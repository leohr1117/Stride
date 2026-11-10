import { expect, test, type Locator, type Page } from './uhr.ts';
import { SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ZIEL = 'https://leohr.de';

function textVon(sprache: Sprache): string {
  return `${zeige('von', sprache)} leohr`;
}

async function absender(seite: Page): Promise<Locator> {
  const zeile = seite.locator('[data-absender]');
  await expect(zeile).toHaveCount(1);
  return zeile;
}

async function fokusSichtbar(seite: Page, link: Locator): Promise<void> {
  await seite.keyboard.press('Tab');
  for (let schritt = 0; schritt < 60; schritt += 1) {
    const trifft = await link.evaluate((element) => document.activeElement === element);
    if (trifft) {
      break;
    }
    await seite.keyboard.press('Tab');
  }
  await expect(link).toBeFocused();
  const umriss = await link.evaluate((element) => {
    const stil = getComputedStyle(element);
    return { art: stil.outlineStyle, breite: Number.parseFloat(stil.outlineWidth) };
  });
  expect(umriss.art).not.toBe('none');
  expect(umriss.breite).toBeGreaterThan(0);
}

async function pruefeAbsender(seite: Page, sprache: Sprache, mitFokus: boolean): Promise<void> {
  const zeile = await absender(seite);
  await expect(zeile).toBeVisible();
  await expect(zeile).toHaveText(textVon(sprache));
  const link = zeile.getByRole('link', { name: 'leohr', exact: true });
  await expect(link).toHaveText('leohr');
  await expect(link).toHaveAttribute('href', ZIEL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await ohneSeitlichenUeberlauf(seite);
  if (mitFokus) {
    await fokusSichtbar(seite, link);
  }
}

async function gespeicherteSprache(seite: Page): Promise<Sprache | null> {
  const wert = await seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error(`einstellungen ${antwort.status}`);
    }
    const daten = (await antwort.json()) as { sprache: string | null };
    return daten.sprache;
  });
  return SPRACHEN.find((code) => code === wert) ?? null;
}

async function setzeSprache(seite: Page, wert: Sprache): Promise<void> {
  await seite.evaluate(async (sprache) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache }),
    });
    if (!antwort.ok) {
      throw new Error(`sprache ${antwort.status}`);
    }
  }, wert);
  await seite.goto('/mehr');
  await expect(seite.getByRole('heading', { name: zeige('Mehr', wert), level: 1 })).toBeVisible();
}

test('Absender steht unter der Anmeldung und unten in Mehr und Konto', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  for (const sprache of SPRACHEN) {
    await page.evaluate((code) => {
      localStorage.setItem('stride-sprache', code);
    }, sprache);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(zeige('Anmelden', sprache));
    await pruefeAbsender(page, sprache, sprache === 'de');
  }

  await page.evaluate(() => {
    localStorage.setItem('stride-sprache', 'de');
  });
  await anmelden(page);
  const vorher = await gespeicherteSprache(page);
  try {
    for (const sprache of SPRACHEN) {
      await setzeSprache(page, sprache);
      await pruefeAbsender(page, sprache, sprache === 'de');
      await page.goto('/mehr/profil');
      await expect(page.getByRole('heading', { name: zeige('Konto', sprache), level: 1 })).toBeVisible();
      await pruefeAbsender(page, sprache, sprache === 'de');
    }
  } finally {
    await setzeSprache(page, vorher ?? 'de');
  }
});
