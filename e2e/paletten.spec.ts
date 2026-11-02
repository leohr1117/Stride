import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { erscheinungAus, standardVorlage } from '../shared/features/darstellung/paletten.ts';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

const ANSICHT_NAME: Record<string, string> = {
  standard: 'Standard',
  minimal: 'Minimal',
  jade: 'Jade',
  holo: 'Hologramm',
  antik: 'Antik',
};

const TRIO = { primaer: '#d0d0d0', akzent: '#9a9a9a', hintergrund: '#141414' };

interface Palette {
  id: string;
  name: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
}

interface Stand {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  eigeneFarben: boolean;
  sprache: string | null;
  paletten: Palette[];
  ansichtFarben: Partial<Record<string, { primaer: string; akzent: string; hintergrund: string }>>;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function lese(seite: Page): Promise<Stand> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Stand;
    return daten;
  });
}

async function patch(seite: Page, koerper: unknown): Promise<void> {
  const ok = await seite.evaluate(async (wert) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wert),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

async function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate((schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim(), name);
}

async function setzeFarbfeld(dialog: Locator, label: string, wert: string): Promise<void> {
  await dialog.locator('.feld', { hasText: label }).locator('input[type="color"]').evaluate((element, farbe) => {
    const feld = element as HTMLInputElement;
    const setze = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setze?.call(feld, farbe);
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    feld.dispatchEvent(new Event('change', { bubbles: true }));
  }, wert);
}

test('Eigene Paletten wählen die Ansicht, Standard ist die Ausgangsansicht', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const bild = (name: string) => page.screenshot({ path: `tmp-test/paletten/${testInfo.project.name}-${name}.png`, fullPage: true });
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });

  await page.goto('/');
  await page.locator('input[name="username"]').fill('testvoll');
  await page.locator('input[name="password"]').fill(await passwort());
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  const spracheVorher = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { sprache: string | null };
    return daten.sprache;
  });
  let anfang: Stand | null = null;

  try {
    if (spracheVorher !== 'de') {
      await patch(page, { sprache: 'de' });
      await page.reload();
      await page.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
    }
    anfang = await lese(page);
    const andere = anfang.stil === 'jade' ? 'holo' : 'jade';
    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Eigene Paletten', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await expect(page.locator('button.rounded-xl').filter({ hasText: 'Standard' })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);

    await page.getByRole('link', { name: 'Paletten verwalten', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/darstellung\/paletten$/);
    await expect(page.getByRole('heading', { name: 'Paletten', exact: true })).toBeVisible();
    if (anfang.paletten.length === 0) {
      await expect(page.getByText('Noch keine Palette.')).toBeVisible();
    }
    await page.getByRole('button', { name: '+ Palette anlegen', exact: true }).click();
    const formular = page.getByRole('dialog', { name: 'Neue Palette' });
    await expect(formular).toBeVisible();
    const info = formular.getByRole('button', { name: 'Info' });
    await info.click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText('Primär für Knöpfe, Akzent für XP, Hintergrund für die Fläche.');
    const kasten = await hinweis.boundingBox();
    const fenster = page.viewportSize();
    expect(kasten).not.toBeNull();
    expect(fenster).not.toBeNull();
    if (kasten && fenster) {
      expect(kasten.x).toBeGreaterThanOrEqual(0);
      expect(kasten.y).toBeGreaterThanOrEqual(0);
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
      expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
    }
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);
    await expect(formular).toBeVisible();

    const grundVorher = await variable(page, '--grund');
    await formular.getByRole('textbox', { name: 'Name', exact: true }).fill('Morgenrot');
    await setzeFarbfeld(formular, 'Hintergrund', '#101010');
    await expect.poll(() => variable(page, '--grund')).toBe(grundVorher);
    await setzeFarbfeld(formular, 'Primär', TRIO.primaer);
    await setzeFarbfeld(formular, 'Akzent', TRIO.akzent);
    await setzeFarbfeld(formular, 'Hintergrund', TRIO.hintergrund);
    await ohneSeitlichenUeberlauf(page);
    await bild('formular');

    const gespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await formular.getByRole('button', { name: 'Speichern', exact: true }).click();
    await gespeichert;
    await expect(formular).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Morgenrot', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('paletten');

    await page.getByRole('button', { name: '+ Palette anlegen', exact: true }).click();
    const doppelt = page.getByRole('dialog', { name: 'Neue Palette' });
    await doppelt.getByRole('textbox', { name: 'Name', exact: true }).fill('morgenrot');
    const abgelehnt = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && !antwort.ok(),
    );
    await doppelt.getByRole('button', { name: 'Speichern', exact: true }).click();
    await abgelehnt;
    await expect(doppelt.getByText('Der Name ist schon vergeben.')).toBeVisible();
    await expect(doppelt).toBeVisible();
    await doppelt.getByRole('button', { name: 'Schließen', exact: true }).click();
    const verwerfen = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(verwerfen).toBeVisible();
    await verwerfen.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await expect(doppelt).toHaveCount(0);

    await page.getByRole('button', { name: 'Morgenrot', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Morgenrot' });
    await expect(detail).toBeVisible();
    await expect(detail.locator('input[type="color"]')).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeVisible();
    await detail.getByRole('button', { name: 'Aktionen', exact: true }).click();
    await expect(detail.getByRole('button', { name: 'Löschen', exact: true })).toBeVisible();
    await detail.getByRole('button', { name: 'Aktionen', exact: true }).click();
    await expect(detail.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('detail');
    await detail.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    const bearbeiten = page.getByRole('dialog', { name: 'Palette bearbeiten' });
    await expect(bearbeiten).toBeVisible();
    await bearbeiten.getByRole('textbox', { name: 'Name', exact: true }).fill('Abendrot');
    const umbenannt = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await bearbeiten.getByRole('button', { name: 'Speichern', exact: true }).click();
    await umbenannt;
    await expect(bearbeiten).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abendrot', exact: true })).toBeVisible();

    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    const chip = page.getByRole('button', { name: 'Abendrot', exact: true });
    const uebernommen = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    const xpVorher = await variable(page, '--xp');
    await chip.click();
    await uebernommen;
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const bildFarben = erscheinungAus(TRIO);
    await expect.poll(() => variable(page, '--akzent')).toBe(bildFarben.primaer);
    await expect.poll(() => variable(page, '--xp')).toBe(xpVorher);
    expect(xpVorher).not.toBe(bildFarben.akzent);
    await expect.poll(() => variable(page, '--grund')).toBe(bildFarben.hintergrund);
    const gewaehlt = await lese(page);
    expect(gewaehlt.stil).toBe(anfang.stil);
    expect(gewaehlt.primaer).toBe(TRIO.primaer);
    expect(gewaehlt.akzent).toBe(TRIO.akzent);
    expect(gewaehlt.hintergrund).toBe(TRIO.hintergrund);
    expect(gewaehlt.ansichtFarben[anfang.stil]).toEqual(TRIO);
    expect(gewaehlt.paletten.some((palette) => palette.name === 'Abendrot')).toBe(true);
    await ohneSeitlichenUeberlauf(page);
    await bild('auswahl');

    const wegGespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.locator('button.rounded-xl').filter({ hasText: ANSICHT_NAME[andere] ?? andere }).click();
    await wegGespeichert;
    const weg = await lese(page);
    expect(weg.stil).toBe(andere);
    expect(weg.ansichtFarben[anfang.stil]).toEqual(TRIO);
    expect(weg.paletten.some((palette) => palette.name === 'Abendrot')).toBe(true);
    expect(weg.primaer).not.toBe(TRIO.primaer);

    const zurueckGespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.locator('button.rounded-xl').filter({ hasText: ANSICHT_NAME[anfang.stil] ?? anfang.stil }).click();
    await zurueckGespeichert;
    const zurueck = await lese(page);
    expect(zurueck.stil).toBe(anfang.stil);
    expect(zurueck.primaer).toBe(TRIO.primaer);

    const schlichtGespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.locator('button.rounded-xl').filter({ hasText: 'Standard' }).click();
    await schlichtGespeichert;
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.stil ?? '')).toBe('standard');
    const dunkel = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const soll = standardVorlage('standard', dunkel);
    const gemerkt = (await lese(page)).ansichtFarben.standard;
    await expect.poll(() => variable(page, '--akzent')).toBe(gemerkt?.primaer ?? soll.primaer);
    await expect.poll(() => variable(page, '--xp')).toBe(soll.akzent);
    await expect.poll(() => variable(page, '--grund')).toBe(gemerkt?.hintergrund ?? soll.hintergrund);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('standard');

    await page.goto('/mehr/darstellung/paletten');
    await page.getByRole('button', { name: 'Abendrot', exact: true }).click();
    const loeschDialog = page.getByRole('dialog', { name: 'Abendrot' });
    const geloescht = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await loeschDialog.getByRole('button', { name: 'Aktionen', exact: true }).click();
    await loeschDialog.getByRole('button', { name: 'Löschen', exact: true }).click();
    await geloescht;
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Abendrot');
    expect((await lese(page)).paletten.some((palette) => palette.name === 'Abendrot')).toBe(false);
    const rueck = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await rueck;
    await expect.poll(async () => (await lese(page)).paletten.some((palette) => palette.name === 'Abendrot')).toBe(true);
    await expect(page.getByRole('button', { name: 'Abendrot', exact: true })).toBeVisible();
  } finally {
    const jetzt = await lese(page).catch(() => null);
    if (anfang && jetzt) {
      const bekannt = new Set(anfang.paletten.map((palette) => palette.id));
      for (const palette of jetzt.paletten) {
        if (!bekannt.has(palette.id)) {
          await patch(page, { paletteLoeschen: palette.id });
        }
      }
      await patch(page, {
        stil: anfang.stil,
        primaer: anfang.primaer,
        akzent: anfang.akzent,
        hintergrund: anfang.hintergrund,
      });
      if (!anfang.eigeneFarben) {
        await patch(page, { farbenZuruecksetzen: true });
      }
    }
    if (spracheVorher && spracheVorher !== 'de') {
      await page.evaluate(async (sprache) => {
        await fetch('/api/einstellungen', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprache }),
        });
      }, spracheVorher);
    }
  }
});
