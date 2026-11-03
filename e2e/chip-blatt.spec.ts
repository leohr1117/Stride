import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

async function hoehe(ziel: Locator): Promise<number> {
  return ziel.evaluate((element) => element.getBoundingClientRect().height);
}

async function imRahmen(ziel: Locator, rahmen: Locator): Promise<void> {
  const inhalt = await ziel.boundingBox();
  const kasten = await rahmen.boundingBox();
  expect(inhalt, 'Ziel liegt im Rahmen').not.toBeNull();
  expect(kasten).not.toBeNull();
  if (!inhalt || !kasten) {
    return;
  }
  expect(inhalt.y).toBeGreaterThanOrEqual(kasten.y - 1);
  expect(inhalt.y + inhalt.height).toBeLessThanOrEqual(kasten.y + kasten.height + 1);
}

async function chipMasse(chip: Locator): Promise<void> {
  const treffer = await chip.boundingBox();
  const flaeche = await chip.locator('.chip-flaeche').boundingBox();
  expect(treffer).not.toBeNull();
  expect(flaeche).not.toBeNull();
  if (!treffer || !flaeche) {
    return;
  }
  expect(Math.abs(treffer.height - 48)).toBeLessThanOrEqual(1);
  expect(Math.abs(flaeche.height - 36)).toBeLessThanOrEqual(1);
}

async function kopfUndFelder(dialog: Locator): Promise<void> {
  const kopf = dialog.locator('.dialog-kopf');
  await expect(kopf).toBeVisible();
  expect(Math.abs((await hoehe(kopf)) - 56)).toBeLessThanOrEqual(1);
  const felder = dialog.locator('input.feld-eingabe, select.feld-eingabe');
  const anzahl = await felder.count();
  for (let index = 0; index < anzahl; index += 1) {
    const feld = felder.nth(index);
    if (!(await feld.isVisible())) {
      continue;
    }
    expect(Math.abs((await hoehe(feld)) - 48)).toBeLessThanOrEqual(1);
  }
}

async function oeffneUndMesse(page: Page, vorbereitung: () => Promise<void>, name: string): Promise<void> {
  await vorbereitung();
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await kopfUndFelder(dialog);
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
}

test('Chips messen 36 px, das Eintrag-Blatt bleibt auf einem Schirm', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/chip-blatt', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await anmelden(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(dialog).toBeVisible();

  const reihe = dialog.locator('[data-gruppe="taetigkeit"] .chip-reihe');
  const knoepfe = reihe.getByRole('button');
  expect(await knoepfe.count()).toBeGreaterThan(1);
  const erster = await knoepfe.nth(0).boundingBox();
  const zweiter = await knoepfe.nth(1).boundingBox();
  expect(erster).not.toBeNull();
  expect(zweiter).not.toBeNull();
  if (erster && zweiter) {
    expect(Math.abs(zweiter.x - (erster.x + erster.width) - 8)).toBeLessThanOrEqual(1);
  }
  const innen = await reihe.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight));
  expect(Math.abs(innen - 16)).toBeLessThanOrEqual(1);
  const label = await dialog.locator('[data-gruppe="taetigkeit"] p').evaluate((element) => {
    const stil = getComputedStyle(element);
    return { groesse: stil.fontSize, zeile: stil.lineHeight, gewicht: Number(stil.fontWeight) };
  });
  expect(label).toEqual({ groesse: '13px', zeile: '18px', gewicht: 600 });

  const chipZahl = await knoepfe.count();
  for (let index = 0; index < chipZahl; index += 1) {
    await chipMasse(knoepfe.nth(index));
  }

  const laufend = await page.evaluate(async () => {
    const antwort = await fetch('/api/laufend');
    if (!antwort.ok) {
      throw new Error(`laufend ${antwort.status}`);
    }
    return (await antwort.json()) as { bosse: { titel: string }[]; vorhaben: { titel: string }[] };
  });
  const titel = [...laufend.bosse, ...laufend.vorhaben].map((eintrag) => eintrag.titel);
  expect(titel.length).toBeGreaterThanOrEqual(5);
  const lang = titel.reduce((bisher, name) => (name.length > bisher.length ? name : bisher));
  const langChip = dialog.locator('[data-gruppe="wofuer"] button.chip').filter({ hasText: lang }).first();
  await expect(langChip).toHaveAttribute('aria-label', expect.stringContaining(lang));
  const nameKasten = await langChip.locator('.chip-name').evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    max: getComputedStyle(element).maxWidth,
  }));
  expect(nameKasten.max).toBe('200px');
  expect(nameKasten.client).toBeLessThanOrEqual(200);
  expect(nameKasten.scroll).toBeGreaterThan(nameKasten.client);

  const felder = dialog.locator('.formular-felder');
  expect(await felder.evaluate((element) => element.scrollTop)).toBe(0);
  for (const gruppe of ['Tätigkeit', 'Wofür?', 'Fähigkeit']) {
    await imRahmen(dialog.getByText(gruppe, { exact: true }), felder);
  }
  const eintragen = dialog.locator('.formular-fuss').getByRole('button', { name: /Eintragen/ });
  await imRahmen(eintragen, dialog);
  const sicht = page.viewportSize();
  const knopf = await eintragen.boundingBox();
  expect(knopf).not.toBeNull();
  expect(knopf!.y + knopf!.height).toBeLessThanOrEqual((sicht?.height ?? 844) + 1);
  await page.screenshot({ path: `tmp-test/chip-blatt/${testInfo.project.name}-eintrag.png` });

  await kopfUndFelder(dialog);
  await dialog.getByRole('button', { name: '+ Tätigkeit' }).click();
  const taetigkeit = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(taetigkeit).toBeVisible();
  await kopfUndFelder(taetigkeit);
  await taetigkeit.getByRole('button', { name: 'Schließen' }).click();
  await dialog.getByRole('button', { name: 'Schließen' }).click();

  await oeffneUndMesse(page, async () => {
    await page.goto('/chronik');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
  }, 'Filter');

  await oeffneUndMesse(page, async () => {
    await page.goto('/ziele');
    await page.getByRole('button', { name: 'Neu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Vision', exact: true }).click();
  }, 'Vision');

  await oeffneUndMesse(page, async () => {
    await page.goto('/basis');
    await page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true }).click();
  }, 'Basis-Aufgabe');

  await oeffneUndMesse(page, async () => {
    await page.goto('/faehigkeiten');
    await page.getByRole('button', { name: '+ Fähigkeit anlegen', exact: true }).click();
  }, 'Fähigkeit');

  await oeffneUndMesse(page, async () => {
    await page.goto('/investitionen');
    await page.getByRole('button', { name: '+ Investition anlegen', exact: true }).click();
  }, 'Investition');

  await page.goto('/');
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await page.screenshot({ path: `tmp-test/chip-blatt/${testInfo.project.name}-schluss.png` });
});
