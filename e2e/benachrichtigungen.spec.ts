import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_KOPIE, TEST_URL } from './testdaten.ts';

const ENDPUNKTE = ['https://geraet.example/abo', 'https://geraet.example/abo-zwei'] as const;
const HINWEIS = ['hinweis_streak', 'hinweis_rueckkehr', 'hinweis_boss', 'hinweis_ruhe_von', 'hinweis_ruhe_bis'] as const;
const RUHIG = '21:00–07:00';
const UHR_FEHLER = 'Die Uhrzeit muss im Format HH:MM angegeben werden.';

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
    db.prepare('INSERT INTO push_abos (endpoint, p256dh, auth) VALUES (?, ?, ?)').run(endpoint, 'abo-p256', 'abo-auth');
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

test('Benachrichtigungen stehen unter Mehr vor Daten', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const bild = (name: string) => page.screenshot({ path: `tmp-test/benachrichtigungen/${testInfo.project.name}-${name}.png` });
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
  let bosseVorher: boolean | null = null;
  try {
    vorher = snapshot();
    await anmelden(page);
    await page.goto('/mehr');
    await expect(page.locator('main h1')).toHaveText('Mehr');
    await expect(page.locator('main a[href="/mehr/funktionen"]')).toBeVisible();
    const ziele = await page.locator('[data-abschnitt="einstellungen"] a').evaluateAll((knoten) =>
      knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
    );
    expect(ziele.at(-2)).toBe('/mehr/benachrichtigungen');
    expect(ziele.at(-1)).toBe('/mehr/daten');
    const hinweisZeile = page.locator('[data-abschnitt="einstellungen"] [data-zeile]').filter({
      has: page.locator('a[href="/mehr/benachrichtigungen"]'),
    });
    await expect(hinweisZeile.locator('span.truncate')).toHaveText('Aus');
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
        expect(knopf.y).toBeGreaterThanOrEqual(kopf.y - 1);
        expect(knopf.y + knopf.height).toBeLessThanOrEqual(kopf.y + kopf.height + 1);
        expect(knopf.height).toBeGreaterThanOrEqual(48);
        expect(knopf.width).toBeGreaterThanOrEqual(48);
      }
      await expect(page.locator('nav.mobilleiste a[href="/mehr"]')).toHaveAttribute('aria-current', 'page');
    } else {
      await expect(page.locator('aside.seitenleiste a[href="/mehr"]')).toHaveAttribute('aria-current', 'page');
    }
    expect(hinweis.patch).toBe(0);
    expect(hinweis.post).toBe(0);
    const geraet = page.getByRole('switch', { name: 'Auf diesem Gerät', exact: true });
    await expect(geraet).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: 'Streak in Gefahr', exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Rückkehr geht auf', exact: true })).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Boss-Datum', exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Rückkehr', exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Fällig|Training/ })).toHaveCount(0);
    await expect(page.locator('#hinweis-streak').getByRole('button', { name: /^Info/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Ruhe von')).toHaveCount(0);
    await expect(page.getByLabel('Ruhe bis')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ruhezeit', exact: true })).toHaveCount(0);
    const ruheAus = page.locator('[data-zeile="lesen"]').filter({ hasText: 'Ruhezeit' });
    const ruheZeit = ((await ruheAus.innerText()).match(/\d{2}:\d{2}–\d{2}:\d{2}/) ?? [''])[0];
    expect(ruheZeit).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);

    const einstellungen = await page.request.get('/api/einstellungen');
    expect(einstellungen.ok()).toBe(true);
    const lage = (await einstellungen.json()) as { funktionen: { bossAngriffe: boolean } };
    bosseVorher = lage.funktionen.bossAngriffe;
    const boss = page.getByRole('switch', { name: 'Boss einen Tag vorher', exact: true });
    if (lage.funktionen.bossAngriffe) {
      await expect(boss).toBeDisabled();
    } else {
      await expect(boss).toHaveCount(0);
    }
    const bosseAus = await page.request.patch('/api/einstellungen', { data: { funktionen: { bossAngriffe: false } } });
    expect(bosseAus.ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Boss einen Tag vorher', exact: true })).toHaveCount(0);
    const bosseWieder = await page.request.patch('/api/einstellungen', {
      data: { funktionen: { bossAngriffe: lage.funktionen.bossAngriffe } },
    });
    expect(bosseWieder.ok()).toBe(true);
    await page.reload();
    if (lage.funktionen.bossAngriffe) {
      await expect(page.getByRole('switch', { name: 'Boss einen Tag vorher', exact: true })).toBeDisabled();
    }

    const schluessel = await oeffentlicherSchluessel(page);
    if (schluessel) {
      await expect(geraet).toBeEnabled();
    } else {
      await expect(geraet).toBeDisabled();
      await expect(page.getByText('Benachrichtigungen sind auf diesem Server nicht eingerichtet.')).toBeVisible();
    }
    await bild('seite-aus');
    await ohneSeitlichenUeberlauf(page);

    await zurueck.click();
    await expect(page).toHaveURL(/\/mehr$/);
    await expect(page.locator('main h1')).toHaveText('Mehr');

    setzeAbo(ENDPUNKTE[0]);
    setzeAbo(ENDPUNKTE[1]);
    await page.reload();
    await expect(hinweisZeile.locator('span.truncate')).toHaveText('2 Geräte');
    await bild('mehr-zwei');
    loescheAbo(ENDPUNKTE[1]);
    await page.reload();
    await expect(hinweisZeile.locator('span.truncate')).toHaveText('An');
    await bild('mehr-an');

    await page.goto('/mehr/benachrichtigungen');
    await expect(page.locator('main h1')).toHaveText('Benachrichtigungen');
    await expect(page.getByRole('switch', { name: 'Auf diesem Gerät', exact: true })).toHaveAttribute('aria-checked', 'true');
    const streak = page.getByRole('switch', { name: 'Streak in Gefahr', exact: true });
    await expect(streak).toBeEnabled();
    await expect(page.locator('#hinweis-streak').getByRole('button', { name: /^Info/ })).toHaveCount(0);
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

    const ruhe = page.locator('[data-zeile="auswahl"]').filter({ has: page.getByRole('button', { name: 'Ruhezeit', exact: true }) });
    await page.getByRole('button', { name: 'Ruhezeit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ruhezeit' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Ruhe von')).toBeVisible();
    await expect(dialog.getByLabel('Ruhe bis')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Abbrechen', exact: true })).toBeVisible();
    await setzeUhr(page, 'von', '25:00');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(UHR_FEHLER)).toBeVisible();
    await expect(ruhe).toContainText(ruheZeit);
    await setzeUhr(page, 'von', '21:00');
    await setzeUhr(page, 'bis', '07:00');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ruhe).toContainText(RUHIG);
    await page.getByRole('button', { name: 'Ruhezeit', exact: true }).click();
    await expect(dialog).toBeVisible();
    await setzeUhr(page, 'von', '20:00');
    await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
    const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(frage).toBeVisible();
    await frage.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ruhe).toContainText(RUHIG);
    await page.getByRole('button', { name: 'Ruhezeit', exact: true }).click();
    await expect(dialog).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('dialog');
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(hinweis.post).toBe(0);
  } finally {
    if (bosseVorher !== null) {
      await page.request.patch('/api/einstellungen', { data: { funktionen: { bossAngriffe: bosseVorher } } });
    }
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
    const schalter = seite.getByRole('switch', { name: 'Auf diesem Gerät', exact: true });
    await expect(schalter).toBeDisabled();
    const schluessel = await oeffentlicherSchluessel(seite);
    if (schluessel) {
      await expect(seite.getByText('Auf dem iPhone nur aus der App auf dem Home-Bildschirm.')).toBeVisible();
    } else {
      await expect(seite.getByText('Auf dem iPhone nur aus der App auf dem Home-Bildschirm.')).toHaveCount(0);
    }
    await seite.screenshot({ path: `tmp-test/benachrichtigungen/${testInfo.project.name}-ios.png` });
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
  const schalter = page.getByRole('switch', { name: 'Auf diesem Gerät', exact: true });
  await expect(schalter).toBeEnabled();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await schalter.click();
  expect(posts).toBe(0);
});

const FRAGE = 'Benachrichtigungen auf diesem Gerät einschalten?';

function teilWelt(): string {
  return verweigereEchteDatenbank(path.join(TEST_KOPIE, 'welten', '4.db'));
}

function setzeNichtVor(iso: string): void {
  const db = new DatabaseSync(teilWelt(), { timeout: 5_000 });
  try {
    db.prepare(
      `INSERT INTO einstellungen (schluessel, wert) VALUES ('hinweis_nicht_vor', ?)
       ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    ).run(JSON.stringify(iso));
  } finally {
    db.close();
  }
}

async function passwortTeil(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function profilZurueck(seite: Page): Promise<void> {
  await seite.evaluate(async () => {
    await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
  });
}

async function vorbereitenTeil(seite: Page): Promise<string> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testteil');
  await seite.locator('input[name="password"]').fill(await passwortTeil());
  await seite.locator('button[type="submit"]').click();
  await seite.waitForFunction(async () => (await fetch('/api/einstellungen')).ok);
  const vorher = await seite.evaluate(async () => {
    const reset = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!reset.ok) {
      throw new Error(`zuruecksetzen ${reset.status}`);
    }
    const stand = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil?: string };
    const stil = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'antik' }),
    });
    if (!stil.ok) {
      throw new Error(`stil ${stil.status}`);
    }
    localStorage.removeItem('stride-sprache');
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
    return typeof stand.stil === 'string' ? stand.stil : 'standard';
  });
  await seite.goto('/');
  await expect(seite.locator('html')).toHaveAttribute('data-stil', 'antik');
  return vorher;
}

async function zumStartTeil(seite: Page): Promise<void> {
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.locator('input[name="nickname"]').fill('Start');
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('checkbox', { name: 'Sport' }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('radio', { name: 'In etwas besser werden' }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await expect(seite.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
}

async function angebotTesten(seite: Page, an: boolean): Promise<void> {
  const ok = await seite.evaluate(async (testen) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angebotTesten: testen }),
    });
    return antwort.ok;
  }, an);
  expect(ok).toBe(true);
}

async function eintraegeLegen(seite: Page, anzahl: number): Promise<void> {
  const status = await seite.evaluate(async (menge) => {
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlageId = vorlagen.find((vorlage) => !vorlage.archiviert && vorlage.projektId === null)?.id;
    if (!vorlageId) {
      return 0;
    }
    for (let index = 0; index < menge; index += 1) {
      const antwort = await fetch('/api/eintraege', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projektId: null,
          vorlageId,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        }),
      });
      if (!antwort.ok) {
        return antwort.status;
      }
    }
    return 201;
  }, anzahl);
  expect(status).toBe(201);
}

async function tragEin(seite: Page): Promise<void> {
  await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = seite.getByRole('dialog', { name: 'Was hast du getan?' });
  const knopf = dialog.getByRole('button', { name: /Eintragen/ });
  await expect(knopf).toBeEnabled();
  await knopf.click();
  await expect(dialog).toHaveCount(0);
  const schleier = seite.locator('div.fixed.inset-0').filter({ hasText: 'Level aufgestiegen' });
  try {
    await schleier.waitFor({ state: 'visible', timeout: 1500 });
    await schleier.click({ position: { x: 8, y: 8 } });
    await expect(schleier).toHaveCount(0);
  } catch {
    // Kein Level-Aufstieg bei diesem Eintrag.
  }
  const schliessen = seite.getByRole('button', { name: 'Schließen' });
  const da = await schliessen.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
  if (!da) {
    return;
  }
  await schliessen.click();
  await expect(schliessen).toBeHidden();
}

async function erlaubnisZaehler(seite: Page): Promise<number> {
  return seite.evaluate(() => {
    const fenster = window as Window & { __erlaubnis?: number };
    return fenster.__erlaubnis ?? 0;
  });
}

test('Angebotskarte nur mit Testschlüssel, Ansehen fragt nicht, Nicht jetzt merkt gesehen', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const fenster = window as Window & { __erlaubnis?: number };
    fenster.__erlaubnis = 0;
    const meldung = window.Notification;
    if (!meldung || typeof meldung.requestPermission !== 'function') {
      return;
    }
    const original = meldung.requestPermission.bind(meldung);
    meldung.requestPermission = ((...args: unknown[]) => {
      fenster.__erlaubnis = (fenster.__erlaubnis ?? 0) + 1;
      return original(...(args as []));
    }) as typeof meldung.requestPermission;
  });
  fs.mkdirSync('tmp-test/benachrichtigungen', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/benachrichtigungen/${testInfo.project.name}-${name}.png`, fullPage: true });
  let stilVorher = 'standard';
  try {
    stilVorher = await vorbereitenTeil(page);
    await zumStartTeil(page);
    setzeNichtVor('2000-01-01T00:00:00.000Z');
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await eintraegeLegen(page, 9);
    await tragEin(page);
    await expect(page.getByRole('region', { name: FRAGE })).toHaveCount(0);
    expect(await erlaubnisZaehler(page)).toBe(0);

    await angebotTesten(page, true);
    await tragEin(page);
    const karte = page.getByRole('region', { name: FRAGE });
    await expect(karte).toBeVisible();
    await expect(karte.getByRole('button', { name: /^Info/ })).toHaveCount(0);
    await expect(karte.getByRole('button', { name: 'Ansehen', exact: true })).toBeVisible();
    await expect(karte.getByRole('button', { name: 'Nicht jetzt', exact: true })).toBeVisible();
    const ident = page.locator('[data-flaeche]').filter({ has: page.locator('[data-levelring]') }).first();
    const oben = await ident.boundingBox();
    const kasten = await karte.boundingBox();
    expect(oben).not.toBeNull();
    expect(kasten).not.toBeNull();
    if (oben && kasten) {
      expect(kasten.y).toBeGreaterThanOrEqual(oben.y + oben.height - 1);
    }
    const streak = page.locator('[data-heute]');
    if ((await streak.count()) > 0 && (await streak.isVisible())) {
      const streakKasten = await streak.boundingBox();
      if (streakKasten && kasten) {
        expect(streakKasten.y).toBeGreaterThan(kasten.y);
      }
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('angebot');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await expect(karte).toBeVisible();
    await karte.getByRole('button', { name: 'Ansehen', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/benachrichtigungen$/);
    await expect(page.getByRole('heading', { name: 'Benachrichtigungen', exact: true })).toBeVisible();
    expect(await erlaubnisZaehler(page)).toBe(0);
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/');
    await expect(karte).toBeVisible();

    await page.route('**/api/hinweise/angebot', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'weg' }) });
        return;
      }
      await route.continue();
    });
    await karte.getByRole('button', { name: 'Nicht jetzt', exact: true }).click();
    await expect(karte).toBeVisible();
    await expect(karte.getByText('Etwas ist schiefgelaufen.')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('angebot-fehler');
    await page.unroute('**/api/hinweise/angebot');

    await karte.getByRole('button', { name: 'Nicht jetzt', exact: true }).click();
    await expect(karte).toHaveCount(0);
    await tragEin(page);
    await expect(karte).toHaveCount(0);
    expect(await erlaubnisZaehler(page)).toBe(0);
  } finally {
    await page.evaluate(async (stil) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stil }),
      });
    }, stilVorher);
    await profilZurueck(page);
  }
});

