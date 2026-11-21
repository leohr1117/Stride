import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SICHERUNG_APP, type DatenExport, type DatenZeile, type DatenWert } from '../shared/api/daten.ts';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import type { Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';
import { leereGeerbteZugangsVariablen } from '../server/testpfad.ts';
import { mitDatenbankPfaden } from '../server/umgebung.ts';
import { TEST_PASSWORT, TEST_URL, WURZEL } from './testdaten.ts';
import { TESTDATUM, TESTZEIT, expect, stelleTestuhr, test, testJetzt, type Page, type TestInfo } from './uhr.ts';

const ORDNER = 'tmp-test/infoseite';
const PROFIL_DATEI = path.join(ORDNER, 'profilstand.json');
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };
const VISION = 'Fit und belastbar';
const BAUM_KNOTEN = 'Kniebeuge sauber';
const PROFIL_NAME = 'Test Voll';
const MIN_EINTRAEGE = 40;

interface Profilstand {
  name: string;
  klasse: string;
  titel: string | null;
  level: number;
  xp: number;
  eintraege: number;
}

let saatCache: DatenExport | null = null;
let vorher: DatenExport | null = null;

function alsDatenwert(inhalt: unknown, tabelle: string, spalte: string): DatenWert {
  if (inhalt === null || typeof inhalt === 'string' || typeof inhalt === 'number') {
    return inhalt;
  }
  if (typeof inhalt === 'bigint') {
    const zahl = Number(inhalt);
    if (!Number.isSafeInteger(zahl)) {
      throw new Error(`Die Saat hat in ${tabelle}.${spalte} eine zu große Zahl.`);
    }
    return zahl;
  }
  if (typeof inhalt === 'boolean') {
    return inhalt ? 1 : 0;
  }
  throw new Error(`Die Saat hat in ${tabelle}.${spalte} einen unlesbaren Wert.`);
}

function liesWelt(datei: string): DatenExport {
  const db = new DatabaseSync(datei, { readOnly: true });
  try {
    const versionZeile = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
    const schemaVersion = versionZeile?.user_version ?? 0;
    if (schemaVersion < 1) {
      throw new Error('Die Saat hat keine Schemaversion.');
    }
    const namen = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as { name: string }[];
    const tabellen: DatenExport['tabellen'] = {};
    for (const { name } of namen) {
      if (!/^[A-Za-z0-9_]+$/.test(name)) {
        throw new Error(`Die Saat hat eine unerwartete Tabelle ${name}.`);
      }
      const zeilen = db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
      tabellen[name] = zeilen.map((zeile) => {
        const kopie: DatenZeile = {};
        for (const [spalte, inhalt] of Object.entries(zeile)) {
          kopie[spalte] = alsDatenwert(inhalt, name, spalte);
        }
        return kopie;
      });
    }
    return { app: SICHERUNG_APP, schemaVersion, exportiertAm: testJetzt().toISOString(), tabellen };
  } finally {
    db.close();
  }
}

function baueSaat(): DatenExport {
  if (saatCache) {
    return saatCache;
  }
  const ordner = path.join(WURZEL, 'tmp-test', 'infoseite-saat', `${process.pid}-${Date.now()}`);
  const welt = path.join(ordner, 'welten', '1.db');
  fs.mkdirSync(ordner, { recursive: true });
  const env = mitDatenbankPfaden(
    { ...process.env, STRIDE_TEST: '1' },
    path.join(ordner, 'app.db'),
    path.join(ordner, 'zugang.db'),
  );
  leereGeerbteZugangsVariablen(env);
  const ergebnis = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'e2e/samen.ts'], {
    cwd: WURZEL,
    env,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (ergebnis.status !== 0 || !fs.existsSync(welt)) {
    throw new Error(
      `Die Saat ließ sich nicht anlegen (${ergebnis.status ?? 'kein'}). ${`${ergebnis.stderr ?? ''}${ergebnis.stdout ?? ''}`.trim()}`.trim(),
    );
  }
  saatCache = liesWelt(welt);
  return saatCache;
}

