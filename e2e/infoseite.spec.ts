import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SICHERUNG_APP, type DatenExport, type DatenZeile, type DatenWert } from '../shared/api/daten.ts';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import type { Sprache } from '../shared/sprache/kern.ts';
import { klasseAnzeigen, zeige } from '../shared/sprache/index.ts';
import { leereGeerbteZugangsVariablen } from '../server/testpfad.ts';
import { mitDatenbankPfaden } from '../server/umgebung.ts';
import { TEST_PASSWORT, TEST_URL, WURZEL } from './testdaten.ts';
import {
  TESTDATUM,
  TESTZEIT,
  expect,
  stelleTestuhr,
  test,
  testJetzt,
  type Browser,
  type Page,
  type TestInfo,
} from './uhr.ts';

const ORDNER = 'tmp-test/infoseite';
const EN_ORDNER = 'tmp-test/infoseite-en';
const PROFIL_DATEI = path.join(ORDNER, 'profilstand.json');

function saatKonstante(name: string): string {
  const quelle = fs.readFileSync(path.join(WURZEL, 'e2e', 'infoseite-saat.ts'), 'utf8');
  const treffer = quelle.match(new RegExp(`^const ${name} = ([^;\\n]+);`, 'm'));
  if (!treffer?.[1]) {
    throw new Error(`Die Saat nennt ${name} nicht.`);
  }
  return treffer[1].trim();
}

function saatText(name: string): string {
  const roh = saatKonstante(name);
  if (roh.length < 2 || roh[0] !== "'" || roh.at(-1) !== "'") {
    throw new Error(`Die Saat setzt ${name} nicht als Text.`);
  }
  return roh.slice(1, -1);
}

function saatZahl(name: string): number {
  const zahl = Number(saatKonstante(name));
  if (!Number.isInteger(zahl)) {
    throw new Error(`Die Saat setzt ${name} nicht als ganze Zahl.`);
  }
  return zahl;
}

const PROFIL_NAME = saatText('PROFIL');
const KLASSE = saatText('KLASSE');
const LEVEL = saatZahl('LEVEL');
const MIN_EINTRAEGE = saatZahl('EINTRAEGE');
const VISION = 'Fit im Alltag';
const FAEHIGKEIT = 'Laufen';
const KNOTEN = 'Locker laufen';
const BOSSE = ['Zehn Kilometer', 'Rücken ruhig', 'Küche leer'] as const;
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };
const EN_TEXT: Readonly<Record<string, string>> = {
  [PROFIL_NAME]: PROFIL_NAME,
  [VISION]: 'Fit for everyday life',
  'Laufen, Rücken und ein klarer Kopf.': 'Running, a calm back and a clear head.',
  Laufen: 'Running',
  Spanisch: 'Spanish',
  Lesen: 'Reading',
  Rücken: 'Back',
  Haushalt: 'Household',
  Lernen: 'Learning',
  [KNOTEN]: 'Easy running',
  'Fünf Kilometer': 'Five kilometers',
  'Rücken schonen': 'Spare the back',
  'Zehn Kilometer': 'Ten kilometers',
  'Rücken ruhig': 'Calm back',
  'Küche leer': 'Kitchen clear',
  'Kapitel 3': 'Chapter 3',
  Lüften: 'Air it out',
};
const FENSTER = [
  { art: 'handy', breite: 390, hoehe: 664, mobil: true, dsf: 2, geraetePixel: true, bildBreite: 780, bildHoehe: 1328 },
  { art: 'desktop', breite: 1440, hoehe: 900, mobil: false, dsf: 1, geraetePixel: false, bildBreite: 1440, bildHoehe: 900 },
] as const;

interface Profilstand {
  name: string;
  klasse: string;
  titel: string | null;
  level: number;
  xp: number;
  eintraege: number;
}

