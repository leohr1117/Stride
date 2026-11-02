import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/level-anzeige', { recursive: true });
  return seite.screenshot({ path: `tmp-test/level-anzeige/${name}.png`, fullPage: true });
}

function bruch(text: string): boolean {
  return /Lvl\s+\d+,\d/.test(text);
}

async function gleicheZeile(name: Locator, icon: Locator): Promise<void> {
  const nameKasten = await name.boundingBox();
  const iconKasten = await icon.boundingBox();
  expect(nameKasten && iconKasten).toBeTruthy();
  if (!nameKasten || !iconKasten) {
    return;
  }
  expect(iconKasten.x).toBeGreaterThanOrEqual(nameKasten.x + nameKasten.width - 2);
  expect(iconKasten.x).toBeLessThanOrEqual(nameKasten.x + nameKasten.width + 16);
  expect(Math.abs(iconKasten.y + iconKasten.height / 2 - (nameKasten.y + nameKasten.height / 2))).toBeLessThan(8);
}

async function ringPasst(ring: Locator): Promise<void> {
  const passt = await ring.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const mitteX = kasten.left + kasten.width / 2;
    const mitteY = kasten.top + kasten.height / 2;
    const innen = kasten.width * 0.36;
    const label = element.querySelector('span.uppercase');
    const zahl = element.querySelector('span.zahl');
    if (!label || !zahl) {
      return false;
    }
    const kaesten = [label.getBoundingClientRect(), zahl.getBoundingClientRect()];
    return kaesten.every((eintrag) => {
      const ecken = [
        [eintrag.left, eintrag.top],
        [eintrag.right, eintrag.top],
        [eintrag.left, eintrag.bottom],
        [eintrag.right, eintrag.bottom],
      ];
      return ecken.every(([x, y]) => Math.hypot(x - mitteX, y - mitteY) <= innen + 1);
    });
  });
  expect(passt).toBe(true);
}

test('Level ohne Bruch, Radare nebeneinander, Hinweis und Ring', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  await anmelden(page);

  await page.goto('/charakter');
  await expect(page.locator('[data-spektrum="attribut"]')).toBeVisible();
  await expect(page.locator('[data-spektrum="status"]')).toBeVisible();
  const spektren = page.locator('[data-spektren]');
  const kaesten = await spektren.locator('[data-spektrum]').evaluateAll((elemente) =>
    elemente.map((element) => {
      const kasten = element.getBoundingClientRect();
      return { links: kasten.left, rechts: kasten.right, oben: kasten.top };
    }),
  );
  expect(kaesten).toHaveLength(2);
  const links = kaesten[0];
  const rechts = kaesten[1];
  expect(links && rechts).toBeTruthy();
  if (links && rechts) {
    expect(links.rechts).toBeLessThanOrEqual(rechts.links + 1);
    expect(Math.abs(links.oben - rechts.oben)).toBeLessThan(2);
  }
  const fenster = page.viewportSize();
  expect(fenster).toBeTruthy();
  if (fenster && rechts) {
    expect(rechts.rechts).toBeLessThanOrEqual(fenster.width + 1);
  }
  expect(await spektren.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const profilLabel = page.locator('main [data-levelring] span.uppercase');
  await expect(profilLabel).toBeVisible();
  expect(await profilLabel.evaluate((element) => getComputedStyle(element).fontSize)).toBe('12px');
  const profilZahl = page.locator('main [data-levelring] span.zahl');
  expect(await profilZahl.evaluate((element) => element.getAttribute('style') ?? '')).toBe('');

  const flaeche = page.locator('[data-spektrum="attribut"] .recharts-radar-polygon').first();
  await flaeche.hover({ force: true });
  const hinweis = page.locator('[data-diagramm-hinweis]');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText(/Lvl \d/);
  expect(bruch(await hinweis.innerText())).toBe(false);
  const hinweisKasten = await hinweis.boundingBox();
  expect(hinweisKasten).toBeTruthy();
  if (hinweisKasten && fenster) {
    expect(hinweisKasten.x).toBeGreaterThanOrEqual(-1);
    expect(hinweisKasten.y).toBeGreaterThanOrEqual(-1);
    expect(hinweisKasten.x + hinweisKasten.width).toBeLessThanOrEqual(fenster.width + 1);
    expect(hinweisKasten.y + hinweisKasten.height).toBeLessThanOrEqual(fenster.height + 1);
  }
  const untertitel = await spektren.locator('p').allInnerTexts();
  for (const text of untertitel) {
    expect(bruch(text)).toBe(false);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-profil`);

  await page.goto('/');
  const werteKopf = page.getByRole('button', { name: 'Werte', exact: true });
  if ((await werteKopf.getAttribute('aria-expanded')) !== 'true') {
    await werteKopf.click();
  }
  const heuteIcon = page.getByRole('button', { name: 'Lvl zu niedrig' }).first();
  await expect(heuteIcon).toBeVisible();
  const heuteZeile = heuteIcon.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]');
  await gleicheZeile(heuteZeile.locator('span.truncate').first(), heuteIcon);
  await heuteIcon.click();
  await expect(page.getByRole('tooltip')).toHaveText('Lvl zu niedrig');
  await page.keyboard.press('Escape');
  await bild(page, `${name}-heute`);

  await page.goto('/koennen');
  await expect(page.locator('[data-spektrum="attribut"] p')).toBeVisible();
  expect(bruch(await page.locator('[data-spektrum="attribut"] p').innerText())).toBe(false);
  const seitenIcon = page.getByRole('button', { name: 'Lvl zu niedrig' }).first();
  await expect(seitenIcon).toBeVisible();
  const attributZeile = seitenIcon.locator('xpath=ancestor::div[contains(@class,"attributzeile")][1]');
  await gleicheZeile(attributZeile.locator('span.truncate').first(), seitenIcon);
  await seitenIcon.click();
  await expect(page.getByRole('tooltip')).toHaveText('Lvl zu niedrig');
  await page.keyboard.press('Escape');
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-koennen`);

  await page.goto('/faehigkeiten');
  const ring = page.locator('main [data-levelring]').first();
  await expect(ring).toBeVisible();
  const breite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(breite).toBe(56);
  await ringPasst(ring);
  const wort = ring.locator('span.uppercase');
  const schrift = await wort.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(schrift).toBeLessThan(12);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-faehigkeiten`);
});
