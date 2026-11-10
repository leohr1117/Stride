import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_URL } from './testdaten.ts';

const BANNER = 'Als App installieren';
const HINWEIS = 'Stride als App installieren';
const SCHLIESSEN = 'Hinweis ausblenden';
const HINWEIS_IOS = 'Teilen → Zum Home-Bildschirm.';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

function bannerVon(seite: Page) {
  return seite.locator(`main section[aria-label="${HINWEIS}"]`);
}

function aufnahmen(): void {
  mkdirSync('tmp-test/installieren', { recursive: true });
}

async function feuerInstallEreignis(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    const ziel = window as Window & { __installPrompt?: number };
    ziel.__installPrompt = 0;
    const ereignis = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(ereignis, {
      prompt: () => {
        ziel.__installPrompt = (ziel.__installPrompt ?? 0) + 1;
        return Promise.resolve();
      },
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
    });
    window.dispatchEvent(ereignis);
  });
}

function promptZahl(seite: Page): Promise<number> {
  return seite.evaluate(() => (window as Window & { __installPrompt?: number }).__installPrompt ?? 0);
}

async function oeffne(seite: Page, name: 'Heute' | 'Mehr', ueberschrift: string): Promise<void> {
  const mobil = seite.locator('nav.mobilleiste').getByRole('link', { name, exact: true });
  const leiste = seite.locator('aside.seitenleiste').getByRole('link', { name, exact: true });
  if (await mobil.isVisible()) {
    await mobil.click();
  } else {
    await leiste.click();
  }
  await expect(seite.locator('main h1')).toHaveText(ueberschrift);
}

async function knopfRechts(kasten: { x: number; width: number }, knopf: { x: number; width: number }): Promise<void> {
  const abstand = kasten.x + kasten.width - (knopf.x + knopf.width);
  expect(abstand).toBeGreaterThanOrEqual(0);
  expect(abstand).toBeLessThan(4);
}

