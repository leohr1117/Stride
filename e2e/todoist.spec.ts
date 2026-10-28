import { expect, test, type Page } from '@playwright/test';
import { eintragXp } from '../shared/spiel/xp.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';

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

  await expect(page.getByText('Öffne die Entwicklerseite in Todoist.')).toBeVisible();
  await expect(page.getByText('Kopiere den API-Token.')).toBeVisible();
  await expect(page.getByText('Füge ihn hier ein und tippe auf Verbinden.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Token in Todoist öffnen' })).toHaveAttribute('href', TOKEN_SEITE);
  await page.screenshot({ path: `tmp-bau/v1-token-${info.project.name}.png`, fullPage: true });

  await page.getByRole('textbox', { name: 'API-Token' }).fill('e2e-todoist-token');
  await page.getByRole('button', { name: 'Verbinden' }).click();

  const modus = page.getByRole('combobox', { name: 'Aufgaben ohne Zuordnung' });
  await expect(modus).toHaveValue('keine');
  const vorschau = (xp: number) => page.getByText(`${xp} XP für die letzten Erledigungen`, { exact: true });
  await expect(vorschau(0)).toBeVisible();

  await modus.selectOption('standard');
  await page.getByLabel('Standard-Tätigkeit').selectOption({ index: 1 });
  const basis = eintragXp(null);
  await expect(vorschau(basis)).toBeVisible();

  await modus.selectOption('keine');
  await expect(vorschau(0)).toBeVisible();

  await expect(page.getByRole('button', { name: 'Überspringen' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Zuordnung' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zuordnen' })).toHaveCount(0);

  const kopf = page.getByRole('heading', { name: 'Todoist' }).locator('..');
  await kopf.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('tooltip')).toContainText('15 Minuten');
  await page.keyboard.press('Escape');

  const projekte = page.getByRole('heading', { name: 'Projekte' }).locator('xpath=ancestor::section[1]');
  const post = projekte.locator('div.py-3').filter({ has: page.getByRole('switch', { name: 'Posteingang' }) });
  await expect(post.getByRole('switch', { name: 'Posteingang' })).not.toBeChecked();
  await post.getByRole('switch', { name: 'Posteingang' }).click();
  await expect(post.getByRole('switch', { name: 'Posteingang' })).toBeChecked();
  await expect(vorschau(basis)).toBeVisible();
  for (const name of ['Ziel', 'Tätigkeit', 'Dauer']) {
    await expect(post.getByText(name, { exact: true })).toBeVisible();
    await expect(post.getByRole('combobox', { name })).toBeVisible();
  }
  await expect(post.locator('p').filter({ hasText: '·' }).first()).toBeVisible();

  const labels = page.getByRole('heading', { name: 'Labels' }).locator('xpath=ancestor::section[1]');
  await labels.getByRole('switch', { name: 'Lesen' }).click();
  await labels.getByRole('switch', { name: 'Sport' }).click();
  const sport = labels.locator('div.py-3').filter({ has: page.getByRole('switch', { name: 'Sport' }) });
  for (const name of ['Ziel', 'Tätigkeit', 'Dauer']) {
    await expect(sport.getByText(name, { exact: true })).toBeVisible();
    await expect(sport.getByRole('combobox', { name })).toBeVisible();
  }
  await expect(sport.getByRole('combobox', { name: 'Ziel' })).toHaveText('Wie das Projekt');
  for (const name of ['Tätigkeit', 'Dauer']) {
    await expect(sport.getByRole('combobox', { name }).locator('option:checked')).toHaveText('Wie das Projekt');
  }
  const taetigkeit = sport.getByRole('combobox', { name: 'Tätigkeit' });
  const gewaehlt = (await taetigkeit.locator('option').nth(1).textContent())?.trim() ?? '';
  expect(gewaehlt.length).toBeGreaterThan(0);
  await taetigkeit.selectOption({ index: 1 });
  await expect(sport.locator('p.text-xs')).toContainText(gewaehlt);
  await sport.getByRole('button', { name: 'Weitere Felder' }).click();
  await expect(sport.getByText('Ergebnis', { exact: true })).toBeVisible();
  await expect(sport.getByRole('combobox', { name: 'Ergebnis' }).locator('option:checked')).toHaveText('Wie das Projekt');
  await sport.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('tooltip')).toContainText('Gegner');
  await page.keyboard.press('Escape');
  await sport.getByRole('combobox', { name: 'Ergebnis' }).selectOption({ label: 'Meilenstein' });
  await expect(sport.locator('p.text-xs')).toContainText('Meilenstein');
  await labels.getByRole('button', { name: 'Sport nach oben' }).click();

  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-bau/v4-${info.project.name}.png`, fullPage: true });
});
