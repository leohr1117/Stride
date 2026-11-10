import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const WEG = ['Schnellzugriff', 'Nach Vorliebe', 'Erste Schritte', 'Tätigkeiten prüfen', 'Empfohlen bei Ressourcen'];

async function bild(seite: Page, name: string): Promise<void> {
  await expect(seite.getByText('Lädt …')).toHaveCount(0);
  fs.mkdirSync('tmp-test/seitenstand', { recursive: true });
  await seite.screenshot({ path: `tmp-test/seitenstand/${name}.png` });
}

test('gestrichenes fehlt, Zurück führt aus dem Handbuch nach Mehr', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const handy = projekt === 'handy';
  await anmelden(page);

  await page.goto('/mehr');
  await expect(page.locator('main h1')).toHaveText('Mehr');
  for (const text of WEG) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-mehr`);

  await page.locator('[data-seitenliste] a[href="/handbuch"]').click();
  await expect(page.locator('main h1')).toHaveText('Handbuch');
  await expect(page.getByText('Empfohlen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nach Vorliebe', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Schalten', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-handbuch`);

  if (handy) {
    await page.locator('a[data-zurueck]').click();
    await expect(page.locator('main h1')).toHaveText('Mehr');
  }

  await page.goto('/mehr/profil');
  await expect(page.locator('main h1')).toHaveText('Konto');
  await expect(page.getByRole('link', { name: 'Benutzernamen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ziel-Stufen', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-konto`);

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.getByText('Tätigkeiten prüfen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Erste Schritte', { exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-heute`);

  await page.goto('/ziele');
  await expect(page.locator('main h1')).toHaveText('Ziele');
  await expect(page.locator('.border-s-2')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-ziele`);

  await page.goto('/charakter');
  await expect(page.locator('main h1')).toHaveText('Profil');
  await expect(page.getByRole('link', { name: /^Können/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Fähigkeiten/ })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-profil`);
});
