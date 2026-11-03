import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

interface VorlageZeile {
  id: number;
  name: string;
  projektId: number | null;
  archiviert: boolean;
}

interface ProjektZeile {
  id: number;
  name: string;
  aktiv: boolean;
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
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Projekt-Tätigkeiten nur beim eigenen Projekt', async ({ page }, testInfo) => {
  const vorlagen = (await page.evaluate(async () => {
    const antwort = await fetch('/api/vorlagen');
    return antwort.json();
  })) as VorlageZeile[];
  const projekte = (await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    return (await antwort.json()).projekte;
  })) as ProjektZeile[];
  const gebunden = vorlagen.find((vorlage) => vorlage.projektId !== null && !vorlage.archiviert);
  const allgemein = vorlagen.find((vorlage) => vorlage.projektId === null && !vorlage.archiviert);
  expect(gebunden).toBeTruthy();
  expect(allgemein).toBeTruthy();
  if (!gebunden || !allgemein) {
    return;
  }
  const eigenes = projekte.find((projekt) => projekt.id === gebunden.projektId);
  const fremdes = projekte.find((projekt) => projekt.aktiv && projekt.id !== gebunden.projektId);
  expect(eigenes).toBeTruthy();
  expect(fremdes).toBeTruthy();
  if (!eigenes || !fremdes) {
    return;
  }

  const chip = (name: string) => {
    const muster = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    return page.getByRole('dialog').locator('.chip-reihe button').filter({ hasText: muster });
  };

  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(chip(allgemein.name)).toBeVisible();
  await expect(chip(gebunden.name)).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto(`/projekte/${fremdes.id}`);
  await expect(page.getByRole('button', { name: `${gebunden.name} bearbeiten` })).toHaveCount(0);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(chip(gebunden.name)).toHaveCount(0);
  await expect(chip(allgemein.name)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(`/projekte/${eigenes.id}`);
  await expect(page.getByRole('button', { name: `${gebunden.name} bearbeiten` })).toBeVisible();
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(chip(gebunden.name)).toBeVisible();
  await expect(chip(allgemein.name)).toBeVisible();
  await page.screenshot({ path: `tmp-test/korrektur/${testInfo.project.name}-eintrag.png` });
  await page.keyboard.press('Escape');

  await page.goto('/basis');
  await page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const auswahl = dialog.getByRole('combobox', { name: 'Tätigkeit', exact: true });
  const projektFeld = dialog.getByRole('combobox', { name: /^Projekt\b/ });
  await expect(auswahl.locator('option', { hasText: gebunden.name })).toHaveCount(0);
  await projektFeld.click();
  await page.getByRole('option', { name: eigenes.name, exact: true }).click();
  await expect(auswahl.locator('option', { hasText: gebunden.name })).toHaveCount(1);
  await projektFeld.click();
  await page.getByRole('option', { name: fremdes.name, exact: true }).click();
  await expect(auswahl.locator('option', { hasText: gebunden.name })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/chronik');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const filter = page.getByRole('dialog', { name: 'Filter' });
  await expect(filter.locator('.chip-reihe').getByRole('button', { name: gebunden.name, exact: true })).toHaveCount(0);
  await expect(filter.locator('.chip-reihe').getByRole('button', { name: allgemein.name, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText(/KW \d/)).toHaveCount(0);
  const tage = await page.locator('h2').allInnerTexts();
  for (const tag of tage) {
    expect(tag).not.toMatch(/XP/);
  }
});

test('Chronik, Vision und Version', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/korrektur/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr');
  const version = page.getByRole('link', { name: 'Was ist neu' });
  await version.scrollIntoViewIfNeeded();
  await expect(version).toBeVisible();
  await expect(page.getByText('Der Versionsverlauf lässt sich aufklappen.')).toHaveCount(0);
  await expect(page.getByText('Versionen zählen')).toHaveCount(0);
  await bild('mehr-zu');
  await version.click();
  const aktuell = page.getByRole('region', { name: 'Version 3.3.0' });
  for (const abschnitt of ['Hinzugefügt', 'Verbessert', 'Geändert']) {
    const label = aktuell.getByText(abschnitt, { exact: true });
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeVisible();
  }
  await expect(aktuell.getByText(/^Seiten:/)).toBeVisible();
  await expect(aktuell.getByText(/^Behoben:/)).toHaveCount(0);
  await aktuell.getByText('3.3.0', { exact: true }).scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr-auf');
  const verlauf = page.getByText('Der Versionsverlauf lässt sich aufklappen.');
  await verlauf.scrollIntoViewIfNeeded();
  await expect(verlauf).toBeVisible();
  const klein = page.getByRole('region', { name: 'Version 0.9.1' });
  await klein.scrollIntoViewIfNeeded();
  await expect(klein.getByText('Kleine UI-Verbesserungen.')).toBeVisible();
  await expect(klein.getByText('Hinzugefügt', { exact: true })).toHaveCount(0);
  await expect(klein.getByText('Geändert', { exact: true })).toHaveCount(0);
  await expect(klein.getByText(/^Behoben:/)).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/chronik');
  await expect(page.getByRole('heading', { name: 'Verlauf' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('chronik');
  const eintrag = page.locator('section').filter({ hasText: 'XP' }).getByRole('button').first();
  await eintrag.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/\+[\d.]+ XP/).first()).toBeVisible();
  await page.waitForTimeout(500);
  await ohneSeitlichenUeberlauf(page);
  await bild('chronik-detail');
  await page.keyboard.press('Escape');

  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit und belastbar', exact: true })).toBeVisible();
  await expect(page.getByText('Ein Körper, der den Alltag trägt.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Erreicht' })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele');
  await page.getByRole('button', { name: 'Fit und belastbar', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ein Körper, der den Alltag trägt.')).toBeVisible();
  await expect(dialog.getByText(/Plan/)).toBeVisible();
  await expect(dialog.getByText(/Level/)).toBeVisible();
  await expect(dialog.getByText(/Beute/)).toBeVisible();
  await expect(dialog.getByText(/Meilenstein/)).toBeVisible();
  await expect(dialog.getByText(/XP/).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Aktionen für Fit und belastbar', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await ohneSeitlichenUeberlauf(page);
  await bild('vision-detail');
});
