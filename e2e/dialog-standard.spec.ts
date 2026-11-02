import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function flaecheMindestens(kasten: { width: number; height: number } | null, px: number): void {
  expect(kasten).not.toBeNull();
  expect(kasten!.width).toBeGreaterThanOrEqual(px);
  expect(kasten!.height).toBeGreaterThanOrEqual(px);
}

async function api<T>(seite: Page, pfad: string, methode: string, koerper?: unknown): Promise<T> {
  const antwort = await seite.request.fetch(pfad, { method: methode, data: koerper });
  const text = await antwort.text();
  if (!antwort.ok()) {
    throw new Error(`${methode} ${pfad} ${antwort.status()}: ${text.slice(0, 180)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function scrimBereit(seite: Page): Promise<Locator> {
  const scrim = seite.locator('.dialog-scrim').last();
  await expect.poll(async () =>
    scrim.evaluate((element) => !element.parentElement?.classList.contains('pointer-events-none')),
  ).toBe(true);
  return scrim;
}

async function klickScrim(seite: Page): Promise<void> {
  const scrim = await scrimBereit(seite);
  await scrim.click({ position: { x: 12, y: 12 } });
}

test('Blatt, Fokus und Verwerfen folgen dem Dialog-Standard', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/dialog-standard', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/dialog-standard/${testInfo.project.name}-${name}.png` });
  const handy = testInfo.project.name === 'handy';
  await anmelden(page);

  const ausloeser = page.getByRole('button', { name: 'Eintrag loggen' });
  await ausloeser.click();
  const blatt = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(blatt).toBeVisible();
  const schliessen = blatt.getByRole('button', { name: 'Schließen' });
  flaecheMindestens(await schliessen.boundingBox(), 48);
  const scrim = await scrimBereit(page);
  const scrimStil = await scrim.evaluate((element) => getComputedStyle(element).backdropFilter);
  expect(scrimStil === 'none' || scrimStil === '').toBe(true);
  const lage = await blatt.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    return {
      oben: kasten.top,
      unten: window.innerHeight - kasten.bottom,
      breite: kasten.width,
      radiusOben: stil.borderTopLeftRadius,
      radiusUnten: stil.borderBottomRightRadius,
      griff: Boolean(element.querySelector('.dialog-griff')),
    };
  });
  expect(lage.radiusOben).toBe('12px');
  if (handy) {
    await expect(blatt.locator('.dialog-griff')).toBeVisible();
    expect(lage.unten).toBeLessThan(2);
    expect(lage.radiusUnten).toBe('0px');
    expect(lage.breite).toBeGreaterThan(360);
  } else {
    await expect(blatt.locator('.dialog-griff')).toBeHidden();
    expect(lage.oben).toBeGreaterThan(24);
    expect(lage.unten).toBeGreaterThan(24);
    expect(lage.breite).toBeGreaterThan(540);
    expect(lage.breite).toBeLessThan(580);
    expect(lage.radiusUnten).toBe('12px');
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('blatt');
  await schliessen.click();
  await expect(blatt).toBeHidden();
  await expect(ausloeser).toBeFocused();

  await ausloeser.click();
  await expect(blatt).toBeVisible();
  const notiz = blatt.getByRole('textbox', { name: 'Notiz' });
  await notiz.fill('Notiz noch offen');
  await klickScrim(page);
  const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
  await expect(frage).toBeVisible();
  await expect(frage.getByText('Die Eingaben in diesem Blatt gehen verloren.')).toBeVisible();
  await expect(frage.getByRole('button', { name: 'Weiter bearbeiten' })).toBeFocused();
  await expect(frage.getByRole('button', { name: 'Schließen' })).toHaveCount(0);
  await bild('verwerfen');
  await frage.getByRole('button', { name: 'Weiter bearbeiten' }).click();
  await expect(frage).toBeHidden();
  await expect(notiz).toHaveValue('Notiz noch offen');
  await page.keyboard.press('Escape');
  await expect(frage).toBeVisible();
  await frage.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(ausloeser).toBeFocused();
});

