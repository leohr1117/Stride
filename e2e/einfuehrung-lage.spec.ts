import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function abstand(seite: Page): Promise<number> {
  const liste = seite.locator('[data-schritt-inhalt]');
  const knopf = seite.locator('.formular-fuss button[type="submit"]');
  await expect(liste).toBeVisible();
  await expect(knopf).toBeVisible();
  const inhalt = await liste.boundingBox();
  const ziel = await knopf.boundingBox();
  expect(inhalt).not.toBeNull();
  expect(ziel).not.toBeNull();
  return ziel!.y - (inhalt!.y + inhalt!.height);
}

test('Weiter steht in der Einführung direkt unter der Liste', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/einfuehrung-lage', { recursive: true });
  const desktop = (page.viewportSize()?.width ?? 0) >= 1200;
  await page.goto('/');
  await page.locator('input[name="username"]').fill('testteil');
  await page.locator('input[name="password"]').fill(await passwort());
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(async () => {
    const antwort = await fetch('/api/einstellungen');
    return antwort.ok;
  });
  await page.evaluate(async () => {
    const antwort = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!antwort.ok) {
      throw new Error(`zuruecksetzen ${antwort.status}`);
    }
    localStorage.removeItem('stride-sprache');
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
  });
  await page.goto('/');

  const schritte = ['sprache', 'name', 'fokus', 'ziel', 'erstes', 'abschluss'];
  for (const schritt of schritte) {
    if (schritt === 'fokus') {
      await expect(page.getByRole('heading', { name: 'Worin willst du wachsen?', exact: true })).toBeVisible();
      await page.getByRole('checkbox', { name: 'Sport' }).click();
    }
    if (schritt === 'abschluss') {
      await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
      await expect(page.locator('[data-schritt-inhalt]')).toBeVisible();
    }
    const luecke = await abstand(page);
    if (desktop) {
      expect(luecke).toBeGreaterThanOrEqual(-1);
      expect(luecke).toBeLessThanOrEqual(24);
      await page.screenshot({ path: `tmp-test/einfuehrung-lage/${schritt}.png` });
    }
    if (schritt === 'erstes') {
      await page.locator('input[name="zielname"]').fill('Lage');
    }
    if (schritt !== 'abschluss') {
      await page.locator('.formular-fuss button[type="submit"]').click();
    }
  }
  await page.locator('.formular-fuss button[type="submit"]').click();
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
});
