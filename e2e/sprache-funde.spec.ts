import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';

test.use({ locale: 'en-US' });

function bild(info: TestInfo, sprache: Sprache, name: string): string {
  const ordner = 'tmp-test/sprache-funde';
  fs.mkdirSync(ordner, { recursive: true });
  return `${ordner}/${info.project.name}-${sprache}-${name}.png`;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: /Sign in|Anmelden/ }).click();
  await seite.getByRole('button', { name: /Log entry|Eintrag loggen/ }).waitFor();
}

async function gespeicherteSprache(seite: Page): Promise<Sprache | null> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error(`einstellungen ${antwort.status}`);
    }
    const daten = (await antwort.json()) as { sprache: Sprache | null };
    return daten.sprache;
  });
}

async function setzeSprache(seite: Page, wert: Sprache): Promise<void> {
  await seite.evaluate(async (sprache) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache }),
    });
    if (!antwort.ok) {
      throw new Error(`sprache ${antwort.status}`);
    }
  }, wert);
  await seite.reload();
  await seite.getByRole('button', { name: zeige('Eintrag loggen', wert) }).waitFor();
}

async function zeigeAbschnitt(seite: Page, ziel: string): Promise<void> {
  await seite.locator(ziel).evaluate((element) => element.scrollIntoView({ block: 'center' }));
}

test('übersetzte Funde sind in jeder Sprache sichtbar', async ({ page }, info) => {
  test.setTimeout(240_000);
  await anmelden(page);
  const vorher = await gespeicherteSprache(page);
  try {
    for (const code of SPRACHEN) {
      await setzeSprache(page, code);

      await page.goto('/mehr/darstellung');
      await expect(page.getByRole('heading', { name: zeige('Darstellung', code), exact: true })).toBeVisible();
      const farben = page.locator('#farben');
      await expect(farben).toBeVisible();
      await zeigeAbschnitt(page, '#farben');
      const hell = farben.getByRole('button', { name: zeige('Hell', code), exact: true });
      await expect(hell.first()).toBeVisible();
      await expect(farben.getByRole('button', { name: zeige('Dunkel', code), exact: true }).first()).toBeVisible();
      await expect(farben.getByRole('button', { name: zeige('Tinte', code), exact: true })).toBeVisible();
      await expect(farben.getByRole('button', { name: zeige('Purpur', code), exact: true })).toBeVisible();
      if (code !== 'de') {
        await expect(farben.getByRole('button', { name: 'Hell', exact: true })).toHaveCount(0);
      }
      await page.screenshot({ path: bild(info, code, 'darstellung') });

      await page.goto('/vorbilder/durchschnitt');
      const name = zeige('Durchschnittsmensch', code);
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      const vergleich = page.locator('[data-vergleich]');
      await expect(vergleich).toBeVisible();
      const koerper = vergleich.locator('[data-kennung="koerper"]');
      await expect(koerper).toContainText(zeige('Körper', code));
      if (code !== 'de') {
        await expect(page.getByRole('heading', { name: 'Durchschnittsmensch', exact: true })).toHaveCount(0);
      }
      await zeigeAbschnitt(page, '[data-kennung="koerper"]');
      await page.screenshot({ path: bild(info, code, 'vorbild') });

      await page.goto('/mehr/profil/titel');
      await expect(page.getByRole('heading', { name: zeige('Titel', code), exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: zeige('Erwacht', code), exact: true })).toBeVisible();
      await page.screenshot({ path: bild(info, code, 'titel') });

      await page.goto('/mehr/inhalte/verbindungen');
      await page.getByRole('button', { name: zeige('Kalender', code), exact: true }).click();
      const kalender = page.getByRole('dialog');
      await kalender.getByRole('button', { name: zeige('Google', code), exact: true }).click();
      const schritt = kalender.getByText(zeige('Kopiere die geheime Adresse im iCal-Format.', code));
      await expect(schritt).toBeVisible();
      await expect(kalender.getByText(zeige('iCal-Adresse', code), { exact: true })).toBeVisible();
      await schritt.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: bild(info, code, 'ical') });
      await kalender.getByRole('button', { name: zeige('Schließen', code) }).click();

      await page.goto('/ziele');
      await page.getByRole('button', { name: zeige('Vision', code), exact: true }).click();
      const vision = page.getByRole('dialog');
      await expect(vision.getByText(zeige('Wenn-dann-Plan', code), { exact: true })).toBeVisible();
      await vision.locator('textarea').last().evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: bild(info, code, 'plan') });
      await vision.getByRole('button', { name: zeige('Schließen', code) }).click();
    }
  } finally {
    await setzeSprache(page, vorher ?? 'de');
  }
});