async function liesExport(seite: Page): Promise<DatenExport> {
  const antwort = await seite.request.get('/api/export');
  const text = await antwort.text();
  expect(antwort.ok(), text.slice(0, 500)).toBe(true);
  const daten = JSON.parse(text) as DatenExport;
  if (daten.app !== SICHERUNG_APP || daten.tabellen === undefined) {
    throw new Error('Der Export ist keine Weltsicherung.');
  }
  return daten;
}

async function schreibeWelt(seite: Page, daten: DatenExport): Promise<void> {
  const antwort = await seite.request.post('/api/import', { data: daten });
  const text = await antwort.text();
  expect(antwort.ok(), text.slice(0, 500)).toBe(true);
}

async function hinweisAktuell(seite: Page): Promise<void> {
  const antwort = await seite.request.patch('/api/version-hinweis', {
    data: { benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION },
  });
  expect(antwort.ok()).toBe(true);
}

async function meldeAn(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(TEST_PASSWORT);
  await seite.getByRole('button', { name: /Sign in|Anmelden/ }).click();
  await seite.getByRole('button', { name: /Log entry|Eintrag loggen/ }).waitFor();
}

async function liesProfil(seite: Page): Promise<Profilstand> {
  const antwort = await seite.request.get('/api/charakter');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as {
    name: string;
    klasse: string;
    titel: string | null;
    level: { level: number; xpGesamt: number };
    statistik: { eintraegeGesamt: number };
  };
  return {
    name: daten.name, klasse: daten.klasse, titel: daten.titel,
    level: daten.level.level, xp: daten.level.xpGesamt, eintraege: daten.statistik.eintraegeGesamt,
  };
}

function gleicherProfilstand(stand: Profilstand): void {
  expect(stand.name).toBe(PROFIL_NAME);
  expect(stand.eintraege).toBeGreaterThanOrEqual(MIN_EINTRAEGE);
  fs.mkdirSync(ORDNER, { recursive: true });
  if (!fs.existsSync(PROFIL_DATEI)) {
    fs.writeFileSync(PROFIL_DATEI, `${JSON.stringify(stand)}\n`);
    return;
  }
  const gespeichert = JSON.parse(fs.readFileSync(PROFIL_DATEI, 'utf8')) as Profilstand;
  expect(stand).toEqual(gespeichert);
}

async function festeUhrPasst(seite: Page): Promise<void> {
  await stelleTestuhr(seite);
  expect(await seite.evaluate(() => new Date().toISOString())).toBe(new Date(TESTZEIT).toISOString());
  const kette = await seite.request.get('/api/kette/heute');
  expect(kette.ok()).toBe(true);
  expect(((await kette.json()) as { heuteErfasst: boolean }).heuteErfasst, TESTDATUM).toBe(true);
}

function sollBreite(info: TestInfo): number {
  if (info.project.name === 'handy') return 390;
  if (info.project.name === 'desktop') return 1440;
  throw new Error(`Unbekanntes Projekt ${info.project.name}`);
}

function bild(info: TestInfo, fassung: string, ansicht: string): string {
  fs.mkdirSync(ORDNER, { recursive: true });
  return `${ORDNER}/${info.project.name}-${sollBreite(info)}-${fassung}-${ansicht}.png`;
}

async function speichere(seite: Page, daten: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (koerper) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return antwort.ok;
  }, daten);
  expect(ok).toBe(true);
}

