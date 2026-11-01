import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-bau/u18', { recursive: true });
  await seite.screenshot({ path: `tmp-bau/u18/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Heute folgt dem Aufbau aus S5', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toHaveCount(0);

  const ident = page.locator('[data-identitaet]');
  await expect(ident).toBeVisible();
  const ring = ident.locator('[data-levelring]');
  await expect(ring).toBeVisible();
  const ringBreite = await ring.evaluate((element) => element.getBoundingClientRect().width);
  expect(ringBreite).toBeGreaterThanOrEqual(63);
  expect(ringBreite).toBeLessThanOrEqual(65);
  await expect(ident.locator('.kopfblock-name')).toHaveCSS('font-size', '17px');
  await expect(ident.locator('.kopfblock-name')).toHaveCSS('font-weight', '600');

  const zahlen = page.locator('[data-kennzahlen]');
  await expect(zahlen.locator('[data-wochenwert="XP diese Woche"]')).toBeVisible();
  await expect(zahlen.locator('[data-wochenwert="Streak"]')).toBeVisible();
  await expect(zahlen.locator('[data-wochenwert="Momentum"]')).toBeVisible();
  const kachelGrund = await zahlen.locator('[data-wochenwert="XP diese Woche"]').evaluate((element) => {
    const farbe = getComputedStyle(element).backgroundColor;
    return farbe === 'rgba(0, 0, 0, 0)' || farbe === 'transparent';
  });
  expect(kachelGrund).toBe(true);
  await expect(zahlen.locator('[data-wochenwert="Streak"] .lucide-flame')).toBeVisible();

  const basis = page.getByRole('heading', { name: 'Basis' }).locator('a[href="/basis"]');
  await expect(basis).toBeVisible();
  await expect(basis).toContainText('Basis');

  const werte = page.locator('#uebersicht-werte');
  if ((await werte.count()) > 0) {
    const kopf = werte.getByRole('button').first();
    if ((await kopf.getAttribute('aria-expanded')) === 'false') {
      await kopf.click();
    }
    const koennen = werte.locator('a[href="/koennen"]');
    const haben = werte.locator('a[href="/haben"]');
    if ((await koennen.count()) > 0) {
      await expect(koennen).toContainText('Können');
    }
    if ((await haben.count()) > 0) {
      await expect(haben).toContainText('Haben');
    }
  }

  const bosse = page.getByRole('heading', { name: 'Bosse greifen an' });
  if ((await bosse.count()) > 0) {
    const laufend = page.locator('section', { has: bosse }).getByRole('link', { name: 'Laufend' });
    await expect(laufend).toBeVisible();
    await expect(laufend).toHaveAttribute('href', '/laufend');
  }

  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${testInfo.project.name}-heute`);

  await basis.click();
  await expect(page).toHaveURL(/\/basis$/);
  await expect(page.locator('main h1')).toHaveText('Basis');
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${testInfo.project.name}-basis`);

  if (handy) {
    expect(page.viewportSize()?.width).toBe(390);
  } else {
    expect(page.viewportSize()?.width).toBe(1440);
  }
});
