import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden } from './helfer.ts';
import { expect, test, TESTDATUM, type Page } from './uhr.ts';

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

function pausen(): { von: string; bis: string | null }[] {
  const db = new DatabaseSync(weltDatei());
  try {
    return db.prepare('SELECT von, bis FROM streak_pausen ORDER BY id').all() as { von: string; bis: string | null }[];
  } finally {
    db.close();
  }
}

async function setzeFunktionen(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

async function ketteLaenge(seite: Page): Promise<number> {
  const antwort = await seite.request.get('/api/kette/heute');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { serie: { laenge: number } };
  return daten.serie.laenge;
}

async function leistenZiele(seite: Page): Promise<string[]> {
  return seite.locator('.mobilleiste a, .seitenleiste a').evaluateAll((knoten) =>
    knoten.map((element) => element.getAttribute('href') ?? ''),
  );
}

function raster(seite: Page) {
  return seite.locator('[data-wochenwert="XP diese Woche"]').locator('xpath=..');
}

async function spalten(seite: Page): Promise<string> {
  return raster(seite).evaluate((element) => (element as HTMLElement).style.gridTemplateColumns);
}

async function wochenNamen(seite: Page): Promise<string[]> {
  return seite.locator('[data-wochenwert]').evaluateAll((knoten) =>
    knoten.map((element) => element.getAttribute('data-wochenwert') ?? ''),
  );
}

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/streak-aussetzen', { recursive: true });
  await seite.screenshot({ path: `tmp-test/streak-aussetzen/${name}.png` });
}

test('Streak aus blendet Kette und Kennzahl aus und stellt die Länge wieder her', async ({ page }, testInfo) => {
  await anmelden(page);
  const standAntwort = await page.request.get('/api/einstellungen');
  expect(standAntwort.ok()).toBe(true);
  const stand = (await standAntwort.json()) as { funktionen: Record<string, boolean> };
  const laengeVorher = await ketteLaenge(page);
  const projekt = testInfo.project.name;
  fs.mkdirSync('tmp-test/streak-aussetzen', { recursive: true });

  try {
    await page.goto('/');
    await expect(page.locator('[data-wochenwert]')).toHaveCount(3);
    expect(await wochenNamen(page)).toEqual(['XP diese Woche', 'Streak', 'Momentum']);
    expect(await spalten(page)).toBe('repeat(3, 1fr)');
    await expect(page.locator('[data-wochenwert="Streak"]')).toContainText(String(laengeVorher));
    const abschnittVorher = await page.locator('section[data-heute]').count();
    const leisteVorher = await leistenZiele(page);
    await raster(page).screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-an-raster.png` });
    if (abschnittVorher > 0) {
      await page.locator('section[data-heute]').screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-an-streak.png` });
    } else {
      await page.locator('[data-wochenwert="Streak"]').screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-an-streak.png` });
    }

    await page.goto('/statistiken');
    const gitter = page.locator('.grid-cols-2').filter({ has: page.locator('[data-kennzahl]') });
    await expect(gitter.getByText('Längster Streak', { exact: true })).toBeVisible();
    await expect(gitter.getByText('Einträge', { exact: true })).toBeVisible();
    await expect(gitter.getByText('Stunden', { exact: true })).toBeVisible();
    await expect(gitter.getByText('Aktive Tage', { exact: true })).toBeVisible();
    await expect(gitter.getByText('Meilensteine', { exact: true })).toBeVisible();
    const kennzahlenAn = await gitter.locator('[data-kennzahl]').count();
    await gitter.screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-an-statistik.png` });

    await page.goto('/mehr/funktionen');
    const schalter = page.locator('#funktion-streak').getByRole('switch', { name: 'Streak', exact: true });
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    await expect(schalter).toBeEnabled();
    await expect(page.locator('#funktion-streak')).toContainText('Aus pausiert die Kette. Momentum bleibt solange bei 1,0.');
    const patches: string[] = [];
    page.on('request', (anfrage) => {
      if (anfrage.method() === 'PATCH' && anfrage.url().includes('/api/einstellungen')) {
        patches.push(anfrage.postData() ?? '');
      }
    });
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'false');
    expect(patches.length).toBeGreaterThan(0);
    expect((JSON.parse(patches.at(-1) ?? '{}') as { funktionen?: { streak?: boolean } }).funktionen?.streak).toBe(false);

    await page.goto('/');
    await expect(page.locator('section[data-heute]')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert]')).toHaveCount(1);
    expect(await wochenNamen(page)).toEqual(['XP diese Woche']);
    expect(await spalten(page)).toBe('repeat(1, 1fr)');
    await expect(raster(page).locator('[data-wochenwert="Streak"]')).toHaveCount(0);
    await expect(raster(page).locator('[data-wochenwert="Momentum"]')).toHaveCount(0);
    expect(await leistenZiele(page)).toEqual(leisteVorher);
    expect(pausen()).toEqual([{ von: TESTDATUM, bis: null }]);
    await raster(page).screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-aus-raster.png` });
    await bild(page, `${projekt}-aus-streak`);

    await page.route('**/api/kette/heute', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('section[data-heute]')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert]')).toHaveCount(1);
    await page.unroute('**/api/kette/heute');

    await page.goto('/statistiken');
    const gitterAus = page.locator('.grid-cols-2').filter({ has: page.locator('[data-kennzahl]') });
    await expect(gitterAus).toHaveClass(/grid-cols-2/);
    await expect(gitterAus.getByText('Längster Streak', { exact: true })).toHaveCount(0);
    await expect(gitterAus.getByText('Einträge', { exact: true })).toBeVisible();
    await expect(gitterAus.getByText('Stunden', { exact: true })).toBeVisible();
    await expect(gitterAus.getByText('Aktive Tage', { exact: true })).toBeVisible();
    await expect(gitterAus.getByText('Meilensteine', { exact: true })).toBeVisible();
    const kacheln = gitterAus.locator('[data-kennzahl]');
    await expect(kacheln).toHaveCount(kennzahlenAn - 1);
    const texte = await kacheln.allInnerTexts();
    expect(texte.every((text) => text.trim().length > 0)).toBe(true);
    expect(await gitterAus.evaluate((element) => element.childElementCount)).toBe(kennzahlenAn - 1);
    await gitterAus.screenshot({ path: `tmp-test/streak-aussetzen/${projekt}-aus-statistik.png` });

    await page.goto('/mehr/funktionen');
    const wieder = page.locator('#funktion-streak').getByRole('switch', { name: 'Streak', exact: true });
    await wieder.click();
    await expect(wieder).toHaveAttribute('aria-checked', 'true');
    expect((JSON.parse(patches.at(-1) ?? '{}') as { funktionen?: { streak?: boolean } }).funktionen?.streak).toBe(true);

    await page.goto('/');
    await expect(page.locator('[data-wochenwert]')).toHaveCount(3);
    expect(await wochenNamen(page)).toEqual(['XP diese Woche', 'Streak', 'Momentum']);
    expect(await spalten(page)).toBe('repeat(3, 1fr)');
    await expect(page.locator('[data-wochenwert="Streak"]')).toContainText(String(laengeVorher));
    await expect(page.locator('section[data-heute]')).toHaveCount(abschnittVorher);
    expect(await ketteLaenge(page)).toBe(laengeVorher);
    expect(pausen()).toEqual([]);
  } finally {
    await page.unroute('**/api/kette/heute').catch(() => undefined);
    await setzeFunktionen(page, stand.funktionen);
  }
});
