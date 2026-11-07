import { expect, test, type Page } from '@playwright/test';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { standardVorlage, vorlagen } from '../shared/features/darstellung/paletten.ts';
import { TEST_PASSWORT } from './testdaten.ts';

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
  return TEST_PASSWORT;
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
  const kopf = seite.locator('.vorbild-kopf');
  const stand = kopf.locator('[data-vorbild-stand]');
  await expect(kopf).toBeVisible();
  await expect(seite.locator('section.karte')).toHaveCount(0);
  await expect(kopf.getByText(name, { exact: true })).toHaveCount(0);
  await expect(stand).toBeVisible();
  await expect(stand).toContainText('Lvl');
  await schriftBereit(seite);
  const textUeberlauf = await kopf.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(textUeberlauf, name).toBe(false);
  const masse = await seite.evaluate(() => {
    const kasten = (element: Element | null) => {
      if (!element) {
        return null;
      }
      const stil = getComputedStyle(element);
      const rechteck = element.getBoundingClientRect();
      return {
        x: rechteck.x,
        y: rechteck.y,
        breite: rechteck.width,
        hoehe: rechteck.height,
        schrift: Number.parseFloat(stil.fontSize),
        zeile: Number.parseFloat(stil.lineHeight),
        gewicht: stil.fontWeight,
      };
    };
    const bereich = document.querySelector('.vorbild-kopf');
    const titel = document.querySelector('h1');
    const zuGross: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      if (titel && (element === titel || titel.contains(element))) {
        continue;
      }
      const stil = getComputedStyle(element);
      if (stil.display === 'none' || stil.visibility === 'hidden') {
        continue;
      }
      const schrift = Number.parseFloat(stil.fontSize);
      if (!(schrift > 20)) {
        continue;
      }
      const eigenerText = [...element.childNodes].some(
        (knoten) => knoten.nodeType === Node.TEXT_NODE && (knoten.textContent ?? '').trim() !== '',
      );
      if (!eigenerText) {
        continue;
      }
      zuGross.push(`${element.tagName} ${schrift} ${(element.textContent ?? '').trim().slice(0, 48)}`);
    }
    return {
      kopf: kasten(bereich),
      herkunft: kasten(bereich?.querySelector('[data-vorbild-herkunft]') ?? null),
      stand: kasten(bereich?.querySelector('[data-vorbild-stand]') ?? null),
      aehnlichkeit: kasten(bereich?.querySelector('[data-aehnlichkeit]') ?? null),
      text: kasten(bereich?.querySelector('[data-vorbild-text]') ?? null),
      zuGross,
    };
  });
  expect(masse.kopf && masse.herkunft && masse.stand && masse.text, name).toBeTruthy();
  if (!masse.kopf || !masse.herkunft || !masse.stand || !masse.text) {
    return;
  }
  expect(masse.kopf.hoehe, `${name} Kopfblock`).toBeLessThanOrEqual(160);
  expect(masse.zuGross, `${name} Schrift`).toEqual([]);
  expect(masse.herkunft.schrift, `${name} Herkunft`).toBe(13);
  expect(masse.herkunft.zeile, `${name} Herkunft`).toBe(18);
  expect(masse.stand.schrift, `${name} Stand`).toBe(15);
  expect(masse.stand.zeile, `${name} Stand`).toBe(22);
  expect(masse.stand.gewicht, `${name} Stand`).toBe('600');
  expect(innerhalb(masse.herkunft, masse.kopf), `${name} Herkunft`).toBe(true);
  expect(innerhalb(masse.stand, masse.kopf), `${name} Stand`).toBe(true);
  expect(innerhalb(masse.text, masse.kopf), `${name} Text`).toBe(true);
  expect(masse.herkunft.y, `${name} Reihenfolge`).toBeLessThan(masse.stand.y);
  expect(masse.stand.y, `${name} Reihenfolge`).toBeLessThan(masse.text.y);
  expect(Math.abs(masse.herkunft.x - masse.stand.x), `${name} Kante`).toBeLessThanOrEqual(1);
  expect(ueberlappt(masse.herkunft, masse.stand), `${name} Herkunft/Stand`).toBe(false);
  expect(ueberlappt(masse.stand, masse.text), `${name} Stand/Text`).toBe(false);
  if (masse.aehnlichkeit) {
    expect(masse.aehnlichkeit.schrift, `${name} Ähnlichkeit`).toBe(15);
    expect(masse.aehnlichkeit.zeile, `${name} Ähnlichkeit`).toBe(22);
    expect(masse.aehnlichkeit.gewicht, `${name} Ähnlichkeit`).toBe('600');
    expect(innerhalb(masse.aehnlichkeit, masse.kopf), `${name} Ähnlichkeit`).toBe(true);
    expect(masse.stand.y, `${name} Reihenfolge`).toBeLessThan(masse.aehnlichkeit.y);
    expect(masse.aehnlichkeit.y, `${name} Reihenfolge`).toBeLessThan(masse.text.y);
    expect(Math.abs(masse.aehnlichkeit.x - masse.stand.x), `${name} Kante`).toBeLessThanOrEqual(1);
    expect(ueberlappt(masse.stand, masse.aehnlichkeit), `${name} Stand/Ähnlichkeit`).toBe(false);
    expect(ueberlappt(masse.aehnlichkeit, masse.text), `${name} Ähnlichkeit/Text`).toBe(false);
  }
  const textZeilen = masse.text.hoehe / masse.text.zeile;
  expect(textZeilen, `${name} Beschreibung`).toBeLessThanOrEqual(3.05);
  if (name === 'Durchschnittsmensch') {
    expect(masse.herkunft.hoehe / masse.herkunft.zeile, name).toBeLessThan(1.4);
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
  const kopf = page.locator('.vorbild-kopf');
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
  await expect(page.locator('.vorbild-kopf [data-vorbild-stand]')).toContainText('Lvl 800');
  await page.locator('.vorbild-kopf').screenshot({
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
    const kopf = document.querySelector('.vorbild-kopf');
    const stand = kopf?.querySelector('[data-vorbild-stand]');
    const flaeche = kopf ? getComputedStyle(kopf).backgroundColor : '';
    const schrift = stand ? getComputedStyle(stand).color : '';
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

test('Vorbild: Kopf ist eine Fläche ohne zweiten Namen', async ({ page }, testInfo) => {
  const hell = standardVorlage('standard', false);
  await speichereDarstellung(page, {
    stil: 'standard',
    primaer: hell.primaer,
    akzent: hell.akzent,
    hintergrund: hell.hintergrund,
    glimmen: true,
  });
  await page.goto('/vorbilder/ronaldo');
  await expect(page.getByRole('heading', { name: 'Cristiano Ronaldo', exact: true })).toBeVisible();
  await expect.poll(() => variable(page, '--flaeche')).toBe('#ffffff');
  await expect.poll(() => variable(page, '--gefahr')).toBe('#c62828');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.schema ?? '')).toBe('light');
  await schriftBereit(page);
  await page.waitForTimeout(400);
  await pruefeKopf(page, 'Cristiano Ronaldo');
  const kopf = page.locator('.vorbild-kopf');
  await expect(kopf.locator('[data-vorbild-herkunft]')).toHaveText('Fußball · geboren 1985');
  await expect(kopf.locator('[data-vorbild-stand]')).toHaveText('Lvl 8.835 · Vitaler Krieger · Ikone');
  await expect(kopf.locator('[data-aehnlichkeit]')).toContainText(/%\s*ähnlich/);
  const breite = testInfo.project.name === 'desktop' ? '1440' : '390';
  const ordner = 'tmp-test/vorbild-kopf';
  await page.screenshot({ path: `${ordner}/${breite}-vorbild-ronaldo.png` });
  await page.screenshot({ path: `${ordner}/${breite}-vorbild-ronaldo-ganz.png`, fullPage: true });
  await kopf.screenshot({ path: `${ordner}/${breite}-vorbild-ronaldo-kopf.png` });
});
