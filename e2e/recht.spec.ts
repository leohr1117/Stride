import { expect, test } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test('Rechtsseiten sind ohne Anmeldung erreichbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Rechtliches' });
  await nav.getByRole('link', { name: 'Impressum', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('c/o COCENTER')).toBeVisible();
  await expect(page.getByText('Koppoldstr. 1')).toBeVisible();
  await expect(page.getByText('86551 Aichach')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kontaktformular', exact: true })).toHaveAttribute('href', '/kontakt');
  const impressum = await page.locator('[data-recht]').innerHTML();
  expect(impressum).not.toContain('<!--');
  expect(impressum).not.toContain('PRÜFEN');
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeVisible();
  await expect(page.getByText('ascend_sitzung')).toBeVisible();
  await expect(page.getByText('30 Tage ab der Anmeldung')).toBeVisible();
  await expect(page.getByText('Thüringer Landesbeauftragten für den Datenschutz und die Informationsfreiheit')).toBeVisible();
  await expect(page.getByText('Cloudflare, Inc.')).toBeVisible();
  await expect(page.getByText('Firebase Cloud Messaging')).toBeVisible();
  await expect(page.getByText('Todoist-API-Token')).toBeVisible();
  await expect(page.getByText('Ich speichere es verschlüsselt')).toBeVisible();
  await expect(page.getByRole('heading', { name: '7. Kalender-Verbindung' })).toBeVisible();
  const daten = await page.locator('[data-recht]').innerHTML();
  expect(daten).not.toContain('<!--');
  expect(daten).not.toContain('Browser und Betriebssystem');
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/nutzungsbedingungen');
  await expect(page.getByRole('heading', { level: 1, name: 'Nutzungsbedingungen' })).toBeVisible();
  await expect(page.getByText('Exportiere wichtige Daten deshalb zusätzlich selbst.')).toBeVisible();
  await expect(page.getByText('so please also export important data yourself.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Terms of Use (English)' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/lizenzhinweise');
  await expect(page.getByRole('heading', { level: 1, name: 'Lizenzhinweise' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Liste der Open-Source-Komponenten' })).toHaveAttribute('href', '/lizenzen.txt');
  await expect(page.getByText('Exo 2, die Schrift der App')).toBeVisible();
  await expect(page.getByText('lucide-react')).toBeVisible();
  const liste = await page.request.get('/lizenzen.txt');
  expect(liste.ok()).toBe(true);
  const text = await liste.text();
  expect(text).toContain('## lucide-react@');
  expect(text).toContain('## @fontsource-variable/exo-2@');
  expect(text).toContain('## @fontsource/cinzel@');
  expect(text).not.toContain('<!--');
  await ohneSeitlichenUeberlauf(page);
});

test('Mehr verlinkt die Rechtsseiten', async ({ page }) => {
  await anmelden(page);
  await page.goto('/mehr');
  const bereich = page.locator('[data-abschnitt="recht"]');
  await bereich.getByRole('link', { name: 'Nutzungsbedingungen', exact: true }).click();
  await expect(page).toHaveURL(/\/nutzungsbedingungen$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nutzungsbedingungen' })).toBeVisible();
  await expect(page.getByText('Exportiere wichtige Daten deshalb zusätzlich selbst.')).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await ohneSeitlichenUeberlauf(page);
});