test('nach der Anmeldung liegt das Banner auf Heute und die Zeile installiert', async ({ page }, testInfo) => {
  aufnahmen();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
  await feuerInstallEreignis(page);
  await expect(bannerVon(page)).toHaveCount(0);

  await anmelden(page);
  await expect(bannerVon(page)).toHaveCount(0);
  await feuerInstallEreignis(page);

  const banner = bannerVon(page);
  await expect(banner).toBeVisible();
  const schliessen = banner.getByRole('button', { name: SCHLIESSEN, exact: true });
  const installieren = banner.getByRole('button', { name: 'Installieren', exact: true });
  await expect(schliessen).toBeVisible();
  await expect(installieren).toBeVisible();
  const lageBanner = await banner.boundingBox();
  const lageSchliessen = await schliessen.boundingBox();
  const lageInstall = await installieren.boundingBox();
  const lageOben = await page.locator('.identitaets-flaeche').boundingBox();
  expect(lageBanner).not.toBeNull();
  expect(lageSchliessen).not.toBeNull();
  expect(lageInstall).not.toBeNull();
  expect(lageOben).not.toBeNull();
  if (!lageBanner || !lageSchliessen || !lageInstall || !lageOben) {
    throw new Error('Maße des Banners fehlen.');
  }
  expect(lageBanner.y).toBeGreaterThan(lageOben.y);
  expect(lageInstall.x + lageInstall.width).toBeLessThanOrEqual(lageSchliessen.x + 1);
  expect(Math.abs(lageInstall.y - lageSchliessen.y)).toBeLessThan(4);
  await knopfRechts(lageBanner, lageSchliessen);
  expect(await banner.evaluate((element) => getComputedStyle(element).position)).not.toBe('fixed');
  await ohneSeitlichenUeberlauf(page);
  if (testInfo.project.name === 'handy') {
    await page.screenshot({ path: 'tmp-test/installieren/handy-heute-banner.png' });
  }

  await oeffne(page, 'Mehr', 'Mehr');
  const abschnitt = page.locator('[data-abschnitt="einstellungen"]');
  const ziele = await abschnitt.locator('a').evaluateAll((knoten) =>
    knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
  );
  expect(ziele.at(-2)).toBe('/mehr/benachrichtigungen');
  expect(ziele.at(-1)).toBe('/mehr/daten');
  const namen = await abschnitt.locator('[data-zeile]').evaluateAll((knoten) =>
    knoten.map((knoten) => knoten.querySelector('a,button')?.getAttribute('aria-label')),
  );
  const indexHinweis = namen.indexOf('Benachrichtigungen');
  const indexInstall = namen.indexOf(BANNER);
  const indexDaten = namen.indexOf('Daten');
  expect(indexInstall).toBe(indexHinweis + 1);
  expect(indexDaten).toBe(indexInstall + 1);
  const zeile = abschnitt.getByRole('button', { name: BANNER, exact: true });
  await expect(zeile).toBeVisible();
  await zeile.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(page);
  if (testInfo.project.name === 'handy') {
    await page.screenshot({ path: 'tmp-test/installieren/handy-mehr-zeile.png' });
  }

  await oeffne(page, 'Heute', 'Heute');
  await banner.getByRole('button', { name: SCHLIESSEN, exact: true }).click();
  await expect(bannerVon(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Eintrag loggen', exact: true })).toBeVisible();
  await expect(bannerVon(page)).toHaveCount(0);
  await feuerInstallEreignis(page);
  await expect(bannerVon(page)).toHaveCount(0);

  await oeffne(page, 'Mehr', 'Mehr');
  const zeileDanach = page.locator('[data-abschnitt="einstellungen"]').getByRole('button', { name: BANNER, exact: true });
  await expect(zeileDanach).toBeVisible();
  await zeileDanach.click();
  await expect.poll(() => promptZahl(page)).toBe(1);
});

test('ein iPhone zeigt nur den Hinweis ohne Installieren', async ({ browser }, testInfo) => {
  const breit = testInfo.project.name === 'desktop';
  const context = await browser.newContext({
    baseURL: TEST_URL,
    viewport: breit ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    hasTouch: true,
    isMobile: !breit,
    userAgent: IPHONE,
    serviceWorkers: 'block',
    locale: 'de-DE',
  });
  const seite = await context.newPage();
  try {
    await seite.goto('/');
    await expect(seite.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
    await expect(bannerVon(seite)).toHaveCount(0);
    await anmelden(seite);
    const banner = bannerVon(seite);
    await expect(banner).toBeVisible();
    await expect(banner.getByText(HINWEIS_IOS, { exact: true })).toHaveCount(0);
    const so = banner.getByRole('button', { name: 'So geht’s', exact: true });
    await expect(so).toHaveAttribute('aria-expanded', 'false');
    await expect(banner.getByRole('button', { name: 'Installieren', exact: true })).toHaveCount(0);
    const schliessen = banner.getByRole('button', { name: SCHLIESSEN, exact: true });
    await expect(schliessen).toBeVisible();
    const lageBanner = await banner.boundingBox();
    const lageSchliessen = await schliessen.boundingBox();
    expect(lageBanner).not.toBeNull();
    expect(lageSchliessen).not.toBeNull();
    if (!lageBanner || !lageSchliessen) {
      throw new Error('Maße des Hinweises fehlen.');
    }
    await knopfRechts(lageBanner, lageSchliessen);
    await so.click();
    await expect(so).toHaveAttribute('aria-expanded', 'true');
    await expect(banner.getByText('Tippe auf Teilen.', { exact: true })).toBeVisible();
    await expect(banner.getByText('Wähle „Zum Home-Bildschirm“.', { exact: true })).toBeVisible();
    await expect(banner.getByText('Tippe auf „Hinzufügen“.', { exact: true })).toBeVisible();
    await expect(seite.getByRole('dialog')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(seite);

    await oeffne(seite, 'Mehr', 'Mehr');
    await seite.locator('[data-abschnitt="einstellungen"]').getByRole('button', { name: BANNER, exact: true }).click();
    const dialog = seite.getByRole('dialog', { name: BANNER, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(HINWEIS_IOS, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Installieren', exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
