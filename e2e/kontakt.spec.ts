import { expect, test } from './uhr.ts';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

test('Kontaktformular sendet ohne Anmeldung', async ({ page }) => {
  await page.goto('/kontakt');
  await expect(page.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeVisible();
  await expect(page.getByText('Das Kontaktformular ist nicht verfügbar.')).toHaveCount(0);
  await expect(page.getByText('Ohne E-Mail ist keine Antwort möglich.')).toBeVisible();
  await page.getByLabel('Name').fill('Ada');
  await page.getByLabel('E-Mail (optional)').fill('ada@example.com');
  await page.getByLabel('Nachricht').fill('Hallo Stride');
  await page.getByRole('button', { name: 'Senden' }).click();
  await expect(page.getByRole('status')).toHaveText('Deine Nachricht ist angekommen.');
  await ohneSeitlichenUeberlauf(page);
});

test('Kontaktformular sendet ohne E-Mail', async ({ page }) => {
  await page.goto('/kontakt');
  await expect(page.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeVisible();
  await expect(page.getByText('Ohne E-Mail ist keine Antwort möglich.')).toBeVisible();
  await expect(page.getByLabel('E-Mail (optional)')).toHaveValue('');
  await page.getByLabel('Name').fill('Ada');
  await page.getByLabel('Nachricht').fill('Hallo ohne Adresse');
  await page.getByRole('button', { name: 'Senden' }).click();
  await expect(page.getByRole('status')).toHaveText('Deine Nachricht ist angekommen.');
  await ohneSeitlichenUeberlauf(page);
});