test('Handbuch nennt die Benachrichtigungen nicht', async ({ page }) => {
  await anmelden(page);
  const vorher = await page.evaluate(async () => {
    const stand = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil?: string };
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'antik' }),
    });
    return { ok: antwort.ok, stil: typeof stand.stil === 'string' ? stand.stil : 'standard' };
  });
  expect(vorher.ok).toBe(true);
  try {
  await page.goto('/handbuch');
  await expect(page.locator('html')).toHaveAttribute('data-stil', 'antik');
  await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();
  const seite = page.locator('main');
  await expect(seite.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
  await expect(seite.getByRole('region', { name: 'Benachrichtigungen' })).toHaveCount(0);
  await expect(seite.getByText('Streak in Gefahr', { exact: true })).toHaveCount(0);
  await expect(seite.getByText('Boss-Datum', { exact: true })).toHaveCount(0);
  await expect(seite.getByText('Ruhezeit', { exact: true })).toHaveCount(0);
  await expect(seite.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await expect(seite.getByText('Fällige Aufgabe')).toHaveCount(0);
  await expect(seite.getByText('Trainingstag')).toHaveCount(0);
  const abgeschnitten = await seite.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(abgeschnitten).toBe(false);
  await ohneSeitlichenUeberlauf(page);
  await seite.locator('#streak').evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'nearest' }));
  fs.mkdirSync('tmp-test/benachrichtigungen', { recursive: true });
  const projekt = test.info().project.name;
  await seite.locator('#streak').screenshot({ path: `tmp-test/benachrichtigungen/${projekt}-karte.png` });
  await page.screenshot({ path: `tmp-test/benachrichtigungen/${projekt}-seite.png` });

  await page.goto('/mehr/neu');
  const verlauf = page.getByRole('region', { name: 'Version 3.17.0' });
  await expect(verlauf).toBeVisible();
  await expect(verlauf.getByText('Unter Mehr schaltest du Benachrichtigungen für dieses Gerät ein. Höchstens eine am Tag.')).toBeVisible();
  await expect(verlauf.getByText('Sie gelten für einen angeschlagenen Streak, für die Rückkehr und für das Boss-Datum am Vortag.')).toBeVisible();
  await expect(verlauf.getByText('In der Ruhezeit bleibt es still. Danach kommt höchstens eine, wenn sie noch stimmt.')).toBeVisible();
  await expect(verlauf.getByText('Nach einem Erfolg kann die Übersicht einmal fragen, ob du Benachrichtigungen einschalten willst.')).toBeVisible();
  await verlauf.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'nearest' }));
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/benachrichtigungen/${projekt}-version.png` });
  } finally {
    const wieder = await page.evaluate(async (stil) => {
      const antwort = await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stil }),
      });
      return antwort.ok;
    }, vorher.stil);
    expect(wieder).toBe(true);
  }
});

const HELL = { stil: 'standard', primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };

async function setzeFarben(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

async function pruefeKnopfZeile(seite: Page, breite: number): Promise<void> {
  await seite.setViewportSize({ width: breite, height: 844 });
  const karte = seite.getByRole('region', { name: FRAGE });
  await karte.scrollIntoViewIfNeeded();
  await expect(karte).toBeVisible();
  const frage = karte.getByText(FRAGE, { exact: true });
  const nicht = karte.getByRole('button', { name: 'Nicht jetzt', exact: true });
  const ansehen = karte.getByRole('button', { name: 'Ansehen', exact: true });
  const nichtKlassen = ((await nicht.getAttribute('class')) ?? '').split(/\s+/);
  const ansehenKlassen = ((await ansehen.getAttribute('class')) ?? '').split(/\s+/);
  expect(nichtKlassen).toContain('knopf');
  expect(nichtKlassen).toContain('knopf-leise');
  expect(ansehenKlassen).toContain('knopf');
  expect(ansehenKlassen).toContain('knopf-primaer');
  const frageKasten = await frage.boundingBox();
  const nichtKasten = await nicht.boundingBox();
  const ansehenKasten = await ansehen.boundingBox();
  expect(frageKasten).not.toBeNull();
  expect(nichtKasten).not.toBeNull();
  expect(ansehenKasten).not.toBeNull();
  if (!frageKasten || !nichtKasten || !ansehenKasten) {
    return;
  }
  const mitte = (kasten: { y: number; height: number }) => kasten.y + kasten.height / 2;
  expect(Math.abs(mitte(nichtKasten) - mitte(ansehenKasten))).toBeLessThanOrEqual(2);
  expect(ansehenKasten.x).toBeGreaterThan(nichtKasten.x);
  expect(ansehenKasten.x - (nichtKasten.x + nichtKasten.width)).toBeGreaterThanOrEqual(4);
  expect(Math.abs(ansehenKasten.x + ansehenKasten.width - (frageKasten.x + frageKasten.width))).toBeLessThanOrEqual(2);
  expect(nichtKasten.x).toBeGreaterThanOrEqual(frageKasten.x + 8);
  expect(nichtKasten.y).toBeGreaterThanOrEqual(frageKasten.y + frageKasten.height - 2);
  await ohneSeitlichenUeberlauf(seite);
}

test('Angebotskarte hält beide Knöpfe in einer Zeile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  let stilVorher = 'standard';
  const abo = 'https://geraet.example/abo-karte';
  try {
    stilVorher = await vorbereitenTeil(page);
    await zumStartTeil(page);
    setzeNichtVor('2000-01-01T00:00:00.000Z');
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await eintraegeLegen(page, 9);
    await angebotTesten(page, true);
    await tragEin(page);
    await expect(page.getByRole('region', { name: FRAGE })).toBeVisible();
    await pruefeKnopfZeile(page, 390);
    await pruefeKnopfZeile(page, 360);

    if (testInfo.project.name === 'handy') {
      fs.mkdirSync('tmp-test/angebotskarte', { recursive: true });
      for (const [name, farben] of [
        ['hell', HELL],
        ['dunkel', DUNKEL],
      ] as const) {
        await setzeFarben(page, farben);
        for (const breite of [390, 360]) {
          await page.setViewportSize({ width: breite, height: 844 });
          await page.goto('/');
          await expect(page.locator('html')).toHaveAttribute('data-schema', name === 'hell' ? 'light' : 'dark');
          const karte = page.getByRole('region', { name: FRAGE });
          await karte.scrollIntoViewIfNeeded();
          await expect(karte).toBeVisible();
          await karte.screenshot({ path: `tmp-test/angebotskarte/karte-${breite}-${name}.png` });
        }
      }
      const db = new DatabaseSync(teilWelt(), { timeout: 5_000 });
      try {
        db.prepare('DELETE FROM push_abos WHERE endpoint = ?').run(abo);
        db.prepare('INSERT INTO push_abos (endpoint, p256dh, auth) VALUES (?, ?, ?)').run(abo, 'abo-p256', 'abo-auth');
      } finally {
        db.close();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/mehr/benachrichtigungen');
      await page.getByRole('button', { name: 'Ruhezeit', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Ruhezeit' });
      await expect(dialog.getByRole('button', { name: 'Abbrechen', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Speichern', exact: true })).toBeVisible();
      await dialog.screenshot({ path: 'tmp-test/angebotskarte/dialog-abbrechen-speichern-390-dunkel.png' });
    }
  } finally {
    const db = new DatabaseSync(teilWelt(), { timeout: 5_000 });
    try {
      db.prepare('DELETE FROM push_abos WHERE endpoint = ?').run(abo);
    } finally {
      db.close();
    }
    await page.evaluate(async (stil) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stil, farbenZuruecksetzen: true }),
      });
    }, stilVorher);
    await profilZurueck(page);
  }
});
