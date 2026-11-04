import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { abzugNebenNamen, erschoepfungsBild } from '../shared/spiel/belastung.ts';

interface ZielRef {
  art: string;
  id: number;
}

interface ProjektZeile {
  id: number;
  name: string;
  aktiv: boolean;
  archiviert: boolean;
  investition: boolean;
  investitionZiel: ZielRef | null;
  investitionRessourcen: boolean;
  investitionGroesse: number;
  geschafftAm: string | null;
}

interface AttributZeile {
  id: number;
  name: string;
  level: { level: number };
}

interface UebersichtDaten {
  attribute: AttributZeile[];
  status: AttributZeile[];
  erschoepfungen: { attributId: number; faktor: number; zielId: number | null }[];
}

interface EinstellungenZeile {
  funktionen: Record<string, boolean>;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function projekte(seite: Page): Promise<ProjektZeile[]> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    if (!antwort.ok) {
      throw new Error('Ziele nicht geladen');
    }
    const daten = (await antwort.json()) as { projekte: ProjektZeile[] };
    return daten.projekte;
  });
}

async function stelleProjekt(seite: Page, id: number, daten: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async ({ projektId, koerper }) => {
    const antwort = await fetch(`/api/projekte/${projektId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return antwort.ok;
  }, { projektId: id, koerper: daten });
  expect(ok).toBe(true);
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

function abzugText(prozent: number): string {
  return `−${prozent} % XP`;
}

async function pruefeAbzugNebenNamen(zeile: Locator, name: string, prozent: number): Promise<void> {
  const nameKasten = await zeile.getByText(name, { exact: true }).boundingBox();
  const abzugKasten = await zeile.getByText(abzugText(prozent), { exact: true }).boundingBox();
  const balkenKasten = await zeile.locator('.balken').boundingBox();
  expect(nameKasten && abzugKasten && balkenKasten).toBeTruthy();
  if (!nameKasten || !abzugKasten || !balkenKasten) {
    return;
  }
  expect(abzugKasten.x).toBeGreaterThanOrEqual(nameKasten.x + nameKasten.width - 2);
  expect(abzugKasten.x).toBeLessThanOrEqual(nameKasten.x + nameKasten.width + 48);
  expect(Math.abs(abzugKasten.y + abzugKasten.height / 2 - (nameKasten.y + nameKasten.height / 2))).toBeLessThan(14);
  expect(abzugKasten.y + abzugKasten.height / 2).toBeLessThan(balkenKasten.y);
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    const art = dialog.type();
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${art}`);
  });
  await anmelden(page);
});

