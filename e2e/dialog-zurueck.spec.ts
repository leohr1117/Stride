import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function dialogId(seite: Page): Promise<string | null> {
  return seite.evaluate(() => {
    const zustand = history.state as { dialog?: unknown } | null;
    return zustand && typeof zustand.dialog === 'string' ? zustand.dialog : null;
  });
}

async function seiteBleibt(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    const flaeche = document.querySelector('main');
    if (flaeche) {
      (flaeche as HTMLElement & { probe?: number }).probe = 1;
    }
  });
}

async function seiteIstGeblieben(seite: Page): Promise<void> {
  const geblieben = await seite.evaluate(() => {
    const flaeche = document.querySelector('main');
    return Boolean(flaeche && (flaeche as HTMLElement & { probe?: number }).probe === 1);
  });
  expect(geblieben).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
  await page.goto('/');
  const boss = page.locator('section', { has: page.getByRole('heading', { name: 'Bosse greifen an' }) }).locator('a').first();
  await expect(boss).toBeVisible();
  await boss.click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
});

test('Browser-Zurück schließt nur den Eintrag-Dialog', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u3/${testInfo.project.name}-${name}.png` });
  const adresse = page.url();
  await seiteBleibt(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialogId(page)).not.toBeNull();
  await ohneSeitlichenUeberlauf(page);
  await bild('dialog');

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.dialog-fenster')).toHaveCount(0);
  await expect(page).toHaveURL(adresse);
  await expect.poll(() => dialogId(page)).toBeNull();
  await seiteIstGeblieben(page);
  await expect(page.locator('main h1')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('zu');

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Esc und Schließen nehmen den Verlaufseintrag mit', async ({ page }) => {
  const adresse = page.url();
  await seiteBleibt(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(adresse);
  await expect.poll(() => dialogId(page)).toBeNull();
  await seiteIstGeblieben(page);

  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(adresse);
  await expect.poll(() => dialogId(page)).toBeNull();
  await seiteIstGeblieben(page);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('Bei zwei Dialogen schließt Zurück nur den obersten', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u3/${testInfo.project.name}-${name}.png` });
  const adresse = page.url();
  await seiteBleibt(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(eintrag).toBeVisible();
  await expect.poll(() => dialogId(page)).not.toBeNull();
  const unten = await dialogId(page);
  await eintrag.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
  const oben = page.getByRole('dialog', { name: /^Tätigkeit/ });
  await expect(oben).toBeVisible();
  await expect.poll(() => dialogId(page)).not.toBe(unten);
  await ohneSeitlichenUeberlauf(page);
  await bild('zwei');

  await page.goBack();
  await expect(oben).toBeHidden();
  await expect(page.locator('.dialog-fenster')).toHaveCount(1);
  await expect(eintrag).toBeVisible();
  await expect(page).toHaveURL(adresse);
  await expect.poll(() => dialogId(page)).toBe(unten);
  await seiteIstGeblieben(page);
  await ohneSeitlichenUeberlauf(page);
  await bild('einer');

  await page.keyboard.press('Escape');
  await expect(eintrag).toBeHidden();
  await expect(page).toHaveURL(adresse);
  await expect.poll(() => dialogId(page)).toBeNull();
  await seiteIstGeblieben(page);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
