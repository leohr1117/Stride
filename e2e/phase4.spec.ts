import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_URL } from './testdaten.ts';

const ENDPUNKTE = ['https://geraet.example/phase4', 'https://geraet.example/phase4-zwei'] as const;
const HINWEIS = ['hinweis_streak', 'hinweis_rueckkehr', 'hinweis_boss', 'hinweis_ruhe_von', 'hinweis_ruhe_bis'] as const;
const STREAK_INFO = 'Am angeschlagenen Tag, einmal. Der Text bittet um einen Eintrag.';
const RUHIG = '21:00 – 07:00';

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

function mitDb<T>(arbeit: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    return arbeit(db);
  } finally {
    db.close();
  }
}

function snapshot(): Record<string, string | null> {
  return mitDb((db) => {
    const frage = db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?');
    const aus: Record<string, string | null> = {};
    for (const name of HINWEIS) {
      const zeile = frage.get(name) as { wert: string } | undefined;
      aus[name] = zeile?.wert ?? null;
    }
    return aus;
  });
}

function setzeAbo(endpoint: string): void {
  mitDb((db) => {
    db.prepare('INSERT INTO push_abos (endpoint, p256dh, auth) VALUES (?, ?, ?)').run(endpoint, 'phase4-p256', 'phase4-auth');
  });
}

function loescheAbo(endpoint: string): void {
  mitDb((db) => {
    db.prepare('DELETE FROM push_abos WHERE endpoint = ?').run(endpoint);
  });
}

function stelleZurueck(vorher: Record<string, string | null>): void {
  mitDb((db) => {
    const weg = db.prepare('DELETE FROM push_abos WHERE endpoint = ?');
    for (const endpoint of ENDPUNKTE) {
      weg.run(endpoint);
    }
    const loesche = db.prepare('DELETE FROM einstellungen WHERE schluessel = ?');
    const schreibe = db.prepare('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)');
    for (const name of HINWEIS) {
      loesche.run(name);
      const wert = vorher[name];
      if (wert !== null) {
        schreibe.run(name, wert);
      }
    }
  });
}

async function oeffentlicherSchluessel(seite: Page): Promise<string | null> {
  const antwort = await seite.request.get('/api/hinweise');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { oeffentlicherSchluessel: string | null };
  return daten.oeffentlicherSchluessel;
}

async function setzeUhr(seite: Page, name: string, wert: string): Promise<void> {
  await seite.locator(`input[name="${name}"]`).evaluate((el, zeit) => {
    const feld = el as HTMLInputElement;
    const schreibe = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    schreibe?.call(feld, zeit);
    feld.dispatchEvent(new Event('input', { bubbles: true }));
  }, wert);
}

function imBild(kasten: { x: number; y: number; width: number; height: number } | null, fenster: { width: number; height: number } | null): void {
  expect(kasten).not.toBeNull();
  expect(fenster).not.toBeNull();
  if (!kasten || !fenster) {
    return;
  }
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.y).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
  expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
}

