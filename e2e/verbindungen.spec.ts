import { expect, test } from './uhr.ts';
import { anmelden } from './helfer.ts';

test('Übersicht nennt den Status und öffnet Todoist und Kalender', async ({ page }) => {
  await anmelden(page);
  await page.goto('/mehr/inhalte/verbindungen');
  const haupt = page.locator('main');
  await expect(haupt.locator('h1')).toHaveText('Verbindungen');
  await expect(page.getByRole('textbox', { name: 'API-Token' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Kalender verbinden', exact: true })).toHaveCount(0);

  const zeilen = haupt.locator('.zeile');
  await expect(zeilen).toHaveCount(2);
  await expect(zeilen.nth(0)).toContainText('Todoist');
  await expect(zeilen.nth(1)).toContainText('Kalender');
  await expect(zeilen.nth(0).locator('a')).toHaveAttribute('href', '/mehr/inhalte/verbindungen/todoist');
  await expect(zeilen.nth(1).locator('a')).toHaveAttribute('href', '/mehr/inhalte/verbindungen/kalender');

  for (const index of [0, 1]) {
    const zeile = zeilen.nth(index);
    const wert = zeile.locator('[data-zeile-wert]');
    await expect(wert).toHaveText(/^(Verbunden|Fehler|Aus)$/);
    await expect(zeile.locator('svg[aria-hidden="true"]').first()).toBeVisible();
    await expect(zeile.locator('.zeile-pfeil')).toBeVisible();
    const status = (await wert.innerText()).trim();
    const neben = zeile.locator('.zeile-neben');
    if (status === 'Verbunden') {
      await expect(neben).toContainText('abgeglichen');
    } else if (status === 'Fehler') {
      await expect(wert).toHaveText('Fehler');
      if ((await neben.count()) > 0) {
        expect([
          'Token abgelehnt',
          'Nicht erreichbar',
          'Zu viele Anfragen',
          'Antwort fehlerhaft',
          'Adresse ungültig',
          'Kein Zugriff',
          'Nicht gefunden',
          'Kein iCal',
          'Zu groß',
        ]).toContain((await neben.innerText()).trim());
      }
    } else {
      await expect(neben).toHaveCount(0);
    }
    const wertKasten = await wert.boundingBox();
    const pfeilKasten = await zeile.locator('.zeile-pfeil').boundingBox();
    expect(wertKasten).toBeTruthy();
    expect(pfeilKasten).toBeTruthy();
    if (wertKasten && pfeilKasten) {
      expect(pfeilKasten.x).toBeGreaterThan(wertKasten.x);
    }
  }

  await zeilen.nth(0).locator('a').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte\/verbindungen\/todoist$/);
  await expect(page.getByRole('heading', { name: 'Todoist', level: 2 })).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/inhalte/verbindungen');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte\/verbindungen$/);
  await expect(haupt.locator('h1')).toHaveText('Verbindungen');

  await haupt.locator('.zeile').nth(1).locator('a').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte\/verbindungen\/kalender$/);
  await expect(page.getByRole('heading', { name: 'Kalender', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Kalender verbinden', exact: true })).toBeVisible();
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte\/verbindungen$/);
  await expect(page.locator('main h1')).toHaveText('Verbindungen');
});
