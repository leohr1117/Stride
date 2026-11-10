import fs from 'node:fs';
import { expect, test } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test('Daten zeigt Export, Import und den Gefahrenbereich', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/daten', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/daten/${testInfo.project.name}-${name}.png`, fullPage: true });
  await anmelden(page);
  await page.goto('/mehr/daten');
  await expect(page.locator('main h1')).toHaveText('Daten');
  const zurueck = page.locator('a[data-zurueck]');
  await expect(zurueck).toHaveAttribute('href', '/mehr');

  const exportZeile = page.locator('[data-zeile="aktion"]').filter({ hasText: 'Exportieren' });
  await expect(exportZeile.locator('a')).toHaveAttribute('href', '/api/export');
  expect(await exportZeile.locator('a').getAttribute('download')).not.toBeNull();
  await expect(exportZeile.locator('svg')).toHaveCount(1);

  const importZeile = page.locator('[data-zeile="aktion"]').filter({ hasText: 'Importieren' });
  await expect(importZeile).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sicherung.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  const importDialog = page.getByRole('alertdialog', { name: 'Sicherung importieren?' });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByText('Der jetzige Stand wird ersetzt.')).toBeVisible();
  await expect(importDialog.getByRole('button', { name: 'Importieren', exact: true })).toBeEnabled();
  await importDialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(importDialog).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Gefahrenbereich', exact: true })).toBeVisible();
  const gefahr = page.locator('[data-zeile="aktion"]').filter({ has: page.getByRole('button', { name: 'Profil zurücksetzen', exact: true }) });
  await expect(gefahr.locator('span.text-gefahr')).toBeVisible();
  await gefahr.getByRole('button', { name: 'Profil zurücksetzen', exact: true }).click();
  const reset = page.getByRole('alertdialog', { name: 'Profil zurücksetzen?' });
  await expect(reset).toBeVisible();
  await expect(reset.getByText('Einträge, Ziele und Tätigkeiten dieses Accounts werden gelöscht, dein Login bleibt.')).toBeVisible();
  await bild('zuruecksetzen');
  const knopf = reset.getByRole('button', { name: 'Zurücksetzen', exact: true });
  await expect(knopf).toBeDisabled();
  await reset.getByLabel('Tippe ZURÜCKSETZEN, um fortzufahren.').fill('zuruecksetzen');
  await expect(knopf).toBeDisabled();
  await reset.getByLabel('Tippe ZURÜCKSETZEN, um fortzufahren.').fill('ZURÜCKSETZEN');
  await expect(knopf).toBeEnabled();
  await reset.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(reset).toHaveCount(0);
  await expect(page).toHaveURL(/\/mehr\/daten$/);

  await ohneSeitlichenUeberlauf(page);
  await bild('seite');
  await zurueck.click();
  await expect(page).toHaveURL(/\/mehr$/);
  await expect(page.locator('main h1')).toHaveText('Mehr');
});
