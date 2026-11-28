import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test as basis, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { MIN_RADAR_ACHSEN } from '../shared/spiel/radar.ts';
import { TEST_PASSWORT } from './testdaten.ts';

export const TESTZEIT = '2026-11-10T12:00:00+01:00';
export const TESTDATUM = '2026-11-10';

const MITTAG = 12;
const echteSeiten = new WeakSet<Page>();
const aufnahmeHaengt = new WeakSet<object>();

export function testJetzt(): Date {
  const [jahr, monat, tag] = TESTDATUM.split('-').map(Number);
  return new Date(jahr, monat - 1, tag, MITTAG, 0, 0, 0);
}

export async function koppeleAnTestzeit(seite: Page): Promise<void> {
  if (echteSeiten.has(seite)) {
    return;
  }
  await schreibeTesttag(seite, TESTDATUM);
}

function diagrammLesen(mindestAchsen: number): string {
  const radarFertig = (wurzel: Element): boolean => {
    const radar = wurzel.matches('[data-spektrum], [data-radar="vergleich"]')
      ? wurzel
      : wurzel.querySelector('[data-spektrum], [data-radar="vergleich"]');
    if (!radar) {
      return false;
    }
    const kasten = radar.getBoundingClientRect();
    if (kasten.width < 40 || kasten.height < 40) {
      return false;
    }
    const flaechen = [...radar.querySelectorAll('.recharts-radar-polygon path')];
    if (flaechen.length === 0) {
      return false;
    }
    const werte = (radar.getAttribute('data-werte') ?? '').split(',').filter((teil) => teil.length > 0);
    for (const flaeche of flaechen) {
      const pfad = flaeche.getAttribute('d') ?? '';
      if (pfad.length === 0) {
        return false;
      }
      if (werte.length >= mindestAchsen) {
        const punkte = pfad.match(/[ML]\s*-?[0-9.]+\s*,\s*-?[0-9.]+/gi);
        if (!punkte || punkte.length < werte.length) {
          return false;
        }
      }
    }
    return true;
  };

  const rahmenFertig = (rahmen: Element): boolean => {
    const kasten = rahmen.getBoundingClientRect();
    if (kasten.width < 40 || kasten.height < 40) {
      return false;
    }
    const daten = rahmen.querySelectorAll(
      '.recharts-radar-polygon path, .recharts-line path, .recharts-area path, .recharts-bar path, .recharts-rectangle',
    );
    return [...daten].some((knoten) => knoten.tagName !== 'path' || (knoten.getAttribute('d') ?? '').length > 0);
  };

  const chartFertig = (wurzel: Element): boolean => {
    if (wurzel.querySelector('[data-spektrum], [data-radar="vergleich"]')) {
      return radarFertig(wurzel);
    }
    const kandidaten = wurzel.classList.contains('recharts-wrapper')
      ? [wurzel]
      : [...wurzel.querySelectorAll('.recharts-wrapper')];
    return kandidaten.some(rahmenFertig);
  };

  const spektren = document.querySelector('[data-spektren]');
  if (spektren) {
    const bloecke = [...spektren.children];
    if (bloecke.length === 0 || bloecke.some((block) => !radarFertig(block))) {
      return 'offen';
    }
  }

  if ([...document.querySelectorAll('main div.px-2.py-3')].some((slot) => !chartFertig(slot))) {
    return 'offen';
  }

  const vergleich = document.querySelector('[data-vergleich]');
  const kennungen = vergleich ? vergleich.querySelectorAll('[data-kennung]').length : 0;
  if (vergleich && kennungen >= mindestAchsen && !radarFertig(vergleich)) {
    return 'offen';
  }

  if (/\/vorbilder\/[^/]+$/.test(location.pathname)) {
    const rahmen = [...document.querySelectorAll('.recharts-wrapper')];
    const erwartet = (kennungen >= mindestAchsen ? 1 : 0) + 1;
    if (rahmen.filter((knoten) => chartFertig(knoten)).length < erwartet) {
      return 'offen';
    }
  }

  const huellen = [...document.querySelectorAll('.recharts-wrapper')];
  if (huellen.some((knoten) => !rahmenFertig(knoten))) {
    return 'offen';
  }
  const teile: string[] = [];
  for (const knoten of huellen) {
    for (const pfad of knoten.querySelectorAll('path')) {
      teile.push(pfad.getAttribute('d') ?? '');
    }
  }
  return teile.length === 0 ? 'keine' : teile.join('\n');
}