test('Projekt abschließen aktiviert die Investition und lässt sich öffnen', async ({ page }, testInfo) => {
  const liste = await projekte(page);
  const ziel = liste.filter((projekt) => projekt.aktiv).sort((a, b) => a.name.localeCompare(b.name, 'de'))[0];
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }

  try {
    await stelleProjekt(page, ziel.id, {
      investition: true,
      investitionZiel: { art: 'projekt', id: ziel.id },
      investitionGroesse: 1,
      geschafft: true,
    });
    await page.goto(`/projekte/${ziel.id}`);
    await expect(page.getByRole('heading', { name: ziel.name, exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wieder öffnen', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abschließen', exact: true })).toHaveCount(0);
    const zeile = page.locator('#projekt-investition');
    await expect(zeile).toContainText('+10 %');
    const status = zeile.getByText('+10 %', { exact: true });
    expect(await status.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await zeile.getByRole('button', { name: 'Investition', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition' });
    await expect(dialog.getByRole('button', { name: 'Abschließen' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
    await expect(dialog.getByText(/Aktiv ·/)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/ziele');
    const projektZeile = page.locator('[data-zeile]').filter({ has: page.locator(`a[href="/projekte/${ziel.id}"]`) });
    const marke = projektZeile.locator('.zeile-neben');
    await expect(marke).toBeVisible();
    await expect(marke).toHaveText(/^Abgeschlossen · /);
    await expect(marke).toHaveClass(/text-leise/);
    const schrift = await marke.evaluate((element) => getComputedStyle(element).fontSize);
    expect(schrift).toBe('13px');
    await expect(projektZeile.locator('.zeile-titel')).toHaveText(ziel.name);
    await expect(projektZeile.locator('.zeile-titel')).not.toContainText('Abgeschlossen');
    await expect(projektZeile).not.toHaveClass(/opacity-50/);
    await page.screenshot({ path: `tmp-test/ziele-erschoepfung/${testInfo.project.name}-liste.png`, fullPage: true });

    await page.goto(`/projekte/${ziel.id}`);
    await page.getByRole('button', { name: 'Wieder öffnen', exact: true }).click();
    const oeffnen = page.getByRole('alertdialog', { name: 'Projekt wieder öffnen?' });
    await expect(oeffnen.getByText('Der Bonus bleibt, und die Investition wird inaktiv.')).toBeVisible();
    await oeffnen.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect(oeffnen).toBeHidden();
    await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toHaveCount(0);
    await expect(zeile).not.toContainText('Aktiv');
    await expect(page.getByRole('button', { name: 'Abschließen', exact: true })).toBeVisible();
    await expect.poll(async () => {
      const stand = (await projekte(page)).find((projekt) => projekt.id === ziel.id);
      return stand?.geschafftAm ?? null;
    }).toBeNull();

    await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
    const frage = page.getByRole('alertdialog', { name: `"${ziel.name}" abschließen?` });
    await expect(frage.getByText('Die Investition wird aktiv.')).toBeVisible();
    await frage.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(frage).toBeHidden();
    await expect.poll(async () => (await projekte(page)).find((projekt) => projekt.id === ziel.id)?.geschafftAm ?? null).toBeNull();

    await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
    const nochmal = page.getByRole('alertdialog', { name: `"${ziel.name}" abschließen?` });
    await nochmal.getByRole('button', { name: 'Abschließen', exact: true }).click();
    await expect(nochmal).toBeHidden();
    await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
    await expect(zeile).toContainText('+10 %');
    await expect.poll(async () => {
      const stand = (await projekte(page)).find((projekt) => projekt.id === ziel.id);
      return stand?.geschafftAm !== null && stand?.investition === true;
    }).toBe(true);
    await page.screenshot({ path: `tmp-test/ziele-erschoepfung/${testInfo.project.name}-projekt.png`, fullPage: true });
  } finally {
    await stelleProjekt(page, ziel.id, {
      investition: ziel.investition,
      investitionZiel: ziel.investitionZiel,
      investitionRessourcen: ziel.investitionRessourcen,
      investitionGroesse: ziel.investitionGroesse,
      geschafft: ziel.geschafftAm !== null,
    });
  }
});

test('Erschöpfung steht neben dem Namen', async ({ page }, testInfo) => {
  const daten = await uebersicht(page);
  const werte = [...daten.attribute, ...daten.status];
  const bild = erschoepfungsBild(
    daten.erschoepfungen.map((eintrag) => ({ quelleId: eintrag.attributId, zielId: eintrag.zielId, faktor: eintrag.faktor })),
  );
  const gezielt = werte
    .map((attribut) => ({ attribut, prozent: abzugNebenNamen(bild, attribut.id) }))
    .filter((eintrag): eintrag is { attribut: AttributZeile; prozent: number } => eintrag.prozent !== null);
  expect(bild.ursachen.length).toBeGreaterThan(0);
  expect(bild.allgemein !== null || gezielt.length > 0).toBe(true);

  await page.goto('/');
  const kopf = page.getByRole('button', { name: 'Werte', exact: true });
  if ((await kopf.getAttribute('aria-expanded')) !== 'true') {
    await kopf.click();
  }
  const bereich = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Werte', exact: true }) });
  await alleAnzeigen(bereich);
  const listen = [
    { titel: 'Können', kennung: 'koennen', werte: daten.attribute },
    { titel: 'Haben', kennung: 'haben', werte: daten.status },
  ];
  for (const liste of listen) {
    const karte = bereich.locator(`[data-werte="${liste.kennung}"]`);
    await expect(karte.locator('[data-abzug="allgemein"]')).toHaveCount(bild.allgemein !== null ? 1 : 0);
    if (bild.allgemein !== null) {
      const abzug = karte.locator('[data-abzug="allgemein"]');
      await expect(abzug).toHaveText(abzugText(bild.allgemein));
      expect(await abzug.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (liste.werte.length > 0) {
        const abzugKasten = await abzug.boundingBox();
        const nameKasten = await karte.getByText(liste.werte[0].name, { exact: true }).boundingBox();
        expect(abzugKasten && nameKasten).toBeTruthy();
        if (abzugKasten && nameKasten) {
          expect(abzugKasten.y + abzugKasten.height).toBeLessThanOrEqual(nameKasten.y + 2);
        }
      }
    }
    const treffer = liste.werte.filter((attribut) => abzugNebenNamen(bild, attribut.id) !== null);
    await expect(karte.locator('[data-abzug="ziel"]')).toHaveCount(treffer.length + (bild.allgemein !== null ? 1 : 0));
  }
  for (const eintrag of gezielt) {
    const zeile = bereich
      .getByText(eintrag.attribut.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    await expect(zeile.locator('[data-abzug="allgemein"]')).toHaveCount(0);
    await expect(zeile.locator('[data-abzug="ziel"]')).toHaveCount(1);
    await pruefeAbzugNebenNamen(zeile, eintrag.attribut.name, eintrag.prozent);
  }
  for (const attribut of werte) {
    if (abzugNebenNamen(bild, attribut.id) !== null) {
      continue;
    }
    const zeile = bereich
      .getByText(attribut.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    await expect(zeile.locator('[data-abzug="ziel"]')).toHaveCount(0);
  }
  const ursache = werte.find((attribut) => bild.ursachen.includes(attribut.id));
  expect(ursache).toBeTruthy();
  if (ursache) {
    const ursacheZeile = bereich
      .getByText(ursache.name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
    const nameKasten = await ursacheZeile.getByText(ursache.name, { exact: true }).boundingBox();
    const hinweis = ursacheZeile.locator('[data-zustand="zu-niedrig"]');
    await expect(hinweis).toContainText('Lvl zu niedrig');
    await expect(hinweis.locator('span[aria-hidden="true"]')).toHaveText('⚠');
    const hinweisKasten = await hinweis.boundingBox();
    expect(nameKasten && hinweisKasten).toBeTruthy();
    if (nameKasten && hinweisKasten) {
      expect(hinweisKasten.y).toBeGreaterThan(nameKasten.y + nameKasten.height / 2);
      expect(Math.abs(hinweisKasten.x - nameKasten.x)).toBeLessThan(16);
    }
  }

  const seiten = [
    { pfad: '/koennen', titel: 'Können', werte: daten.attribute },
    { pfad: '/haben', titel: 'Haben', werte: daten.status },
  ];
  for (const liste of seiten) {
    await page.goto(liste.pfad);
    const abschnitt = page.locator('main');
    await expect(abschnitt.getByRole('heading', { name: liste.titel, exact: true })).toBeVisible();
    const abzug = abschnitt.locator('[data-abzug="allgemein"]');
    await expect(abzug).toHaveCount(bild.allgemein !== null ? 1 : 0);
    if (bild.allgemein !== null && liste.werte[0]) {
      await expect(abzug).toHaveText(abzugText(bild.allgemein));
      const abzugKasten = await abzug.boundingBox();
      const nameKasten = await abschnitt.getByText(liste.werte[0].name, { exact: true }).first().boundingBox();
      expect(abzugKasten && nameKasten).toBeTruthy();
      if (abzugKasten && nameKasten) {
        expect(abzugKasten.y + abzugKasten.height).toBeLessThanOrEqual(nameKasten.y + 2);
      }
    }
  }
  if (gezielt.length > 0) {
    const probe = gezielt[0];
    await page.goto(daten.attribute.some((eintrag) => eintrag.id === probe.attribut.id) ? '/koennen' : '/haben');
    const zeile = page.locator('.attributzeile').filter({ hasText: probe.attribut.name }).first();
    await expect(zeile.locator('[data-abzug="allgemein"]')).toHaveCount(0);
    await pruefeAbzugNebenNamen(zeile, probe.attribut.name, probe.prozent);
  }
  await page.screenshot({ path: `tmp-test/ziele-erschoepfung/${testInfo.project.name}-erschoepfung.png`, fullPage: true });
});

test('Ein Tipp in die Einstellungszeile trifft den Schalter', async ({ page }, testInfo) => {
  const vorher = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error('Einstellungen nicht geladen');
    }
    return antwort.json() as Promise<EinstellungenZeile>;
  });

  try {
    await page.goto('/mehr/funktionen');
    const zeile = page.locator('#funktion-verfallKoennen');
    await zeile.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const info = zeile.getByRole('button', { name: /^Info/ });
    const schalter = zeile.getByRole('switch', { name: 'Verfall Können' });
    await expect(schalter).toBeEnabled();
    const zeileKasten = await zeile.boundingBox();
    const infoKasten = await info.boundingBox();
    expect(zeileKasten && infoKasten).toBeTruthy();
    if (!zeileKasten || !infoKasten) {
      return;
    }
    expect(infoKasten.width).toBeLessThanOrEqual(20);
    expect(infoKasten.height).toBeLessThanOrEqual(20);
    const mitteX = zeileKasten.x + zeileKasten.width / 2;
    const mitteY = zeileKasten.y + zeileKasten.height / 2;
    const trifftInfo =
      mitteX >= infoKasten.x &&
      mitteX <= infoKasten.x + infoKasten.width &&
      mitteY >= infoKasten.y &&
      mitteY <= infoKasten.y + infoKasten.height;
    expect(trifftInfo).toBe(false);
    const getroffen = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return { rolle: element?.getAttribute('role') ?? '', label: element?.getAttribute('aria-label') ?? '' };
    }, { x: mitteX, y: mitteY });
    expect(getroffen.rolle).toBe('switch');
    expect(getroffen.label).toBe('Verfall Können');

    const anfang = await schalter.getAttribute('aria-checked');
    await page.mouse.click(mitteX, mitteY);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(schalter).toHaveAttribute('aria-checked', anfang === 'true' ? 'false' : 'true');

    const nachMitte = await schalter.getAttribute('aria-checked');
    await info.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(schalter).toHaveAttribute('aria-checked', nachMitte ?? '');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.screenshot({ path: `tmp-test/ziele-erschoepfung/${testInfo.project.name}-zeile.png`, fullPage: true });
  } finally {
    await page.evaluate(async (funktionen) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ funktionen }),
      });
    }, vorher.funktionen);
  }
});
