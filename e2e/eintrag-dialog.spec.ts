import fs from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function ganzInDerReihe(reihe: Locator, chip: Locator): Promise<void> {
  await chip.evaluate((element) => {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  const kasten = await chip.boundingBox();
  const rahmen = await reihe.boundingBox();
  expect(kasten).not.toBeNull();
  expect(rahmen).not.toBeNull();
  if (!kasten || !rahmen) {
    return;
  }
  expect(kasten.height).toBeGreaterThanOrEqual(48);
  expect(kasten.width).toBeGreaterThan(0);
  if (kasten.width <= rahmen.width + 1) {
    expect(kasten.x).toBeGreaterThanOrEqual(rahmen.x - 1);
    expect(kasten.x + kasten.width).toBeLessThanOrEqual(rahmen.x + rahmen.width + 1);
  }
  const beschnitten = await chip.evaluate((element) => element.scrollWidth - element.clientWidth > 1);
  expect(beschnitten).toBe(false);
}

test('Eintrag-Dialog ist ein Blatt ohne Tipp, mit lesbaren Chips und Info', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/eintrag-dialog', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/eintrag-dialog/${testInfo.project.name}-${name}.png` });
  await anmelden(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByText('Tipp: Wähl ein Vorhaben.')).toHaveCount(0);
  await expect(dialog.getByText('Tipp: Wähl ein Vorhaben oder eine Fähigkeit.')).toHaveCount(0);
  await expect(dialog.getByText('Tipp: Wähl eine Fähigkeit.')).toHaveCount(0);

  const wofuer = dialog.locator('[data-eintrag="wofuer"]');
  await expect(wofuer.getByText('Wofür?', { exact: true })).toBeVisible();
  await expect(wofuer.locator('p').filter({ hasText: /^Vorhaben$/ })).toHaveCount(0);
  const rand = await wofuer.evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(rand).toBe('0px');

  const reihe = dialog.locator('.eintrag-chips');
  const reiheKasten = await reihe.boundingBox();
  const dialogKasten = await dialog.boundingBox();
  expect(reiheKasten).not.toBeNull();
  expect(dialogKasten).not.toBeNull();
  if (reiheKasten && dialogKasten) {
    expect(reiheKasten.x).toBeGreaterThanOrEqual(dialogKasten.x - 1);
    expect(reiheKasten.x + reiheKasten.width).toBeLessThanOrEqual(dialogKasten.x + dialogKasten.width + 1);
  }
  const chips = reihe.getByRole('button');
  const anzahl = await chips.count();
  expect(anzahl).toBeGreaterThan(1);
  for (let index = 0; index < anzahl; index += 1) {
    await ganzInDerReihe(reihe, chips.nth(index));
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('dialog');

  const anlegen = dialog.getByRole('button', { name: '+ Tätigkeit' });
  await anlegen.click();
  const formular = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(formular).toBeVisible();
  await formular.getByRole('button', { name: 'Schließen' }).click();
  await expect(formular).toBeHidden();
  await expect(dialog).toBeVisible();

  const info = dialog.getByRole('button', { name: /^Info/ });
  await info.scrollIntoViewIfNeeded();
  await info.click();
  const hinweis = page.getByRole('tooltip');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText('Ein großes Ereignis');
  await expect(dialog.getByRole('switch', { name: 'Meilenstein' })).toHaveAttribute('aria-checked', 'false');
  const oben = await hinweis.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 2, Math.max(2, kasten.left + kasten.width / 2));
    const y = Math.min(window.innerHeight - 2, Math.max(2, kasten.top + Math.min(16, kasten.height / 2)));
    const ziel = document.elementFromPoint(x, y);
    return {
      trifft: ziel === element || element.contains(ziel),
      z: Number(getComputedStyle(element).zIndex),
    };
  });
  expect(oben.trifft).toBe(true);
  expect(oben.z).toBeGreaterThan(90);
  await ohneSeitlichenUeberlauf(page);
  await bild('info');
  await page.keyboard.press('Escape');
  await expect(hinweis).toBeHidden();

  const eintragen = dialog.locator('.formular-fuss').getByRole('button', { name: /Eintragen/ });
  await expect(eintragen).toBeEnabled();
  await expect(eintragen).toContainText('ca. +');
  await dialog.locator('.formular-felder').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const knopf = await eintragen.boundingBox();
  const blatt = await dialog.boundingBox();
  expect(knopf).not.toBeNull();
  expect(blatt).not.toBeNull();
  if (knopf && blatt) {
    expect(knopf.y).toBeGreaterThanOrEqual(blatt.y);
    expect(knopf.y + knopf.height).toBeLessThanOrEqual(blatt.y + blatt.height + 1);
  }
  await bild('fuss');
});