async function ohneTestreste(seite: Page): Promise<void> {
  const text = await seite.evaluate(() => {
    const teile: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let knoten = walker.nextNode();
    while (knoten) {
      const inhalt = knoten.textContent ?? '';
      const eltern = knoten.parentElement;
      const aktuell = knoten;
      knoten = walker.nextNode();
      if (!eltern || inhalt.trim() === '' || eltern.closest('[inert]')) {
        continue;
      }
      const stil = getComputedStyle(eltern);
      if (stil.display === 'none' || stil.visibility === 'hidden') {
        continue;
      }
      const bereich = document.createRange();
      bereich.selectNodeContents(aktuell);
      const kasten = bereich.getBoundingClientRect();
      if (kasten.width > 0 && kasten.height > 0) {
        teile.push(inhalt);
      }
    }
    return teile.join('\n');
  });
  expect(text.includes('Lauf80'), text).toBe(false);
  expect(text.includes('Lvl 4242'), text).toBe(false);
}

async function aufnahme(seite: Page, pfad: string): Promise<void> {
  await ohneTestreste(seite);
  await seite.screenshot({ path: pfad, fullPage: false, scale: 'css' });
  expect(fs.existsSync(pfad), pfad).toBe(true);
}

async function kopfFrei(seite: Page, ziel: string): Promise<void> {
  await seite.locator(ziel).evaluate((element) => {
    const kopf = document.querySelector('header[data-kopf]');
    const hoehe = kopf instanceof HTMLElement ? kopf.getBoundingClientRect().height : 0;
    const oben = element.getBoundingClientRect().top + window.scrollY - hoehe - 12;
    window.scrollTo(0, Math.max(0, oben));
  });
}

async function nimmAnsichten(seite: Page, info: TestInfo, fassung: string, sprache: Sprache): Promise<void> {
  expect(seite.viewportSize()?.width).toBe(sollBreite(info));
  const xp = sprache === 'en' ? /about \+/ : /ca\. \+/;

  await seite.goto('/');
  await expect(seite.getByRole('heading', { name: zeige('Heute', sprache), exact: true })).toBeVisible();
  await expect(seite.locator('[data-levelring]').first()).toBeVisible();
  await expect(seite.getByText(zeige('Streak', sprache), { exact: true }).first()).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  if (fassung === 'hell') {
    await seite.waitForFunction(() => {
      const stil = getComputedStyle(document.documentElement);
      return (
        stil.getPropertyValue('--flaeche').trim().toLowerCase() === '#ffffff' &&
        stil.getPropertyValue('--gefahr').trim().toLowerCase() === '#c62828'
      );
    });
  }
  await expect(seite.locator('html')).toHaveAttribute('data-schema', fassung === 'hell' ? 'light' : 'dark');
  await expect(seite.locator('[data-levelring]').first()).toBeInViewport();
  await expect(seite.getByText(zeige('Streak', sprache), { exact: true }).first()).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'heute'));

  await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).click();
  const dialogName = zeige('Was hast du getan?', sprache);
  const dialog = seite.getByRole('dialog', { name: dialogName });
  const vorschau = dialog.getByRole('button', { name: xp });
  await expect(dialog.getByRole('heading', { name: dialogName, exact: true })).toBeVisible();
  await expect(vorschau).toBeVisible();
  await expect(vorschau).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'eintrag'));
  await dialog.getByRole('button', { name: zeige('Schließen', sprache), exact: true }).click();
  await expect(dialog).toBeHidden();

  await seite.goto('/laufend');
  const bosse = seite.getByRole('heading', { name: zeige('Bosse', sprache), exact: true });
  const vorhaben = seite.getByRole('heading', { name: zeige('Vorhaben', sprache), exact: true });
  await expect(seite.getByRole('heading', { name: zeige('Laufend', sprache), exact: true })).toBeVisible();
  await expect(bosse).toBeVisible();
  await expect(vorhaben).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await vorhaben.evaluate((element) => element.scrollIntoView({ block: 'nearest' }));
  await expect(bosse).toBeInViewport();
  await expect(vorhaben).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'laufend'));

  await seite.goto('/charakter');
  const spektren = seite.locator('[data-spektren]');
  await expect(seite.getByRole('heading', { name: zeige('Profil', sprache), exact: true })).toBeVisible();
  await expect(spektren.getByText(zeige('Können', sprache), { exact: true })).toBeVisible();
  await expect(spektren.getByText(zeige('Haben', sprache), { exact: true })).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(spektren).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'profil'));

  const liste = await seite.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error(`faehigkeiten ${antwort.status}`);
    }
    return (await antwort.json()) as { id: number; name: string; archiviert: boolean }[];
  });
  const kraft = liste.find((eintrag) => eintrag.name === 'Kraft' && !eintrag.archiviert);
  expect(kraft, 'Fähigkeit Kraft').toBeTruthy();
  await seite.goto(`/faehigkeiten/${kraft?.id}`);
  await expect(seite.getByRole('heading', { name: 'Kraft', exact: true })).toBeVisible();
  const baumName = zeige('Baum', sprache);
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeVisible();
  await kopfFrei(seite, 'section:has(.baum-karte)');
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeInViewport();
  await expect(seite.locator('.baum-karte')).toBeInViewport();
  await expect(seite.getByText(BAUM_KNOTEN, { exact: true })).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'faehigkeiten'));

  await seite.goto('/charakter');
  await seite.getByRole('button', { name: zeige('Klassen und Titel', sprache), exact: true }).click();
  const klassenName = zeige('Klassen und Titel', sprache);
  const klassen = seite.getByRole('dialog', { name: klassenName });
  await expect(klassen).toBeVisible();
  await expect(klassen.getByRole('heading', { name: zeige('Klassen', sprache), exact: true })).toBeInViewport();
  await expect(klassen.getByRole('heading', { name: zeige('Titel', sprache), exact: true })).toBeVisible();
  await aufnahme(seite, bild(info, fassung, 'klassen'));
  await klassen.getByRole('button', { name: zeige('Schließen', sprache), exact: true }).click();
  await expect(klassen).toBeHidden();

  await seite.goto('/ziele');
  await expect(seite.getByRole('heading', { name: zeige('Ziele', sprache), exact: true })).toBeVisible();
  const vision = seite.getByRole('heading', { name: VISION, exact: true });
  await expect(vision).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(vision).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'ziele'));
}