interface Sicht {
  art: 'handy' | 'desktop';
  breite: number;
  hoehe: number;
  mobil: boolean;
  dsf: number;
  geraetePixel: boolean;
  bildBreite: number;
  bildHoehe: number;
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
  const ergebnis = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'e2e/infoseite-saat.ts'], {
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

function raeumeSaatAuf(): void {
  fs.rmSync(path.join(WURZEL, 'tmp-test', 'infoseite-saat'), { recursive: true, force: true });
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
    name: daten.name,
    klasse: daten.klasse,
    titel: daten.titel,
    level: daten.level.level,
    xp: daten.level.xpGesamt,
    eintraege: daten.statistik.eintraegeGesamt,
  };
}

function gleicherProfilstand(stand: Profilstand): void {
  expect(stand.name).toBe(PROFIL_NAME);
  expect(stand.klasse).toBe(KLASSE);
  expect(stand.level).toBe(LEVEL);
  expect(stand.eintraege).toBe(MIN_EINTRAEGE);
  fs.mkdirSync(ORDNER, { recursive: true });
  const gespeichert = fs.existsSync(PROFIL_DATEI)
    ? (JSON.parse(fs.readFileSync(PROFIL_DATEI, 'utf8')) as Profilstand)
    : null;
  const vonDieserSaat =
    gespeichert !== null &&
    gespeichert.name === PROFIL_NAME &&
    gespeichert.klasse === KLASSE &&
    gespeichert.level === LEVEL &&
    gespeichert.eintraege === MIN_EINTRAEGE;
  if (!vonDieserSaat) {
    fs.writeFileSync(PROFIL_DATEI, `${JSON.stringify(stand)}\n`);
    return;
  }
  expect(stand).toEqual(gespeichert);
}

