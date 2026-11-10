import { expect, test, type Page } from './uhr.ts';
import { hatEintragFab, LEISTEN_SEITEN } from '../shared/spiel/leiste.ts';
import { anmelden } from './helfer.ts';
import {
  BREITE,
  formatBericht,
  HOEHE,
  missDichte,
  missPlus,
  plusText,
  schreibeBericht,
  type DichteBericht,
  type OrtBericht,
} from './dichte-messen.ts';
import { dialogeZu, erstePfade } from './pruefaufnahme.ts';

const SEITEN: { name: string; pfad: string }[] = [
  { name: 'Heute', pfad: '/' },
  { name: 'Ziele', pfad: '/ziele' },
  { name: 'Laufend', pfad: '/laufend' },
  { name: 'Basis', pfad: '/basis' },
  { name: 'Tätigkeiten', pfad: '/mehr/inhalte' },
  { name: 'Verlauf', pfad: '/chronik' },
  { name: 'Rückblick', pfad: '/rueckblick' },
  { name: 'Statistik', pfad: '/statistiken' },
  { name: 'Vorbilder', pfad: '/vorbilder' },
  { name: 'Profil', pfad: '/charakter' },
  { name: 'Können', pfad: '/koennen' },
  { name: 'Haben', pfad: '/haben' },
  { name: 'Fähigkeiten', pfad: '/faehigkeiten' },
  { name: 'Investitionen', pfad: '/investitionen' },
  { name: 'Handbuch', pfad: '/handbuch' },
  { name: 'Mehr', pfad: '/mehr' },
  { name: 'Was ist neu', pfad: '/mehr/neu' },
  { name: 'Konto', pfad: '/mehr/profil' },
  { name: 'Profilname', pfad: '/mehr/profil/name' },
  { name: 'Titel', pfad: '/mehr/profil/titel' },
  { name: 'Geburtsjahr', pfad: '/mehr/profil/jahr' },
  { name: 'Ziel', pfad: '/mehr/profil/ziel' },
  { name: 'Fokus', pfad: '/mehr/profil/fokus' },
  { name: 'Passwort', pfad: '/mehr/profil/passwort' },
  { name: 'Accounts', pfad: '/mehr/profil/accounts' },
  { name: 'Verbindungen', pfad: '/mehr/inhalte/verbindungen' },
  { name: 'Darstellung', pfad: '/mehr/darstellung' },
  { name: 'Leiste', pfad: '/mehr/darstellung/leiste' },
  { name: 'Paletten', pfad: '/mehr/darstellung/paletten' },
  { name: 'Karten auf Heute', pfad: '/mehr/uebersicht' },
  { name: 'Bereiche', pfad: '/mehr/funktionen' },
  { name: 'Benachrichtigungen', pfad: '/mehr/benachrichtigungen' },
  { name: 'Daten', pfad: '/mehr/daten' },
  { name: 'Vorbild', pfad: '/vorbilder/ronaldo' },
];

test.describe.configure({ timeout: 180_000 });

function leerBericht(): DichteBericht {
  return { fenster: { breite: 0, hoehe: 0 }, seiten: [], blaetter: [], plus: [], fehler: [] };
}

async function seiteDicht(seite: Page, pfad: string): Promise<void> {
  await seite.goto(pfad, { waitUntil: 'domcontentloaded' });
  await expect(seite.locator('main h1').first()).toBeVisible();
  await expect(seite.getByText('Lädt …', { exact: true })).toHaveCount(0);
}

async function klappeHeute(seite: Page): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    const zu = seite.locator('main .abschnitt-kopf > button[aria-expanded="false"]');
    if ((await zu.count()) === 0) return;
    await zu.first().click();
  }
}

async function missOrt(seite: Page, ort: string): Promise<OrtBericht> {
  return { ort, funde: await seite.evaluate(missDichte) };
}

async function blattAuf(
  seite: Page,
  name: string,
  oeffne: () => Promise<void>,
  fehler: string[],
): Promise<OrtBericht | null> {
  try {
    await oeffne();
    const dialog = seite.getByRole('dialog').or(seite.getByRole('alertdialog')).last();
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    const bericht = await missOrt(seite, name);
    await dialogeZu(seite);
    return bericht;
  } catch (ursache) {
    const roh = ursache instanceof Error ? ursache.message : String(ursache);
    const text = roh.replace(/\u001B\[[0-9;]*m/g, '').split('\n')[0] ?? roh;
    fehler.push(`${name}: ${text}`);
    await dialogeZu(seite).catch(() => undefined);
    return null;
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'handy', 'Nur bei 390 mal 844');
  await page.setViewportSize({ width: BREITE, height: HOEHE });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Dichte auf allen Seiten und Plus-Knopf am Seitenende', async ({ page }) => {
  const bericht = leerBericht();
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await page.setViewportSize({ width: BREITE, height: HOEHE });
    bericht.fenster = await page.evaluate(() => ({ breite: window.innerWidth, hoehe: window.innerHeight }));
    expect(bericht.fenster).toEqual({ breite: BREITE, hoehe: HOEHE });
    bericht.seiten.push(await missOrt(page, 'Anmeldung'));

    await anmelden(page);
    const pfade = await erstePfade(page);
    const seiten = [...SEITEN];
    if (pfade.projekt) seiten.push({ name: 'Projekt', pfad: pfade.projekt });
    if (pfade.faehigkeit) seiten.push({ name: 'Fähigkeit', pfad: pfade.faehigkeit });

    const plusPfade = new Set(LEISTEN_SEITEN.map((eintrag) => eintrag.pfad));
    for (const eintrag of seiten) {
      await seiteDicht(page, eintrag.pfad);
      if (eintrag.pfad === '/') await klappeHeute(page);
      bericht.seiten.push(await missOrt(page, `${eintrag.name} (${eintrag.pfad})`));
      if (!plusPfade.has(eintrag.pfad)) continue;
      const lage = await missPlus(page);
      const plus = {
        pfad: eintrag.pfad,
        amEnde: lage.amEnde,
        fab: lage.fab,
        fabSoll: hatEintragFab(eintrag.pfad),
        ueberX: lage.ueberX,
        ueberY: lage.ueberY,
        hatKreis: lage.hatKreis,
        hatMenue: lage.hatMenue,
        zeile: lage.zeile !== null,
        text: '',
      };
      plus.text = plusText(eintrag.pfad, plus);
      bericht.plus.push(plus);
    }
  } finally {
    schreibeBericht(bericht, 'seiten');
    test.info().annotations.push({ type: 'dichte', description: formatBericht(bericht) });
  }
  expect(bericht.seiten.length).toBeGreaterThan(10);
  expect(bericht.plus.length).toBe(LEISTEN_SEITEN.length);
});

