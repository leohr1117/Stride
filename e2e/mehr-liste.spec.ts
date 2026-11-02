import { expect, test, type Page } from '@playwright/test';
import { STIL_INFO, type Stil } from '../shared/features/darstellung/stile.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const SEITEN = [
  '/',
  '/ziele',
  '/laufend',
  '/basis',
  '/mehr/inhalte',
  '/chronik',
  '/rueckblick',
  '/statistiken',
  '/vorbilder',
  '/charakter',
  '/koennen',
  '/haben',
  '/faehigkeiten',
  '/investitionen',
  '/handbuch',
];

const EINSTELLUNGEN = [
  '/mehr/profil',
  '/mehr/inhalte/verbindungen',
  '/mehr/funktionen',
  '/mehr/uebersicht',
  '/mehr/darstellung',
  '/mehr/benachrichtigungen',
  '/mehr/daten',
];

async function setzeFunktion(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Mehr ist das Seitenverzeichnis und die Einstellungen', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/mehr-liste/${testInfo.project.name}-${name}.png` });
  await page.goto('/mehr');
  await expect(page.locator('main h1')).toHaveText('Mehr');
  await expect(page.getByRole('heading', { name: 'Seiten', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Einstellungen', exact: true })).toBeVisible();
  await expect(page.getByText('Schnellzugriff')).toHaveCount(0);
  await expect(page.locator('.eintrag-fab')).toHaveCount(0);

  const listen = page.locator('[data-seitenliste]');
  await expect(listen).toHaveCount(4);
  const pfade = await listen.locator('a').evaluateAll((knoten) =>
    knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
  );
  expect(pfade).toEqual(SEITEN);
  await expect(page.locator('[data-seitenliste] a[href="/mehr"]')).toHaveCount(0);
  const profil = page.locator('[data-seitenliste] a[href="/charakter"]');
  await expect(profil.locator('xpath=..').locator('.klassenbild')).toBeVisible();

  const einstellungen = page.locator('[data-abschnitt="einstellungen"]');
  const ziele = await einstellungen.locator('a').evaluateAll((knoten) =>
    knoten.map((knoten) => (knoten instanceof HTMLAnchorElement ? knoten.getAttribute('href') : null)),
  );
  expect(ziele).toEqual(EINSTELLUNGEN);
  await expect(einstellungen.locator('a[href="/mehr/inhalte"]')).toHaveCount(0);
  const zeile = (href: string) => einstellungen.locator('[data-zeile]').filter({ has: page.locator(`a[href="${href}"]`) });
  await expect(zeile('/mehr/profil').locator('span.truncate')).toHaveText('testvoll');
  await expect(zeile('/mehr/inhalte/verbindungen').locator('span.truncate')).toHaveText(/^(Aus|Todoist|Kalender|Todoist, Kalender)$/);
  await expect(zeile('/mehr/funktionen').locator('span.truncate')).toHaveText(/^\d+ an$/);
  await expect(zeile('/mehr/uebersicht').locator('span.truncate')).toHaveText(/^\d+ von 6$/);
  const gelesen = await page.request.get('/api/einstellungen');
  expect(gelesen.ok()).toBe(true);
  const stil = ((await gelesen.json()) as { stil: Stil }).stil;
  await expect(zeile('/mehr/darstellung').locator('span.truncate')).toHaveText(STIL_INFO[stil].label);
  await expect(zeile('/mehr/daten').locator('span.truncate')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr');

  await page.locator('[data-seitenliste] a[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main h1')).toHaveText('Heute');
  if (handy) {
    await page.locator('nav.mobilleiste').getByRole('link', { name: 'Mehr' }).click();
  } else {
    await page.locator('aside.seitenleiste').getByRole('link', { name: 'Mehr', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/mehr$/);

  await page.locator('[data-seitenliste] a[href="/mehr/inhalte"]').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);
  await expect(page.locator('main h1')).toHaveText('Tätigkeiten');
  if (handy) {
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr$/);
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
    await page.locator('aside.seitenleiste').getByRole('link', { name: 'Mehr', exact: true }).click();
  }

  await einstellungen.locator('a[href="/mehr/inhalte/verbindungen"]').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte\/verbindungen$/);
  await expect(page.locator('main h1')).toHaveText('Verbindungen');
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
  await ohneSeitlichenUeberlauf(page);
  await bild('verbindungen');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);

  await page.locator('[data-abschnitt="einstellungen"] a[href="/mehr/funktionen"]').click();
  await expect(page).toHaveURL(/\/mehr\/funktionen$/);
  await expect(page.locator('main h1')).toHaveText('Bereiche');
  await expect(page.getByRole('heading', { name: 'Verbindungen', exact: true })).toHaveCount(0);
  await expect(page.locator('main a[href="/mehr/inhalte/verbindungen"]')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('bereiche');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);

  const version = page.getByRole('link', { name: 'Was ist neu' });
  await version.scrollIntoViewIfNeeded();
  await version.click();
  await expect(page).toHaveURL(/\/mehr\/neu$/);
  await expect(page.locator('[data-changelog]')).toContainText('Mehr zeigt alle eingeschalteten Seiten');
  await ohneSeitlichenUeberlauf(page);
  await bild('version');

  await setzeFunktion(page, { handbuch: false, basis: false });
  try {
    await page.goto('/mehr');
    await expect(page.locator('[data-seitenliste] a[href="/handbuch"]')).toHaveCount(0);
    await expect(page.locator('[data-seitenliste] a[href="/basis"]')).toHaveCount(0);
    await expect(page.locator('[data-seitenliste] a[href="/"]')).toBeVisible();
    await expect(page.locator('[data-seitenliste] a[href="/chronik"]')).toBeVisible();
    await expect(page.locator('[data-seitenliste]')).toHaveCount(3);
    await ohneSeitlichenUeberlauf(page);
    await bild('aus');
  } finally {
    await setzeFunktion(page, { handbuch: true, basis: true });
  }
});
