import { expect, test, type Page } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte as aufgabenAn } from './aufgabenHelfer.ts';
import { oben, raeume, schalte } from './trainingHelfer.ts';

const BESTWERT_ROUTE = '**/api/uebungen/*/bestwerte';
const HEUTE_ROUTE = '**/api/training/heute';
const AUFGABEN_ROUTE = '**/api/aufgaben';
const INFO = 'Aufwärmen zählt nicht. Die Schätzung ist Gewicht mal (1 + Wiederholungen / 30).';

const BESTWERTE = [
  { id: 3, art: 'gewicht', wert: 82500, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
  { id: 2, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' },
  { id: 1, art: 'gewicht', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' },
  { id: 9, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
];

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

function isoTag(datum: string): number {
  const [jahr, monat, tag] = datum.split('-').map(Number);
  const wochentag = new Date(jahr ?? 0, (monat ?? 1) - 1, tag ?? 1).getDay();
  return wochentag === 0 ? 7 : wochentag;
}

function heuteKarte(seite: Page) {
  return seite.locator('main section').filter({ has: seite.getByRole('heading', { name: 'Heute', level: 2 }) });
}

async function legePlan(seite: Page): Promise<number> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/vorlagen');
    const vorlagen = (await antwort.json()) as { id: number; name: string; archiviert: boolean; projektId: number | null }[];
    const training = vorlagen.find((vorlage) => vorlage.name === 'Training' && !vorlage.archiviert && vorlage.projektId === null);
    if (!training) {
      return 0;
    }
    const plan = await fetch('/api/trainingsplaene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unterkörper',
        wochentage: [1, 3, 5],
        projektId: null,
        vorlageId: training.id,
        uebungen: [
          {
            name: 'Kniebeuge',
            art: 'kraft',
            zielSaetze: 3,
            zielWiederholungen: 5,
            zielGewichtG: 80000,
            zielSekunden: null,
            aufwaermSaetze: 2,
            aufwaermWiederholungen: 5,
            aufwaermGewichtG: 40000,
            aufwaermSekunden: null,
          },
          {
            name: 'Klimmzug',
            art: 'kraft',
            zielSaetze: 3,
            zielWiederholungen: 8,
            zielGewichtG: null,
            zielSekunden: null,
            aufwaermSaetze: null,
            aufwaermWiederholungen: null,
            aufwaermGewichtG: null,
            aufwaermSekunden: null,
          },
        ],
      }),
    });
    if (!plan.ok) {
      return 0;
    }
    const daten = (await plan.json()) as { id: number };
    return daten.id;
  });
}

async function einheit(seite: Page, wert: 'kg' | 'lb'): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { gewichtEinheit: wert } });
  expect(antwort.ok()).toBe(true);
}

async function legeAufgaben(seite: Page, projekt: string, heute: string): Promise<void> {
  const vorlagenAntwort = await seite.request.get('/api/vorlagen');
  expect(vorlagenAntwort.ok()).toBe(true);
  const vorlagen = (await vorlagenAntwort.json()) as { id: number; archiviert: boolean }[];
  const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
  expect(vorlage).toBeTruthy();
  for (let index = 1; index <= 6; index += 1) {
    const angelegt = await seite.request.post('/api/aufgaben', {
      data: {
        name: `Bau ${projekt} ${index}`,
        icon: 'clipboard-list',
        projektId: null,
        organisationId: null,
        visionId: null,
        vorlageId: vorlage?.id,
        stunden: null,
        faelligAm: heute,
        faelligUm: null,
        wiederholung: 'keine',
        wochentage: [],
        prioritaet: null,
        nurHeute: false,
        meilenstein: false,
        gegner: false,
        boss: false,
        deadline: null,
      },
    });
    expect(angelegt.ok()).toBe(true);
  }
}

async function zurUebung(seite: Page): Promise<void> {
  await seite.goto('/training');
  await seite.locator('main').getByRole('button', { name: 'Öffnen', exact: true }).first().click();
  await seite.locator('main').getByRole('link', { name: 'Kniebeuge', exact: true }).click();
  await expect(seite).toHaveURL(/\/training\/uebungen\/\d+$/);
  await expect(seite.locator('main').locator('[data-zurueck]')).toHaveText('Unterkörper');
}

