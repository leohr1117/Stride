import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Leiste, Seitenleiste und Mehr bleiben bei der Seitentabelle', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u12b/${testInfo.project.name}-${name}.png` });

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await ohneSeitlichenUeberlauf(page);

  if (handy) {
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Heute' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Chronik' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toHaveCount(0);
    await expect(leiste.getByRole('link', { name: 'Tätigkeiten', exact: true })).toHaveCount(0);
    await expect(leiste.getByRole('link', { name: 'Können', exact: true })).toHaveCount(0);
    await bild('uebersicht');

    await leiste.getByRole('link', { name: 'Chronik' }).click();
    await expect(page.locator('main h1')).toHaveText('Chronik');
    await ohneSeitlichenUeberlauf(page);
    await bild('chronik');

    await leiste.getByRole('link', { name: 'Mehr' }).click();
    await expect(page.locator('main h1')).toHaveText('Mehr');
    await expect(page.getByRole('link', { name: 'Tätigkeiten' })).toBeVisible();
    const ziele = page.getByRole('link', { name: 'Ziele', exact: true });
    await expect(ziele).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('mehr');
    await ziele.click();
    await expect(page.locator('main h1')).toHaveText('Ziele');
    await ohneSeitlichenUeberlauf(page);
    await bild('ziele');
    return;
  }

  const seite = page.locator('aside.seitenleiste');
  for (const name of ['Heute', 'Ziele', 'Laufend', 'Basis', 'Tätigkeiten', 'Chronik', 'Rückblick', 'Statistiken', 'Vorbilder', 'Profil', 'Können', 'Haben', 'Fähigkeiten', 'Investitionen', 'Handbuch', 'Mehr']) {
    await expect(seite.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(seite.getByText('Reise', { exact: true })).toHaveCount(0);
  await bild('uebersicht');

  await seite.getByRole('link', { name: 'Ziele', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Ziele');
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele');

  await seite.getByRole('link', { name: 'Chronik', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Chronik');
  await ohneSeitlichenUeberlauf(page);
  await bild('chronik');

  await seite.getByRole('link', { name: 'Mehr', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Mehr');
  await expect(page.locator('main').getByRole('link', { name: 'Tätigkeiten' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr');
});
