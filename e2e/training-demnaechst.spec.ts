import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './aufgabenHelfer.ts';
import { oben, schalte } from './trainingHelfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Demnächst fehlt und /demnaechst hat keinen Hash', async ({ page }, testInfo) => {
  const breit = testInfo.project.name === 'desktop';
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-bau/training-29/${testInfo.project.name}-${name}.png` });
  const seitenleiste = page.locator('aside.seitenleiste');
  const leiste = page.locator('nav.mobilleiste');
  const kopf = page.locator('header.mobilkopf');

  await page.goto('/mehr/funktionen');
  await expect(page.getByRole('heading', { name: 'Funktionen', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seiten', exact: true })).toBeVisible();
  await expect(page.locator('#demnaechst')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demnächst', exact: true })).toHaveCount(0);
  await expect(page.getByText('Training, Lernen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Training, Lernen, Aufgaben')).toHaveCount(0);

  const training = page.locator('#funktion-training');
  const schalter = training.getByRole('switch', { name: 'Training', exact: true });
  await expect(schalter).toBeVisible();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('form').filter({ has: training })).toHaveCount(0);
  await expect(training.getByRole('button', { name: 'Info', exact: true })).toBeVisible();

  if (breit) {
    await expect(seitenleiste.getByRole('link', { name: 'Mehr', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(seitenleiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  } else {
    await expect(kopf.getByRole('link', { name: 'Mehr', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(leiste.getByRole('link', { name: 'Mehr', exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await oben(page);
  await bild('aus');

  await schalte(page, true);
  await expect(schalter).toHaveAttribute('aria-checked', 'true');
  if (breit) {
    const link = seitenleiste.getByRole('link', { name: 'Training', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/training');
  }
  await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await oben(page);
  await bild('an');

  await page.goto('/demnaechst');
  await expect(page).toHaveURL(/\/mehr\/funktionen$/);
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.getByRole('heading', { name: 'Funktionen', exact: true })).toBeVisible();
  await expect(page.locator('#demnaechst')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demnächst', exact: true })).toHaveCount(0);
  await expect(page.getByText('Training, Lernen', { exact: true })).toHaveCount(0);
  await expect(schalter).toHaveAttribute('aria-checked', 'true');
  await ohneSeitlichenUeberlauf(page);
  await oben(page);
  await bild('umleitung');
});