test('Heute, Bestwerte und Pfund', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const projekt = testInfo.project.name;
  const haupt = page.locator('main');
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/training-28/${projekt}-${name}.png`, fullPage: true });
  const karteBild = async (name: string) => {
    const karte = heuteKarte(page);
    await karte.scrollIntoViewIfNeeded();
    await karte.screenshot({ path: `tmp-bau/training-28/${projekt}-${name}.png` });
  };
  try {
    await page.goto('/mehr/funktionen');
    await aufgabenAn(page, true);
    await schalte(page, true);
    await raeume(page);
    await raeumeBau(page);
    const planId = await legePlan(page);
    expect(planId).toBeGreaterThan(0);

    await einheit(page, 'lb');
    await page.goto('/training');
    await expect(haupt.getByText('3 × 5 · 176,4 lb', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Aufwärmen · 2 × 5 · 88,2 lb', { exact: true })).toBeVisible();
    await expect(haupt.getByText('3 × 8', { exact: true })).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'lb', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await oben(page);
    await bild('training-lb');
    await ohneSeitlichenUeberlauf(page);
    await einheit(page, 'kg');

    const heute = await heuteDerWelt(page);
    const tage = [...new Set([1, 3, 5, isoTag(heute)])].sort((links, rechts) => links - rechts);
    const tageAntwort = await page.request.patch(`/api/trainingsplaene/${planId}`, { data: { wochentage: tage } });
    expect(tageAntwort.ok()).toBe(true);

    await page.goto('/');
    const zeile = heuteKarte(page).locator('li').filter({ hasText: 'Unterkörper' });
    await expect(zeile.getByRole('button', { name: 'Starten', exact: true })).toBeVisible();
    await expect(zeile).toContainText('Kniebeuge');
    await expect(zeile).toContainText('Klimmzug');
    await expect(zeile.locator('input, textarea, select')).toHaveCount(0);
    await expect(zeile.locator('.aufgaben-kreis')).toHaveCount(0);
    await expect(zeile.getByRole('button', { name: 'Erledigt', exact: true })).toHaveCount(0);
    await karteBild('uebersicht');
    await ohneSeitlichenUeberlauf(page);

    await legeAufgaben(page, projekt, heute);
    await page.goto('/');
    const voll = heuteKarte(page);
    await expect(voll.getByRole('link', { name: 'Alle', exact: true })).toBeVisible();
    const trainingZeile = voll.locator('li').filter({ hasText: 'Unterkörper' });
    await expect(trainingZeile.getByRole('button', { name: 'Starten', exact: true })).toBeVisible();
    await trainingZeile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-bau/training-28/${projekt}-uebersicht-voll-sicht.png` });
    await karteBild('uebersicht-voll');
    await ohneSeitlichenUeberlauf(page);

    const gestartet = page.waitForResponse(
      (res) => res.url().includes('/api/trainingseinheiten') && res.request().method() === 'POST' && res.ok(),
    );
    await voll.locator('li').filter({ hasText: 'Unterkörper' }).getByRole('button', { name: 'Starten', exact: true }).click();
    await gestartet;
    await expect(page).toHaveURL(/\/$/);
    await voll.locator('li').filter({ hasText: 'Unterkörper' }).getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/einheiten\/\d+$/);
    const einheitId = Number(page.url().match(/\/training\/einheiten\/(\d+)/)?.[1]);
    expect(einheitId).toBeGreaterThan(0);
    await expect(haupt.locator('[data-zurueck]')).toHaveText('Übersicht');
    await expect(haupt.getByRole('link', { name: 'Kniebeuge', exact: true })).toBeVisible();
    await haupt.getByRole('link', { name: 'Kniebeuge', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/uebungen\/\d+$/);
    await expect(haupt.locator('[data-zurueck]')).toHaveText('Unterkörper');
    await expect(haupt.getByRole('heading', { name: 'Kniebeuge', level: 1 })).toBeVisible();
    await expect(haupt.getByText('Noch kein Bestwert.')).toBeVisible();
    await expect(haupt.getByText('kg', { exact: true })).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await oben(page);
    await bild('uebung-leer');
    await ohneSeitlichenUeberlauf(page);

    await haupt.getByRole('button', { name: 'Info', exact: true }).click();
    await expect(page.getByRole('tooltip')).toHaveText(INFO);
    await oben(page);
    await bild('uebung-info');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await haupt.locator('[data-zurueck]').click();
    await expect(page).toHaveURL(/\/training\/einheiten\/\d+$/);
    await expect(haupt.locator('[data-zurueck]')).toHaveText('Übersicht');
    const haken = page.waitForResponse(
      (res) => /\/api\/trainingssaetze\/\d+$/.test(new URL(res.url()).pathname) && res.request().method() === 'PATCH' && res.ok(),
    );
    const satz = haupt.getByRole('button', { name: 'Satz abhaken', exact: true }).first();
    await satz.click();
    await haken;
    await expect(satz).toHaveAttribute('aria-pressed', 'true');
    await expect(satz).toBeEnabled();
    await haupt.getByRole('link', { name: 'Kniebeuge', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/uebungen\/\d+$/);
    await expect(haupt.getByText('80,0 kg × 5', { exact: true })).toHaveCount(1);
    await expect(haupt.getByText('Schätzung 93,3 kg')).toBeVisible();
    await expect(haupt.locator('[data-zurueck]')).toHaveText('Unterkörper');

    await page.route(BESTWERT_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BESTWERTE) });
    });
    await zurUebung(page);
    const liste = haupt.locator('section').filter({ has: page.getByText('82,5 kg × 5') }).locator('li');
    await expect(liste).toHaveCount(3);
    await expect(haupt.getByText('Schätzung 96,3 kg')).toBeVisible();
    await expect(haupt.getByText('80,0 kg × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 93,3 kg')).toBeVisible();
    await expect(haupt.getByText('100,0 kg × 1', { exact: true })).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await oben(page);
    await bild('uebung');
    await ohneSeitlichenUeberlauf(page);

    await einheit(page, 'lb');
    await zurUebung(page);
    await expect(haupt.getByText('181,9 lb × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 212,2 lb')).toBeVisible();
    await expect(haupt.getByText('176,4 lb × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 205,8 lb')).toBeVisible();
    await expect(haupt.getByText('220,5 lb × 1', { exact: true })).toBeVisible();
    await expect(haupt.getByText('212,3')).toHaveCount(0);
    await expect(haupt.getByText('205,7')).toHaveCount(0);
    await expect(haupt.getByText('lb', { exact: true })).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await oben(page);
    await bild('uebung-lb');
    await ohneSeitlichenUeberlauf(page);
    await einheit(page, 'kg');
    await page.unroute(BESTWERT_ROUTE);

    await page.route(HEUTE_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ fehler: 'Etwas ist schiefgelaufen.' }),
      });
    });
    await page.goto('/');
    const fehlerKarte = heuteKarte(page);
    const meldung = fehlerKarte.getByText('Etwas ist schiefgelaufen.');
    await expect(meldung).toBeVisible();
    await expect(fehlerKarte.locator('.aufgaben-kreis').first()).toBeVisible();
    await expect(fehlerKarte.getByText('Unterkörper')).toHaveCount(0);
    await meldung.evaluate((knoten) => knoten.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `tmp-bau/training-28/${projekt}-uebersicht-fehler-sicht.png` });
    await karteBild('uebersicht-fehler');
    await page.unroute(HEUTE_ROUTE);

    const fertig = await page.request.post(`/api/trainingseinheiten/${einheitId}/abschliessen`);
    expect(fertig.ok()).toBe(true);
    await page.goto('/');
    const danach = heuteKarte(page);
    await expect(danach.getByText('Unterkörper')).toHaveCount(0);
    await expect(danach.locator('.aufgaben-kreis').first()).toBeVisible();
    await karteBild('uebersicht-danach');

    await page.route(AUFGABEN_ROUTE, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET' || url.pathname !== '/api/aufgaben') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route(HEUTE_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test Voll', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Basis', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heute', level: 2 })).toHaveCount(0);
    await oben(page);
    await bild('uebersicht-leer');
    await ohneSeitlichenUeberlauf(page);
  } finally {
    await page.unroute(BESTWERT_ROUTE).catch(() => undefined);
    await page.unroute(HEUTE_ROUTE).catch(() => undefined);
    await page.unroute(AUFGABEN_ROUTE).catch(() => undefined);
    try {
      await raeume(page);
    } finally {
      await raeumeBau(page);
    }
  }
});
