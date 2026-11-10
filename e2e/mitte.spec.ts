import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden } from './helfer.ts';
import { dialogeZu, erstePfade } from './pruefaufnahme.ts';
import {
  BERICHT_ORDNER,
  missMitte,
  PFLICHT_PAARE,
  schreibeTabelle,
  type MitteZeile,
  type TabellenZeile,
} from './mitte-messen.ts';

const HELL = { primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };
const DUNKEL = { primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };

const BREITEN = [
  { breite: 360, hoehe: 800 },
  { breite: 390, hoehe: 844 },
  { breite: 1280, hoehe: 800 },
] as const;

const ANSICHTEN = [
  { stil: 'standard', schema: 'light', name: 'hell Standard', farben: HELL },
  { stil: 'standard', schema: 'dark', name: 'dunkel Standard', farben: DUNKEL },
  { stil: 'holo', schema: 'light', name: 'hell Hologramm', farben: HELL },
  { stil: 'holo', schema: 'dark', name: 'dunkel Hologramm', farben: DUNKEL },
] as const;

interface Flaeche {
  name: string;
  pfad: string;
}

interface Darstellung {
  stil: string;
  glimmen: boolean;
  primaer: string;
  akzent: string;
  hintergrund: string;
  eigeneFarben?: boolean;
}

test.describe.configure({ timeout: 900_000 });

async function lese(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      glimmen: daten.glimmen,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      eigeneFarben: daten.eigeneFarben,
    };
  });
}

async function speichere(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

async function ruhe(seite: Page): Promise<void> {
  await seite.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function klappeAuf(seite: Page): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    const zu = seite.locator('main .abschnitt-kopf > button[aria-expanded="false"]');
    if ((await zu.count()) === 0) {
      return;
    }
    await zu.first().click();
  }
}

async function oeffne(seite: Page, pfad: string, stil: string, schema: string): Promise<void> {
  await seite.goto(pfad, { waitUntil: 'domcontentloaded' });
  await expect(seite.locator('main h1, [data-kopf] h1').first()).toBeVisible();
  await expect(seite.getByText('Lädt …', { exact: true })).toHaveCount(0);
  await expect(seite.locator('html')).toHaveAttribute('data-stil', stil);
  await expect(seite.locator('html')).toHaveAttribute('data-schema', schema);
  await seite.evaluate(() => document.fonts.ready);
  await klappeAuf(seite);
  await ruhe(seite);
}

async function missFlaeche(seite: Page, modus: string): Promise<MitteZeile[]> {
  return seite.evaluate(missMitte, modus);
}