test('Warndialog sitzt mittig und der Fokus startet auf Abbrechen', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/dialog-standard', { recursive: true });
  await anmelden(page);
  await page.goto('/mehr/profil');
  const abmelden = page.getByRole('button', { name: 'Abmelden', exact: true });
  await abmelden.click();
  const warnung = page.getByRole('alertdialog', { name: 'Abmelden?' });
  await expect(warnung).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Abmelden?' })).toHaveCount(0);
  const abbrechen = warnung.getByRole('button', { name: 'Abbrechen' });
  await expect(abbrechen).toBeFocused();
  await expect(warnung.getByRole('button', { name: 'Schließen' })).toHaveCount(0);
  await expect(warnung.locator('.dialog-griff')).toHaveCount(0);
  flaecheMindestens(await abbrechen.boundingBox(), 48);
  flaecheMindestens(await warnung.getByRole('button', { name: 'Abmelden' }).boundingBox(), 48);
  const lage = await warnung.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    return {
      oben: kasten.top,
      unten: window.innerHeight - kasten.bottom,
      radius: stil.borderTopLeftRadius,
    };
  });
  expect(lage.oben).toBeGreaterThan(8);
  expect(lage.unten).toBeGreaterThan(8);
  expect(lage.radius).toBe('12px');
  await page.keyboard.press('Tab');
  await expect(warnung.getByRole('button', { name: 'Abmelden' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(abbrechen).toBeFocused();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/dialog-standard/${testInfo.project.name}-warnung.png` });
  await abbrechen.click();
  await expect(warnung).toBeHidden();
  await expect(abmelden).toBeFocused();
});

test('Bereich im Verlauf ist eine Liste mit Farbpunkt, Haken und Alle', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/dialog-standard', { recursive: true });
  const titel = `Bereich-Test-${testInfo.project.name}`;
  await anmelden(page);
  const vorher = await api<{ ebenen: { visionen: boolean } }>(page, '/api/einstellungen', 'GET');
  let visionId: number | null = null;
  try {
    await api(page, '/api/einstellungen', 'PATCH', { ebenen: { visionen: true } });
    const vision = await api<{ id: number }>(page, '/api/visionen', 'POST', {
      titel,
      beschreibung: '',
      farbe: '#cc3366',
      woopErgebnis: '',
      woopHindernis: '',
      woopPlan: '',
      level: null,
    });
    visionId = vision.id;
    await page.goto('/chronik');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const filter = page.getByRole('dialog', { name: 'Filter' });
    const wahl = filter.getByRole('combobox', { name: 'Bereich' });
    await expect(wahl).toBeVisible();
    await wahl.click();
    const blatt = page.getByRole('dialog', { name: 'Bereich' });
    await expect(blatt).toBeVisible();
    const alle = blatt.getByRole('option', { name: 'Alle', exact: true });
    await expect(alle).toBeFocused();
    await expect(alle).toHaveAttribute('aria-selected', 'true');
    await expect(alle.locator('svg')).toBeVisible();
    const option = blatt.getByRole('option', { name: titel });
    await option.scrollIntoViewIfNeeded();
    flaecheMindestens(await option.boundingBox(), 48);
    const farbe = await option.locator('[data-farbpunkt]').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(farbe.replaceAll(' ', '')).toBe('rgb(204,51,102)');
    await option.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(option.locator('svg')).toBeVisible();
    await expect(alle).toHaveAttribute('aria-selected', 'false');
    await blatt.getByRole('button', { name: 'Anwenden' }).focus();
    await page.keyboard.press('Tab');
    await expect(blatt.getByRole('button', { name: 'Schließen' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(blatt.getByRole('button', { name: 'Anwenden' })).toBeFocused();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/dialog-standard/${testInfo.project.name}-bereich.png` });
    await blatt.getByRole('button', { name: 'Anwenden' }).click();
    await expect(blatt).toBeHidden();
    await expect(wahl).toContainText(titel);
    await expect(wahl).toBeFocused();
  } finally {
    if (visionId !== null) {
      await api(page, `/api/visionen/${visionId}`, 'DELETE').catch(() => undefined);
    }
    await api(page, '/api/einstellungen', 'PATCH', { ebenen: { visionen: vorher.ebenen.visionen } }).catch(() => undefined);
  }
});

test('Loslassen gilt sofort und die Meldung bietet Rückgängig', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/dialog-standard', { recursive: true });
  await anmelden(page);
  const boss = page.locator('section', { has: page.getByRole('heading', { name: 'Bosse greifen an' }) }).locator('a[href^="/projekte/"]').first();
  await expect(boss).toBeVisible();
  await boss.click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  const zeile = page.locator('main [data-schnell]').first();
  const aktion = zeile.getByRole('button', { name: /Aktionen für/ });
  await expect(aktion).toBeVisible();
  await aktion.click();
  await page.getByRole('menuitem', { name: 'Loslassen', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  const status = page.getByRole('status');
  await expect(status).toContainText('Losgelassen');
  await expect(status.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  await page.screenshot({ path: `tmp-test/dialog-standard/${testInfo.project.name}-toast.png` });
  await status.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(status).toHaveCount(0);
  await zeile.getByRole('button', { name: /Aktionen für/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Loslassen', exact: true })).toBeVisible();
});