function animationenAus(): void {
  if (document.getElementById('diagramm-still')) {
    return;
  }
  const stil = document.createElement('style');
  stil.id = 'diagramm-still';
  stil.textContent =
    '[data-spektrum],[data-spektrum] *,[data-radar="vergleich"],[data-radar="vergleich"] *,main div.px-2.py-3,main div.px-2.py-3 *,.recharts-wrapper,.recharts-wrapper *{animation:none !important;transition:none !important}';
  document.head.append(stil);
}

function festeBreiten(): void {
  const rahmen = new Set<HTMLElement>();
  for (const knoten of document.querySelectorAll(
    'main div.px-2.py-3, [data-spektrum], [data-radar="vergleich"], .recharts-responsive-container',
  )) {
    const treffer = knoten.closest('main div.px-2.py-3, [data-spektrum], [data-radar="vergleich"]');
    const ziel = treffer instanceof HTMLElement ? treffer : knoten.parentElement;
    if (ziel instanceof HTMLElement) {
      rahmen.add(ziel);
    }
  }
  for (const ziel of rahmen) {
    const kasten = ziel.getBoundingClientRect();
    const breite = Math.floor(kasten.width);
    if (breite < 40) {
      continue;
    }
    ziel.style.boxSizing = 'border-box';
    ziel.style.width = `${breite}px`;
    ziel.dataset.festeBreite = '1';
  }
}

function diagrammLoesenImDokument(): void {
  document.getElementById('diagramm-still')?.remove();
  for (const knoten of document.querySelectorAll('[data-feste-breite]')) {
    if (!(knoten instanceof HTMLElement)) {
      continue;
    }
    knoten.style.boxSizing = '';
    knoten.style.width = '';
    delete knoten.dataset.festeBreite;
  }
}

export async function diagrammLoesen(seite: Page): Promise<void> {
  await seite.evaluate(diagrammLoesenImDokument);
}

async function warteGezeichnet(seite: Page, leereSeiteFertig = false): Promise<void> {
  let vorher = '';
  await expect
    .poll(async () => {
      const jetzt = await seite.evaluate(diagrammLesen, MIN_RADAR_ACHSEN);
      const gezeichnet = jetzt !== 'offen' && jetzt !== 'keine';
      const ohneDiagramm = leereSeiteFertig && jetzt === 'keine';
      const stabil = (gezeichnet || ohneDiagramm) && jetzt === vorher;
      vorher = jetzt;
      return stabil;
    })
    .toBe(true);
}

export async function diagrammeAufnehmen(seite: Page): Promise<void> {
  await seite.evaluate(animationenAus);
  await warteGezeichnet(seite);
  await seite.evaluate(festeBreiten);
  await warteGezeichnet(seite);
}

export async function vorbereiteAufnahme(seite: Page): Promise<void> {
  await expect(seite.locator('main div.py-16').filter({ hasText: /^Lädt …$/ })).toHaveCount(0);
  await seite.evaluate(() => document.fonts.ready);
  await warteGezeichnet(seite, true);
}

function haengeAufnahmeAn(seite: Page): void {
  const seitenMuster = Object.getPrototypeOf(seite) as { screenshot: Page['screenshot'] };
  if (!aufnahmeHaengt.has(seitenMuster)) {
    const original = seitenMuster.screenshot;
    seitenMuster.screenshot = async function (this: Page, options) {
      await vorbereiteAufnahme(this);
      return original.call(this, { ...options, animations: 'disabled' });
    };
    aufnahmeHaengt.add(seitenMuster);
  }
  const locatorMuster = Object.getPrototypeOf(seite.locator('html')) as {
    screenshot: Locator['screenshot'];
  };
  if (!aufnahmeHaengt.has(locatorMuster)) {
    const original = locatorMuster.screenshot;
    locatorMuster.screenshot = async function (this: Locator, options) {
      await vorbereiteAufnahme(this.page());
      return original.call(this, { ...options, animations: 'disabled' });
    };
    aufnahmeHaengt.add(locatorMuster);
  }
}

