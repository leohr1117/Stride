import { expect, test } from './uhr.ts';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

test('Kontaktformular sendet ohne Anmeldung', async ({ page }) => {
  await page.goto('/kontakt');
  await expect(page.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeVisible();
  await expect(page.getByText('Das Kontaktformular ist nicht verfügbar.')).toHaveCount(0);
  await page.getByLabel('Name').fill('Ada');
  await page.getByLabel('E-Mail').fill('ada@example.com');
  await page.getByLabel('Nachricht').fill('Hallo Stride');
  await page.getByRole('button', { name: 'Senden' }).click();
  await expect(page.getByRole('status')).toHaveText('Deine Nachricht ist angekommen.');
  await ohneSeitlichenUeberlauf(page);
});
