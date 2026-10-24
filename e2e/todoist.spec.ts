import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

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
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function trennenFallsVerbunden(seite: Page): Promise<void> {
  await seite.getByRole('heading', { name: 'Todoist' }).waitFor();
  const trennen = seite.getByRole('button', { name: 'Aktionen für Todoist' });
  if ((await trennen.count()) === 0) {
    return;
  }
  await trennen.click();
  await seite.getByRole('menuitem', { name: 'Trennen' }).click();
  await seite.getByRole('button', { name: 'Trennen' }).click();
  await seite.getByRole('textbox', { name: 'API-Token' }).waitFor();
}

test('Todoist-Zuordnung bleibt auf Handy und Desktop lesbar', async ({ page }, info) => {
  await anmelden(page);
  await page.goto('/mehr/inhalte/verbindungen');
  await trennenFallsVerbunden(page);
  await page.getByRole('textbox', { name: 'API-Token' }).fill('e2e-todoist-token');
  await page.getByRole('button', { name: 'Verbinden' }).click();

  const projekte = page.getByRole('heading', { name: 'Projekte' }).locator('xpath=ancestor::section[1]');
  await projekte.getByRole('switch', { name: 'Posteingang' }).click();
  await expect(projekte.locator('p').filter({ hasText: '·' }).first()).toBeVisible();

  const kopf = page.getByRole('heading', { name: 'Todoist' }).locator('..');
  await kopf.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('tooltip')).toContainText('15 Minuten');
  await page.keyboard.press('Escape');

  const labels = page.getByRole('heading', { name: 'Labels' }).locator('xpath=ancestor::section[1]');
  await labels.getByRole('switch', { name: 'Lesen' }).click();
  await labels.getByRole('switch', { name: 'Sport' }).click();
  await expect(labels.locator('p').filter({ hasText: 'Wie das Projekt' }).first()).toBeVisible();
  await labels.getByRole('button', { name: 'Sport nach oben' }).click();

  const ueberlauf = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
  await page.screenshot({ path: `e2e/bilder/lauf79-${info.project.name}.png`, fullPage: true });
});
