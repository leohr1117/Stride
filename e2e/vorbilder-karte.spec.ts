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

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Vorbilder: Karte ohne Radar, Prozent auf Karte und Richtung', async ({ page }) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Durchschnittsmensch', exact: true })).toBeVisible();
  await expect(page.locator('.recharts-wrapper')).toHaveCount(0);

  const karten = page.locator('a[href^="/vorbilder/"]');
  const anzahl = await karten.count();
  expect(anzahl).toBeGreaterThan(10);
  for (let index = 0; index < anzahl; index += 1) {
    await expect(karten.nth(index)).toContainText(/%/);
  }

  const breite = page.viewportSize()?.width ?? 0;
  const raster = page.locator('.grid a');
  const erste = await raster.nth(0).boundingBox();
  const zweite = await raster.nth(1).boundingBox();
  expect(erste && zweite).toBeTruthy();
  if (erste && zweite) {
    if (breite >= 768) {
      expect(zweite.x).toBeGreaterThan(erste.x + 40);
    } else {
      expect(Math.abs(zweite.x - erste.x)).toBeLessThan(2);
      expect(zweite.y).toBeGreaterThan(erste.y + 20);
    }
  }

  const richtungen = [
    'Körper',
    'Wettkampf',
    'Strategie',
    'Esports/Gaming',
    'Kunst',
    'Content/Creator',
    'Innovation/Technik',
    'Business/Unternehmertum',
    'Finanzen/Investing/Crypto',
    'Wissenschaft/Genies',
    'Führung/Wandel',
  ];
  const kaesten: { x: number; y: number; width: number; height: number }[] = [];
  for (const name of ['Alle', ...richtungen]) {
    const chip = page.getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(chip).toBeVisible();
    const gequetscht = await chip.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(gequetscht, name).toBe(false);
    const kasten = await chip.boundingBox();
    expect(kasten, name).toBeTruthy();
    if (kasten) {
      expect(kasten.x, name).toBeGreaterThanOrEqual(-1);
      expect(kasten.x + kasten.width, name).toBeLessThanOrEqual(breite + 1);
      kaesten.push(kasten);
    }
  }
  for (let links = 0; links < kaesten.length; links += 1) {
    for (let rechts = links + 1; rechts < kaesten.length; rechts += 1) {
      const a = kaesten[links];
      const b = kaesten[rechts];
      const ueberX = a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1;
      const ueberY = a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
      expect(ueberX && ueberY, `${links} ${rechts}`).toBe(false);
    }
  }
  await expect(page.locator('body')).not.toContainText('°');
  await ohneSeitlichenUeberlauf(page);

  const hinweis = page.getByRole('button', { name: 'Hinweis zu den Werten' });
  const kasten = await hinweis.boundingBox();
  expect(kasten).toBeTruthy();
  if (kasten) {
    expect(kasten.width).toBeGreaterThanOrEqual(14);
    expect(kasten.width).toBeLessThanOrEqual(20);
    expect(kasten.height).toBeGreaterThanOrEqual(14);
    expect(kasten.height).toBeLessThanOrEqual(20);
  }
  const deltaListe = await page.locator('header p').evaluate((zeile) => {
    const knopf = zeile.querySelector('button');
    const text = zeile.querySelector('span');
    if (!knopf || !text) {
      return null;
    }
    const icon = knopf.getBoundingClientRect();
    const schrift = text.getBoundingClientRect();
    return Math.abs(icon.top + icon.height / 2 - (schrift.top + schrift.height / 2));
  });
  expect(deltaListe).not.toBeNull();
  expect(deltaListe ?? 99).toBeLessThanOrEqual(4);
  await hinweis.click();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.',
  );

  const wettkampf = page.getByRole('button', { name: /^Wettkampf/ });
  await expect(wettkampf).toContainText(/%/);
  const chipZahl = (await wettkampf.innerText()).match(/(\d+)\s*%/)?.[1];
  expect(chipZahl).toBeTruthy();
  await wettkampf.click();
  await expect(page.getByRole('link', { name: /Elon Musk/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Cristiano Ronaldo/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lionel Messi/ })).toBeVisible();
  await expect(raster.first()).toContainText(`${chipZahl} %`);
  const karteLaeuftUeber = await raster.first().evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(karteLaeuftUeber).toBe(false);
  await ohneSeitlichenUeberlauf(page);

  await page.getByRole('button', { name: /^Content/ }).click();
  await expect(page.getByRole('link', { name: /MrBeast/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Khaby Lame/ })).toBeVisible();

  await page.getByRole('button', { name: /^Wissenschaft/ }).click();
  await expect(page.getByRole('link', { name: /Albert Einstein/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Leonardo da Vinci/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cristiano Ronaldo/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);

  await page.getByRole('button', { name: /^Führung/ }).click();
  await expect(page.getByRole('link', { name: /Nelson Mandela/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Barack Obama/ })).toBeVisible();

  await page.getByRole('button', { name: /^Alle/ }).click();
  await page.getByRole('link', { name: /Cristiano Ronaldo/ }).click();
  await expect(page.getByRole('heading', { name: 'Cristiano Ronaldo', exact: true })).toBeVisible();
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  await expect(page.getByText(/\d+\s*%\s*ähnlich/)).toBeVisible();
  const nameHinweis = page.getByRole('button', { name: 'Hinweis zu den Werten' });
  await expect(nameHinweis).toBeVisible();
  const deltaName = await page.locator('.profil-name').evaluate((name) => {
    const knopf = name.parentElement?.querySelector('button');
    if (!knopf) {
      return null;
    }
    const icon = knopf.getBoundingClientRect();
    const schrift = name.getBoundingClientRect();
    return Math.abs(icon.top + icon.height / 2 - (schrift.top + schrift.height / 2));
  });
  expect(deltaName).not.toBeNull();
  expect(deltaName ?? 99).toBeLessThanOrEqual(4);
  await expect(page.locator('body')).not.toContainText('°');
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/vorbilder/einstein');
  await expect(page.getByRole('heading', { name: 'Albert Einstein', exact: true })).toBeVisible();
  await expect(page.getByText('1879 bis 1955')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hinweis zu den Werten' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/handbuch');
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  const tabelle = page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Richtung' }) });
  await expect(tabelle.getByRole('columnheader', { name: 'Richtung' })).toBeVisible();
  const zeile = tabelle.getByRole('row').filter({ hasText: 'Cristiano Ronaldo' });
  await expect(zeile).toContainText('Wettkampf');
  const richtungZelle = zeile.getByRole('cell').nth(1);
  const zelleGequetscht = await richtungZelle.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(zelleGequetscht).toBe(false);
  await expect(tabelle.getByRole('row').filter({ hasText: 'Körper' })).toHaveCount(2);
  await expect(tabelle.getByRole('row').filter({ hasText: 'Wissenschaft/Genies' })).toHaveCount(2);
  await expect(tabelle.getByRole('row').filter({ hasText: 'Finanzen/Investing/Crypto' })).toHaveCount(1);
  await expect(tabelle.getByRole('row').filter({ hasText: 'Führung/Wandel' })).toHaveCount(2);
  await expect(tabelle.getByRole('cell', { name: 'Albert Einstein', exact: true })).toBeVisible();
  await expect(tabelle.getByRole('cell', { name: 'Graham Stephan', exact: true })).toHaveCount(0);
  await expect(tabelle.getByRole('cell', { name: 'donk', exact: true })).toHaveCount(0);
  const langeZelle = tabelle.getByRole('row').filter({ hasText: 'Warren Buffett' }).getByRole('cell').nth(1);
  const langGequetscht = await langeZelle.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(langGequetscht).toBe(false);
  await ohneSeitlichenUeberlauf(page);
});
