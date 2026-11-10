import { expect, test } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Aufgaben sind aus Navigation, Funktionen und Übersicht', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-test/ohne-aufgaben/${projekt}-${name}.png`, fullPage: true });

  await page.goto('/mehr/funktionen');
  await expect(page.locator('#funktion-basis')).toBeVisible();
  await expect(page.locator('#funktion-aufgaben')).toHaveCount(0);
  await expect(page.locator('#funktion-training')).toHaveCount(0);
  const reihenfolge = await page.locator('[id^="funktion-"]').evaluateAll((knoten) => knoten.map((knoten) => knoten.id));
  const basis = reihenfolge.indexOf('funktion-basis');
  expect(reihenfolge[basis + 1]).toBe('funktion-chronik');
  await ohneSeitlichenUeberlauf(page);
  await bild('funktionen');

  await expect(page.locator('a[href="/aufgaben"]')).toHaveCount(0);
  await page.goto('/aufgaben');
  await expect(page).toHaveURL('/');
  await expect(page.locator('a[href="/aufgaben"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Heute', level: 1 })).toBeVisible();
  await expect(page.locator('main').getByText('Test Voll', { exact: true }).locator('visible=true')).toHaveCount(1);
  await ohneSeitlichenUeberlauf(page);
  await bild('uebersicht');
});
