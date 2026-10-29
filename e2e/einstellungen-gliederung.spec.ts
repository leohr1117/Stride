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
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/n2/${testInfo.project.name}-${name}.png`, fullPage: true });
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
  await expect(inhalt.locator('h1')).toHaveText('Übersicht');
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await expect(inhalt.getByRole('link', { name: 'Identität', exact: true })).toHaveCount(0);
  await expect(inhalt.getByRole('switch', { name: 'Identität', exact: true })).toBeChecked();
  await expect(inhalt.getByText('Immer', { exact: true }).first()).toBeVisible();
  await expect(inhalt.getByRole('link', { name: 'Bereich für Bosse', exact: true })).toHaveAttribute('href', '/mehr/funktionen#funktion-bossAngriffe');
  await expect(inhalt.getByRole('link', { name: 'Bereich für Zurück aufstehen', exact: true })).toHaveAttribute('href', '/mehr/funktionen#ziel-stufen');
  await expect(inhalt.getByRole('link', { name: 'Bereich für Basis', exact: true })).toHaveAttribute('href', '/mehr/funktionen#funktion-basis');
  await expect(inhalt.getByRole('link', { name: 'Bereich für Werte', exact: true })).toHaveAttribute('href', '/mehr/funktionen#funktion-koennen');
  await expect(inhalt.getByRole('switch', { name: 'Aktivität', exact: true })).toBeChecked();
  await expect(inhalt.getByRole('link', { name: 'Aktivität', exact: true })).toHaveCount(0);

  const info = inhalt.getByRole('button', { name: 'Info' }).first();
  await info.click();
  const hinweis = page.getByRole('tooltip');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toHaveText('Hier legst du fest, welche Karten die Übersicht zeigt. Den Bereich schaltest du unter App & Verbindungen.');
  const kasten = await hinweis.boundingBox();
  const fenster = page.viewportSize();
  expect(kasten).not.toBeNull();
  expect(fenster).not.toBeNull();
  if (kasten && fenster) {
    expect(kasten.x).toBeGreaterThanOrEqual(0);
    expect(kasten.y).toBeGreaterThanOrEqual(0);
    expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
    expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('uebersicht-info');

  await page.keyboard.press('Escape');
  await expect(hinweis).toHaveCount(0);
  await inhalt.getByRole('link', { name: 'Bereich für Bosse', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/funktionen#funktion-bossAngriffe$/);
  await expect(page.locator('#funktion-bossAngriffe')).toBeInViewport();
  await expect(page.locator('#funktion-bossAngriffe').getByRole('switch', { name: 'Bosse' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('bosse');

  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr\/uebersicht$/);
  await expect(page.locator('main h1')).toHaveText('Übersicht');
});
