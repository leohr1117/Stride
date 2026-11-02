import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

let spracheVorher: string | null = null;

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
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  spracheVorher = await seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { sprache: string | null };
    return daten.sprache;
  });
  if (spracheVorher === 'de') {
    return;
  }
  const ok = await seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache: 'de' }),
    });
    return antwort.ok;
  });
  expect(ok).toBe(true);
  await seite.reload();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ausschnitt(seite: Page, ziel: Locator, pfad: string): Promise<void> {
  await ziel.scrollIntoViewIfNeeded();
  const kasten = await ziel.boundingBox();
  const sicht = seite.viewportSize();
  if (!kasten || !sicht) {
    throw new Error('Ausschnitt ohne Fläche');
  }
  const x = Math.max(0, kasten.x - 16);
  const y = Math.max(0, kasten.y - 16);
  const width = Math.min(sicht.width - x, kasten.width + 32);
  const height = Math.min(sicht.height - y, kasten.height + 32);
  await seite.screenshot({ path: pfad, clip: { x, y, width, height } });
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  if (spracheVorher && spracheVorher !== 'de') {
    await page.evaluate(async (sprache) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprache }),
      });
    }, spracheVorher);
  }
});

test('Regler lässt das Textfeld los', async ({ page }, testInfo) => {
  const bild = `tmp-test/regler/${testInfo.project.name}`;

  await page.goto('/mehr/inhalte');
  await page.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
  const taetigkeit = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(taetigkeit).toBeVisible();
  const name = taetigkeit.getByRole('textbox', { name: 'Name' });
  await name.click();
  await expect(name).toBeFocused();
  const gewichte = taetigkeit.getByRole('slider');
  expect(await gewichte.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await gewichte.count()); index += 1) {
    await expect(gewichte.nth(index)).toHaveAttribute('inputmode', 'none');
  }
  const gewicht = gewichte.first();
  await gewicht.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1 });
  await expect(name).not.toBeFocused();
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 1 }));
  });

  await name.click();
  await expect(name).toBeFocused();
  const flaeche = await gewicht.boundingBox();
  if (!flaeche) {
    throw new Error('Regler ohne Fläche');
  }
  const mitte = flaeche.y + flaeche.height / 2;
  await page.mouse.move(flaeche.x + 6, mitte);
  await page.mouse.down();
  await page.mouse.move(flaeche.x + flaeche.width - 6, mitte, { steps: 8 });
  await expect(name).not.toBeFocused();
  await expect(gewicht).not.toHaveValue('0');
  const art = await page.evaluate(() => {
    const aktiv = document.activeElement;
    return aktiv instanceof HTMLInputElement ? aktiv.type : aktiv?.tagName ?? '';
  });
  expect(art).not.toBe('text');
  await page.mouse.up();
  await gewicht.focus();
  const vorher = await gewicht.inputValue();
  await page.keyboard.press('ArrowLeft');
  await expect(gewicht).not.toHaveValue(vorher);
  await page.screenshot({ path: `${bild}-taetigkeit.png` });
  await ohneSeitlichenUeberlauf(page);
  await page.keyboard.press('Escape');

  await page.goto('/investitionen');
  await page.getByRole('button', { name: /Investition anlegen/ }).click();
  const investition = page.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(investition).toBeVisible();
  const investitionName = investition.getByRole('textbox', { name: 'Name' });
  const groesse = investition.getByRole('slider', { name: 'Größe' });
  await expect(groesse).toHaveAttribute('inputmode', 'none');
  await investitionName.click();
  await expect(investitionName).toBeFocused();
  await groesse.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1 });
  await expect(investitionName).not.toBeFocused();
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 1 }));
  });
  await investitionName.click();
  const kasten = await groesse.boundingBox();
  if (!kasten) {
    throw new Error('Größenregler ohne Fläche');
  }
  const hoehe = kasten.y + kasten.height / 2;
  await page.mouse.move(kasten.x + 8, hoehe);
  await page.mouse.down();
  await page.mouse.move(kasten.x + kasten.width - 8, hoehe, { steps: 8 });
  await expect(investitionName).not.toBeFocused();
  await expect(groesse).toHaveValue('3');
  await page.mouse.up();
  if (testInfo.project.name === 'handy') {
    await investitionName.click();
    const nochmal = await groesse.boundingBox();
    if (!nochmal) {
      throw new Error('Größenregler ohne Fläche');
    }
    await page.touchscreen.tap(nochmal.x + 10, nochmal.y + nochmal.height / 2);
    await expect(investitionName).not.toBeFocused();
  }
  await page.screenshot({ path: `${bild}-investition.png` });
  await ohneSeitlichenUeberlauf(page);
});

test('Fokus-Ring nur bei der Tastatur', async ({ page }, testInfo) => {
  const bild = `tmp-test/regler/${testInfo.project.name}`;
  await page.goto('/mehr/funktionen');
  const info = page.getByRole('button', { name: /^Info/ }).first();
  await info.scrollIntoViewIfNeeded();
  await info.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1 });
  await info.focus();
  await info.dispatchEvent('click', { bubbles: true, detail: 0 });
  await expect(info).toBeFocused();
  const nachTippen = await info.evaluate((element) => ({
    ring: getComputedStyle(element).outlineStyle,
    eingabe: document.documentElement.dataset.eingabe ?? '',
  }));
  expect(nachTippen.eingabe).toBe('zeiger');
  expect(nachTippen.ring).toBe('none');
  await ausschnitt(page, info, `${bild}-ring-zeiger.png`);

  let ringZiel: Locator | null = null;
  for (let schritt = 0; schritt < 15; schritt += 1) {
    await page.keyboard.press('Tab');
    const sichtbar = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) {
        return false;
      }
      const stil = getComputedStyle(element);
      return stil.outlineStyle !== 'none' && stil.outlineWidth !== '0px';
    });
    if (sichtbar) {
      ringZiel = page.locator(':focus');
      break;
    }
  }
  expect(ringZiel).not.toBeNull();
  if (!ringZiel) {
    return;
  }
  const tastatur = await page.evaluate(() => document.documentElement.dataset.eingabe ?? '');
  expect(tastatur).toBe('tastatur');
  await ausschnitt(page, ringZiel, `${bild}-ring-tastatur.png`);
  await page.evaluate(() => {
    document.documentElement.dataset.eingabe = 'zeiger';
  });
  const ohneRing = await page.evaluate(() => getComputedStyle(document.activeElement as HTMLElement).outlineStyle);
  expect(ohneRing).toBe('none');
});
