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

async function farbeWie(ziel: Locator, variable: '--gefahr' | '--haupt' | '--leise'): Promise<boolean> {
  return ziel.evaluate((element, name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const soll = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(element).color === soll;
  }, variable);
}

async function flaecheWie(ziel: Locator, variable: '--gefahr' | '--flaeche-2' | '--fortschritt'): Promise<boolean> {
  return ziel.evaluate((element, name) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const soll = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(element).backgroundColor === soll;
  }, variable);
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

function setzeStufenVerlust(attributId: number, abzug: number): () => void {
  const datei = weltDatei();
  const db = new DatabaseSync(datei);
  const minus = db
    .prepare(`INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`)
    .run(attributId, -abzug, '2098-01-01T00:00:00.000Z');
  db.close();
  const id = Number(minus.lastInsertRowid);
  return () => {
    const weg = new DatabaseSync(datei);
    weg.prepare('DELETE FROM xp_ereignisse WHERE id = ?').run(id);
    weg.close();
  };
}

async function pruefeStufenVerlust(seite: Page, werte: AttributZeile[]): Promise<void> {
  const ziel = werte
    .map((attribut) => ({
      attribut,
      info: berechneLevel(attribut.level.xpGesamt, LEVEL_KURVEN[attribut.typ]),
    }))
    .find((eintrag) => eintrag.info.level >= 1);
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }
  const zurueck = setzeStufenVerlust(ziel.attribut.id, ziel.info.xpImLevel + 1);
  try {
    await seite.goto('/');
    const kopf = seite.getByRole('button', { name: 'Werte', exact: true });
    await expect(kopf).toBeVisible();
    if ((await kopf.getAttribute('aria-expanded')) !== 'true') {
      await kopf.click();
    }
    const bereich = seite.locator('section').filter({ has: seite.getByRole('heading', { name: 'Werte', exact: true }) });
    await alleAnzeigen(bereich);
    const daten = await uebersicht(seite);
    const neu = [...daten.attribute, ...daten.status].find((attribut) => attribut.id === ziel.attribut.id);
    expect(neu).toBeTruthy();
    if (!neu) {
      return;
    }
    const kurve: LevelKurve = LEVEL_KURVEN[neu.typ];
    const balken = verlustBalken(neu.level.xpGesamt, neu.hoechstXp, kurve);
    expect(balken.verloreneLevel).toBeGreaterThan(0);
    const zeile = bereich
      .getByText(neu.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const verlust = zeile.locator('.balken-verlust');
    await expect(verlust).toBeVisible();
    const anteil = await verlust.evaluate((element) => {
      const spur = element.parentElement?.getBoundingClientRect().width ?? 1;
      return element.getBoundingClientRect().width / spur;
    });
    expect(Math.abs(anteil - balken.verlustBis)).toBeLessThan(0.08);
  } finally {
    zurueck();
  }
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

  expect(erwarteteUrsachen).toBeGreaterThan(0);
  await expect(bereich.getByRole('link', { name: 'Details' })).toHaveCount(0);
  await expect(bereich.getByText('zu niedrig', { exact: true })).toHaveCount(0);
  const hinweise = bereich.locator('[data-zustand="zu-niedrig"]');
  await expect(hinweise).toHaveCount(erwarteteUrsachen);
  for (let index = 0; index < erwarteteUrsachen; index += 1) {
    const hinweis = hinweise.nth(index);
    await expect(hinweis.locator('span[aria-hidden="true"]')).toHaveText('⚠');
    const text = (await hinweis.innerText()).replace(/\s+/g, ' ').trim();
    if (text.includes('Lvl zu niedrig')) {
      await expect(hinweis.getByRole('button')).toHaveCount(0);
    } else {
      await expect(hinweis.getByRole('button', { name: 'Lvl zu niedrig' })).toBeVisible();
    }
  }
  const ursache = werte.find((attribut) => bild.ursachen.includes(attribut.id));
  expect(ursache).toBeTruthy();
  if (ursache) {
    const ursacheZeile = bereich
      .getByText(ursache.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const stufe = ursacheZeile.getByText(`Lvl ${ursache.level.level}`, { exact: true });
    await expect(stufe).toHaveClass(/text-gefahr/);
    await expect(stufe).not.toHaveClass(/text-leise/);
    expect(await farbeWie(stufe, '--gefahr')).toBe(true);
    expect(await farbeWie(stufe, '--leise')).toBe(false);
    const zustand = ursacheZeile.locator('[data-zustand="zu-niedrig"]');
    const zeichen = zustand.locator('span[aria-hidden="true"]');
    await expect(zeichen).toHaveText('⚠');
    await expect(zeichen).toHaveClass(/text-gefahr/);
    await expect(zeichen).not.toHaveClass(/bg-gefahr|text-haupt/);
    expect(await farbeWie(zeichen, '--gefahr')).toBe(true);
    expect(await farbeWie(zeichen, '--haupt')).toBe(false);
    expect(await flaecheWie(zeichen, '--gefahr')).toBe(false);
    const label = zustand.getByText('Lvl zu niedrig', { exact: true });
    if ((await label.count()) > 0) {
      await expect(label).toHaveClass(/text-gefahr/);
      expect(await farbeWie(label, '--gefahr')).toBe(true);
    }
    const nameKasten = await ursacheZeile.getByText(ursache.name, { exact: true }).boundingBox();
    const hinweisKasten = await zustand.boundingBox();
    const balkenKasten = await ursacheZeile.locator('.balken').boundingBox();
    const stufeKasten = await stufe.boundingBox();
    expect(nameKasten && hinweisKasten && balkenKasten && stufeKasten).toBeTruthy();
    if (nameKasten && hinweisKasten && balkenKasten && stufeKasten) {
      expect(Math.abs(hinweisKasten.y + hinweisKasten.height / 2 - (nameKasten.y + nameKasten.height / 2))).toBeLessThan(8);
      expect(hinweisKasten.x).toBeGreaterThanOrEqual(nameKasten.x + nameKasten.width - 2);
      expect(stufeKasten.x).toBeGreaterThan(hinweisKasten.x);
      expect(hinweisKasten.height).toBeLessThanOrEqual(24);
      expect(hinweisKasten.y + hinweisKasten.height).toBeLessThanOrEqual(balkenKasten.y + 1);
    }
  }
  if (bild.allgemein !== null || bild.jeZiel.some((eintrag) => ids.has(eintrag.zielId))) {
    const abzug = bereich.locator('[data-abzug="ziel"]').first();
    await expect(abzug).toBeVisible();
    await expect(abzug).toHaveClass(/text-gefahr/);
    await expect(abzug).not.toHaveClass(/text-haupt/);
    expect(await farbeWie(abzug, '--gefahr')).toBe(true);
    expect(await farbeWie(abzug, '--haupt')).toBe(false);
  }
  const ruhig = werte.find((attribut) => !bild.ursachen.includes(attribut.id));
  if (ruhig) {
    const ruhigeZeile = bereich
      .getByText(ruhig.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const ruhigeStufe = ruhigeZeile.getByText(`Lvl ${ruhig.level.level}`, { exact: true });
    await expect(ruhigeStufe).toHaveClass(/text-leise/);
    await expect(ruhigeStufe).not.toHaveClass(/text-gefahr/);
    await expect(ruhigeZeile.locator('.balken')).not.toHaveClass(/text-gefahr|bg-gefahr|border-gefahr/);
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
  if (mehrereLevel === 0) {
    await pruefeStufenVerlust(seite, werte);
  }
  if (einLevel === 0) {
    await pruefeGleichenLevel(seite, werte);
  }
  await bereich.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `tmp-test/balken-boss-dialog/${info.project.name}-attribut-balken.png` });
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
  await expect(karte).not.toHaveClass(/text-gefahr|bg-gefahr|border-gefahr/);
  await expect(karte.locator('[class*="bg-gefahr"]')).toHaveCount(1);
  await expect(karte.locator('[data-schnell-streifen]')).toHaveClass(/bg-gefahr/);
  const titelRot = await karte.locator('.zeile-titel').evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--gefahr)';
    document.body.append(probe);
    const gefahr = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(element).color === gefahr;
  });
  expect(titelRot).toBe(false);
  await karte.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `tmp-test/balken-boss-dialog/${info.project.name}-chronik-boss.png` });

  await karte.click();
  const dialog = seite.getByRole('dialog');
  await expect(dialog.locator('[class*="gefahr"]')).toHaveCount(1);
  await expect(dialog.locator('.lucide-swords')).toHaveClass(/text-gefahr/);
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
  await seite.screenshot({ path: `tmp-test/balken-boss-dialog/${info.project.name}-chronik-boss-detail.png` });
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
    const mitProjekt = [...daten.vorhaben, ...daten.bosse].filter((eintrag) => eintrag.projektId !== null);
    return mitProjekt.find((eintrag) => !eintrag.titel.startsWith('Prüfboss')) ?? mitProjekt[0] ?? null;
  });
  expect(ziel?.projektId).toBeTruthy();
  if (!ziel?.projektId) {
    return;
  }

  await seite.goto(`/projekte/${ziel.projektId}`);
  const zeile = seite.locator('[data-schnell]').filter({ hasText: ziel.titel }).first();
  await expect(zeile).toBeVisible();
  await zeile.getByRole('button', { name: `Aktionen für ${ziel.titel}`, exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Umbenennen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Umbenennen', exact: true });
  const feld = dialog.getByRole('textbox', { name: 'Titel' });
  await expect(feld).toHaveValue(ziel.titel);
  await expect(seite.getByRole('dialog', { name: 'Titel ändern' })).toHaveCount(0);
  await expect.poll(async () =>
    feld.evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      return kasten.top >= 0 && kasten.bottom <= window.innerHeight + 1;
    }),
  ).toBe(true);
  await ohneSeitlichenUeberlauf(seite);
  await seite.screenshot({ path: `tmp-test/balken-boss-dialog/${info.project.name}-titel-dialog.png` });
  await seite.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(zeile.getByText(ziel.titel, { exact: true })).toBeVisible();
}

