import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { standardVorlage } from '../shared/features/darstellung/paletten.ts';
import type { Stil } from '../shared/features/darstellung/stile.ts';

interface Darstellung {
  stil: Stil;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben?: boolean;
}

const ANSICHT_NAME: Record<Stil, string> = {
  minimal: 'Minimal',
  jade: 'Jade',
  holo: 'Hologramm',
  antik: 'Antik',
};

interface Abstand {
  seite: string;
  label: string;
  breite: number;
  hoehe: number;
  abstand: number;
  luecke: number | null;
  gleicheZeile: boolean;
  deltaY: number | null;
}

let original: Darstellung | null = null;
let spracheVorher: string | null = null;

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
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  spracheVorher = await seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { sprache: string | null };
    return daten.sprache;
  });
  if (spracheVorher === 'de') {
    return;
  }
  const ok = await seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache: 'de' }),
    });
    return antwort.ok;
  });
  expect(ok).toBe(true);
  await seite.reload();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function leseDarstellung(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      glimmen: daten.glimmen,
      eigeneFarben: daten.eigeneFarben,
    };
  });
}

async function speichereDarstellung(seite: Page, daten: Darstellung): Promise<void> {
  const ok = await seite.evaluate(async (körper) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(körper),
    });
    return antwort.ok;
  }, daten);
  expect(ok).toBe(true);
}

async function oeffneGeschlossene(seite: Page): Promise<void> {
  for (let schutz = 0; schutz < 40; schutz += 1) {
    const knopf = seite.locator('button[aria-expanded="false"][aria-labelledby]').first();
    if ((await knopf.count()) === 0) {
      return;
    }
    await knopf.click();
  }
}

async function missAbstaende(seite: Page, name: string): Promise<Abstand[]> {
  return seite.evaluate((seiteName) => {
    const knoepfe = [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Info"], button[aria-label="Hinweis zu den Werten"]',
      ),
    ];
    const ergebnis: Abstand[] = [];
    for (const knopf of knoepfe) {
      const kasten = knopf.getBoundingClientRect();
      if (kasten.width < 2 || kasten.height < 2) {
        continue;
      }
      const huelle = knopf.parentElement;
      if (!huelle) {
        continue;
      }
      const abstand = Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0;
      let zeile: Element = huelle;
      let behaelter = huelle.parentElement;
      if (behaelter && behaelter.childElementCount === 1 && behaelter.previousElementSibling) {
        zeile = behaelter;
        behaelter = behaelter.parentElement;
      }
      let luecke: number | null = null;
      let gleicheZeile = false;
      let deltaY: number | null = null;
      if (behaelter) {
        const bereich = document.createRange();
        bereich.setStart(behaelter, 0);
        bereich.setEndBefore(zeile);
        const iconMitte = kasten.top + kasten.height / 2;
        const rects = [...bereich.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1 && rect.right <= kasten.left + 2);
        const passend = rects
          .map((rect) => ({ rect, dy: Math.abs(rect.top + rect.height / 2 - iconMitte) }))
          .sort((a, b) => a.dy - b.dy)[0];
        if (passend) {
          luecke = kasten.left - passend.rect.right;
          deltaY = iconMitte - (passend.rect.top + passend.rect.height / 2);
          gleicheZeile = passend.dy <= 8;
        }
      }
      ergebnis.push({
        seite: seiteName,
        label: (knopf.closest('h1, h2, h3, label, [role="switch"]')?.textContent ?? knopf.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        breite: kasten.width,
        hoehe: kasten.height,
        abstand,
        luecke,
        gleicheZeile,
        deltaY,
      });
    }
    return ergebnis;
  }, name);
}

function pruefeAbstaende(liste: Abstand[], mindestens: number): void {
  expect(liste.length, liste.map((eintrag) => eintrag.label).join(' | ')).toBeGreaterThanOrEqual(mindestens);
  for (const eintrag of liste) {
    const ort = `${eintrag.seite}: ${eintrag.label}`;
    expect(eintrag.breite, ort).toBeLessThanOrEqual(20);
    expect(eintrag.hoehe, ort).toBeLessThanOrEqual(20);
    expect(eintrag.breite, ort).toBeGreaterThanOrEqual(14);
    expect(eintrag.abstand, ort).toBeGreaterThanOrEqual(5);
    expect(eintrag.abstand, ort).toBeLessThanOrEqual(8);
    if (eintrag.gleicheZeile && eintrag.luecke !== null && eintrag.deltaY !== null) {
      expect(eintrag.luecke, ort).toBeGreaterThanOrEqual(4);
      expect(eintrag.luecke, ort).toBeLessThanOrEqual(12);
      expect(Math.abs(eintrag.deltaY), ort).toBeLessThanOrEqual(4);
    }
  }
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
  original = await leseDarstellung(page);
});

