import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './aufgabenHelfer.ts';

const INFO = 'Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert.';

async function schalte(seite: Page, an: boolean): Promise<void> {
  const schalter = seite.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  const ist = (await schalter.getAttribute('aria-checked')) === 'true';
  if (ist === an) {
    return;
  }
  const antwort = seite.waitForResponse(
    (res) => res.url().includes('/api/einstellungen') && res.request().method() === 'PATCH' && res.ok(),
  );
  await schalter.click();
  await antwort;
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Schalter Training sitzt hinter Aufgaben und blendet die Navigation', async ({ page }, testInfo) => {
  const breit = testInfo.project.name === 'desktop';
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-bau/training-schalter/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr/funktionen');
  const zeile = page.locator('#funktion-training');
  const schalter = zeile.getByRole('switch', { name: 'Training', exact: true });
  await expect(schalter).toBeVisible();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');

  const reihenfolge = await page.locator('[id^="funktion-"]').evaluateAll((knoten) => knoten.map((knoten) => knoten.id));
  const aufgaben = reihenfolge.indexOf('funktion-aufgaben');
  expect(reihenfolge[aufgaben + 1]).toBe('funktion-training');

  const lage = await zeile.locator('button[aria-label="Info"]').evaluate((knopf) => {
    const kasten = knopf.getBoundingClientRect();
    const huelle = knopf.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : 0;
    const titel = knopf.closest('#funktion-training')?.querySelector('.text-sm');
    const titelKasten = titel?.getBoundingClientRect();
    const delta = titelKasten ? kasten.top + kasten.height / 2 - (titelKasten.top + titelKasten.height / 2) : null;
    return { abstand, delta };
  });
  expect(lage.abstand).toBeGreaterThanOrEqual(5);
  expect(lage.abstand).toBeLessThanOrEqual(8);
  expect(Math.abs(lage.delta ?? 99)).toBeLessThanOrEqual(4);

  const seitenleiste = page.locator('aside.seitenleiste nav');
  const leiste = page.locator('nav.mobilleiste');
  if (breit) {
    await expect(seitenleiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  } else {
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('aus');

  await page.goto('/training');
  await expect(page).toHaveURL('/');

  await page.goto('/mehr/funktionen');
  await zeile.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toHaveText(INFO);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await schalte(page, true);
  await expect(schalter).toHaveAttribute('aria-checked', 'true');

  if (breit) {
    const link = seitenleiste.getByRole('link', { name: 'Training', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/training');
    const texte = (await seitenleiste.locator('a').allInnerTexts()).map((text) => text.trim());
    const trainingIndex = texte.indexOf('Training');
    const aufgabenIndex = texte.indexOf('Aufgaben');
    const basisIndex = texte.indexOf('Basis');
    const vorgaenger = aufgabenIndex >= 0 ? aufgabenIndex : basisIndex >= 0 ? basisIndex : texte.indexOf('Laufend');
    expect(trainingIndex).toBe(vorgaenger + 1);
  } else {
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('an');

  await page.goto('/training');
  await expect(page).toHaveURL(/\/training$/);
  await page.goto('/mehr/funktionen');

  if (!breit) {
    await page.goto('/mehr');
    const sprung = page.getByRole('link', { name: 'Training', exact: true });
    await expect(sprung).toBeVisible();
    await expect(sprung).toHaveAttribute('href', '/training');
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
});