test('Balken, besiegte Bosse und Titel-Dialog', async ({ page }, testInfo) => {
  verbieteBrowserFenster(page);
  await anmelden(page);
  await test.step('Attribut-Balken', async () => pruefeBalken(page, testInfo));
  await test.step('Erschöpfung', async () => {
    await page.goto('/koennen');
    const koennen = page.locator('main');
    await expect(koennen.getByText('zu niedrig', { exact: true })).toHaveCount(0);
    const hinweis = koennen.locator('[data-zustand="zu-niedrig"]').first();
    await expect(hinweis).toBeVisible();
    const hinweisText = (await hinweis.innerText()).replace(/\s+/g, ' ').trim();
    if (hinweisText.includes('Lvl zu niedrig')) {
      await expect(hinweis.getByRole('button')).toHaveCount(0);
    } else {
      await expect(hinweis.getByRole('button', { name: 'Lvl zu niedrig' })).toBeVisible();
    }
    const hinweisZahl = await koennen.locator('[data-zustand="zu-niedrig"]').count();
    const roteStufen = koennen
      .locator('.attributzeile')
      .filter({ has: page.locator('[data-zustand="zu-niedrig"]') })
      .locator('span.text-gefahr', { hasText: /^Lvl \d/ });
    await expect(roteStufen).toHaveCount(hinweisZahl);
    const zeile = hinweis.locator('xpath=ancestor::div[contains(@class,"attributzeile")][1]');
    const stufe = zeile.locator('span', { hasText: /^Lvl \d/ }).last();
    await expect(stufe).toHaveClass(/text-gefahr/);
    await expect(stufe).not.toHaveClass(/text-leise/);
    expect(await farbeWie(stufe, '--gefahr')).toBe(true);
    const zeichen = hinweis.locator('span[aria-hidden="true"]');
    await expect(zeichen).toHaveClass(/text-gefahr/);
    await expect(zeichen).not.toHaveClass(/bg-gefahr|text-haupt/);
    expect(await farbeWie(zeichen, '--gefahr')).toBe(true);
    expect(await flaecheWie(zeichen, '--gefahr')).toBe(false);
    if (hinweisText.includes('Lvl zu niedrig')) {
      await expect(hinweis.getByText('Lvl zu niedrig', { exact: true })).toHaveClass(/text-gefahr/);
    }
    const abzug = zeile.locator('[data-abzug="ziel"]');
    if ((await abzug.count()) > 0) {
      await expect(abzug).toHaveClass(/text-gefahr/);
      await expect(abzug).not.toHaveClass(/text-haupt/);
    }
    const normal = koennen.locator('.attributzeile').filter({ hasNot: page.locator('[data-zustand="zu-niedrig"]') });
    if ((await normal.count()) > 0) {
      const normaleStufe = normal.first().locator('span', { hasText: /^Lvl \d/ }).last();
      await expect(normaleStufe).toHaveClass(/text-leise/);
      await expect(normaleStufe).not.toHaveClass(/text-gefahr/);
      await expect(normal.first().locator('.balken')).not.toHaveClass(/text-gefahr|bg-gefahr|border-gefahr/);
    }
    await zeile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-test/balken-boss-dialog/${testInfo.project.name}-koennen-stufe.png` });
    const oeffnen = zeile.locator('[data-zeile] > button');
    const name = await oeffnen.getAttribute('aria-label');
    expect(name).toBeTruthy();
    await oeffnen.click();
    const dialog = page.getByRole('dialog', { name: name ?? '', exact: true });
    await expect(dialog.getByRole('switch', { name: 'Zu niedrig senkt XP anderer Attribute' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();
  });
  await test.step('Titel', async () => pruefeTitel(page, testInfo));
  await test.step('Chronik', async () => pruefeChronik(page, testInfo));
});

async function wochenZurueckBisVerlust(seite: Page): Promise<number | null> {
  return seite.evaluate(async () => {
    function schluesselVon(datum: Date): string {
      const monat = String(datum.getMonth() + 1).padStart(2, '0');
      const tag = String(datum.getDate()).padStart(2, '0');
      return `${datum.getFullYear()}-${monat}-${tag}`;
    }
    function montagVon(datum: Date): string {
      const beginn = new Date(datum);
      const tage = (beginn.getDay() + 6) % 7;
      beginn.setDate(beginn.getDate() - tage);
      return schluesselVon(beginn);
    }
    function zurueck(schluessel: string): string {
      const teile = schluessel.split('-').map(Number);
      const datum = new Date(teile[0] ?? 0, (teile[1] ?? 1) - 1, teile[2] ?? 1);
      datum.setDate(datum.getDate() - 7);
      return schluesselVon(datum);
    }
    let woche = montagVon(new Date());
    for (let schritt = 0; schritt < 40; schritt += 1) {
      const antwort = await fetch(`/api/rueckblick?woche=${woche}`);
      if (!antwort.ok) {
        return null;
      }
      const daten = (await antwort.json()) as { woche: string; attribute: { xp: number }[] };
      if (daten.attribute.some((eintrag) => Number(eintrag.xp) < 0)) {
        return schritt;
      }
      woche = zurueck(daten.woche);
    }
    return null;
  });
}

const BALKEN_SICHTBAR = 6;
const VERLUST_XP = -100_000;

async function aktiveAttributIds(seite: Page): Promise<number[]> {
  return seite.evaluate(async () => {
    const einstellungen = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as {
      funktionen: { koennen?: boolean; status?: boolean };
    };
    const daten = (await fetch('/api/uebersicht').then((antwort) => antwort.json())) as {
      attribute: { id: number }[];
      status: { id: number }[];
    };
    const ids: number[] = [];
    if (einstellungen.funktionen.koennen === true) {
      ids.push(...daten.attribute.map((eintrag) => eintrag.id));
    }
    if (einstellungen.funktionen.status === true) {
      ids.push(...daten.status.map((eintrag) => eintrag.id));
    }
    return ids;
  });
}

function setzeVerstecktenVerlust(ids: number[]): () => void {
  if (ids.length === 0) {
    throw new Error('Kein aktives Attribut für den Rückblick.');
  }
  const datei = weltDatei();
  const db = new DatabaseSync(datei);
  const jetzt = new Date().toISOString();
  const einfuegen = db.prepare(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
  );
  const zeilen: number[] = [];
  try {
    const letzte = ids.length - 1;
    ids.forEach((id, index) => {
      zeilen.push(Number(einfuegen.run(id, index === letzte ? VERLUST_XP : 50, jetzt).lastInsertRowid));
    });
  } finally {
    db.close();
  }
  return () => {
    const weg = new DatabaseSync(datei);
    try {
      for (const id of zeilen) {
        weg.prepare('DELETE FROM xp_ereignisse WHERE id = ?').run(id);
      }
    } finally {
      weg.close();
    }
  };
}

test('Rückblick zeigt verlorenes XP in der Hauptfarbe', async ({ page }, testInfo) => {
  verbieteBrowserFenster(page);
  await anmelden(page);
  const uhr = await page.request.post('/api/test/heute', { data: { datum: null } });
  expect(uhr.ok()).toBe(true);
  const ids = await aktiveAttributIds(page);
  expect(ids.length).toBeGreaterThan(BALKEN_SICHTBAR);
  const raeume = setzeVerstecktenVerlust(ids);
  try {
    await page.goto('/rueckblick');
    await expect(page.locator('main h1')).toHaveText('Rückblick');
    const schritte = await wochenZurueckBisVerlust(page);
    expect(schritte).toBe(0);
    const titel = page.locator('main p.zahl').first();
    await expect(titel).toBeVisible();
    const bereich = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Veränderung', exact: true }) });
    await expect(bereich.getByRole('heading', { name: 'Veränderung', exact: true })).toBeVisible();
    await alleAnzeigen(bereich);
    const verlust = bereich.locator('span.zahl', { hasText: /^\u2212/ });
    await expect(verlust.first()).toBeVisible();
    await expect(verlust.first()).toHaveClass(/text-haupt/);
    await expect(verlust.first()).not.toHaveClass(/text-gefahr/);
    expect(await farbeWie(verlust.first(), '--haupt')).toBe(true);
    expect(await farbeWie(verlust.first(), '--gefahr')).toBe(false);
    const plus = bereich.locator('span.zahl', { hasText: /^\+/ }).first();
    await expect(plus).toHaveClass(/text-haupt/);
    const fuellung = bereich.locator('.h-2 > div').first();
    await expect(fuellung).toBeVisible();
    expect(await flaecheWie(fuellung, '--fortschritt')).toBe(true);
    await expect(bereich.locator('.text-gefahr')).toHaveCount(0);
    await verlust.first().scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/balken-boss-dialog/${testInfo.project.name}-rueckblick-verlust.png` });
  } finally {
    raeume();
  }
});
