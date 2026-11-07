import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PASSWORT_MAX, PASSWORT_REGEL } from '../shared/spiel/passwort.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_PASSWORT } from './testdaten.ts';

function passwort(): string {
  return TEST_PASSWORT;
}

async function bild(seite: Page, name: string): Promise<void> {
  const projekt = test.info().project.name;
  fs.mkdirSync('tmp-test/passwortmanager', { recursive: true });
  await seite.screenshot({ path: `tmp-test/passwortmanager/${projekt}-${name}.png`, fullPage: true });
}

test('Anmeldung ist ein Formular für Passwortmanager', async ({ page }) => {
  await page.goto('/');
  const formular = page.locator('form');
  await expect(formular.locator('button[type="submit"]')).toHaveText('Anmelden');
  const name = page.locator('#username');
  await expect(page.locator('label[for="username"]')).toBeVisible();
  await expect(page.locator('label[for="username"]')).toHaveText('Benutzername');
  await expect(name).toHaveAttribute('name', 'username');
  await expect(name).toHaveAttribute('autocomplete', 'username');
  await expect(name).toHaveAttribute('autocapitalize', 'none');
  await expect(name).toHaveAttribute('autocorrect', 'off');
  await expect(name).toHaveAttribute('spellcheck', 'false');
  const geheim = page.locator('#current-password');
  await expect(page.locator('label[for="current-password"]')).toHaveText('Passwort');
  await expect(geheim).toHaveAttribute('type', 'password');
  await expect(geheim).toHaveAttribute('name', 'password');
  await expect(geheim).toHaveAttribute('autocomplete', 'current-password');
  await expect(geheim).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  expect(PASSWORT_MAX).toBeGreaterThanOrEqual(128);
  const knopf = page.getByRole('button', { name: 'Passwort einblenden' });
  const kasten = await knopf.boundingBox();
  expect(kasten?.width).toBeGreaterThanOrEqual(48);
  expect(kasten?.height).toBeGreaterThanOrEqual(48);
  const paste = await geheim.evaluate((el) => {
    const ereignis = new Event('paste', { bubbles: true, cancelable: true });
    return { offen: el.dispatchEvent(ereignis), onpaste: (el as HTMLInputElement).onpaste };
  });
  expect(paste.offen).toBe(true);
  expect(paste.onpaste).toBeNull();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'anmelden');

  await name.fill('testvoll');
  await geheim.fill('falsches-passwort');
  const laenge = await page.evaluate(() => history.length);
  await geheim.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Anmeldung fehlgeschlagen.');
  await expect(name).toHaveValue('testvoll');
  await expect(geheim).toHaveValue('');
  expect(await page.evaluate(() => history.length)).toBe(laenge);
  await bild(page, 'anmelden-fehler');

  await geheim.fill(passwort());
  const vorher = await page.evaluate(() => history.length);
  await geheim.press('Enter');
  await page.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  expect(await page.evaluate(() => history.length)).toBe(vorher + 1);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Anmelden' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Eintrag loggen|Log entry/ })).toBeVisible();
});

test('Das erste Konto verlangt ein neues Passwort', async ({ page }) => {
  await page.route('**/api/zugang', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modus: 'einrichten', benutzername: null, rolle: null, admin: false }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ fehler: 'Anmeldung fehlgeschlagen.' }),
    });
  });
  await page.goto('/');
  await expect(page.locator('form button[type="submit"]')).toHaveText('Festlegen');
  const name = page.locator('#username');
  const neu = page.locator('#new-password');
  const nochmal = page.locator('#new-password-repeat');
  await expect(name).toHaveAttribute('name', 'username');
  await expect(name).toHaveAttribute('autocomplete', 'username');
  await expect(name).toHaveAttribute('autocapitalize', 'none');
  await expect(name).toHaveAttribute('autocorrect', 'off');
  await expect(name).toHaveAttribute('spellcheck', 'false');
  await expect(page.locator('label[for="username"]')).toBeVisible();
  await expect(neu).toHaveAttribute('type', 'password');
  await expect(neu).toHaveAttribute('autocomplete', 'new-password');
  await expect(neu).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  await expect(nochmal).toHaveAttribute('autocomplete', 'new-password');
  await expect(nochmal).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  const knopf = page.getByRole('button', { name: 'Passwort einblenden' }).first();
  const kasten = await knopf.boundingBox();
  expect(kasten?.width).toBeGreaterThanOrEqual(48);
  expect(kasten?.height).toBeGreaterThanOrEqual(48);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'erstes-konto');

  await name.fill('neu');
  await neu.fill('geheimes-passwort');
  await nochmal.fill('geheimes-passwort');
  await neu.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Anmeldung fehlgeschlagen.');
  await expect(name).toHaveValue('neu');
  await expect(neu).toHaveValue('');
  await expect(nochmal).toHaveValue('');
});

test('Passwort ändern nennt die Regel und die Wechseladresse', async ({ page }) => {
  const umleitung = await page.request.get('/.well-known/change-password', { maxRedirects: 0 });
  expect(umleitung.status()).toBe(302);
  expect(umleitung.headers().location).toBe('/mehr/profil/passwort');

  await anmelden(page);
  await page.goto('/.well-known/change-password');
  await expect(page).toHaveURL(/\/mehr\/profil\/passwort$/);
  await expect(page.getByRole('heading', { name: 'Passwort', level: 1 })).toBeVisible();
  const formular = page.locator('form');
  await expect(formular.locator('button[type="submit"]')).toHaveText('Passwort ändern');
  const konto = formular.locator('input[name="username"]');
  await expect(konto).toHaveAttribute('type', 'hidden');
  await expect(konto).toHaveAttribute('autocomplete', 'username');
  await expect(konto).toHaveValue('testvoll');
  const bisher = page.locator('#current-password');
  const neu = page.locator('#new-password');
  const nochmal = page.locator('#new-password-repeat');
  await expect(bisher).toHaveAttribute('autocomplete', 'current-password');
  await expect(bisher).toHaveAttribute('name', 'current-password');
  await expect(neu).toHaveAttribute('autocomplete', 'new-password');
  await expect(neu).toHaveAttribute('passwordrules', PASSWORT_REGEL);
  await expect(neu).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  await expect(nochmal).toHaveAttribute('autocomplete', 'new-password');
  await expect(nochmal).toHaveAttribute('passwordrules', PASSWORT_REGEL);
  await expect(nochmal).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  await expect(page.locator('label[for="current-password"]')).toBeVisible();
  await expect(page.locator('label[for="new-password"]')).toBeVisible();
  await expect(page.locator('label[for="new-password-repeat"]')).toBeVisible();
  const knopf = page.getByRole('button', { name: 'Bisheriges einblenden' });
  const kasten = await knopf.boundingBox();
  expect(kasten?.width).toBeGreaterThanOrEqual(48);
  expect(kasten?.height).toBeGreaterThanOrEqual(48);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'passwort');

  await page.route('**/api/zugang/passwort', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modus: 'bereit', benutzername: 'testvoll', rolle: null, admin: false }),
    });
  });
  await bisher.fill('altes-geheim');
  await neu.fill('neues-geheim-1');
  await nochmal.fill('neues-geheim-1');
  await neu.press('Enter');
  await expect(page.getByText('Passwort gespeichert.')).toBeVisible();
  await expect(bisher).toHaveValue('');
  await expect(neu).toHaveValue('');
});