async function schreibeTesttag(seite: Page, datum: string | null): Promise<void> {
  const antwort = await seite.request.post('/api/test/heute', { data: { datum } });
  if (!antwort.ok()) {
    const aktion = datum === null ? 'zurücksetzen' : 'setzen';
    throw new Error(`Testuhr ließ sich nicht ${aktion}: ${antwort.status()} ${await antwort.text()}`);
  }
}

// Sichtstand der Basis: drei offene Bosse buchen bis zu diesem Tag 200 XP.
// Ein späterer Kalendertag bucht je Boss 5 XP mehr. TESTDATUM lässt die 200 XP aus.
const SICHTSTAND = '2026-11-27';
let sichtstandSteht = false;

function heutigesDatum(): string {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0');
  const tag = String(jetzt.getDate()).padStart(2, '0');
  return `${jetzt.getFullYear()}-${monat}-${tag}`;
}

function weltdateien(): string[] {
  const voll = process.env.PLAYWRIGHT_WELT;
  if (!voll) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  const ordner = path.dirname(voll);
  return [verweigereEchteDatenbank(voll), verweigereEchteDatenbank(path.join(ordner, '2.db'))];
}

// /api/test/heute überspringt den onRequest-Haken. Die nächste angemeldete
// Anfrage rechnet Boss, Verfall und Rückkehr ab. Danach liegt angriff_bis
// auf dem Sichtstand und würde am echten Tag weiterbuchen.
async function rechneSichtstandAb(anfrage: APIRequestContext, benutzername: string): Promise<void> {
  const anmeldung = await anfrage.post('/api/zugang', {
    data: { benutzername, passwort: TEST_PASSWORT },
  });
  if (!anmeldung.ok()) {
    throw new Error(`Testwelt ließ sich nicht anmelden (${benutzername}): ${anmeldung.status()}`);
  }
  const stand = await anfrage.get('/api/einstellungen');
  if (!stand.ok()) {
    throw new Error(`Abrechnung ließ sich nicht auslösen (${benutzername}): ${stand.status()}`);
  }
  const abmelden = await anfrage.post('/api/zugang/abmelden');
  if (!abmelden.ok()) {
    throw new Error(`Testwelt ließ sich nicht abmelden (${benutzername}): ${abmelden.status()}`);
  }
}

function halteAbrechnungAufHeutigemTag(heute: string): void {
  const bosse = `UPDATE vorhaben SET angriff_bis = ?
    WHERE status = 'offen' AND boss = 1 AND deadline IS NOT NULL AND deadline < ?
      AND (angriff_bis IS NULL OR angriff_bis < ?)`;
  const verfall = `UPDATE attribute SET verfall_bis = ? WHERE verfall_bis IS NOT NULL AND verfall_bis < ?`;
  for (const datei of weltdateien()) {
    const db = new DatabaseSync(datei, { timeout: 5_000 });
    try {
      db.prepare(bosse).run(heute, heute, heute);
      db.prepare(verfall).run(heute, heute);
    } finally {
      db.close();
    }
  }
}

async function sichereSichtstand(seite: Page, anfrage: APIRequestContext): Promise<void> {
  await schreibeTesttag(seite, SICHTSTAND);
  await rechneSichtstandAb(anfrage, 'testvoll');
  await rechneSichtstandAb(anfrage, 'testteil');
  halteAbrechnungAufHeutigemTag(heutigesDatum());
}

function sichtstandMittag(): string {
  const [jahr, monat, tag] = SICHTSTAND.split('-').map(Number);
  return new Date(jahr, monat - 1, tag, MITTAG, 0, 0, 0).toISOString();
}

