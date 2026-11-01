import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function bild(seite: Page, name: string, volleSeite = true): Promise<void> {
  fs.mkdirSync('tmp-bau/u18', { recursive: true });
  await seite.screenshot({ path: `tmp-bau/u18/${name}.png`, fullPage: volleSeite });
}

test('Heute behält Maß und folgt der Reihenfolge', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  await anmelden(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toHaveCount(0);
  await expect(page.locator('main .space-y-6')).toHaveCount(1);

  const ring = page.locator('main [data-levelring]').first();
  const ringBreite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(ringBreite).toBe(96);
  const name = page.locator('main .kopfblock-name').locator('visible=true').first();
  await expect(name).toHaveClass(/text-2xl/);
  const schrift = await name.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const stil = await page.evaluate(() => document.documentElement.dataset.stil ?? '');
  if (stil === 'standard') {
    expect(schrift).toBe(17);
  } else {
    expect(schrift).toBeGreaterThan(20);
  }

  const karte = page.locator('main section.karte').first();
  await expect(karte).toHaveClass(/\bp-4\b/);
  const polster = await karte.evaluate((element) => getComputedStyle(element).paddingTop);
  expect(polster).toBe('16px');

  const zeile = await page.locator('[data-wochenwert]').evaluateAll((knoten) =>
    knoten.map((knoten) => {
      const kasten = knoten.getBoundingClientRect();
      const stil = getComputedStyle(knoten);
      return { top: kasten.top, left: kasten.left, rand: stil.borderRightWidth };
    }),
  );
  expect(zeile).toHaveLength(3);
  expect(Math.abs((zeile[0]?.top ?? 0) - (zeile[1]?.top ?? 0))).toBeLessThan(2);
  expect(Math.abs((zeile[1]?.top ?? 0) - (zeile[2]?.top ?? 0))).toBeLessThan(2);
  expect(zeile[1]?.left ?? 0).toBeGreaterThan(zeile[0]?.left ?? 0);
  expect(zeile[0]?.rand).toBe('1px');
  expect(zeile[2]?.rand).toBe('0px');

  const info = page.locator('[data-wochenwert="Streak"]').getByRole('button', { name: 'Info' });
  await info.click();
  await expect(page.getByRole('tooltip')).toContainText('Ein Tag Pause ist frei');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const rueckkehrInfo = page.locator('[data-kette="rueckkehr"]').getByRole('button', { name: 'Info' });
  await rueckkehrInfo.click();
  await expect(page.getByRole('tooltip')).toContainText('Ein Eintrag in sieben Tagen');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.getByRole('button', { name: 'Werte', exact: true }).click();
  const koennen = page.locator('main a[href="/koennen"]');
  const haben = page.locator('main a[href="/haben"]');
  await expect(koennen).toBeVisible();
  await expect(koennen.locator('svg')).toHaveCount(1);
  await expect(haben.locator('svg')).toHaveCount(1);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-werte`);

  await koennen.click();
  await expect(page).toHaveURL(/\/koennen$/);
  await expect(page.locator('main h1')).toHaveText('Können');
  await page.goto('/');

  const basisSchalter = page.getByRole('button', { name: 'Basis', exact: true });
  await basisSchalter.click();
  await expect(page.getByText('Kurz dehnen')).toHaveCount(0);
  await basisSchalter.click();
  await expect(page.getByText('Kurz dehnen')).toBeVisible();
  const basis = page.locator('main a[href="/basis"]');
  await expect(basis).toBeVisible();
  await expect(basis.locator('svg')).toHaveCount(1);
  await basis.click();
  await expect(page).toHaveURL(/\/basis$/);
  await expect(page.locator('main h1')).toHaveText('Basis');
  await page.goto('/');

  const laufend = page.locator('main a[href="/laufend"]');
  await expect(laufend).toBeVisible();
  await expect(laufend).toContainText('Laufend');
  await laufend.click();
  await expect(page).toHaveURL(/\/laufend$/);
  await page.goto('/');
  const projektLink = page.locator('main a[href^="/projekte/"]').first();
  await expect(projektLink).toBeVisible();
  await projektLink.click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  await page.goto('/');
  await expect(page.locator('[data-wochenwert]')).toHaveCount(3);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-oben`, false);
  await bild(page, `${projekt}-heute`);

  if (projekt === 'handy') {
    await expect(page.locator('nav.mobilleiste').getByRole('link', { name: 'Übersicht' })).toBeVisible();
  } else {
    await expect(page.locator('aside.seitenleiste').getByRole('link', { name: 'Übersicht', exact: true })).toBeVisible();
  }

  await page.goto('/charakter');
  const profilRing = page.locator('main [data-levelring]').first();
  const profilBreite = await profilRing.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(profilBreite).toBe(104);
  await expect(page.locator('main .kopfblock-name').locator('visible=true').first()).toHaveClass(/text-2xl/);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-profil`);
});
