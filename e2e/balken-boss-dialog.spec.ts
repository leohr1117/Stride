import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { erschoepfungsBild } from '../shared/spiel/belastung.ts';
import { LEVEL_KURVEN, berechneLevel, verlustBalken, type LevelKurve } from '../shared/spiel/level.ts';

interface AttributZeile {
  id: number;
  name: string;
  typ: 'attribut' | 'status';
  hoechstXp: number;
  level: { xpGesamt: number };
}

interface UebersichtDaten {
  attribute: AttributZeile[];
  status: AttributZeile[];
  erschoepfungen: { attributId: number; faktor: number; zielId: number | null }[];
}

interface LaufendZeile {
  id: number;
  titel: string;
  projektId: number | null;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

function verbieteBrowserFenster(seite: Page): void {
  seite.on('dialog', (dialog) => {
    const art = dialog.type();
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${art}`);
  });
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function uebersicht(seite: Page): Promise<UebersichtDaten> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/uebersicht');
    if (!antwort.ok) {
      throw new Error('Übersicht nicht geladen');
    }
    return antwort.json() as Promise<UebersichtDaten>;
  });
}

async function alleAnzeigen(bereich: Locator): Promise<void> {
  const knopf = bereich.getByRole('button', { name: /Alle anzeigen/ });
  const anzahl = await knopf.count();
  for (let index = 0; index < anzahl; index += 1) {
    await bereich.getByRole('button', { name: /Alle anzeigen/ }).first().click();
  }
}

const PROBE_ZEIT = ['2099-01-01T00:00:00.000Z', '2099-01-01T00:00:01.000Z'] as const;

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt. Der Standard ist die Kopie aus dem Playwright-Setup.');
  }
  return verweigereEchteDatenbank(datei);
}

function setzeGleichenLevel(attributId: number, betrag: number): () => void {
  const datei = weltDatei();
  const db = new DatabaseSync(datei);
  const einfuegen = db.prepare(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
  );
  const plus = einfuegen.run(attributId, betrag, PROBE_ZEIT[0]);
  const minus = einfuegen.run(attributId, -betrag, PROBE_ZEIT[1]);
  db.close();
  const ids = [Number(plus.lastInsertRowid), Number(minus.lastInsertRowid)];
  return () => {
    const weg = new DatabaseSync(datei);
    weg.prepare('DELETE FROM xp_ereignisse WHERE id = ? OR id = ?').run(ids[0], ids[1]);
    weg.close();
  };
}

async function pruefeGleichenLevel(seite: Page, werte: AttributZeile[]): Promise<void> {
  const kandidat = werte
    .map((attribut) => {
      const kurve = LEVEL_KURVEN[attribut.typ];
      const info = berechneLevel(attribut.level.xpGesamt, kurve);
      const balken = verlustBalken(attribut.level.xpGesamt, attribut.hoechstXp, kurve);
      const platz = info.xpFuerNaechstes - info.xpImLevel;
      return { attribut, platz, hatVerlust: balken.verlustBis - balken.stand > 0.005 };
    })
    .filter((eintrag) => !eintrag.hatVerlust && eintrag.platz > 2)
    .sort((a, b) => b.platz - a.platz)[0];
  expect(kandidat).toBeTruthy();
  if (!kandidat) {
    return;
  }
  const betrag = Math.min(10, kandidat.platz - 1);
  const zurueck = setzeGleichenLevel(kandidat.attribut.id, betrag);
  try {
    await seite.goto('/');
    const kopf = seite.getByRole('button', { name: 'Werte', exact: true });
    if ((await kopf.getAttribute('aria-expanded')) !== 'true') {
      await kopf.click();
    }
    const bereich = seite.locator('section').filter({ has: seite.getByRole('heading', { name: 'Werte', exact: true }) });
    await alleAnzeigen(bereich);
    const daten = await uebersicht(seite);
    const neu = [...daten.attribute, ...daten.status].find((attribut) => attribut.id === kandidat.attribut.id);
    expect(neu).toBeTruthy();
    if (!neu) {
      return;
    }
    const kurve: LevelKurve = LEVEL_KURVEN[neu.typ];
    const balken = verlustBalken(neu.level.xpGesamt, neu.hoechstXp, kurve);
    expect(balken.verloreneLevel).toBe(0);
    expect(balken.verlustBis - balken.stand).toBeGreaterThan(0.005);
    const zeile = bereich.getByText(neu.name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const verlust = zeile.locator('.balken-verlust');
    await expect(verlust).toBeVisible();
    const anteil = await verlust.evaluate((element) => {
      const spur = element.parentElement?.getBoundingClientRect().width ?? 1;
      return element.getBoundingClientRect().width / spur;
    });
    expect(Math.abs(anteil - balken.verlustBis)).toBeLessThan(0.08);
    expect(anteil).toBeLessThan(0.98);
  } finally {
    zurueck();
  }
}

async function pruefeBalken(seite: Page, info: TestInfo): Promise<void> {
  const daten = await uebersicht(seite);
  const werte = [...daten.attribute, ...daten.status];
  const ids = new Set(werte.map((attribut) => attribut.id));
  const bild = erschoepfungsBild(
    daten.erschoepfungen.map((eintrag) => ({ quelleId: eintrag.attributId, zielId: eintrag.zielId, faktor: eintrag.faktor })),
  );
  const erwarteteUrsachen = bild.ursachen.filter((id) => ids.has(id)).length;

  await seite.goto('/');
  const kopf = seite.getByRole('button', { name: 'Werte', exact: true });
  await expect(kopf).toBeVisible();
  if ((await kopf.getAttribute('aria-expanded')) !== 'true') {
    await kopf.click();
  }
  const bereich = seite.locator('section').filter({ has: seite.getByRole('heading', { name: 'Werte', exact: true }) });
  await expect(bereich.getByRole('heading', { name: 'Können', exact: true })).toBeVisible();
  await alleAnzeigen(bereich);

  const breiten = await bereich.locator('.balken').evaluateAll((elemente) =>
    elemente.map((element) => Math.round(element.getBoundingClientRect().width)),
  );
  expect(breiten.length).toBeGreaterThan(1);
  expect(new Set(breiten).size).toBe(1);
  expect(breiten[0]).toBeGreaterThan(24);

  expect(erwarteteUrsachen).toBeGreaterThan(1);
  await expect(bereich.getByRole('link', { name: 'Details' })).toHaveCount(0);
  await expect(bereich.getByText('zu niedrig', { exact: true })).toHaveCount(0);
  const hinweise = bereich.getByRole('button', { name: 'Lvl zu niedrig' });
  await expect(hinweise).toHaveCount(erwarteteUrsachen);
  await hinweise.nth(0).click();
  await expect(seite.getByRole('tooltip')).toHaveText('Lvl zu niedrig');
  await seite.keyboard.press('Escape');
  await expect(seite.getByRole('tooltip')).toHaveCount(0);
  await hinweise.nth(1).click();
  await expect(seite.getByRole('tooltip')).toHaveText('Lvl zu niedrig');
  await seite.keyboard.press('Escape');
  const ursache = werte.find((attribut) => bild.ursachen.includes(attribut.id));
  expect(ursache).toBeTruthy();
  if (ursache) {
    const ursacheZeile = bereich
      .getByText(ursache.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    await expect(ursacheZeile.getByText(`Lvl ${ursache.level.level}`, { exact: true })).toHaveClass(/text-gefahr/);
    const nameKasten = await ursacheZeile.getByText(ursache.name, { exact: true }).boundingBox();
    const iconKasten = await ursacheZeile.getByRole('button', { name: 'Lvl zu niedrig' }).boundingBox();
    const balkenKasten = await ursacheZeile.locator('.balken').boundingBox();
    expect(nameKasten && iconKasten && balkenKasten).toBeTruthy();
    if (nameKasten && iconKasten && balkenKasten) {
      expect(iconKasten.x).toBeGreaterThanOrEqual(nameKasten.x + nameKasten.width - 1);
      expect(iconKasten.x).toBeLessThanOrEqual(nameKasten.x + nameKasten.width + 16);
      expect(iconKasten.y + iconKasten.height / 2).toBeLessThan(balkenKasten.y);
    }
  }
  if (bild.allgemein !== null || bild.jeZiel.some((eintrag) => ids.has(eintrag.zielId))) {
    await expect(bereich.getByText(/−\d+ % XP/).first()).toBeVisible();
  }

  let einLevel = 0;
  let mehrereLevel = 0;
  for (const attribut of werte) {
    const kurve: LevelKurve = LEVEL_KURVEN[attribut.typ];
    const balken = verlustBalken(attribut.level.xpGesamt, attribut.hoechstXp, kurve);
    if (balken.verlustBis - balken.stand <= 0.005) {
      continue;
    }
    if (balken.verloreneLevel > 0) {
      mehrereLevel += 1;
    } else {
      einLevel += 1;
    }
    const zeile = bereich.getByText(attribut.name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const verlust = zeile.locator('.balken-verlust');
    await expect(verlust).toBeVisible();
    const anteil = await verlust.evaluate((element) => {
      const spur = element.parentElement?.getBoundingClientRect().width ?? 1;
      return element.getBoundingClientRect().width / spur;
    });
    expect(Math.abs(anteil - balken.verlustBis)).toBeLessThan(0.08);
  }
  expect(mehrereLevel).toBeGreaterThan(0);
  if (einLevel === 0) {
    await pruefeGleichenLevel(seite, werte);
  }
  await bereich.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `e2e/bilder/${info.project.name}-attribut-balken.png` });
}

async function pruefeChronik(seite: Page, info: TestInfo): Promise<void> {
  const boss = await seite.evaluate(async () => {
    let cursor = '';
    for (let seiteNummer = 0; seiteNummer < 20; seiteNummer += 1) {
      const parameter = new URLSearchParams({ nurMeilensteine: 'true' });
      if (cursor) {
        parameter.set('cursor', cursor);
      }
      const antwort = await fetch(`/api/eintraege?${parameter}`);
      if (!antwort.ok) {
        throw new Error('Chronik nicht geladen');
      }
      const daten = (await antwort.json()) as {
        eintraege: { typ: string; eintrag?: { bossSieg: { level: number; beute: number } | null } }[];
        naechsterCursor: string | null;
      };
      const treffer = daten.eintraege.find((eintrag) => eintrag.typ === 'eintrag' && eintrag.eintrag?.bossSieg);
      if (treffer?.eintrag?.bossSieg) {
        return treffer.eintrag.bossSieg;
      }
      if (!daten.naechsterCursor) {
        return null;
      }
      cursor = daten.naechsterCursor;
    }
    return null;
  });
  expect(boss).toBeTruthy();

  await seite.goto('/chronik');
  const karte = seite.locator('.boss-sieg').first();
  const mehr = seite.getByRole('button', { name: 'Ältere Einträge laden' });
  for (let versuch = 0; versuch < 15 && (await karte.count()) === 0; versuch += 1) {
    if (!(await mehr.isVisible())) {
      await seite.locator('section button').first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
      if ((await karte.count()) > 0 || !(await mehr.isVisible())) {
        break;
      }
    }
    await Promise.all([
      seite.waitForResponse((antwort) => antwort.url().includes('/api/eintraege') && antwort.ok()),
      mehr.click(),
    ]);
  }
  await expect(karte).toBeVisible();
  await expect(karte).toHaveClass(/text-gefahr|border-gefahr/);
  await karte.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `e2e/bilder/${info.project.name}-chronik-boss.png` });

  await karte.click();
  const dialog = seite.getByRole('dialog');
  await expect(dialog.getByText(/Level \d/)).toBeVisible();
  await expect(dialog.getByText(/Kampf-XP/)).toBeVisible();
  if (boss && boss.beute > 0) {
    await expect(dialog.getByText(/XP Siegbonus/)).toBeVisible();
  }
  await expect(dialog.getByText('Ja', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Nein', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Meilenstein', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Beute', { exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `e2e/bilder/${info.project.name}-chronik-boss-detail.png` });
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
}

async function pruefeTitel(seite: Page, info: TestInfo): Promise<void> {
  const ziel = await seite.evaluate(async () => {
    const antwort = await fetch('/api/laufend');
    if (!antwort.ok) {
      throw new Error('Laufend nicht geladen');
    }
    const daten = (await antwort.json()) as { vorhaben: LaufendZeile[]; bosse: LaufendZeile[] };
    return [...daten.vorhaben, ...daten.bosse].find((eintrag) => eintrag.projektId !== null) ?? null;
  });
  expect(ziel?.projektId).toBeTruthy();
  if (!ziel?.projektId) {
    return;
  }

  await seite.goto(`/projekte/${ziel.projektId}`);
  const knopf = seite.getByRole('button', { name: ziel.titel, exact: true });
  await expect(knopf).toBeVisible();
  await knopf.click();
  const feld = seite.getByRole('textbox', { name: 'Titel' });
  await expect(feld).toHaveValue(ziel.titel);
  await expect(seite.getByRole('dialog', { name: 'Titel ändern' })).toHaveCount(0);
  await expect.poll(async () =>
    feld.evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      return kasten.top >= 0 && kasten.bottom <= window.innerHeight + 1;
    }),
  ).toBe(true);
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `e2e/bilder/${info.project.name}-titel-dialog.png` });
  await feld.fill('');
  await seite.keyboard.press('Escape');
  await expect(feld).toHaveCount(0);
  await expect(seite.getByRole('button', { name: ziel.titel, exact: true })).toBeVisible();
}

test('Balken, besiegte Bosse und Titel-Dialog', async ({ page }, testInfo) => {
  verbieteBrowserFenster(page);
  await anmelden(page);
  await test.step('Attribut-Balken', async () => pruefeBalken(page, testInfo));
  await test.step('Erschöpfung', async () => {
    await page.goto('/charakter');
    const koennen = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Können', exact: true }) });
    await expect(koennen.getByText('zu niedrig', { exact: true })).toHaveCount(0);
    const hinweis = koennen.getByRole('button', { name: 'Lvl zu niedrig' }).first();
    await expect(hinweis).toBeVisible();
    await hinweis.click();
    await expect(page.getByRole('tooltip')).toHaveText('Lvl zu niedrig');
    await page.keyboard.press('Escape');
    await expect(koennen.locator('.text-gefahr', { hasText: /^Lvl / }).first()).toBeVisible();
    const knopf = koennen.getByRole('button', { name: 'Geist bearbeiten' });
    if ((await knopf.count()) === 0) {
      await koennen.getByRole('button', { name: /Alle anzeigen/ }).click();
    }
    await knopf.click();
    const dialog = page.getByRole('dialog', { name: 'Geist bearbeiten' });
    await expect(dialog.getByRole('switch', { name: 'Zu niedrig senkt XP anderer Attribute' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();
  });
  await test.step('Titel', async () => pruefeTitel(page, testInfo));
  await test.step('Chronik', async () => pruefeChronik(page, testInfo));
});
