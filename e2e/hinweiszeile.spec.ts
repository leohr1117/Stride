import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Browser, type Page } from './uhr.ts';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_PASSWORT, TEST_TEIL_WELT, TEST_URL } from './testdaten.ts';

const HINWEIS = 'Stride als App installieren';
const SCHLIESSEN = 'Hinweis ausblenden';
const FRAGE = 'Benachrichtigungen einschalten?';
const BEWERTUNG = 'Wie hilfreich ist Stride gerade?';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const SCHRITTE = ['Tippe auf Teilen.', 'Wähle „Zum Home-Bildschirm“.', 'Tippe auf „Hinzufügen“.'];

function platz(seite: Page) {
  return seite.locator('[data-hinweis-platz]');
}

function zeile(seite: Page, name: string) {
  return platz(seite).getByRole('region', { name, exact: true });
}

async function feuerInstallEreignis(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    const ziel = window as Window & { __installPrompt?: number };
    ziel.__installPrompt = ziel.__installPrompt ?? 0;
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

async function hoeheHoechstens56(seite: Page, name: string): Promise<void> {
  const kasten = await zeile(seite, name).boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    throw new Error('Maße der Zeile fehlen.');
  }
  expect(kasten.height).toBeGreaterThanOrEqual(44);
  expect(kasten.height).toBeLessThanOrEqual(56);
  const text = zeile(seite, name).getByText(name, { exact: true });
  const abgeschnitten = await text.evaluate((element) => element.scrollHeight > element.clientHeight + 1);
  expect(abgeschnitten).toBe(false);
}

async function kontext(browser: Browser, sicht: { width: number; height: number }, userAgent: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: TEST_URL,
    viewport: sicht,
    hasTouch: true,
    isMobile: true,
    userAgent,
    serviceWorkers: 'block',
    locale: 'de-DE',
  });
  await context.addInitScript(() => {
    if (navigator.maxTouchPoints > 1) {
      return;
    }
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { configurable: true, get: () => 5 });
  });
  return context.newPage();
}