test.afterEach(async ({ page }) => {
  if (original) {
    await speichereDarstellung(page, original);
  }
  if (spracheVorher && spracheVorher !== 'de') {
    await page.evaluate(async (sprache) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprache }),
      });
    }, spracheVorher);
  }
});

test('Darstellung: alle Ansichten, Farben getrennt, Glühen unter Sound', async ({ page }) => {
  await page.goto('/mehr/darstellung/ansicht');
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
  await expect(page.getByText('Weitere Ansichten')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ansicht', exact: true })).toHaveCount(0);

  for (const name of ['Ansichten', 'Farben', 'Standardfarben', 'Eigene Farben']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const name of ['Minimal', 'Jade', 'Hologramm', 'Antik']) {
    await expect(page.locator('button.rounded-xl').filter({ hasText: name })).toBeVisible();
  }
  await expect(page.getByRole('region').first()).toBeVisible();
  const regionen = await page.getByRole('region').evaluateAll((liste) => liste.map((element) => element.getAttribute('aria-label')));
  expect(regionen.every((name) => ['Minimal', 'Jade', 'Hologramm', 'Antik'].includes(name ?? ''))).toBe(true);

  const kartenText = await page
    .locator('section')
    .filter({ has: page.getByRole('switch', { name: 'Glühen', exact: true }) })
    .locator('a[aria-label], [role="switch"]')
    .evaluateAll((liste) => liste.map((element) => element.getAttribute('aria-label')));
  expect(kartenText).toEqual(['Leiste', 'Sound', 'Glühen']);

  await expect(page.getByRole('button', { name: 'Zurücksetzen', exact: true })).toBeVisible();
  const abstaende = await missAbstaende(page, 'darstellung');
  pruefeAbstaende(abstaende, 4);
  await ohneSeitlichenUeberlauf(page);
});

test('Eigene Farben bleiben gespeichert und lassen sich zurücksetzen', async ({ page }) => {
  await page.goto('/mehr/darstellung');
  await expect(page.getByRole('heading', { name: 'Eigene Farben', exact: true })).toBeVisible();
  const vorher = await leseDarstellung(page);
  const ziel = '#ff00aa';
  const eingabe = page.locator('label', { hasText: 'Akzent' }).locator('input[type="color"]');
  const gespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await eingabe.evaluate((element, wert) => {
    const feld = element as HTMLInputElement;
    const setze = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setze?.call(feld, wert);
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    feld.dispatchEvent(new Event('change', { bubbles: true }));
  }, ziel);
  await gespeichert;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Eigene Farben', exact: true })).toBeVisible();
  const nachLaden = await leseDarstellung(page);
  expect(nachLaden.akzent).toBe(ziel);
  expect(nachLaden.primaer).toBe(vorher.primaer);
  expect(nachLaden.hintergrund).toBe(vorher.hintergrund);
  expect(nachLaden.stil).toBe(vorher.stil);

  const dunkel = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const soll = standardVorlage(vorher.stil, dunkel);
  const zurueck = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
  await zurueck;
  const nachReset = await leseDarstellung(page);
  expect(nachReset.primaer).toBe(soll.primaer);
  expect(nachReset.akzent).toBe(soll.akzent);
  expect(nachReset.hintergrund).toBe(soll.hintergrund);
  expect(nachReset.eigeneFarben).toBe(false);
  expect(nachReset.stil).toBe(vorher.stil);
});

async function setzeFarbe(seite: Page, label: string, wert: string): Promise<void> {
  const gespeichert = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await seite.locator('label', { hasText: label }).locator('input[type="color"]').evaluate((element, farbe) => {
    const feld = element as HTMLInputElement;
    const setze = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setze?.call(feld, farbe);
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    feld.dispatchEvent(new Event('change', { bubbles: true }));
  }, wert);
  await gespeichert;
}

async function waehleAnsicht(seite: Page, name: string): Promise<void> {
  const gespeichert = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await seite.locator('button.rounded-xl').filter({ hasText: name }).click();
  await gespeichert;
}

async function loescheEigeneFarben(seite: Page, stil: Stil): Promise<void> {
  const ok = await seite.evaluate(async (ziel) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: ziel, farbenZuruecksetzen: true }),
    });
    return antwort.ok;
  }, stil);
  expect(ok).toBe(true);
}