async function nimmFassung(seite: Page, info: TestInfo, fassung: string, sprache: Sprache): Promise<void> {
  const koerper =
    fassung === 'hell'
      ? { stil: 'standard', farbenZuruecksetzen: true, sprache: 'de' }
      : { ...DUNKEL, sprache };
  await speichere(seite, koerper);
  await seite.reload();
  await festeUhrPasst(seite);
  await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).waitFor();
  await nimmAnsichten(seite, info, fassung, sprache);
}

test.beforeAll(() => {
  baueSaat();
});

test.beforeEach(async ({ page }) => {
  await stelleTestuhr(page);
  await meldeAn(page);
  if (!vorher) {
    const sicherung = await liesExport(page);
    vorher = sicherung;
    await schreibeWelt(page, baueSaat());
    await hinweisAktuell(page);
  }
  gleicherProfilstand(await liesProfil(page));
});

test.afterAll(async ({ browser }) => {
  const sicherung = vorher;
  vorher = null;
  if (!sicherung) {
    return;
  }
  const kontext = await browser.newContext({ baseURL: TEST_URL, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const seite = await kontext.newPage();
  try {
    await stelleTestuhr(seite);
    await meldeAn(seite);
    await schreibeWelt(seite, sicherung);
  } finally {
    await kontext.close();
  }
});

test('Helle Hauptansichten für die Infoseite', async ({ page }, info) => {
  await nimmFassung(page, info, 'hell', 'de');
});

test('Dunkle Hauptansichten für die Infoseite', async ({ page }, info) => {
  await nimmFassung(page, info, 'dunkel', 'de');
});

test.describe('englisch', () => {
  test.use({ locale: 'en-US' });

  test('Englische dunkle Hauptansichten für die Infoseite', async ({ page }, info) => {
    await nimmFassung(page, info, 'en-dunkel', 'en');
  });
});
