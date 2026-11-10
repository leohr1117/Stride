import fs from 'node:fs';
import { expect, test } from './uhr.ts';
import { anmelden } from './helfer.ts';

test('Ein frisches Konto löscht sich und die anderen Konten bleiben', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const name = `loesch-${projekt}-${Date.now().toString(36)}-${Math.floor(Math.random() * 36).toString(36)}`;
  const passwort = 'Stride-Loesch-2026';
  fs.mkdirSync('tmp-test/konto-loeschen', { recursive: true });
  const bild = (aufnahme: string, fullPage = false) =>
    page.screenshot({ path: `tmp-test/konto-loeschen/${testInfo.project.name}-${aufnahme}.png`, fullPage });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
  const angelegt = await page.evaluate(
    async ({ benutzername, geheim }) => {
      const antwort = await fetch('/api/zugang/registrieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benutzername, passwort: geheim }),
      });
      return { ok: antwort.ok, status: antwort.status, text: await antwort.text() };
    },
    { benutzername: name, geheim: passwort },
  );
  expect(angelegt.ok, `${angelegt.status} ${angelegt.text}`).toBe(true);
  const profil = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profilAngelegt: true, sprache: 'de' }),
    });
    return antwort.ok;
  });
  expect(profil).toBe(true);

  await page.goto('/mehr/profil');
  await expect(page.getByRole('heading', { name: 'Konto', level: 1 })).toBeVisible();
  const anmeldung = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Anmeldung', exact: true, level: 2 }),
  });
  await expect(anmeldung.getByRole('button', { name: 'Konto löschen', exact: true })).toHaveCount(0);
  const zeile = page.getByRole('button', { name: 'Konto löschen', exact: true });
  await expect(zeile).toBeVisible();
  await expect(zeile).toBeEnabled();
  await bild('liste', true);
  await zeile.click();

  const dialog = page.getByRole('alertdialog', { name: 'Konto löschen?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Alle Daten dieses Kontos werden endgültig gelöscht.');
  await expect(dialog.getByRole('link', { name: 'Exportieren', exact: true })).toHaveCount(0);
  await expect(dialog).not.toContainText('keinen Admin');
  const abbrechen = dialog.getByRole('button', { name: 'Abbrechen', exact: true });
  await expect(abbrechen).toBeFocused();
  await bild('dialog');
  await abbrechen.click();
  await expect(dialog).toBeHidden();

  await zeile.click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#konto-loeschen-passwort').fill('falsch-falsch');
  await dialog.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Das Passwort ist falsch.');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Konto', level: 1 })).toBeVisible();
  await expect(page.locator('#profil-benutzername').getByText(name, { exact: true })).toBeVisible();

  await dialog.locator('#konto-loeschen-passwort').fill(passwort);
  await dialog.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Konto gelöscht.');

  await anmelden(page);
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
});