// Die Wochenstatistik zählt jede positive XP seit dem Rahmen, auch nach dem
// Testtag. Echte Zeit schreibt den Zusatz auf den Kalendertag. Löschen würde
// den Freitag der Basis leer lassen. Nach dem Test liegt er auf dem Sichtstand.
// Die Saat endet am Testtag und bleibt. Am Sichtstand selbst ist nichts zu tun.
function legeZusatzAufSichtstand(heute: string): void {
  if (heute === SICHTSTAND || heute <= TESTDATUM) {
    return;
  }
  const ziel = sichtstandMittag();
  const treffer = `date(erstellt_am, 'localtime') = ?`;
  for (const datei of weltdateien()) {
    const db = new DatabaseSync(datei, { timeout: 5_000 });
    try {
      db.prepare(`UPDATE xp_ereignisse SET erstellt_am = ? WHERE ${treffer}`).run(ziel, heute);
      db.prepare(`UPDATE eintraege SET erstellt_am = ? WHERE ${treffer}`).run(ziel, heute);
      db.prepare(`UPDATE projekt_xp SET erstellt_am = ? WHERE ${treffer}`).run(ziel, heute);
      db.prepare(`UPDATE faehigkeit_xp SET erstellt_am = ? WHERE ${treffer}`).run(ziel, heute);
      db.prepare(`UPDATE investitionen SET erstellt_am = ? WHERE ${treffer}`).run(ziel, heute);
    } finally {
      db.close();
    }
  }
}

// leseJetzt() steht bei gesetztem Testtag auf dem Mittag und geht nicht weiter.
// Einträge bekommen diesen Zeitpunkt, eine neue Investition bekommt SQLite-now.
// Liegt der Eintrag davor, bleibt sie ungenutzt und das Menü zeigt Löschen.
// clock.install und setFixedTime ersetzen requestAnimationFrame. Die
// Belohnungskarte bleibt dann nach Schließen sichtbar, und warteAufRuhe sieht
// laufende Animationen. Beides braucht die echte Browserzeit.
// echteZeit setzt den Server-Testtag für den Test auf null und danach wieder
// auf TESTDATUM. Vorher rechnet die Welt einmal zum Sichtstand ab. angriff_bis
// und verfall_bis stehen danach auf dem echten Tag, damit null keinen weiteren
// Tag bucht. Danach wandert der Zusatz beider Welten auf den Sichtstand, damit
// die Wochenstatistik nicht dem Kalendertag folgt. Die Browseruhr bleibt echt,
// damit Datum von Client und Server zusammenpassen. Eine echte Browseruhr bei
// festem Testtag lehnt den Eintrag ab, weil er für den Server in der Zukunft liegt.
export async function stelleTestuhr(seite: Page, uhrLaeuft = false): Promise<void> {
  if (uhrLaeuft) {
    await seite.clock.install({ time: TESTZEIT });
  } else {
    await seite.clock.setFixedTime(TESTZEIT);
  }
  await schreibeTesttag(seite, TESTDATUM);
}

export const test = basis.extend<{ festeUhr: void; uhrLaeuft: boolean; echteZeit: boolean }>({
  uhrLaeuft: [false, { option: true }],
  echteZeit: [false, { option: true }],
  festeUhr: [
    async ({ page, request, uhrLaeuft, echteZeit }, use) => {
      if (echteZeit) {
        echteSeiten.add(page);
        if (!sichtstandSteht) {
          await sichereSichtstand(page, request);
          sichtstandSteht = true;
        }
        await schreibeTesttag(page, null);
      } else {
        await stelleTestuhr(page, uhrLaeuft);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      haengeAufnahmeAn(page);
      try {
        await use();
      } finally {
        if (echteZeit) {
          legeZusatzAufSichtstand(heutigesDatum());
        }
        await schreibeTesttag(page, TESTDATUM);
      }
    },
    { auto: true },
  ],
});

export { expect };
export type { APIRequestContext, Browser, Locator, Page, Route, TestInfo } from '@playwright/test';
