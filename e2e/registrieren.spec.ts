import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PASSWORT_MAX } from '../shared/spiel/passwort.ts';

const NAME_VERGEBEN = 'Der Benutzername ist schon vergeben. Wähle einen anderen.';

function bild(seite: Page, name: string): Promise<Buffer> {
  fs.mkdirSync('tmp-test/registrieren', { recursive: true });
  return seite.screenshot({ path: `tmp-test/registrieren/${name}.png` });
}

async function einfuegenOffen(seite: Page, selektor: string): Promise<void> {
  const paste = await seite.locator(selektor).evaluate((el) => {
    const ereignis = new Event('paste', { bubbles: true, cancelable: true });
    return { offen: el.dispatchEvent(ereignis), onpaste: (el as HTMLInputElement).onpaste };
  });
  expect(paste.offen).toBe(true);
  expect(paste.onpaste).toBeNull();
}

test('Neues Konto entsteht auf der Anmeldeseite', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
  const link = page.getByRole('button', { name: 'Konto erstellen', exact: true });
  await expect(link).toBeVisible();
  const lage = await link.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const knopf = document.querySelector('button[type="submit"]')?.getBoundingClientRect();
    return {
      hoehe: kasten.height,
      breite: kasten.width,
      darunter: knopf ? kasten.top >= knopf.bottom - 1 : false,
    };
  });
  expect(lage.hoehe).toBeGreaterThanOrEqual(24);
  expect(lage.breite).toBeGreaterThanOrEqual(24);
  expect(lage.darunter).toBe(true);
  if (projekt === 'handy') {
    await bild(page, 'handy-anmelden-link');
  }

  await link.click();
  await expect(page.getByRole('heading', { name: 'Konto erstellen', exact: true })).toBeVisible();
  const felder = page.locator('form input:not([type="hidden"])');
  await expect(felder).toHaveCount(2);
  const name = page.locator('input[name="username"]');
  const passwort = page.locator('input[name="password"]');
  await expect(name).toHaveAttribute('autocomplete', 'username');
  await expect(passwort).toHaveAttribute('autocomplete', 'new-password');
  await expect(passwort).toHaveAttribute('maxlength', String(PASSWORT_MAX));
  await expect(page.getByText('Mindestens 10 Zeichen.', { exact: true })).toBeVisible();
  await expect(page.getByText('Passwort wiederholen')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveCount(1);
  if (projekt === 'handy') {
    await bild(page, 'handy-konto-erstellen');
  }
  if (projekt === 'desktop') {
    await bild(page, 'desktop-konto-erstellen');
  }

  await einfuegenOffen(page, 'input[name="username"]');
  await einfuegenOffen(page, 'input[name="password"]');
  await name.focus();
  await page.keyboard.insertText('eingefuegt');
  await expect(name).toHaveValue('eingefuegt');
  await passwort.fill('geheim-zum-zeigen');
  await page.getByRole('button', { name: 'Passwort einblenden', exact: true }).click();
  await expect(passwort).toHaveAttribute('type', 'text');
  await expect(passwort).toHaveValue('geheim-zum-zeigen');
  await page.getByRole('button', { name: 'Passwort ausblenden', exact: true }).click();
  await expect(passwort).toHaveAttribute('type', 'password');

  await name.fill('testvoll');
  await passwort.fill('anderes-passwort');
  await page.locator('form button[type="submit"]').click();
  const nameFeld = page.locator('.feld', { has: page.locator('input[name="username"]') });
  await expect(nameFeld).toContainText(NAME_VERGEBEN);
  await expect(name).toHaveValue('testvoll');
  await expect(passwort).toHaveValue('');
  await expect(name).toBeFocused();

  await page.getByRole('button', { name: 'Ich habe schon ein Konto', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
  await expect(page.locator('#current-password')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('button', { name: 'Konto erstellen', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  const neu = `gast-${projekt}-${Date.now().toString(36)}`;
  await page.locator('input[name="username"]').fill(neu);
  await page.locator('input[name="password"]').fill('neues-konto-1');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Sprache', exact: true })).toBeVisible();
  const status = await page.evaluate(async () => {
    const antwort = await fetch('/api/zugang');
    return antwort.json() as Promise<{ modus: string; benutzername: string; rolle: string; admin: boolean }>;
  });
  expect(status).toMatchObject({ modus: 'bereit', benutzername: neu, rolle: 'mitglied', admin: false });
});