async function schalter(seite: Page, koerper: { angebotTesten?: boolean; bewertungTesten?: boolean }): Promise<void> {
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

function setzeNichtVor(): void {
  const db = new DatabaseSync(verweigereEchteDatenbank(TEST_TEIL_WELT), { timeout: 5_000 });
  try {
    db.prepare(
      `INSERT INTO einstellungen (schluessel, wert) VALUES ('hinweis_nicht_vor', ?)
       ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    ).run(JSON.stringify('2000-01-01T00:00:00.000Z'));
  } finally {
    db.close();
  }
}

async function teilVorbereiten(seite: Page): Promise<string> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testteil');
  await seite.locator('input[name="password"]').fill(TEST_PASSWORT);
  await seite.locator('button[type="submit"]').click();
  await seite.waitForFunction(async () => (await fetch('/api/einstellungen')).ok);
  const stil = await seite.evaluate(async () => {
    const reset = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!reset.ok) {
      throw new Error(`zuruecksetzen ${reset.status}`);
    }
    const stand = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil?: string };
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'antik' }),
    });
    if (!antwort.ok) {
      throw new Error(`stil ${antwort.status}`);
    }
    localStorage.removeItem('stride-sprache');
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
    return typeof stand.stil === 'string' ? stand.stil : 'standard';
  });
  await seite.goto('/');
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
  return stil;
}

async function eintraegeLegen(seite: Page): Promise<void> {
  const status = await seite.evaluate(async () => {
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlageId = vorlagen.find((vorlage) => !vorlage.archiviert && vorlage.projektId === null)?.id;
    if (!vorlageId) {
      return 0;
    }
    for (let index = 0; index < 9; index += 1) {
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
  });
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

async function stilZurueck(seite: Page, stil: string): Promise<void> {
  await seite.evaluate(async (vorher) => {
    await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: vorher }),
    });
  }, stil);
}

async function setzeStil(seite: Page, stil: string): Promise<void> {
  const ok = await seite.evaluate(async (name) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: name }),
    });
    return antwort.ok;
  }, stil);
  expect(ok).toBe(true);
  await seite.reload();
  await expect(seite.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await expect.poll(() => seite.evaluate(() => document.documentElement.dataset.stil ?? '')).toBe(stil);
}

test('die Install-Zeile ist schmal, die Tastatur trifft Aktion und Schließen', async ({ page }, testInfo) => {
  mkdirSync('tmp-test/hinweiszeile', { recursive: true });
  await anmelden(page);
  await feuerInstallEreignis(page);
  const banner = zeile(page, HINWEIS);
  await expect(banner).toBeVisible();
  await hoeheHoechstens56(page, HINWEIS);
  const schliessen = banner.getByRole('button', { name: SCHLIESSEN, exact: true });
  await expect(schliessen).toHaveAttribute('title', SCHLIESSEN);
  const installieren = banner.getByRole('button', { name: 'Installieren', exact: true });
  await installieren.focus();
  await page.keyboard.press('Tab');
  await expect(schliessen).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(installieren).toBeFocused();
  await ohneSeitlichenUeberlauf(page);
  if (testInfo.project.name === 'handy') {
    await page.screenshot({ path: 'tmp-test/hinweiszeile/handy-install-zeile.png' });
  }
  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'tmp-test/hinweiszeile/desktop-install-zeile.png' });
  }

  await installieren.click();
  await expect.poll(() => promptZahl(page)).toBe(1);
  await feuerInstallEreignis(page);
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Installieren', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => promptZahl(page)).toBe(2);
  await feuerInstallEreignis(page);
  await banner.getByRole('button', { name: SCHLIESSEN, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(banner).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? '')).not.toBe('BODY');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Eintrag loggen', exact: true })).toBeVisible();
  await expect(zeile(page, HINWEIS)).toHaveCount(0);
  await feuerInstallEreignis(page);
  await expect(zeile(page, HINWEIS)).toHaveCount(0);
});

test('auf 390 und auf dem iPad bleibt die eingeklappte Zeile unter 56 Pixel', async ({ browser }) => {
  const ipad = await kontext(browser, { width: 820, height: 1180 }, IPAD);
  try {
    expect(await ipad.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(1);
    await anmelden(ipad);
    await expect(zeile(ipad, HINWEIS)).toBeVisible();
    await hoeheHoechstens56(ipad, HINWEIS);
    await ipad.setViewportSize({ width: 390, height: 844 });
    await hoeheHoechstens56(ipad, HINWEIS);
  } finally {
    await ipad.context().close();
  }
});

test('auf dem iPhone klappt So gehts auf und zu, ohne Dialog', async ({ browser }, testInfo) => {
  const seite = await kontext(browser, { width: 390, height: 844 }, IPHONE);
  try {
    await anmelden(seite);
    const banner = zeile(seite, HINWEIS);
    const so = banner.getByRole('button', { name: 'So geht’s', exact: true });
    await expect(so).toHaveAttribute('aria-expanded', 'false');
    for (const schritt of SCHRITTE) {
      await expect(banner.getByText(schritt, { exact: true })).toBeHidden();
    }
    await seite.emulateMedia({ reducedMotion: 'no-preference' });
    await so.click();
    await expect(so).toHaveAttribute('aria-expanded', 'true');
    const dauer = await banner.locator('.grid').evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(['0.15s', '150ms']).toContain(dauer);
    for (const schritt of SCHRITTE) {
      await expect(banner.getByText(schritt, { exact: true })).toBeVisible();
    }
    await expect(seite.getByRole('dialog')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(seite);
    if (testInfo.project.name === 'handy') {
      await seite.screenshot({ path: 'tmp-test/hinweiszeile/handy-install-offen-iphone.png' });
    }
    await so.click();
    await expect(so).toHaveAttribute('aria-expanded', 'false');
    for (const schritt of SCHRITTE) {
      await expect(banner.getByText(schritt, { exact: true })).toBeHidden();
    }
    await seite.emulateMedia({ reducedMotion: 'reduce' });
    await so.click();
    const reduziert = await banner.locator('.grid').evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(reduziert === '0s' || reduziert.startsWith('0s')).toBe(true);
    await expect(banner.getByText(SCHRITTE[0], { exact: true })).toBeVisible();
  } finally {
    await seite.context().close();
  }
});

test('eine installierte App zeigt im Platz keine Zeile', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList;
      }
      return original(query);
    };
  });
  await anmelden(page);
  await feuerInstallEreignis(page);
  await expect(platz(page).locator('section')).toHaveCount(0);
});

test('Bewertung und Angebot zugleich zeigen eine Zeile, Bewerten speichert Nicht fragen', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync('tmp-test/hinweiszeile', { recursive: true });
  let stil = 'standard';
  try {
    stil = await teilVorbereiten(page);
    setzeNichtVor();
    await schalter(page, { bewertungTesten: true, angebotTesten: true });
    await eintraegeLegen(page);
    await tragEin(page);
    await expect(platz(page).locator('section')).toHaveCount(1);
    const karte = zeile(page, BEWERTUNG);
    await expect(karte).toBeVisible();
    await expect(zeile(page, FRAGE)).toHaveCount(0);
    const bewerten = karte.getByRole('button', { name: 'Bewerten', exact: true });
    await bewerten.click();
    await expect(bewerten).toHaveAttribute('aria-expanded', 'true');
    const namen = ['1', '2', '3', '4', '5', 'Nicht fragen'];
    for (const name of namen) {
      await expect(karte.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await bewerten.focus();
    await page.keyboard.press('Tab');
    await expect(karte.getByRole('button', { name: SCHLIESSEN, exact: true })).toBeFocused();
    for (const name of namen) {
      await page.keyboard.press('Tab');
      await expect(karte.getByRole('button', { name, exact: true })).toBeFocused();
    }
    await ohneSeitlichenUeberlauf(page);
    if (testInfo.project.name === 'handy') {
      await page.screenshot({ path: 'tmp-test/hinweiszeile/handy-bewertung-offen.png' });
    }
    await setzeStil(page, 'standard');
    await tragEin(page);
    const standardKarte = zeile(page, BEWERTUNG);
    await expect(standardKarte).toBeVisible();
    const bewertenStandard = standardKarte.getByRole('button', { name: 'Bewerten', exact: true });
    await bewertenStandard.click();
    await expect(bewertenStandard).toHaveAttribute('aria-expanded', 'true');
    await expect(standardKarte.getByRole('button', { name: 'Nicht fragen', exact: true })).toBeInViewport({ ratio: 1 });
    if (testInfo.project.name === 'handy') {
      await page.screenshot({ path: 'tmp-test/hinweiszeile/handy-bewertung-standard.png' });
    }
    await standardKarte.getByRole('button', { name: 'Nicht fragen', exact: true }).click();
    await expect(standardKarte).toHaveCount(0);
    await tragEin(page);
    await expect(zeile(page, BEWERTUNG)).toHaveCount(0);
  } finally {
    await stilZurueck(page, stil);
  }
});

test('Ansehen merkt das Angebot nicht, Schließen bleibt nach dem Neuladen weg', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  let posts = 0;
  page.on('request', (anfrage) => {
    if (anfrage.method() === 'POST' && anfrage.url().includes('/api/hinweise/angebot')) {
      posts += 1;
    }
  });
  let stil = 'standard';
  try {
    stil = await teilVorbereiten(page);
    setzeNichtVor();
    await schalter(page, { angebotTesten: true });
    await eintraegeLegen(page);
    await tragEin(page);
    const karte = zeile(page, FRAGE);
    await expect(karte).toBeVisible();
    await setzeStil(page, 'standard');
    await expect(karte).toBeVisible();
    if (testInfo.project.name === 'handy') {
      mkdirSync('tmp-test/hinweiszeile', { recursive: true });
      await page.screenshot({ path: 'tmp-test/hinweiszeile/handy-benachrichtigung-standard.png' });
    }
    await karte.getByRole('button', { name: 'Ansehen', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/benachrichtigungen$/);
    expect(posts).toBe(0);
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(zeile(page, FRAGE)).toBeVisible();
    expect(posts).toBe(0);
    await zeile(page, FRAGE).getByRole('button', { name: SCHLIESSEN, exact: true }).click();
    await expect(zeile(page, FRAGE)).toHaveCount(0);
    await expect.poll(() => posts).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await expect(zeile(page, FRAGE)).toHaveCount(0);
  } finally {
    await stilZurueck(page, stil);
  }
});