async function festeUhrPasst(seite: Page): Promise<void> {
  await stelleTestuhr(seite);
  expect(await seite.evaluate(() => new Date().toISOString())).toBe(new Date(TESTZEIT).toISOString());
  const kette = await seite.request.get('/api/kette/heute');
  expect(kette.ok()).toBe(true);
  expect(((await kette.json()) as { heuteErfasst: boolean }).heuteErfasst, TESTDATUM).toBe(true);
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

function uebersetzeInhalt(wert: string): string {
  return EN_TEXT[wert] ?? wert;
}

function englischeSaat(roh: DatenExport): DatenExport {
  const tabellen: DatenExport['tabellen'] = {};
  for (const [name, zeilen] of Object.entries(roh.tabellen)) {
    tabellen[name] = zeilen.map((zeile) => {
      const kopie: DatenZeile = {};
      for (const [spalte, wert] of Object.entries(zeile)) {
        kopie[spalte] = typeof wert === 'string' ? uebersetzeInhalt(wert) : wert;
      }
      return kopie;
    });
  }
  return { ...roh, exportiertAm: testJetzt().toISOString(), tabellen };
}

function text(sprache: Sprache, deutsch: string): string {
  if (sprache === 'de') {
    return deutsch;
  }
  const uebersetzt = EN_TEXT[deutsch];
  if (uebersetzt === undefined) {
    throw new Error(`Die Übersetzung für „${deutsch}“ fehlt.`);
  }
  return uebersetzt;
}

async function ohneTestreste(seite: Page, verboten: readonly string[]): Promise<void> {
  const inhalt = await seite.evaluate(() => {
    const teile: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let knoten = walker.nextNode();
    while (knoten) {
      const stueck = knoten.textContent ?? '';
      const eltern = knoten.parentElement;
      const aktuell = knoten;
      knoten = walker.nextNode();
      if (!eltern || stueck.trim() === '' || eltern.closest('[inert]')) {
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
        teile.push(stueck);
      }
    }
    return teile.join('\n');
  });
  expect(/\bLvl 1\b/.test(inhalt), inhalt).toBe(false);
  for (const wort of verboten) {
    expect(inhalt.includes(wort), `${wort}\n${inhalt}`).toBe(false);
  }
}

async function aufnahme(
  seite: Page,
  pfad: string,
  bild: { breite: number; hoehe: number; geraetePixel: boolean },
  verboten: readonly string[],
): Promise<void> {
  await expect(seite.locator('[data-abzug]')).toHaveCount(0);
  await expect(seite.locator('[data-zustand="zu-niedrig"]')).toHaveCount(0);
  await ohneTestreste(seite, verboten);
  await seite.screenshot({
    path: pfad,
    fullPage: false,
    ...(bild.geraetePixel ? {} : { scale: 'css' as const }),
  });
  expect(fs.existsSync(pfad), pfad).toBe(true);
  const png = fs.readFileSync(pfad);
  expect(png.readUInt32BE(16), pfad).toBe(bild.breite);
  expect(png.readUInt32BE(20), pfad).toBe(bild.hoehe);
}

async function kopfFrei(seite: Page, ziel: string): Promise<void> {
  await seite.locator(ziel).evaluate((element) => {
    const kopf = document.querySelector('header[data-kopf]');
    const hoehe = kopf instanceof HTMLElement ? kopf.getBoundingClientRect().height : 0;
    const oben = element.getBoundingClientRect().top + window.scrollY - hoehe - 12;
    window.scrollTo(0, Math.max(0, oben));
  });
}

function dateiFuer(fassung: string, sicht: Sicht, ansicht: string): string {
  if (fassung === 'en') {
    fs.mkdirSync(EN_ORDNER, { recursive: true });
    return `${EN_ORDNER}/${sicht.breite}-${ansicht}.png`;
  }
  fs.mkdirSync(ORDNER, { recursive: true });
  return `${ORDNER}/${sicht.art}-${sicht.breite}-${fassung}-${ansicht}.png`;
}

async function nimmAnsichten(seite: Page, fassung: string, sprache: Sprache, sicht: Sicht): Promise<void> {
  expect(seite.viewportSize()?.width).toBe(sicht.breite);
  expect(seite.viewportSize()?.height).toBe(sicht.hoehe);
  expect(await seite.evaluate(() => window.devicePixelRatio)).toBe(sicht.dsf);
  const klasse = klasseAnzeigen(KLASSE, sprache);
  const vision = text(sprache, VISION);
  const faehigkeit = text(sprache, FAEHIGKEIT);
  const knoten = text(sprache, KNOTEN);
  const verboten = ['Lauf80', 'Lvl 4242', zeige('Lvl zu niedrig', sprache), zeige('Bosse greifen an', sprache)];
  const schuss = (ansicht: string) =>
    aufnahme(
      seite,
      dateiFuer(fassung, sicht, ansicht),
      { breite: sicht.bildBreite, hoehe: sicht.bildHoehe, geraetePixel: sicht.geraetePixel },
      verboten,
    );
  const xp = sprache === 'en' ? /\+\d+ XP, plus chain/ : /\+\d+ XP, plus Kette/;

  await seite.goto('/');
  await expect(seite.getByRole('heading', { name: zeige('Heute', sprache), exact: true })).toBeVisible();
  await expect(seite.getByText(PROFIL_NAME, { exact: true }).first()).toBeVisible();
  await expect(seite.getByText(klasse).first()).toBeVisible();
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
  await schuss('heute');

  await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).click();
  const dialogName = zeige('Was hast du getan?', sprache);
  const dialog = seite.getByRole('dialog', { name: dialogName });
  const taetigkeit = dialog.locator('[data-gruppe="taetigkeit"]').getByRole('button', { name: faehigkeit, exact: true });
  const skill = dialog.locator('[data-gruppe="faehigkeit"]').getByRole('button', { name: faehigkeit, exact: true });
  await dialog.getByRole('button', { name: zeige('Mehr', sprache), exact: true }).click();
  await taetigkeit.click();
  await skill.click();
  await dialog.getByRole('button', { name: zeige('Eigene', sprache), exact: true }).click();
  const dauer = dialog.getByLabel(zeige('Dauer in Std', sprache));
  const dauerWert = sprache === 'en' ? '0.33' : '0,33';
  await dauer.fill(dauerWert);
  await expect(dauer).toHaveValue(dauerWert);
  await expect(taetigkeit).toHaveAttribute('aria-pressed', 'true');
  await expect(skill).toHaveAttribute('aria-pressed', 'true');
  const vorschau = dialog.getByRole('button', { name: xp });
  await skill.scrollIntoViewIfNeeded();
  await expect(skill).toBeInViewport();
  await dauer.scrollIntoViewIfNeeded();
  await expect(dauer).toBeInViewport();
  await vorschau.scrollIntoViewIfNeeded();
  await expect(vorschau).toBeInViewport();
  await schuss('eintrag');
  const schliessen = dialog.getByRole('button', { name: zeige('Schließen', sprache), exact: true });
  await expect(schliessen).toBeInViewport();
  await schliessen.click();
  const frage = seite.getByRole('alertdialog', { name: zeige('Änderungen verwerfen?', sprache) });
  await expect(frage).toBeVisible();
  const verwerfen = frage.getByRole('button', { name: zeige('Verwerfen', sprache), exact: true });
  await expect(verwerfen).toBeInViewport();
  await verwerfen.click();
  await expect(frage).toBeHidden();
  await expect(dialog).toBeHidden();

  await seite.goto('/koennen');
  await expect(seite.getByRole('heading', { name: zeige('Können', sprache), exact: true })).toBeVisible();
  const zeilen = seite.locator('.attributzeile');
  await expect(zeilen.nth(0)).toContainText(zeige('Körper', sprache));
  await expect(zeilen.nth(1)).toContainText(zeige('Disziplin', sprache));
  await expect(zeilen.nth(2)).toContainText(zeige('Vitalität', sprache));
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(zeilen.nth(0)).toBeInViewport();
  await schuss('koennen');

  await seite.goto('/charakter');
  await seite.getByRole('button', { name: zeige('Klassen und Titel', sprache), exact: true }).click();
  const klassenName = zeige('Klassen und Titel', sprache);
  const klassen = seite.getByRole('dialog', { name: klassenName });
  await expect(klassen).toBeVisible();
  await expect(klassen.getByText(klasse).first()).toBeVisible();
  await expect(klassen.getByRole('heading', { name: zeige('Klassen', sprache), exact: true })).toBeInViewport();
  await expect(klassen.getByRole('heading', { name: zeige('Titel', sprache), exact: true })).toBeVisible();
  await schuss('klassen');
  await klassen.getByRole('button', { name: zeige('Schließen', sprache), exact: true }).click();
  await expect(klassen).toBeHidden();

  await seite.goto('/ziele');
  await expect(seite.getByRole('heading', { name: zeige('Ziele', sprache), exact: true })).toBeVisible();
  const visionKopf = seite.getByRole('heading', { name: vision, exact: true });
  await expect(visionKopf).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(visionKopf).toBeInViewport();
  await schuss('ziele');

  await seite.goto('/laufend');
  const bosse = seite.getByRole('heading', { name: zeige('Bosse', sprache), exact: true });
  const vorhaben = seite.getByRole('heading', { name: zeige('Vorhaben', sprache), exact: true });
  await expect(seite.getByRole('heading', { name: zeige('Laufend', sprache), exact: true })).toBeVisible();
  await expect(bosse).toBeVisible();
  await expect(vorhaben).toBeVisible();
  for (const titel of BOSSE) {
    await expect(seite.getByText(text(sprache, titel), { exact: true }).first()).toBeVisible();
  }
  await seite.evaluate(() => window.scrollTo(0, 0));
  await vorhaben.evaluate((element) => element.scrollIntoView({ block: 'nearest' }));
  await expect(bosse).toBeInViewport();
  await expect(vorhaben).toBeInViewport();
  await schuss('laufend');

  const liste = await seite.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error(`faehigkeiten ${antwort.status}`);
    }
    return (await antwort.json()) as { id: number; name: string; archiviert: boolean }[];
  });
  const lauf = liste.find((eintrag) => eintrag.name === faehigkeit && !eintrag.archiviert);
  expect(lauf, `Fähigkeit ${faehigkeit}`).toBeTruthy();
  await seite.goto(`/faehigkeiten/${lauf?.id}`);
  await expect(seite.getByRole('heading', { name: faehigkeit, exact: true })).toBeVisible();
  const baumName = zeige('Baum', sprache);
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeVisible();
  await kopfFrei(seite, 'section:has(.baum-karte)');
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeInViewport();
  await expect(seite.locator('.baum-karte')).toBeInViewport();
  await expect(seite.getByText(knoten, { exact: true })).toBeInViewport();
  await schuss('faehigkeiten');
}

