import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './aufgabenHelfer.ts';
import { oben, raeume, schalte } from './trainingHelfer.ts';

const SATZ_ROUTE = '**/api/trainingssaetze/**';
const EINHEIT_ROUTE = '**/api/trainingseinheiten/*';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

async function warteHaken(seite: Page, anzahl: number): Promise<void> {
  let offen = anzahl;
  await seite.waitForResponse((res) => {
    const passt = /\/api\/trainingssaetze\/\d+$/.test(new URL(res.url()).pathname) && res.request().method() === 'PATCH' && res.ok();
    if (!passt) {
      return false;
    }
    offen -= 1;
    return offen === 0;
  });
}

async function hake(seite: Page, name: string, index: number): Promise<void> {
  const warte = warteHaken(seite, 1);
  await seite.locator('main').getByRole('button', { name, exact: true }).nth(index).click();
  await warte;
}

test('Durchführung ohne Feld, Kreise und Verwerfen', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const projekt = testInfo.project.name;
  const haupt = page.locator('main');
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/training-27/${projekt}-${name}.png`, fullPage: true });
  const keinFeld = async () => {
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
  };
  try {
    await page.goto('/mehr/funktionen');
    await schalte(page, true);
    await raeume(page);
    const planId = await page.evaluate(async () => {
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
    expect(planId).toBeGreaterThan(0);

    await page.goto('/training');
    const karte = haupt.locator('section').filter({ has: page.getByRole('heading', { name: 'Unterkörper', level: 2 }) });
    const gestartet = page.waitForResponse(
      (res) => res.url().includes('/api/trainingseinheiten') && res.request().method() === 'POST' && res.ok(),
    );
    await karte.getByRole('button', { name: 'Starten', exact: true }).click();
    await gestartet;
    await expect(page).toHaveURL(/\/training$/);
    await haupt.getByRole('button', { name: 'Öffnen', exact: true }).first().click();
    await expect(page).toHaveURL(/\/training\/einheiten\/\d+$/);
    await expect(haupt.getByRole('heading', { name: 'Unterkörper', level: 1 })).toBeVisible();
    await expect(haupt.getByRole('link', { name: 'Training', exact: true })).toBeVisible();
    await expect(haupt.getByText(/^Offen ·/)).toBeVisible();
    await expect(haupt.getByText('40,0 kg × 5')).toHaveCount(2);
    await expect(haupt.getByText('80,0 kg × 5', { exact: true })).toHaveCount(3);
    await expect(haupt.getByText('8 Wiederholungen')).toHaveCount(3);
    await expect(haupt.getByRole('button', { name: 'Abschließen', exact: true })).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Verwerfen', exact: true })).toBeVisible();
    await expect(haupt.getByRole('link', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'kg', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'lb', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Kniebeuge abhaken', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await keinFeld();
    await oben(page);
    await bild('leer');
    await ohneSeitlichenUeberlauf(page);

    await haupt.getByRole('button', { name: 'Info', exact: true }).click();
    await expect(page.getByRole('tooltip')).toHaveText('Nur abhaken. Die Zahlen stehen im Plan.');
    await oben(page);
    await bild('info');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await hake(page, 'Aufwärmen abhaken', 0);
    await hake(page, 'Aufwärmen abhaken', 1);
    await hake(page, 'Satz abhaken', 0);
    await expect(haupt.getByRole('button', { name: 'Kniebeuge abhaken', exact: true })).toHaveAttribute('aria-pressed', 'mixed');
    await keinFeld();
    await oben(page);
    await bild('einheit');
    await ohneSeitlichenUeberlauf(page);

    const aufPfund = page.waitForResponse(
      (res) => res.url().includes('/api/einstellungen') && res.request().method() === 'PATCH' && res.ok(),
    );
    await page.evaluate(async () => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gewichtEinheit: 'lb' }),
      });
    });
    await aufPfund;
    await page.reload();
    await expect(haupt.getByText('88,2 lb × 5', { exact: true })).toHaveCount(2);
    await expect(haupt.getByText('176,4 lb × 5', { exact: true })).toHaveCount(3);
    await expect(haupt.getByText('8 Wiederholungen')).toHaveCount(3);
    await expect(haupt.getByText(/ · lb$/)).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'kg', exact: true })).toHaveCount(0);
    await keinFeld();
    await oben(page);
    await bild('lb');
    await page.evaluate(async () => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gewichtEinheit: 'kg' }),
      });
    });
    await page.reload();
    await expect(haupt.getByText('80,0 kg × 5', { exact: true })).toHaveCount(3);

    await page.route(EINHEIT_ROUTE, async (route) => {
      if (route.request().method() !== 'GET' || route.request().url().includes('/abschliessen')) {
        await route.continue();
        return;
      }
      const antwort = await route.fetch();
      const daten = (await antwort.json()) as { begonnenAm?: string; status?: string; aenderbar?: boolean; beendetAm?: string | null };
      const start = Date.parse(daten.begonnenAm ?? '');
      daten.status = 'fertig';
      daten.aenderbar = false;
      daten.beendetAm = new Date(start + 48 * 60 * 1000).toISOString();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daten) });
    });
    await page.reload();
    await expect(haupt.getByText(/ · fertig$/)).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Satz abhaken', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Abschließen', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Verwerfen', exact: true })).toHaveCount(0);
    await keinFeld();
    await oben(page);
    await bild('verlauf');
    await page.unroute(EINHEIT_ROUTE);
    await page.reload();
    await expect(haupt.getByRole('button', { name: 'Abschließen', exact: true })).toBeVisible();

    await page.route(SATZ_ROUTE, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ fehler: 'Etwas ist schiefgelaufen.' }),
      });
    });
    const letzter = haupt.getByRole('button', { name: 'Satz abhaken', exact: true }).last();
    await expect(letzter).toHaveAttribute('aria-pressed', 'false');
    await letzter.click();
    await expect(haupt.getByText('Etwas ist schiefgelaufen.')).toBeVisible();
    await expect(letzter).toHaveAttribute('aria-pressed', 'false');
    await keinFeld();
    await oben(page);
    await bild('fehler');
    await page.unroute(SATZ_ROUTE);

    await haupt.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Einheit verwerfen' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Die offene Einheit wird verworfen. Der Eintrag und seine XP fallen weg.')).toBeVisible();
    await expect(dialog.locator('input, textarea, select')).toHaveCount(0);
    await keinFeld();
    await bild('dialog');
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/training\/einheiten\/\d+$/);

    const knie = warteHaken(page, 2);
    await haupt.getByRole('button', { name: 'Kniebeuge abhaken', exact: true }).click();
    await knie;
    await expect(haupt.getByRole('button', { name: 'Kniebeuge abhaken', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const zug = warteHaken(page, 3);
    await haupt.getByRole('button', { name: 'Klimmzug abhaken', exact: true }).click();
    await zug;
    const klimmzug = haupt.getByRole('button', { name: 'Klimmzug abhaken', exact: true });
    await expect(klimmzug).toHaveAttribute('aria-pressed', 'true');
    await expect(klimmzug).toBeEnabled();
    await page.waitForTimeout(300);
    await keinFeld();
    await oben(page);
    await bild('voll');

    const abgeschlossen = page.waitForResponse(
      (res) => res.url().includes('/abschliessen') && res.request().method() === 'POST' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'Abschließen', exact: true }).click();
    await abgeschlossen;
    await expect(page.locator('.belohnung')).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Abschließen', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Verwerfen', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Satz abhaken', exact: true }).first()).toBeEnabled();
    await expect(haupt.getByText(/^Fertig ·/)).toBeVisible();
    await keinFeld();
    await oben(page);
    await bild('erfolg');
    await ohneSeitlichenUeberlauf(page);

    await haupt.locator('[data-zurueck]').click();
    await expect(page).toHaveURL(/\/training$/);
    await expect(haupt.getByText('Einheit läuft')).toHaveCount(0);
  } finally {
    await page.unroute(SATZ_ROUTE).catch(() => undefined);
    await page.unroute(EINHEIT_ROUTE).catch(() => undefined);
    await raeume(page);
  }
});