test('Mitte von Symbolen, Zahlen und Text', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Breiten setzt der Test selbst');
  const tabelle: TabellenZeile[] = [];
  const fehler: string[] = [];
  let original: Darstellung | null = null;

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await anmelden(page);
    original = await lese(page);
    const pfade = await erstePfade(page);
    const faehigkeit = await page.evaluate(async () => {
      const liste = (await fetch('/api/faehigkeiten').then((antwort) => antwort.json())) as { id: number; knoten: unknown[] }[];
      const fund = liste.find((eintrag) => eintrag.knoten.length > 0);
      return fund ? `/faehigkeiten/${fund.id}` : null;
    });
    if (!pfade.projekt) {
      fehler.push('Projekt: kein Pfad');
    }
    if (!faehigkeit) {
      fehler.push('Fähigkeit: kein Baum');
    }
    await page.goto('/basis', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByText('Lädt …', { exact: true })).toHaveCount(0);
    const kasten = page.locator('main [role="checkbox"]').first();
    await expect(kasten).toBeVisible();
    if ((await kasten.getAttribute('aria-checked')) !== 'true') {
      await kasten.click();
      await expect(kasten).toHaveAttribute('aria-checked', 'true');
    }
    await expect(page.locator('main [data-abhak="erledigt"]').first()).toBeVisible();
    const aufstieg = page.getByRole('dialog');
    const aufstiegOffen = await aufstieg.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    if (aufstiegOffen) {
      await page.keyboard.press('Escape');
      await expect(aufstieg).toHaveCount(0);
    }
    const toast = page.locator('.belohnung').getByRole('button', { name: 'Schließen' });
    if ((await toast.count()) > 0) {
      await toast.first().click();
    }

    const flaechen: Flaeche[] = [
      { name: 'Heute', pfad: '/' },
      { name: 'Laufend', pfad: '/laufend' },
      { name: 'Ziele', pfad: '/ziele' },
      { name: 'Projekt', pfad: pfade.projekt ?? '' },
      { name: 'Basis', pfad: '/basis' },
      { name: 'Fähigkeit', pfad: faehigkeit ?? '' },
      { name: 'Profil', pfad: '/charakter' },
      { name: 'Mehr', pfad: '/mehr' },
      { name: 'Darstellung', pfad: '/mehr/darstellung' },
    ];

    for (const ansicht of ANSICHTEN) {
      await speichere(page, { stil: ansicht.stil, glimmen: true, ...ansicht.farben });
      for (const fenster of BREITEN) {
        await page.setViewportSize({ width: fenster.breite, height: fenster.hoehe });
        const lage = `${fenster.breite} · ${ansicht.name}`;

        for (const flaeche of flaechen) {
          if (!flaeche.pfad) {
            continue;
          }
          try {
            await oeffne(page, flaeche.pfad, ansicht.stil, ansicht.schema);
            if (flaeche.pfad === '/') {
              expect(await page.evaluate(() => window.innerWidth)).toBe(fenster.breite);
            }
            const funde = await missFlaeche(page, 'seite');
            for (const fund of funde) {
              tabelle.push({ seite: `${flaeche.name} · ${lage}`, ...fund });
            }
          } catch (ursache) {
            const text = ursache instanceof Error ? (ursache.message.split('\n')[0] ?? ursache.message) : String(ursache);
            fehler.push(`${flaeche.name} · ${lage}: ${text}`);
            await dialogeZu(page).catch(() => undefined);
          }
        }

        try {
          await oeffne(page, '/', ansicht.stil, ansicht.schema);
          await page.getByRole('button', { name: 'Eintrag loggen' }).click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await ruhe(page);
          const funde = await missFlaeche(page, 'dialog');
          for (const fund of funde) {
            tabelle.push({ seite: `Eintrag · ${lage}`, ...fund });
          }
          await dialogeZu(page);
        } catch (ursache) {
          const text = ursache instanceof Error ? (ursache.message.split('\n')[0] ?? ursache.message) : String(ursache);
          fehler.push(`Eintrag · ${lage}: ${text}`);
          await dialogeZu(page).catch(() => undefined);
        }

        try {
          await oeffne(page, '/koennen', ansicht.stil, ansicht.schema);
          await page.getByRole('button', { name: /^Aktionen für / }).first().click();
          await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          await ruhe(page);
          const funde = await missFlaeche(page, 'dialog');
          for (const fund of funde) {
            tabelle.push({ seite: `Attribut · ${lage}`, ...fund });
          }
          await dialogeZu(page);
        } catch (ursache) {
          const text = ursache instanceof Error ? (ursache.message.split('\n')[0] ?? ursache.message) : String(ursache);
          fehler.push(`Attribut · ${lage}: ${text}`);
          await dialogeZu(page).catch(() => undefined);
        }
      }
    }
  } finally {
    schreibeTabelle(tabelle, fehler);
    if (original) {
      await speichere(
        page,
        original.eigeneFarben
          ? {
              stil: original.stil,
              glimmen: original.glimmen,
              primaer: original.primaer,
              akzent: original.akzent,
              hintergrund: original.hintergrund,
            }
          : { stil: original.stil, glimmen: original.glimmen, farbenZuruecksetzen: true },
      ).catch(() => undefined);
    }
  }

  expect(fehler, fehler.join('\n')).toEqual([]);
  const text = fs.readFileSync(`${BERICHT_ORDNER}/tabelle.txt`, 'utf8');
  expect(text.startsWith('Seite\tPaar\tAbweichung\tAusreisser')).toBe(true);
  for (const name of ['Heute', 'Laufend', 'Ziele', 'Projekt', 'Basis', 'Fähigkeit', 'Profil', 'Mehr', 'Darstellung', 'Eintrag', 'Attribut']) {
    expect(text, name).toContain(name);
  }
  for (const paar of PFLICHT_PAARE) {
    expect(tabelle.some((zeile) => zeile.paar.startsWith(paar)), paar).toBe(true);
  }
  expect(tabelle.some((zeile) => zeile.paar.startsWith('Haken ↔ Abhakkasten')), 'Haken ↔ Abhakkasten').toBe(true);
  for (const fenster of BREITEN) {
    expect(tabelle.some((zeile) => zeile.seite.includes(`${fenster.breite} ·`)), String(fenster.breite)).toBe(true);
  }
  for (const ansicht of ANSICHTEN) {
    expect(tabelle.some((zeile) => zeile.seite.includes(ansicht.name)), ansicht.name).toBe(true);
  }
});