test('Dichte auf Blättern', async ({ page }) => {
  const bericht = leerBericht();
  try {
    await anmelden(page);
    page.setDefaultTimeout(8_000);
    await page.setViewportSize({ width: BREITE, height: HOEHE });
    bericht.fenster = await page.evaluate(() => ({ breite: window.innerWidth, hoehe: window.innerHeight }));
    const pfade = await erstePfade(page);

    const blaetter: { name: string; oeffne: () => Promise<void> }[] = [
      {
        name: 'Eintrag',
        oeffne: async () => {
          await seiteDicht(page, '/');
          await page.getByRole('button', { name: 'Eintrag loggen' }).click();
        },
      },
      {
        name: 'Tätigkeit anlegen',
        oeffne: async () => {
          await seiteDicht(page, '/');
          await page.getByRole('button', { name: 'Eintrag loggen' }).click();
          await expect(page.getByRole('dialog', { name: 'Was hast du getan?' })).toBeVisible();
          await page.getByRole('button', { name: '+ Tätigkeit' }).click();
        },
      },
      {
        name: 'Filter',
        oeffne: async () => {
          await seiteDicht(page, '/chronik');
          await page.getByRole('button', { name: 'Filter', exact: true }).click();
        },
      },
      {
        name: 'Vision anlegen',
        oeffne: async () => {
          await seiteDicht(page, '/ziele');
          await page.getByRole('button', { name: 'Neu', exact: true }).click();
          await page.getByRole('menuitem', { name: 'Vision', exact: true }).click();
        },
      },
      {
        name: 'Organisation',
        oeffne: async () => {
          await seiteDicht(page, '/ziele');
          await page.getByRole('button', { name: 'Neu', exact: true }).click();
          await page.getByRole('menuitem', { name: 'Organisation', exact: true }).click();
        },
      },
      {
        name: 'Vision lesen',
        oeffne: async () => {
          await seiteDicht(page, '/ziele');
          await page.getByRole('button', { name: 'Fit und belastbar', exact: true }).click();
        },
      },
      {
        name: 'Projekt-Blatt',
        oeffne: async () => {
          await seiteDicht(page, pfade.projekt ?? '/ziele');
          await page.getByRole('button', { name: /^Aktionen für / }).first().click();
          await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
        },
      },
      {
        name: 'Investition',
        oeffne: async () => {
          await seiteDicht(page, '/investitionen');
          await page.getByRole('button', { name: /Investition anlegen/ }).first().click();
        },
      },
      {
        name: 'Klassen und Titel',
        oeffne: async () => {
          await seiteDicht(page, '/charakter');
          await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
        },
      },
      {
        name: 'Basis-Aufgabe',
        oeffne: async () => {
          await seiteDicht(page, '/basis');
          await page.getByRole('button', { name: /Basis-Aufgabe/ }).first().click();
        },
      },
      {
        name: 'Abmelden',
        oeffne: async () => {
          await seiteDicht(page, '/mehr/profil');
          await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
        },
      },
      {
        name: 'Ruhezeit',
        oeffne: async () => {
          await seiteDicht(page, '/mehr/benachrichtigungen');
          const ruhe = page.getByRole('button', { name: 'Ruhezeit', exact: true });
          await expect(ruhe).toBeVisible();
          if (!(await ruhe.isEnabled())) {
            throw new Error('Ruhezeit gesperrt');
          }
          await ruhe.click();
        },
      },
      {
        name: 'Attribut',
        oeffne: async () => {
          await seiteDicht(page, '/koennen');
          await page.getByRole('button', { name: /^Aktionen für / }).first().click();
          await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
        },
      },
      {
        name: 'Eintrag lesen',
        oeffne: async () => {
          await seiteDicht(page, '/chronik');
          const zeilen = page.locator('section [data-zeile]').filter({ hasText: 'XP' });
          await expect(zeilen.first()).toBeVisible();
          await zeilen.first().locator('> button').click();
        },
      },
    ];
    if (pfade.faehigkeit) {
      blaetter.push({
        name: 'Knoten',
        oeffne: async () => {
          await seiteDicht(page, pfade.faehigkeit ?? '/faehigkeiten');
          await page.locator('.baum-karte button').first().click();
        },
      });
    }

    for (const blatt of blaetter) {
      const ort = await blattAuf(page, blatt.name, blatt.oeffne, bericht.fehler);
      if (ort) bericht.blaetter.push(ort);
    }
  } finally {
    schreibeBericht(bericht, 'blaetter');
    test.info().annotations.push({ type: 'dichte', description: formatBericht(bericht) });
  }
  expect(bericht.blaetter.length).toBeGreaterThan(5);
});
