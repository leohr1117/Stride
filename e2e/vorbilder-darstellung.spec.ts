import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { standardVorlage, vorlagen } from '../shared/features/darstellung/paletten.ts';

interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

interface Darstellung {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
}

let original: Darstellung | null = null;
let spracheVorher: string | null = null;
let loeseSperre: (() => void) | null = null;

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

function ueberlappt(a: Kasten, b: Kasten): boolean {
  return a.x < b.x + b.breite - 1 && b.x < a.x + a.breite - 1 && a.y < b.y + b.hoehe - 1 && b.y < a.y + a.hoehe - 1;
}

function innerhalb(innen: Kasten, aussen: Kasten): boolean {
  return (
    innen.x >= aussen.x - 1 &&
    innen.y >= aussen.y - 1 &&
    innen.x + innen.breite <= aussen.x + aussen.breite + 1 &&
    innen.y + innen.hoehe <= aussen.y + aussen.hoehe + 1
  );
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

async function schriftBereit(seite: Page): Promise<void> {
  await seite.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function pruefeKopf(seite: Page, name: string): Promise<void> {
  const karte = seite.locator('section.karte').first();
  const titel = karte.locator('.profil-name');
  const level = karte.locator('p.text-3xl:not([data-aehnlichkeit])');
  await expect(titel).toBeVisible();
  await expect(level).toBeVisible();
  await schriftBereit(seite);
  const textUeberlauf = await titel.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(textUeberlauf, name).toBe(false);
  const kaesten = await seite.evaluate(() => {
    const kasten = (element: Element | null) => {
      if (!element) {
        return null;
      }
      const rechteck = element.getBoundingClientRect();
      return { x: rechteck.x, y: rechteck.y, breite: rechteck.width, hoehe: rechteck.height };
    };
    const bereich = document.querySelector('section.karte');
    return {
      karte: kasten(bereich),
      titel: kasten(bereich?.querySelector('.profil-name') ?? null),
      level: kasten(bereich?.querySelector('p.text-3xl:not([data-aehnlichkeit])') ?? null),
      untertitel: kasten(bereich?.querySelector('p.text-sm') ?? null),
    };
  });
  expect(kaesten.karte && kaesten.titel && kaesten.level, name).toBeTruthy();
  if (!kaesten.karte || !kaesten.titel || !kaesten.level) {
    return;
  }
  expect(innerhalb(kaesten.titel, kaesten.karte), `${name} Titel`).toBe(true);
  expect(innerhalb(kaesten.level, kaesten.karte), `${name} Level`).toBe(true);
  expect(ueberlappt(kaesten.titel, kaesten.level), `${name} Titel/Level`).toBe(false);
  if (name === 'Durchschnittsmensch') {
    const zeilen = await titel.evaluate((element) => {
      const hoehe = Number.parseFloat(getComputedStyle(element).lineHeight);
      return element.getBoundingClientRect().height / hoehe;
    });
    expect(zeilen, name).toBeLessThan(1.4);
  }
  if (kaesten.untertitel) {
    expect(ueberlappt(kaesten.untertitel, kaesten.level), `${name} Untertitel/Level`).toBe(false);
  }
  await ohneSeitlichenUeberlauf(seite);
}

async function oeffneProfil(seite: Page, schluessel: string, name: string, stil?: string): Promise<void> {
  await seite.goto(`/vorbilder/${schluessel}`);
  await expect(seite.getByRole('heading', { name, exact: true })).toBeVisible();
  if (stil) {
    await expect.poll(() => seite.evaluate(() => document.documentElement.dataset.stil ?? 'standard')).toBe(stil);
  }
  await schriftBereit(seite);
  await pruefeKopf(seite, name);
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
  loeseSperre?.();
  loeseSperre = null;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
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

test('Profil: langer Titel und Level überlappen sich nicht', async ({ page }, testInfo) => {
  await page.goto('/vorbilder');
  const zeile = page.locator('[data-zeile]').filter({ has: page.locator('a[href="/vorbilder/durchschnitt"]') });
  await zeile.scrollIntoViewIfNeeded();
  await expect(zeile.getByRole('link', { name: 'Durchschnittsmensch', exact: true })).toBeVisible();
  await expect(zeile).toContainText(/%/);
  const zeilenUeberlauf = await zeile.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(zeilenUeberlauf).toBe(false);

  await oeffneProfil(page, 'durchschnitt', 'Durchschnittsmensch');
  const kopf = page.locator('section.karte').first();
  await expect(kopf).toContainText('Lvl 800');
  await expect(kopf.getByText('Weltweit, etwa 40 Jahre')).toBeVisible();
  await expect(kopf.getByText('Ein durchschnittlicher Erwachsener weltweit: Ausbildung, Beruf, Familie und Freizeit.')).toBeVisible();
  await expect(page.getByText('Deutschland')).toHaveCount(0);
  await oeffneProfil(page, 'mozart', 'Wolfgang Amadeus Mozart');

  const antik = standardVorlage('antik', true);
  await speichereDarstellung(page, {
    stil: 'antik',
    primaer: antik.primaer,
    akzent: antik.akzent,
    hintergrund: antik.hintergrund,
    glimmen: original?.glimmen ?? true,
  });
  await oeffneProfil(page, 'durchschnitt', 'Durchschnittsmensch', 'antik');
  await expect(page.locator('section.karte').first().locator('p.text-3xl:not([data-aehnlichkeit])')).toHaveText('Lvl 800');
  await page.locator('section.karte').first().screenshot({
    path: `tmp-test/vorbilder-darstellung/${testInfo.project.name}-profil.png`,
  });
  await oeffneProfil(page, 'mozart', 'Wolfgang Amadeus Mozart', 'antik');
  await ohneSeitlichenUeberlauf(page);
});

async function waehleDesign(seite: Page, name: string): Promise<void> {
  await seite.locator('button.rounded-xl').filter({ hasText: name }).click();
}

function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate((schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim(), name);
}

test('Darstellung: Farben anderer Designs, sofort und auf jeder Seite', async ({ page }, testInfo) => {
  const hell = vorlagen('minimal').find((vorlage) => vorlage.name === 'Hell');
  const jade = vorlagen('jade').find((vorlage) => vorlage.name === 'Jade');
  expect(hell && jade).toBeTruthy();
  if (!hell || !jade) {
    return;
  }

  await page.goto('/mehr/darstellung');
  await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
  const ansichtGespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await waehleDesign(page, 'Antik');
  await ansichtGespeichert;
  const paletteGespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  const antikGruppe = page.getByRole('region', { name: 'Antik' });
  await antikGruppe.getByRole('button', { name: 'Antik', exact: true }).click();
  await paletteGespeichert;
  await expect(antikGruppe.getByRole('button', { name: 'Antik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Minimal' }).getByRole('button', { name: 'Hell', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('region').first()).toHaveAccessibleName('Antik');
  for (const label of ['Antik', 'Minimal', 'Jade', 'Hologramm']) {
    await expect(page.getByRole('region', { name: label })).toBeVisible();
  }
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/vorbilder-darstellung/${testInfo.project.name}-farben.png`, fullPage: true });

  let freigabe: () => void = () => undefined;
  const sperre = new Promise<void>((resolve) => {
    freigabe = resolve;
  });
  loeseSperre = freigabe;
  await page.route('**/api/einstellungen', async (route) => {
    if (route.request().method() === 'PATCH') {
      await sperre;
    }
    await route.continue();
  });

  await page.getByRole('region', { name: 'Minimal' }).getByRole('button', { name: 'Hell', exact: true }).click();
  await expect.poll(() => variable(page, '--grund')).toBe(hell.hintergrund);
  await expect.poll(() => variable(page, '--akzent')).toBe(hell.primaer);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.stil ?? '')).toBe('antik');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.schema ?? '')).toBe('light');
  const vignette = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(vignette).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\.6\)|rgb\(0 0 0 \/ 60%\)/);

  await page.getByRole('navigation').getByRole('link', { name: 'Heute', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => variable(page, '--grund')).toBe(hell.hintergrund);
  await expect.poll(() => variable(page, '--akzent')).toBe(hell.primaer);

  const gespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  freigabe();
  loeseSperre = null;
  await gespeichert;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.reload();
  await expect.poll(() => variable(page, '--grund')).toBe(hell.hintergrund);
  await expect.poll(() => variable(page, '--akzent')).toBe(hell.primaer);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.stil ?? '')).toBe('antik');

  await page.goto('/vorbilder/durchschnitt');
  await expect(page.getByRole('heading', { name: 'Durchschnittsmensch', exact: true })).toBeVisible();
  await schriftBereit(page);
  const proben = await page.evaluate(() => {
    const karte = document.querySelector('section.karte');
    const titel = karte?.querySelector('.profil-name');
    const flaeche = karte ? getComputedStyle(karte).backgroundColor : '';
    const schrift = titel ? getComputedStyle(titel).color : '';
    return { flaeche, schrift };
  });
  expect(kontrast(proben.schrift, proben.flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);

  await page.goto('/mehr/darstellung');
  const antikGespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await waehleDesign(page, 'Antik');
  await antikGespeichert;
  const jadeGespeichert = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('region', { name: 'Jade' }).getByRole('button', { name: 'Jade', exact: true }).click();
  await jadeGespeichert;
  await expect.poll(() => variable(page, '--grund')).toBe(jade.hintergrund);
  await expect.poll(() => variable(page, '--akzent')).toBe(jade.primaer);
  await page.getByRole('navigation').getByRole('link', { name: 'Heute', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => variable(page, '--akzent')).toBe(jade.primaer);
  await page.reload();
  await expect.poll(() => variable(page, '--grund')).toBe(jade.hintergrund);
  await expect.poll(() => variable(page, '--akzent')).toBe(jade.primaer);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.stil ?? '')).toBe('antik');
  await ohneSeitlichenUeberlauf(page);
});
