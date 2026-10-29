import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Tätigkeit anlegen ist ein Knopf und öffnet das Formular hier', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/d1/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr/inhalte');
  await expect(page.locator('main h1')).toHaveText('Tätigkeiten');
  await expect(page.getByRole('link', { name: 'Neue Tätigkeit' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tätigkeit anlegen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Neue Tätigkeit' })).toHaveCount(0);

  const knopf = page.getByRole('button', { name: 'Tätigkeit anlegen' });
  await expect(knopf).toBeVisible();
  await expect(knopf.locator('.lucide-chevron-right')).toHaveCount(0);
  const pfeilDaneben = await knopf.evaluate((el) => Boolean(el.parentElement?.querySelector('.lucide-chevron-right')));
  expect(pfeilDaneben).toBe(false);

  await ohneSeitlichenUeberlauf(page);
  await bild('liste');

  const adresse = page.url();
  await knopf.click();
  await expect(page).toHaveURL(adresse);
  const dialog = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('dialog');

  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
    await page.locator('aside.seitenleiste a[href="/mehr"]').click();
  } else {
    await page.locator('a[data-zurueck]').click();
  }
  await expect(page).toHaveURL(/\/mehr$/);
});

test('Im Eintrag öffnet Tätigkeit anlegen das Formular', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(eintrag).toBeVisible();
  const knopf = eintrag.getByRole('button', { name: '+ Tätigkeit' });
  await knopf.scrollIntoViewIfNeeded();
  await expect(knopf).toBeVisible();
  await expect(knopf.locator('.lucide-chevron-right')).toHaveCount(0);
  const adresse = page.url();
  await knopf.click();
  await expect(page).toHaveURL(adresse);
  const dialog = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
  await page.screenshot({ path: `tmp-bau/d1/${testInfo.project.name}-eintrag.png` });
});
