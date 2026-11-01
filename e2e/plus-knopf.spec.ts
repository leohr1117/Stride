import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function oeffneEintrag(seite: Page): Promise<void> {
  await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(seite.getByRole('dialog', { name: 'Was hast du getan?' })).toBeVisible();
}

async function schliesseEintrag(seite: Page): Promise<void> {
  const dialog = seite.getByRole('dialog', { name: 'Was hast du getan?' });
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Plus-Knopf unten rechts, nicht auf Mehr, mit Vorauswahl', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/plus-knopf/${testInfo.project.name}-${name}.png` });

  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  if (handy) {
    const fab = page.locator('.eintrag-fab');
    await expect(fab).toBeVisible();
    await expect(page.locator('nav.mobilleiste').getByRole('button')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-fab', 'an');
    const masse = await page.evaluate(() => {
      const knopf = document.querySelector('.eintrag-fab');
      const leiste = document.querySelector('nav.mobilleiste');
      const haupt = document.querySelector('main');
      if (!(knopf instanceof HTMLElement) || !(leiste instanceof HTMLElement) || !(haupt instanceof HTMLElement)) {
        return null;
      }
      const kasten = knopf.getBoundingClientRect();
      const balken = leiste.getBoundingClientRect();
      const wurzel = getComputedStyle(document.documentElement);
      return {
        breite: kasten.width,
        hoehe: kasten.height,
        rechts: balken.right - kasten.right,
        luecke: balken.top - kasten.bottom,
        polster: Number.parseFloat(getComputedStyle(haupt).paddingBottom),
        leiste: Number.parseFloat(wurzel.getPropertyValue('--leisten-hoehe')),
        scroll: Number.parseFloat(wurzel.scrollPaddingBottom),
      };
    });
    expect(masse).not.toBeNull();
    if (masse) {
      expect(Math.abs(masse.breite - 56)).toBeLessThan(1.5);
      expect(Math.abs(masse.hoehe - 56)).toBeLessThan(1.5);
      expect(Math.abs(masse.rechts - 16)).toBeLessThan(1.5);
      expect(Math.abs(masse.luecke - 16)).toBeLessThan(1.5);
      expect(masse.polster).toBeGreaterThanOrEqual(masse.leiste + 88 - 1);
      expect(masse.scroll).toBeGreaterThanOrEqual(masse.leiste + 88 - 1);
    }
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await bild('heute');

    await oeffneEintrag(page);
    await expect(fab).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Was hast du getan?' }).getByPlaceholder('Neues Vorhaben')).toHaveCount(0);
    await bild('dialog');
    await schliesseEintrag(page);
    await expect(fab).toBeVisible();
  } else {
    await expect(page.locator('.eintrag-fab')).toHaveCount(0);
    await expect(page.locator('aside.seitenleiste').getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-fab', 'an');
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await bild('heute');
    await oeffneEintrag(page);
    await expect(page.getByRole('dialog', { name: 'Was hast du getan?' }).getByPlaceholder('Neues Vorhaben')).toHaveCount(0);
    await schliesseEintrag(page);
  }

  await page.goto('/mehr');
  await expect(page.locator('main h1')).toHaveText('Mehr');
  await expect(page.locator('.eintrag-fab')).toHaveCount(0);
  if (!handy) {
    await expect(page.locator('aside.seitenleiste').getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('mehr');

  await page.goto('/mehr/darstellung');
  await expect(page.locator('.eintrag-fab')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);

  const projekt = await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    if (!antwort.ok) {
      return null;
    }
    const daten = (await antwort.json()) as { projekte: { id: number; aktiv: boolean }[] };
    return daten.projekte.find((eintrag) => eintrag.aktiv) ?? daten.projekte[0] ?? null;
  });
  expect(projekt).not.toBeNull();
  await page.goto(`/projekte/${projekt?.id}`);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eintrag', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('projekt');
  await oeffneEintrag(page);
  await expect(page.getByRole('dialog', { name: 'Was hast du getan?' }).getByPlaceholder('Neues Vorhaben')).toBeVisible();
  await schliesseEintrag(page);

  const faehigkeit = await page.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      return null;
    }
    const liste = (await antwort.json()) as { id: number; name: string; archiviert: boolean }[];
    return liste.find((eintrag) => !eintrag.archiviert) ?? liste[0] ?? null;
  });
  expect(faehigkeit).not.toBeNull();
  await page.goto(`/faehigkeiten/${faehigkeit?.id}`);
  await expect(page.locator('main h1')).toHaveText(faehigkeit?.name ?? '');
  await expect(page.getByRole('button', { name: 'Eintrag', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('faehigkeit');
  await oeffneEintrag(page);
  await expect(page.getByRole('dialog').getByRole('button', { name: faehigkeit?.name ?? '', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  if (handy) {
    await expect(page.locator('.eintrag-fab')).toBeHidden();
  }
  await bild('faehigkeit-dialog');
});
