import { expect, test, type Locator } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

async function ersteZeile(text: Locator): Promise<{ x: number; y: number; height: number } | null> {
  return text.evaluate((element) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(element);
    const rect = [...bereich.getClientRects()].find((eintrag) => eintrag.width > 1 && eintrag.height > 1);
    return rect ? { x: rect.x, y: rect.y, height: rect.height } : null;
  });
}

async function punktBuendig(punkt: Locator, text: Locator): Promise<void> {
  const kasten = await punkt.boundingBox();
  const zeile = await ersteZeile(text);
  expect(kasten).not.toBeNull();
  expect(zeile).not.toBeNull();
  if (!kasten || !zeile) {
    return;
  }
  const abstand = Math.abs(kasten.y + kasten.height / 2 - (zeile.y + zeile.height / 2));
  expect(abstand).toBeLessThanOrEqual(3);
}

async function punktIst10(punkt: Locator): Promise<void> {
  await expect(punkt).toBeVisible();
  const kasten = await punkt.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return;
  }
  expect(Math.round(kasten.width)).toBe(10);
  expect(Math.round(kasten.height)).toBe(10);
  const farbe = await punkt.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(farbe).not.toBe('rgba(0, 0, 0, 0)');
}

async function keineFarbLinie(wurzel: Locator): Promise<void> {
  await expect(wurzel.locator('.border-s-2')).toHaveCount(0);
  const streifen = await wurzel.evaluate((element) =>
    [...element.querySelectorAll('*')]
      .filter((knoten) => parseFloat(getComputedStyle(knoten).borderInlineStartWidth) >= 2)
      .map((knoten) => (knoten as HTMLElement).className.toString()),
  );
  expect(streifen).toEqual([]);
}

test('Farbpunkt statt Linie und Balken', async ({ page }, testInfo) => {
  const bild = (name: string, ganz = false) =>
    page.screenshot({ path: `tmp-test/farblinie/${testInfo.project.name}-${name}.png`, fullPage: ganz });

  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();
  const fit = page.locator('section.karte').filter({ has: page.getByRole('heading', { name: 'Fit und belastbar', level: 2 }) });
  await keineFarbLinie(fit);
  await expect(fit.locator('.h-1')).toHaveCount(0);
  const visionKopf = fit.getByRole('heading', { name: 'Fit und belastbar', level: 2 });
  const visionPunkt = visionKopf.locator('[data-farbpunkt]');
  await punktIst10(visionPunkt);
  const punktKasten = await visionPunkt.boundingBox();
  const textKasten = await visionKopf.locator('span.break-words').boundingBox();
  expect(punktKasten && textKasten && punktKasten.x < textKasten.x).toBe(true);
  await punktBuendig(visionPunkt, visionKopf.locator('span.break-words'));

  const org = fit.locator('[data-ast="organisation"]').filter({ has: page.getByRole('heading', { name: 'Lauftreff', level: 3 }) });
  const orgPunkt = org.locator('[data-farbpunkt]');
  await punktIst10(orgPunkt);
  await punktBuendig(orgPunkt, org.locator('h3 span:not([data-farbpunkt])'));
  const orgKasten = await orgPunkt.boundingBox();
  expect(punktKasten && orgKasten && Math.abs(punktKasten.x - orgKasten.x)).toBeLessThanOrEqual(1);
  await keineFarbLinie(org);
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele', true);

  await visionKopf.click();
  const dialog = page.getByRole('dialog', { name: 'Fit und belastbar' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.h-1')).toHaveCount(0);
  await keineFarbLinie(dialog);
  const dialogPunkt = dialog.locator('header [data-farbpunkt]');
  await punktIst10(dialogPunkt);
  const dialogTitel = dialog.getByRole('heading', { name: 'Fit und belastbar', level: 2 });
  const dialogText = dialogTitel.locator('span:not([data-farbpunkt])');
  const dialogPunktKasten = await dialogPunkt.boundingBox();
  const dialogTextKasten = await dialogText.boundingBox();
  expect(dialogPunktKasten && dialogTextKasten && dialogPunktKasten.x < dialogTextKasten.x).toBe(true);
  await punktBuendig(dialogPunkt, dialogText);
  await punktIst10(dialog.getByText('Lauftreff', { exact: true }).locator('xpath=..').locator('[data-farbpunkt]'));
  await ohneSeitlichenUeberlauf(page);
  await bild('dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/ziele$/);

  await page.goto('/basis');
  await page.getByRole('button', { name: 'Aufgabe' }).click();
  const formular = page.getByRole('dialog', { name: 'Neue Aufgabe' });
  await formular.getByRole('combobox', { name: 'Projekt' }).click();
  const wahl = page.getByRole('dialog', { name: 'Projekt' });
  await expect(wahl).toBeVisible();
  await keineFarbLinie(wahl);
  const fitWahl = wahl.locator('[data-ast="vision"]').filter({ has: page.getByRole('heading', { name: 'Fit und belastbar' }) });
  await punktIst10(fitWahl.getByRole('heading', { name: 'Fit und belastbar' }).locator('[data-farbpunkt]'));
  const orgWahl = fitWahl.locator('[data-ast="organisation"]').filter({ has: page.getByRole('heading', { name: 'Lauftreff' }) });
  await punktIst10(orgWahl.getByRole('heading', { name: 'Lauftreff' }).locator('[data-farbpunkt]'));
  await expect(orgWahl.getByRole('option', { name: 'Gruppenläufe', exact: true })).toBeVisible();
  await expect(fitWahl.getByRole('option', { name: 'Krafttraining', exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('auswahl');
});
