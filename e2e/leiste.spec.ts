import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ORIGINAL: string[] = ['/', '/laufend', '/chronik', '/mehr'];

async function leseLeiste(seite: Page): Promise<string[]> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { mobilLeiste: string[] };
  return daten.mobilLeiste;
}

async function setzeLeiste(seite: Page, pfade: string[]): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { mobilLeiste: pfade } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await setzeLeiste(page, ORIGINAL);
});

test('Untere Leiste: gespeicherte Plätze, Standard, Mehr fest, Profil wählbar', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/leiste/${testInfo.project.name}-${name}.png` });

  expect(await leseLeiste(page)).toEqual(ORIGINAL);

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await ohneSeitlichenUeberlauf(page);

  if (handy) {
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Chronik' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toHaveCount(0);
    await expect(leiste.getByRole('link', { name: 'Tätigkeiten', exact: true })).toHaveCount(0);

    const breiten = await leiste.locator('a').evaluateAll((liste) => liste.map((element) => element.getBoundingClientRect().width));
    expect(breiten).toHaveLength(4);
    expect(Math.max(...breiten) - Math.min(...breiten)).toBeLessThan(2);
    const treffer = await leiste.locator('a').first().evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      return { breite: kasten.width, hoehe: kasten.height };
    });
    expect(treffer.breite).toBeGreaterThanOrEqual(48);
    expect(treffer.hoehe).toBeGreaterThanOrEqual(48);

    const aktiv = leiste.locator('a[aria-current="page"]');
    await expect(aktiv).toHaveCSS('font-weight', '600');
    const strich = await aktiv.locator('svg').evaluate((element) => getComputedStyle(element).strokeWidth);
    expect(Number.parseFloat(strich)).toBeCloseTo(2.25, 1);
    await bild('uebersicht');
  }

  await page.goto('/mehr/darstellung/leiste');
  await expect(page.locator('main h1')).toHaveText('Leiste');
  if (!handy) {
    await expect(page.getByText('Gilt nur auf dem Handy.')).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'In der Leiste' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weitere Seiten' })).toBeVisible();
  const profilWahl = page.getByRole('button').filter({ hasText: 'Profil' }).filter({ hasText: 'Hinzufügen' });
  const taetigkeitenWahl = page.getByRole('button').filter({ hasText: 'Tätigkeiten' }).filter({ hasText: 'Hinzufügen' });
  await expect(page.getByRole('button', { name: 'Mehr entfernen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mehr nach oben' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mehr nach unten' })).toHaveCount(0);
  await expect(profilWahl).toBeVisible();
  await expect(taetigkeitenWahl).toBeVisible();
  await expect(profilWahl).toBeDisabled();
  await expect(page.getByText('Alle Plätze sind belegt.').first()).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('editor');

  const entfernt = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('button', { name: 'Laufend entfernen' }).click();
  await entfernt;
  await expect(profilWahl).toBeEnabled();
  const profil = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await profilWahl.click();
  await profil;
  expect(await leseLeiste(page)).toEqual(['/', '/chronik', '/charakter', '/mehr']);

  if (handy) {
    await page.goto('/');
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toHaveCount(0);
    await bild('mit-profil');
    await page.goto('/mehr/darstellung/leiste');
  }

  const standard = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('button', { name: 'Standard' }).click();
  await standard;
  expect(await leseLeiste(page)).toEqual(['/', '/ziele', '/chronik', '/mehr']);

  if (handy) {
    await page.goto('/');
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Ziele' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Chronik' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toHaveCount(0);
    await bild('standard');
  }
});
