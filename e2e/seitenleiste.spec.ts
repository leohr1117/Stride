import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const REIHE = [
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
  '/handbuch',
  '/mehr',
];

async function setzeFunktion(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('PC-Seitenleiste in vier Blöcken, Handy bleibt bei der Leiste', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u15/${testInfo.project.name}-${name}.png` });

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Übersicht');
  await ohneSeitlichenUeberlauf(page);

  if (handy) {
    await expect(page.locator('aside.seitenleiste')).toBeHidden();
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Chronik' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toHaveCount(0);
    await expect(leiste.getByRole('link', { name: 'Tätigkeiten', exact: true })).toHaveCount(0);
    await bild('uebersicht');

    await leiste.getByRole('link', { name: 'Mehr' }).click();
    await expect(page.locator('main h1')).toHaveText('Mehr');
    const chips = page.locator('section').filter({ hasText: 'Schnellzugriff' }).locator('.chip-reihe a');
    await expect(chips).toHaveText(['Basis', 'Ziele', 'Rückblick', 'Statistiken', 'Vorbilder', 'Handbuch']);
    await ohneSeitlichenUeberlauf(page);
    await bild('mehr');
    return;
  }

  const seite = page.locator('aside.seitenleiste');
  await expect(seite.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await expect(seite.getByText('Reise', { exact: true })).toHaveCount(0);
  await expect(seite.getByText(/Lvl /)).toHaveCount(0);
  await expect(seite.getByText('Test Voll', { exact: true })).toHaveCount(0);
  const pfade = await seite.locator('a').evaluateAll((liste) => liste.map((eintrag) => eintrag.getAttribute('href')));
  expect(pfade).toEqual(REIHE);
  await expect(seite.locator('[role="separator"]')).toHaveCount(3);
  const profil = seite.getByRole('link', { name: 'Profil', exact: true });
  await expect(profil.locator('.klassenbild')).toBeVisible();
  for (const name of ['Können', 'Haben', 'Fähigkeiten', 'Investitionen']) {
    await expect(seite.getByRole('link', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  await bild('uebersicht');

  await seite.getByRole('link', { name: 'Tätigkeiten', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);
  await expect(page.locator('main h1')).toHaveText('Tätigkeiten');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  await expect(seite.locator('a[href="/mehr/inhalte"]')).toHaveAttribute('aria-current', 'page');
  await expect(seite.locator('a[href="/mehr"]')).not.toHaveAttribute('aria-current', 'page');
  await ohneSeitlichenUeberlauf(page);
  await bild('taetigkeiten');

  await seite.getByRole('link', { name: 'Profil', exact: true }).click();
  await expect(page).toHaveURL(/\/charakter$/);
  await expect(page.locator('main h1')).toHaveText('Profil');
  await expect(seite.locator('a[href="/charakter"]')).toHaveAttribute('aria-current', 'page');
  await ohneSeitlichenUeberlauf(page);
  await bild('profil');

  await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(page.getByRole('dialog', { name: 'Was hast du getan?' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Was hast du getan?' }).getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await setzeFunktion(page, { handbuch: false, vorbilder: false });
  try {
    await page.goto('/');
    await expect(seite.locator('a[href="/handbuch"]')).toHaveCount(0);
    await expect(seite.locator('a[href="/vorbilder"]')).toHaveCount(0);
    await expect(seite.locator('a[href="/chronik"]')).toBeVisible();
    await expect(seite.locator('[role="separator"]')).toHaveCount(2);
    const ohne = await seite.locator('a').evaluateAll((liste) => liste.map((eintrag) => eintrag.getAttribute('href')));
    expect(ohne).toEqual(REIHE.filter((pfad) => pfad !== '/handbuch' && pfad !== '/vorbilder'));
    await ohneSeitlichenUeberlauf(page);
    await bild('aus');
  } finally {
    await setzeFunktion(page, { handbuch: true, vorbilder: true });
  }
});
