import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './aufgabenHelfer.ts';
import { oben, raeume, schalte } from './trainingHelfer.ts';

const BESTWERT_ROUTE = '**/api/uebungen/*/bestwerte';

const EIN_PUNKT = [
  { id: 3, art: 'gewicht', wert: 82500, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
  { id: 2, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' },
  { id: 1, art: 'gewicht', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' },
  { id: 9, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
];

const VOLL = [
  { id: 4, art: 'gewicht', wert: 82500, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
  { id: 3, art: 'gewicht', wert: 80000, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' },
  { id: 2, art: 'gewicht', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' },
  { id: 1, art: 'gewicht', wert: 75000, wiederholungen: 5, erreichtAm: '2026-10-14T12:00:00.000Z' },
  { id: 13, art: 'eins', wert: 96250, wiederholungen: 5, erreichtAm: '2026-10-23T12:00:00.000Z' },
  { id: 12, art: 'eins', wert: 93333, wiederholungen: 5, erreichtAm: '2026-10-21T12:00:00.000Z' },
  { id: 11, art: 'eins', wert: 100000, wiederholungen: 1, erreichtAm: '2026-10-18T12:00:00.000Z' },
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

function tag(iso: string): string {
  return `${new Date(iso).getDate()}.`;
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

async function zurUebung(seite: Page): Promise<void> {
  await seite.locator('main').getByRole('link', { name: 'Kniebeuge', exact: true }).click();
  await expect(seite).toHaveURL(/\/training\/uebungen\/\d+$/);
  await expect(seite.locator('main').locator('[data-zurueck]')).toHaveText('Unterkörper');
}

test('Diagramm ab zwei Schätzpunkten', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const projekt = testInfo.project.name;
  const haupt = page.locator('main');
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/training-210/${projekt}-${name}.png`, fullPage: true });
  let bestand: typeof EIN_PUNKT = EIN_PUNKT;
  try {
    await page.goto('/mehr/funktionen');
    await schalte(page, true);
    await raeume(page);
    expect(await legePlan(page)).toBeGreaterThan(0);
    await page.route(BESTWERT_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bestand) });
    });

    await page.goto('/training');
    const gestartet = page.waitForResponse(
      (res) => res.url().includes('/api/trainingseinheiten') && res.request().method() === 'POST' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'Starten', exact: true }).click();
    await gestartet;
    await expect(page).toHaveURL(/\/training$/);
    await haupt.getByRole('button', { name: 'Öffnen', exact: true }).first().click();
    await expect(page).toHaveURL(/\/training\/einheiten\/\d+$/);
    const einheitUrl = page.url();
    await zurUebung(page);

    await expect(haupt.getByText('82,5 kg × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 96,3 kg')).toBeVisible();
    await expect(haupt.getByText('100,0 kg × 1', { exact: true })).toBeVisible();
    await expect(haupt.getByRole('heading', { name: 'Schätzung', exact: true })).toHaveCount(0);
    await expect(haupt.locator('.recharts-wrapper')).toHaveCount(0);
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await oben(page);
    await bild('ein-punkt');
    await ohneSeitlichenUeberlauf(page);

    await haupt.locator('[data-zurueck]').click();
    await expect(page).toHaveURL(einheitUrl);
    await expect(haupt.locator('[data-zurueck]')).toBeVisible();

    bestand = VOLL;
    await page.goto(einheitUrl);
    await zurUebung(page);
    await expect(haupt.getByText('75,0 kg × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 87,5 kg')).toBeVisible();
    const diagramm = haupt.locator('section').filter({ has: page.getByRole('heading', { name: 'Schätzung', exact: true }) });
    await expect(diagramm).toBeVisible();
    await expect(diagramm.locator('.recharts-bar-rectangle')).toHaveCount(3);
    await expect(diagramm.getByText(tag('2026-10-18T12:00:00.000Z'), { exact: true })).toBeVisible();
    await expect(diagramm.getByText(tag('2026-10-21T12:00:00.000Z'), { exact: true })).toBeVisible();
    await expect(diagramm.getByText(tag('2026-10-23T12:00:00.000Z'), { exact: true })).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await page.waitForTimeout(500);
    await oben(page);
    await bild('voll');
    await page.screenshot({ path: `tmp-bau/training-210/${projekt}-voll-sicht.png` });
    await ohneSeitlichenUeberlauf(page);

    await einheit(page, 'lb');
    await page.goto(einheitUrl);
    await zurUebung(page);
    await expect(haupt.getByText('181,9 lb × 5', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 212,2 lb')).toBeVisible();
    await expect(haupt.getByText('Schätzung 205,8 lb')).toBeVisible();
    await expect(haupt.getByText('220,5 lb × 1', { exact: true })).toBeVisible();
    await expect(haupt.getByText('Schätzung 192,9 lb')).toBeVisible();
    await expect(diagramm.locator('.recharts-bar-rectangle')).toHaveCount(3);
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await page.waitForTimeout(500);
    await oben(page);
    await bild('voll-lb');
    await ohneSeitlichenUeberlauf(page);
    await einheit(page, 'kg');
  } finally {
    await page.unroute(BESTWERT_ROUTE).catch(() => undefined);
    await raeume(page);
  }
});
