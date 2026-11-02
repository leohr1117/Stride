import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Handbuch und Einführung nennen die Bereiche nicht mehr', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-test/reste/${projekt}-${name}.png`, fullPage: true });

  await page.goto('/handbuch');
  await expect(page.getByRole('heading', { name: 'Handbuch', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Einträge', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aufgaben', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/aufgaben"]')).toHaveCount(0);
  await expect(page.locator('a[href="/training"]')).toHaveCount(0);
  await expect(page.getByText('Eigene Aufgaben')).toHaveCount(0);
  await expect(page.getByText('Trainingsplan')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('handbuch');

  await page.goto('/mehr/profil/fokus');
  await expect(page.getByRole('heading', { name: 'Fokus', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sport' })).toContainText('Training, Körper, Schlaf und Ernährung');
  await expect(page.getByText('Eigene Aufgaben')).toHaveCount(0);
  await expect(page.getByText('Trainingsplan')).toHaveCount(0);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Konto');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr\/profil$/);
  await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('fokus-zurueck');

  await page.goto('/mehr/inhalte/verbindungen');
  await expect(page.getByRole('heading', { name: 'Todoist', level: 2 })).toBeVisible();
  await page.getByRole('heading', { name: 'Todoist', level: 2 }).locator('xpath=..').getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('tooltip')).toContainText('Erledigte Aufgaben werden zu Einträgen');
  await page.keyboard.press('Escape');

  await page.goto('/mehr/neu');
  const satz = page.getByText('Handbuch und Einführung nennen die Bereiche Aufgaben und Training nicht mehr.');
  await satz.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await expect(satz).toBeVisible();
  const treffer = await satz.evaluate((el) => {
    const kasten = el.getBoundingClientRect();
    const x = kasten.left + kasten.width / 2;
    const y = kasten.top + kasten.height / 2;
    const oben = document.elementFromPoint(x, y);
    const verdeckt = oben !== null && oben !== el && !el.contains(oben);
    return verdeckt ? `${oben.tagName} ${oben.className}` : '';
  });
  expect(treffer).toBe('');
  await ohneSeitlichenUeberlauf(page);
  await bild('version');
});
