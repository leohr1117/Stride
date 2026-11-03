import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/formular-speichern', { recursive: true });
  await seite.screenshot({ path: `tmp-test/formular-speichern/${name}.png`, fullPage: true });
}

function schneidet(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

async function tastatur(seite: Page, an: boolean): Promise<void> {
  await seite.evaluate((offen) => {
    const fenster = window as Window & {
      __strideSicht?: { oben: number; hoehe: number; tastatur: number } | null;
    };
    fenster.__strideSicht = offen ? { oben: 0, hoehe: 420, tastatur: 320 } : null;
    window.dispatchEvent(new Event('resize'));
  }, an);
  await expect.poll(() => seite.evaluate(() => document.documentElement.dataset.tastatur ?? '')).toBe(an ? 'an' : '');
}

test('Speichern steht unter dem letzten Feld', async ({ page }, info) => {
  await anmelden(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rueckblick');
  const feld = page.getByRole('textbox', { name: 'Worauf konzentriere ich mich nächste Woche?' });
  const speichern = page.getByRole('button', { name: /^Speichern/ });
  await feld.scrollIntoViewIfNeeded();
  await expect(speichern).toBeVisible();
  await expect(speichern).toBeEnabled();
  const knopf = await speichern.boundingBox();
  const kasten = await feld.boundingBox();
  expect(knopf && kasten).toBeTruthy();
  if (knopf && kasten) {
    expect(knopf.y).toBeGreaterThanOrEqual(kasten.y + kasten.height - 1);
    expect(schneidet(knopf, kasten)).toBe(false);
  }
  const plus = page.locator('.eintrag-fab');
  await expect(plus).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${info.project.name}-offen`);

  await feld.click();
  await tastatur(page, true);
  await feld.scrollIntoViewIfNeeded();
  const feldMitte = await feld.boundingBox();
  expect(feldMitte).toBeTruthy();
  if (feldMitte) {
    const trifftFeld = await page.evaluate(({ x, y }) => {
      const knoten = document.elementFromPoint(x, y);
      return knoten instanceof HTMLElement && knoten.closest('textarea') !== null;
    }, { x: feldMitte.x + feldMitte.width / 2, y: feldMitte.y + Math.min(24, feldMitte.height / 2) });
    expect(trifftFeld).toBe(true);
  }
  const darunter = await speichern.boundingBox();
  const feldOffen = await feld.boundingBox();
  expect(darunter && feldOffen).toBeTruthy();
  if (darunter && feldOffen) {
    expect(schneidet(darunter, feldOffen)).toBe(false);
    expect(darunter.y).toBeGreaterThanOrEqual(feldOffen.y + feldOffen.height - 1);
  }
  await expect(plus).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${info.project.name}-tastatur`);
  await tastatur(page, false);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.eintrag-fab')).toHaveCount(0);
  await speichern.scrollIntoViewIfNeeded();
  await expect(speichern).toBeVisible();
  const weit = await speichern.boundingBox();
  const feldWeit = await feld.boundingBox();
  expect(weit && feldWeit).toBeTruthy();
  if (weit && feldWeit) {
    expect(schneidet(weit, feldWeit)).toBe(false);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${info.project.name}-desktop`);
});
