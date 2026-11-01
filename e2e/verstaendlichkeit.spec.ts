import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

function imBild(kasten: { x: number; y: number; width: number; height: number } | null, breite: number, hoehe: number) {
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return;
  }
  expect(kasten.x).toBeGreaterThanOrEqual(0);
  expect(kasten.y).toBeGreaterThanOrEqual(0);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(breite + 1);
  expect(kasten.y + kasten.height).toBeLessThanOrEqual(hoehe + 1);
}

test('Hierarchie, Funktionen und Projekt-Tätigkeit sind erkennbar', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/verstaendlichkeit/${testInfo.project.name}-${name}.png`, fullPage: true });
  const sicht = page.viewportSize() ?? { width: 390, height: 844 };

  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();
  const fit = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fit und belastbar', level: 2 }) });
  const org = fit.locator('[data-ast="organisation"]').filter({ has: page.getByRole('heading', { name: 'Lauftreff', level: 3 }) });
  await expect(org.getByRole('link', { name: /Gruppenläufe/ })).toBeVisible();
  await expect(org.getByRole('link', { name: /Krafttraining/ })).toHaveCount(0);
  const direkt = fit.locator('[data-ast="vision"]');
  await expect(direkt.getByRole('link', { name: /Krafttraining/ })).toBeVisible();
  await expect(direkt.getByRole('link', { name: /Ausdauer/ })).toBeVisible();
  await expect(direkt.getByRole('link', { name: /Gruppenläufe/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele');

  await page.getByRole('link', { name: /App bauen/ }).click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  const taetigkeiten = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nur für dieses Projekt' }) });
  await expect(taetigkeiten.getByText('Nur für App bauen')).toBeVisible();
  await expect(taetigkeiten.getByText('App-Feinschliff')).toBeVisible();
  await expect(taetigkeiten.getByRole('button', { name: 'Info' })).toHaveCount(0);
  await taetigkeiten.getByRole('button', { name: '+ Tätigkeit nur für dieses Projekt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tätigkeit für App bauen' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nur für App bauen')).toBeVisible();
  await dialog.getByRole('button', { name: 'Info' }).click();
  const formularHinweis = page.getByRole('tooltip');
  await expect(formularHinweis).toContainText('nur für dieses Projekt');
  imBild(await formularHinweis.boundingBox(), sicht.width, sicht.height);
  await bild('taetigkeit');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('[data-zurueck]').click();
  await expect(page).toHaveURL(/\/ziele$/);

  await page.goto('/basis');
  await page.getByRole('button', { name: 'Aufgabe' }).click();
  const formular = page.getByRole('dialog', { name: 'Neue Aufgabe' });
  await formular.getByRole('combobox', { name: 'Projekt' }).click();
  const wahl = page.getByRole('dialog', { name: 'Projekt' });
  await expect(wahl.getByRole('option', { name: 'Gruppenläufe', exact: true })).toBeVisible();
  const namen = await wahl.locator('[role="listbox"] > *').evaluateAll((knoten) =>
    knoten.map((knoten) => (knoten.textContent ?? '').trim()),
  );
  const fitIndex = namen.indexOf('Fit und belastbar');
  const kraftIndex = namen.indexOf('Krafttraining');
  const laufIndex = namen.indexOf('Lauftreff');
  const gruppenIndex = namen.indexOf('Gruppenläufe');
  expect(fitIndex).toBeGreaterThanOrEqual(0);
  expect(kraftIndex).toBeGreaterThan(fitIndex);
  expect(laufIndex).toBeGreaterThan(kraftIndex);
  expect(gruppenIndex).toBe(laufIndex + 1);
  await bild('auswahl');
  await wahl.getByRole('option', { name: 'Krafttraining', exact: true }).click();
  await expect(formular.getByRole('combobox', { name: 'Projekt' })).toHaveText('Krafttraining');
  await page.keyboard.press('Escape');

  await page.goto('/mehr');
  const bereiche = page.locator('[data-abschnitt="einstellungen"]').getByRole('link', { name: 'Bereiche', exact: true });
  await expect(bereiche).toBeVisible();
  await expect(page.locator('[data-abschnitt="einstellungen"] a[href="/mehr/funktionen"]').locator('xpath=..')).toContainText(/\d+ an/);
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr');
  await bereiche.click();
  await expect(page).toHaveURL(/\/mehr\/funktionen$/);
  const funktionen = page.getByRole('heading', { name: 'Funktionen', exact: true }).locator('..');
  await funktionen.getByRole('button', { name: 'Info' }).click();
  const funktionsHinweis = page.getByRole('tooltip');
  await expect(funktionsHinweis).toContainText('ein und aus');
  imBild(await funktionsHinweis.boundingBox(), sicht.width, sicht.height);
  await page.keyboard.press('Escape');
  await page.locator('[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);

  await page.goto('/handbuch');
  const nachVorliebe = page.getByRole('button', { name: 'Nach Vorliebe' });
  await expect(nachVorliebe).toHaveAttribute('aria-expanded', 'true');
  const vorliebe = page.locator('section').filter({ has: nachVorliebe });
  await expect(vorliebe.getByText('Basis', { exact: true }).first()).toBeVisible();
  const kopf = nachVorliebe.locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  await kopf.getByRole('button', { name: 'Info' }).click();
  const handbuchHinweis = page.getByRole('tooltip');
  await expect(handbuchHinweis).toContainText('App & Verbindungen');
  imBild(await handbuchHinweis.boundingBox(), sicht.width, sicht.height);
  await ohneSeitlichenUeberlauf(page);
  await bild('handbuch');
});