test('Eigene Farben bleiben beim Ansichtswechsel erhalten', async ({ page }, testInfo) => {
  await page.goto('/mehr/darstellung');
  await expect(page.getByRole('heading', { name: 'Eigene Farben', exact: true })).toBeVisible();
  const vorher = await leseDarstellung(page);
  const andere: Stil = vorher.stil === 'jade' ? 'minimal' : 'jade';
  const akzent = page.locator('label', { hasText: 'Akzent' }).locator('input[type="color"]');

  try {
    await setzeFarbe(page, 'Akzent', '#ff00aa');
    await expect(akzent).toHaveValue('#ff00aa');
    const gespeichert = await leseDarstellung(page);
    expect(gespeichert.akzent).toBe('#ff00aa');
    expect(gespeichert.stil).toBe(vorher.stil);
    await page.screenshot({ path: `tmp-bau/a3-${testInfo.project.name}-eigene.png`, fullPage: true });

    await waehleAnsicht(page, ANSICHT_NAME[andere]);
    await expect(akzent).not.toHaveValue('#ff00aa');
    const fremd = await leseDarstellung(page);
    expect(fremd.stil).toBe(andere);
    expect(fremd.akzent).not.toBe('#ff00aa');
    await page.screenshot({ path: `tmp-bau/a3-${testInfo.project.name}-wechsel.png`, fullPage: true });

    await setzeFarbe(page, 'Akzent', '#00cc88');
    await expect(akzent).toHaveValue('#00cc88');

    await waehleAnsicht(page, ANSICHT_NAME[vorher.stil]);
    await expect(akzent).toHaveValue('#ff00aa');
    expect((await leseDarstellung(page)).akzent).toBe('#ff00aa');
    await page.screenshot({ path: `tmp-bau/a3-${testInfo.project.name}-zurueck.png`, fullPage: true });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Eigene Farben', exact: true })).toBeVisible();
    await expect(akzent).toHaveValue('#ff00aa');

    await waehleAnsicht(page, ANSICHT_NAME[andere]);
    await expect(akzent).toHaveValue('#00cc88');
    const dunkel = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const soll = standardVorlage(andere, dunkel);
    await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
    await expect.poll(async () => (await leseDarstellung(page)).eigeneFarben).toBe(false);
    await expect(akzent).toHaveValue(soll.akzent);

    await waehleAnsicht(page, ANSICHT_NAME[vorher.stil]);
    await expect(akzent).toHaveValue('#ff00aa');
    await ohneSeitlichenUeberlauf(page);
  } finally {
    for (const stil of ['minimal', 'jade', 'holo', 'antik'] as const) {
      await loescheEigeneFarben(page, stil);
    }
  }
});

test('Info-Icon hat überall Abstand zum Namen', async ({ page }) => {
  test.setTimeout(120_000);
  const orte: { pfad: string; name: string; mindestens: number }[] = [
    { pfad: '/mehr/funktionen', name: 'funktionen', mindestens: 3 },
    { pfad: '/mehr/profil/fokus', name: 'fokus', mindestens: 1 },
    { pfad: '/handbuch', name: 'handbuch', mindestens: 1 },
    { pfad: '/charakter', name: 'charakter', mindestens: 1 },
    { pfad: '/vorbilder', name: 'vorbilder', mindestens: 1 },
    { pfad: '/vorbilder/durchschnitt', name: 'durchschnitt', mindestens: 1 },
  ];

  for (const ort of orte) {
    await page.goto(ort.pfad);
    await page.getByRole('heading').first().waitFor();
    await oeffneGeschlossene(page);
    const abstaende = await missAbstaende(page, ort.name);
    pruefeAbstaende(abstaende, ort.mindestens);
    await ohneSeitlichenUeberlauf(page);
  }

  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('switch', { name: 'Meilenstein', exact: true })).toBeVisible();
  const meilenstein = await missAbstaende(page, 'eintrag');
  pruefeAbstaende(meilenstein, 1);
  await page.keyboard.press('Escape');

  const projektId = await page.evaluate(async () => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { projektId: number | null }[];
    };
    const mitProjekt = laufend.bosse.find((eintrag) => eintrag.projektId !== null);
    return mitProjekt?.projektId ?? null;
  });
  expect(projektId).not.toBeNull();
  await page.goto(`/projekte/${projektId}`);
  await page.getByRole('heading').first().waitFor();
  await oeffneGeschlossene(page);
  const projekt = await missAbstaende(page, 'projekt');
  pruefeAbstaende(projekt, 1);
  const bossKnopf = page.getByTitle(/Boss bearbeiten|Zum Boss machen/).first();
  await bossKnopf.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Info', exact: true })).toBeVisible();
  const deadline = await missAbstaende(page, 'deadline');
  pruefeAbstaende(deadline, 1);
  await page.keyboard.press('Escape');
});
