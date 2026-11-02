import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const EINSTELLUNGEN = [
  '/mehr/profil',
  '/mehr/inhalte/verbindungen',
  '/mehr/funktionen',
  '/mehr/uebersicht',
  '/mehr/darstellung',
  '/mehr/benachrichtigungen',
  '/mehr/daten',
];

test('Einstellungen zeigen Karten auf Heute und Benachrichtigungen vor Daten', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/einstellungen-gliederung/${testInfo.project.name}-${name}.png`, fullPage: true });
  await anmelden(page);
  await page.goto('/mehr');
  await expect(page.locator('main h1')).toHaveText('Mehr');
  await expect(page.locator('[data-abschnitt="einstellungen"] a[href="/mehr/profil"]')).toBeVisible();
  const ziele = await page.locator('[data-abschnitt="einstellungen"] a').evaluateAll((knoten) =>
    knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
  );
  expect(ziele).toEqual(EINSTELLUNGEN);
  await expect(page.locator('main a[href="/mehr/benachrichtigungen"]')).toHaveCount(1);
  await expect(page.locator('nav.mobilleiste a[href="/mehr/benachrichtigungen"]')).toHaveCount(0);
  await expect(page.locator('aside.seitenleiste a[href="/mehr/benachrichtigungen"]')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr');

  const inhalt = page.locator('main');
  await inhalt.locator('a[href="/mehr/uebersicht"]').click();
  await expect(page).toHaveURL(/\/mehr\/uebersicht$/);
  await expect(inhalt.locator('h1')).toHaveText('Karten auf Heute');
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await expect(inhalt.getByRole('link', { name: 'Identität', exact: true })).toHaveCount(0);
  await expect(inhalt.getByRole('switch', { name: 'Identität', exact: true })).toBeChecked();
  await expect(inhalt.getByText('Immer', { exact: true })).toHaveCount(0);
  await expect(inhalt.getByRole('button', { name: 'Info' })).toHaveCount(0);
  await expect(inhalt.getByRole('link', { name: /^Bereich für / })).toHaveCount(0);
  await expect(inhalt.getByRole('switch', { name: 'Aktivität', exact: true })).toBeChecked();
  await expect(inhalt.getByRole('link', { name: 'Aktivität', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('uebersicht-info');
});