test('Benachrichtigungen liegen zwischen App und Daten', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/phase4/${testInfo.project.name}-${name}.png` });
  const hinweis = { patch: 0, post: 0 };
  page.on('request', (anfrage) => {
    const url = anfrage.url();
    if (!url.includes('/api/hinweise')) {
      return;
    }
    if (anfrage.method() === 'PATCH') {
      hinweis.patch += 1;
    }
    if (anfrage.method() === 'POST' && url.includes('/abo')) {
      hinweis.post += 1;
    }
  });
  let vorher: Record<string, string | null> | null = null;
  try {
    vorher = snapshot();
    await anmelden(page);
    await page.goto('/mehr');
    await expect(page.locator('main h1')).toHaveText('Mehr');
    const ziele = await page.locator('main .grid > a').evaluateAll((knoten) =>
      knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
    );
    const app = ziele.indexOf('/mehr/funktionen');
    expect(ziele[app + 1]).toBe('/mehr/benachrichtigungen');
    expect(ziele[app + 2]).toBe('/mehr/daten');
    await expect(page.locator('main a[href="/mehr/benachrichtigungen"] span.text-xs')).toHaveText('Aus');
    await expect(page.locator('nav.mobilleiste a[href="/mehr/benachrichtigungen"]')).toHaveCount(0);
    await expect(page.locator('aside.seitenleiste a[href="/mehr/benachrichtigungen"]')).toHaveCount(0);
    await bild('mehr-aus');

    await page.locator('main a[href="/mehr/benachrichtigungen"]').click();
    await expect(page).toHaveURL(/\/mehr\/benachrichtigungen$/);
    await expect(page.locator('main h1')).toHaveText('Benachrichtigungen');
    const zurueck = page.locator('a[data-zurueck]');
    await expect(zurueck).toBeVisible();
    await expect(zurueck).toHaveAttribute('href', '/mehr');
    if (testInfo.project.name === 'handy') {
      const kopf = await page.locator('header.mobilkopf').boundingBox();
      const knopf = await zurueck.boundingBox();
      expect(kopf).not.toBeNull();
      expect(knopf).not.toBeNull();
      if (kopf && knopf) {
        expect(knopf.y).toBeGreaterThanOrEqual(kopf.y + kopf.height - 1);
      }
      await expect(page.locator('header.mobilkopf a[href="/mehr"]')).toHaveAttribute('aria-current', 'page');
    } else {
      await expect(page.locator('aside.seitenleiste a[href="/mehr"]')).toHaveAttribute('aria-current', 'page');
    }
    expect(hinweis.patch).toBe(0);
    expect(hinweis.post).toBe(0);
    await expect(page.getByRole('switch', { name: 'Streak in Gefahr', exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Boss-Datum', exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Rückkehr', exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: /Fällig|Training/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Von')).toHaveCount(0);
    await expect(page.getByLabel('Bis')).toHaveCount(0);
    const ruhe = page.locator('main section').filter({ has: page.getByRole('heading', { name: 'Ruhezeit', exact: true }) });
    const ruheText = (await ruhe.locator('span.zahl').innerText()).trim();
    expect(ruheText).toContain('–');

    const schluessel = await oeffentlicherSchluessel(page);
    const einschalten = page.getByRole('button', { name: 'Benachrichtigungen einschalten', exact: true });
    if (schluessel) {
      await expect(einschalten).toBeEnabled();
    } else {
      await expect(einschalten).toBeDisabled();
      await expect(page.getByText('Benachrichtigungen sind auf diesem Server nicht eingerichtet.')).toBeVisible();
    }
    await page.locator('#hinweis-streak').getByRole('button', { name: 'Info', exact: true }).click();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('Zuerst einschalten.');
    imBild(await tooltip.boundingBox(), page.viewportSize());
    await bild('info-aus');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await bild('seite-aus');
    await ohneSeitlichenUeberlauf(page);

    await zurueck.click();
    await expect(page).toHaveURL(/\/mehr$/);
    await expect(page.locator('main h1')).toHaveText('Mehr');

    setzeAbo(ENDPUNKTE[0]);
    setzeAbo(ENDPUNKTE[1]);
    await page.reload();
    await expect(page.locator('main a[href="/mehr/benachrichtigungen"] span.text-xs')).toHaveText('2 Geräte');
    await bild('mehr-zwei');
    loescheAbo(ENDPUNKTE[1]);
    await page.reload();
    await expect(page.locator('main a[href="/mehr/benachrichtigungen"] span.text-xs')).toHaveText('An');
    await bild('mehr-an');

    await page.goto('/mehr/benachrichtigungen');
    await expect(page.locator('main h1')).toHaveText('Benachrichtigungen');
    await expect(page.getByRole('button', { name: 'Benachrichtigungen ausschalten', exact: true })).toBeVisible();
    const streak = page.getByRole('switch', { name: 'Streak in Gefahr', exact: true });
    await expect(streak).toBeEnabled();
    await page.locator('#hinweis-streak').getByRole('button', { name: 'Info', exact: true }).click();
    await expect(page.getByRole('tooltip')).toHaveText(STREAK_INFO);
    await page.keyboard.press('Escape');
    const warAn = await streak.getAttribute('aria-checked');
    const antwort = page.waitForResponse(
      (meldung) => meldung.url().includes('/api/hinweise') && meldung.request().method() === 'PATCH' && meldung.ok(),
    );
    await streak.click();
    await antwort;
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Streak in Gefahr', exact: true })).toHaveAttribute(
      'aria-checked',
      warAn === 'true' ? 'false' : 'true',
    );
    await bild('seite-an');

    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ruhezeit' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Von')).toBeVisible();
    await expect(dialog.getByLabel('Bis')).toBeVisible();
    await setzeUhr(page, 'von', '25:00');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Etwas ist schiefgelaufen.')).toBeVisible();
    await expect(ruhe.locator('span.zahl')).toHaveText(ruheText);
    await setzeUhr(page, 'von', '21:00');
    await setzeUhr(page, 'bis', '07:00');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ruhe.locator('span.zahl')).toHaveText(RUHIG);
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await expect(dialog).toBeVisible();
    await setzeUhr(page, 'von', '20:00');
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ruhe.locator('span.zahl')).toHaveText(RUHIG);
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await expect(dialog).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('dialog');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(hinweis.post).toBe(0);
  } finally {
    if (vorher) {
      stelleZurueck(vorher);
    }
  }
});

test('ein iPhone-Tab lässt Einschalten aus', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: TEST_URL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    serviceWorkers: 'block',
    locale: 'de-DE',
  });
  const seite = await context.newPage();
  try {
    await anmelden(seite);
    await seite.goto('/mehr/benachrichtigungen');
    const knopf = seite.getByRole('button', { name: 'Benachrichtigungen einschalten', exact: true });
    await expect(knopf).toBeDisabled();
    const schluessel = await oeffentlicherSchluessel(seite);
    if (schluessel) {
      await seite.locator('[data-hinweis-knopf]').getByRole('button', { name: 'Info', exact: true }).click();
      await expect(seite.getByRole('tooltip')).toHaveText(
        'Auf dem iPhone nur aus der App auf dem Home-Bildschirm. Im Safari-Tab bleibt der Knopf aus.',
      );
    } else {
      await expect(seite.locator('[data-hinweis-knopf]').getByRole('button', { name: 'Info', exact: true })).toHaveCount(0);
    }
    await seite.screenshot({ path: `tmp-bau/phase4/${testInfo.project.name}-ios.png` });
  } finally {
    await context.close();
  }
});

test('eine abgelehnte Erlaubnis sendet kein Abo', async ({ page }) => {
  await anmelden(page);
  const schluessel = await oeffentlicherSchluessel(page);
  test.skip(!schluessel, 'kein öffentlicher Schlüssel');
  try {
    const sitzung = await page.context().newCDPSession(page);
    await sitzung.send('Browser.setPermission', {
      permission: { name: 'notifications' },
      setting: 'denied',
      origin: TEST_URL,
    });
  } catch {
    test.skip(true, 'Erlaubnis lässt sich nicht setzen');
  }
  let posts = 0;
  page.on('request', (anfrage) => {
    if (anfrage.method() === 'POST' && anfrage.url().includes('/api/hinweise/abo')) {
      posts += 1;
    }
  });
  await page.goto('/mehr/benachrichtigungen');
  const erlaubt = await page.evaluate(() => (typeof Notification === 'undefined' ? 'fehlt' : Notification.permission));
  test.skip(erlaubt !== 'denied', 'Erlaubnis blieb nicht abgelehnt');
  await expect(page.getByText('Aus. Die Erlaubnis ist abgelehnt. Heute bleibt nutzbar.')).toBeVisible();
  const knopf = page.getByRole('button', { name: 'Benachrichtigungen einschalten', exact: true });
  await expect(knopf).toBeEnabled();
  await knopf.click();
  expect(posts).toBe(0);
});
