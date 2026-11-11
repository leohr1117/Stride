import fs from 'node:fs';
import { expect, test, type Locator, type Page } from './uhr.ts';
import { anmelden } from './helfer.ts';

async function oeffneFormular(seite: Page): Promise<{ dialog: Locator; felder: Locator; erster: Locator }> {
  await anmelden(seite);
  await seite.goto('/mehr/inhalte');
  await seite.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
  const dialog = seite.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(dialog).toBeVisible();
  const felder = dialog.locator('.formular-felder');
  const erster = dialog.getByRole('slider').first();
  await expect(erster).toBeVisible();
  return { dialog, felder, erster };
}

async function touchZiehen(seite: Page, startX: number, startY: number, dx: number, dy: number): Promise<void> {
  const session = await seite.context().newCDPSession(seite);
  try {
    const punkt = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(startX, startY) });
    const schritte = 8;
    for (let schritt = 1; schritt <= schritte; schritt += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: punkt(startX + (dx * schritt) / schritte, startY + (dy * schritt) / schritte),
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function mittelpunkt(regler: Locator): Promise<{ x: number; y: number; breite: number }> {
  const kasten = await regler.boundingBox();
  if (!kasten) {
    throw new Error('Regler ohne Fläche');
  }
  return {
    x: Math.round(kasten.x + kasten.width / 2),
    y: Math.round(kasten.y + kasten.height / 2),
    breite: kasten.width,
  };
}

test('Senkrechtes Wischen über einen Anteil-Regler scrollt das Formular', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'handy') {
    return;
  }
  const { felder, erster } = await oeffneFormular(page);
  await felder.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(erster).toBeVisible();
  const kann = await felder.evaluate((element) => element.scrollHeight > element.clientHeight + 8);
  expect(kann).toBe(true);
  const vorherScroll = await felder.evaluate((element) => element.scrollTop);
  const wert = await erster.inputValue();
  const text = await erster.getAttribute('aria-valuetext');
  const anfassen = await erster.evaluate((element) => getComputedStyle(element).touchAction);
  expect(anfassen).toBe('pan-y');
  const punkt = await mittelpunkt(erster);
  const dy = -Math.min(160, Math.max(80, punkt.y - 40));
  await touchZiehen(page, punkt.x, punkt.y, 0, dy);
  await expect(erster).toHaveValue(wert);
  await expect(erster).toHaveAttribute('aria-valuetext', text ?? '');
  await expect.poll(async () => felder.evaluate((element) => element.scrollTop)).toBeGreaterThan(vorherScroll);
});

test('Waagrechtes Ziehen über einen Anteil-Regler ändert den Wert', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'handy') {
    return;
  }
  const { erster } = await oeffneFormular(page);
  const wert = await erster.inputValue();
  const text = await erster.getAttribute('aria-valuetext');
  const punkt = await mittelpunkt(erster);
  const dx = Math.max(48, Math.min(120, Math.round(punkt.breite * 0.35)));
  await touchZiehen(page, punkt.x, punkt.y, dx, 0);
  await expect(erster).not.toHaveValue(wert);
  await expect.poll(async () => erster.getAttribute('aria-valuetext')).not.toBe(text);
});

test('Fokusring des ersten Anteil-Reglers liegt im Formular', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/anteil-regler', { recursive: true });
  const { dialog, erster } = await oeffneFormular(page);
  await erster.scrollIntoViewIfNeeded();
  await erster.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', pointerId: 1 });
  await erster.focus();
  await expect.poll(async () =>
    erster.evaluate((element) => ({
      ring: getComputedStyle(element).outlineStyle,
      eingabe: document.documentElement.dataset.eingabe ?? '',
    })),
  ).toEqual({ ring: 'none', eingabe: 'zeiger' });

  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(erster).toBeFocused();
  await expect.poll(async () =>
    erster.evaluate((element) => {
      const formular = element.closest('.formular');
      if (!(formular instanceof HTMLElement)) {
        return false;
      }
      const stil = getComputedStyle(element);
      const rand = Number.parseFloat(stil.outlineWidth) || 0;
      const versatz = Number.parseFloat(stil.outlineOffset) || 0;
      if (stil.outlineStyle === 'none' || rand <= 0 || versatz >= 0) {
        return false;
      }
      if ((document.documentElement.dataset.eingabe ?? '') !== 'tastatur') {
        return false;
      }
      const regler = element.getBoundingClientRect();
      const kasten = formular.getBoundingClientRect();
      const links = regler.left - versatz - rand;
      const rechts = regler.right + versatz + rand;
      const oben = regler.top - versatz - rand;
      const unten = regler.bottom + versatz + rand;
      return links >= kasten.left - 0.5 && rechts <= kasten.right + 0.5 && oben >= kasten.top - 0.5 && unten <= kasten.bottom + 0.5;
    }),
  ).toBe(true);
  const breite = testInfo.project.name === 'handy' ? 390 : 1440;
  await dialog.screenshot({ path: `tmp-test/anteil-regler/${breite}-fokus.png` });
});
