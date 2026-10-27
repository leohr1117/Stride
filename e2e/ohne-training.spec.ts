import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Training ist aus Navigation, Funktionen und Übersicht', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/r2/${projekt}-${name}.png`, fullPage: true });

  await page.goto('/mehr/funktionen');
  await expect(page.locator('#funktion-training')).toHaveCount(0);
  await expect(page.locator('#funktion-aufgaben')).toHaveCount(0);
  await expect(page.locator('#funktion-basis')).toBeVisible();
  const reihenfolge = await page.locator('[id^="funktion-"]').evaluateAll((knoten) => knoten.map((knoten) => knoten.id));
  const basis = reihenfolge.indexOf('funktion-basis');
  expect(reihenfolge[basis + 1]).toBe('funktion-chronik');
  await ohneSeitlichenUeberlauf(page);
  await bild('funktionen');

  await expect(page.locator('a[href="/training"]')).toHaveCount(0);
  const plaene = await page.request.get('/api/trainingsplaene');
  expect(plaene.status()).toBe(404);
  const heute = await page.request.get('/api/training/heute');
  expect(heute.status()).toBe(404);

  for (const pfad of ['/training', '/training/plaene/neu', '/training/einheiten/1', '/training/uebungen/1']) {
    await page.goto(pfad);
    await expect(page).toHaveURL('/');
  }
  await expect(page.locator('a[href="/training"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Test Voll', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Heute', level: 2 })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('uebersicht');
});