async function nimmKontext(browser: Browser, fassung: string, sprache: Sprache, sicht: Sicht): Promise<void> {
  const kontext = await browser.newContext({
    baseURL: TEST_URL,
    locale: sprache === 'en' ? 'en-US' : 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    viewport: { width: sicht.breite, height: sicht.hoehe },
    deviceScaleFactor: sicht.dsf,
    isMobile: sicht.mobil,
    hasTouch: sicht.mobil,
  });
  try {
    const seite = await kontext.newPage();
    await stelleTestuhr(seite);
    await meldeAn(seite);
    await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).waitFor();
    await festeUhrPasst(seite);
    await nimmAnsichten(seite, fassung, sprache, sicht);
  } finally {
    await kontext.close();
  }
}

async function nimmSet(browser: Browser, seite: Page, info: TestInfo, fassung: string, sprache: Sprache): Promise<void> {
  test.skip(info.project.name !== 'handy', 'Beide Breiten entstehen hier einmal.');
  test.setTimeout(480_000);
  const deutsch = fassung === 'en' ? await liesExport(seite) : null;
  try {
    if (fassung === 'en') {
      await schreibeWelt(seite, englischeSaat(baueSaat()));
      await speichere(seite, { ...DUNKEL, sprache: 'en', charakterName: PROFIL_NAME });
    } else if (fassung === 'hell') {
      await speichere(seite, { stil: 'standard', farbenZuruecksetzen: true, sprache: 'de', charakterName: PROFIL_NAME });
    } else {
      await speichere(seite, { ...DUNKEL, sprache: 'de', charakterName: PROFIL_NAME });
    }
    await hinweisAktuell(seite);
    for (const sicht of FENSTER) {
      await nimmKontext(browser, fassung, sprache, sicht);
    }
  } finally {
    if (deutsch) {
      await schreibeWelt(seite, deutsch);
      await hinweisAktuell(seite);
    }
  }
}

test.beforeAll(() => {
  baueSaat();
});

test.beforeEach(async ({ page }) => {
  await stelleTestuhr(page);
  await meldeAn(page);
  if (!vorher) {
    vorher = await liesExport(page);
    await schreibeWelt(page, baueSaat());
    await hinweisAktuell(page);
  }
  gleicherProfilstand(await liesProfil(page));
});

test.afterAll(async ({ browser }) => {
  const sicherung = vorher;
  vorher = null;
  try {
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
  } finally {
    raeumeSaatAuf();
  }
});

test('Helle Hauptansichten für die Infoseite', async ({ browser, page }, info) => {
  await nimmSet(browser, page, info, 'hell', 'de');
});

test('Dunkle Hauptansichten für die Infoseite', async ({ browser, page }, info) => {
  await nimmSet(browser, page, info, 'dunkel', 'de');
});

test('Englische Hauptansichten für die Infoseite', async ({ browser, page }, info) => {
  await nimmSet(browser, page, info, 'en', 'en');
});
