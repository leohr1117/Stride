import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance, type InjectOptions, type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { aktiviereAnfrageSprache } from '../anfrageSprache.ts';
import { mitWelt, schliesseWelt } from '../db.ts';
import { AppFehler } from '../fehler.ts';
import { rechneBossangriffeAb } from '../features/bosse/bossangriffe.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { pflegeRueckkehr } from '../features/kette/rueckkehr.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';
import { rechneZeitverfallAb } from '../features/verfall/verfall.ts';
import { erstelleMitglied } from '../features/zugang/konten.ts';
import { registrierePasswortAdresse } from '../features/zugang/passwortAdresse.ts';
import { istOeffentlicherZugang, leseSitzungsToken, SITZUNG_COOKIE } from '../features/zugang/routen.ts';
import {
  datenordner,
  legeBenutzerAn,
  listeKonten,
  loeseWeltdatei,
  oeffneSitzung,
  schliesseZugang,
  setzeSperrenZurueck,
  verwendeZugang,
  weltdateiDerSitzung,
} from '../features/zugang/zugang.ts';
import { erstelleVorhaben } from '../features/ziele/vorhaben.ts';
import { erstelleProjekt, erstelleVision } from '../services/struktur.ts';
import { beschreibeValidierungsfehler } from '../validierung.ts';
const MINDESTENS_ROUTENMODULE = 13;
const MARKER = 'qx7fremdmarkereigenewelt';
const INHABER_PASSWORT = 'geheimes-passwort';
const GAST_PASSWORT = 'anderes-passwort';
const FREMD_PASSWORT = 'fremdes-passwort';
const FALSCHES_PASSWORT = 'nein';
const EXPORT_DATEI = /^attachment; filename="stride-\d{4}-\d{2}-\d{2}\.json"$/;
const PFLICHT_PFADE = ['/api/export', '/api/import', '/api/zugang', '/api/zugang/google/start', '/api/verbindungen'];
const ordner = mkdtempSync(path.join(tmpdir(), 'stride-welten-zugriff-'));
let nummer = 0;
let gebundenerPfad: string | null = null;
beforeEach(() => {
  nummer += 1;
  verwendeZugang(path.join(ordner, `${nummer}-zugang.db`));
  setzeSperrenZurueck();
});
afterAll(() => {
  setzeSperrenZurueck();
  schliesseZugang();
});
interface ImportZiel {
  spezifizierer: string;
  exportName: string;
}
interface Gesammelt {
  methode: string;
  url: string;
}
interface Weltbezug {
  spuren: string[];
  dateiname: string;
  fremdDatei: string;
  gastDatei: string;
}
function melde(methode: string, url: string, text: string): never {
  throw new Error(`${methode} ${url}: ${text}`);
}
function liesImporte(text: string): Map<string, ImportZiel> {
  const ziele = new Map<string, ImportZiel>();
  const muster = /import\s+(type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  for (const treffer of text.matchAll(muster)) {
    if (treffer[1]) continue;
    const spezifizierer = treffer[3] ?? '';
    for (const stueck of (treffer[2] ?? '').split(',')) {
      const roh = stueck.trim();
      if (roh === '' || roh.startsWith('type ')) continue;
      const teile = roh.split(/\s+as\s+/);
      const exportName = teile[0]?.trim() ?? '';
      const lokal = (teile[1] ?? teile[0])?.trim() ?? '';
      if (exportName !== '' && lokal !== '') ziele.set(lokal, { spezifizierer, exportName });
    }
  }
  return ziele;
}
function apiBlock(text: string): string {
  const prefixBei = text.indexOf('prefix: API_PREFIX');
  const kopf = 'async (api) => {';
  const start = prefixBei < 0 ? -1 : text.lastIndexOf(kopf, prefixBei);
  if (start < 0) {
    throw new Error('Der /api-Block in server/index.ts fehlt.');
  }
  let tiefe = 0;
  for (let index = start + kopf.length - 1; index < text.length; index += 1) {
    if (text[index] === '{') tiefe += 1;
    if (text[index] !== '}') continue;
    tiefe -= 1;
    if (tiefe === 0) return text.slice(start + kopf.length, index);
  }
  throw new Error('Der /api-Block in server/index.ts ist nicht abgeschlossen.');
}
function routenModule(text: string): ImportZiel[] {
  const namen = apiBlock(text)
    .split(/\r?\n/)
    .map((zeile) => zeile.trim().match(/^await api\.register\(([A-Za-z_$][\w$]*)\);$/)?.[1])
    .filter((name): name is string => name !== undefined);
  if (namen.length < MINDESTENS_ROUTENMODULE) {
    throw new Error(
      `Im /api-Block stehen ${namen.length} Routenmodule der Form await api.register(Name). Mindestens ${MINDESTENS_ROUTENMODULE} sind nötig.`,
    );
  }
  const importe = liesImporte(text);
  return namen.map((name) => {
    const ziel = importe.get(name);
    if (!ziel) {
      throw new Error(`Der Bezeichner ${name} aus await api.register steht in keinem Import von server/index.ts.`);
    }
    return ziel;
  });
}
function modulAdresse(spezifizierer: string): string {
  return spezifizierer.startsWith('.') ? spezifizierer.replace(/^\./, '..') : spezifizierer;
}
async function ladeRoutenFunktion(ziel: ImportZiel): Promise<(app: FastifyInstance) => void | Promise<void>> {
  let modul: Record<string, unknown>;
  try {
    modul = (await import(modulAdresse(ziel.spezifizierer))) as Record<string, unknown>;
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    throw new Error(`Das Routenmodul ${ziel.exportName} aus ${ziel.spezifizierer} lässt sich nicht laden: ${grund}`);
  }
  const wert = modul[ziel.exportName];
  if (typeof wert !== 'function') {
    throw new Error(`Der Import ${ziel.exportName} aus ${ziel.spezifizierer} ist keine Funktion.`);
  }
  return wert as (app: FastifyInstance) => void | Promise<void>;
}
function haengeWeltAn(api: FastifyInstance): void {
  api.addHook('onRequest', (anfrage, antwort, fertig) => {
    const pfad = anfrage.url.split('?')[0];
    if (process.env.STRIDE_TEST === '1' && (pfad === '/api/test/heute' || pfad === '/test/heute')) {
      fertig();
      return;
    }
    aktiviereAnfrageSprache(anfrage.headers['accept-language']);
    const token = leseSitzungsToken(anfrage.headers.cookie);
    const weltdatei = weltdateiDerSitzung(token);
    const angemeldet = weltdatei !== null;
    if (!angemeldet && !istOeffentlicherZugang(anfrage.method, anfrage.url)) {
      antwort.status(401).send({ fehler: 'Anmeldung erforderlich.' });
      return;
    }
    const weiter = () => {
      if (angemeldet) {
        rechneBossangriffeAb();
        rechneZeitverfallAb();
        pflegeRueckkehr();
      }
      fertig();
    };
    if (weltdatei) {
      const gebunden = loeseWeltdatei(weltdatei);
      gebundenerPfad = gebunden;
      mitWelt(gebunden, weiter);
      return;
    }
    weiter();
  });
}
async function baueApp(text: string): Promise<{ app: FastifyInstance; routen: Gesammelt[] }> {
  const module = routenModule(text);
  const app = Fastify({ logger: false });
  const routen: Gesammelt[] = [];
  try {
    app.setErrorHandler((fehler: Error, anfrage, antwort) => {
      if (fehler instanceof ZodError) {
        return antwort.status(400).send({ fehler: beschreibeValidierungsfehler(fehler) });
      }
      if (fehler instanceof AppFehler) {
        return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
      }
      const statusCode = 'statusCode' in fehler && typeof fehler.statusCode === 'number' ? fehler.statusCode : undefined;
      if (statusCode !== undefined && statusCode < 500) {
        return antwort.status(statusCode).send({ fehler: fehler.message });
      }
      anfrage.log.error({ err: fehler }, 'Unerwarteter Fehler');
      return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
    });
    app.addHook('onRoute', (optionen) => {
      const prefix = optionen.prefix ?? '';
      const url =
        prefix === '' || optionen.url === prefix || optionen.url.startsWith(`${prefix}/`)
          ? optionen.url
          : `${prefix}${optionen.url.startsWith('/') ? optionen.url : `/${optionen.url}`}`;
      const methoden = Array.isArray(optionen.method) ? optionen.method : [optionen.method];
      for (const methode of methoden) {
        const gross = methode.toUpperCase();
        if (!routen.some((route) => route.methode === gross && route.url === url)) {
          routen.push({ methode: gross, url });
        }
      }
    });
    await app.register(
      async (api) => {
        haengeWeltAn(api);
        for (const ziel of module) {
          await api.register(await ladeRoutenFunktion(ziel));
        }
      },
      { prefix: '/api' },
    );
    registrierePasswortAdresse(app);
    await app.ready();
    return { app, routen };
  } catch (fehler) {
    await app.close();
    throw fehler;
  }
}
function pruefeRoutenliste(routen: Gesammelt[]): void {
  const fehlend = PFLICHT_PFADE.filter((url) => !routen.some((route) => route.url === url));
  if (routen.length === 0 || fehlend.length > 0) {
    throw new Error(`Die Routenliste enthält ${fehlend.join(', ') || 'keine Treffer'}. Gesammelt sind ${routen.length} Routen.`);
  }
  if (!routen.some((route) => route.methode === 'POST' && route.url === '/api/zugang/konto/loeschen')) {
    throw new Error('Die Routenliste enthält POST /api/zugang/konto/loeschen nicht.');
  }
  const abgemeldet = routen.filter((route) => /\/aufgaben(?:\/|$)|\/training/.test(route.url));
  if (abgemeldet.length > 0) {
    throw new Error(`Abgemeldete Routen sind in der Liste: ${abgemeldet.map((route) => `${route.methode} ${route.url}`).join(', ')}.`);
  }
}
function setzeParameter(schablone: string, wertFuer: (name: string) => string): string {
  return schablone
    .replace(/:([A-Za-z_][\w]*)/g, (_alles, name: string) => encodeURIComponent(wertFuer(name)))
    .replace(/\*/g, () => encodeURIComponent(wertFuer('*')));
}
function fremdSpuren(relativ: string, absolut: string): string[] {
  return [...new Set([absolut, absolut.replaceAll('\\', '/'), relativ.replaceAll('\\', '/'), relativ.replaceAll('/', '\\')])].filter(
    (spur) => spur !== '',
  );
}
function anfrageTraegt(anfrage: string, spur: string): boolean {
  const json = JSON.stringify(spur).slice(1, -1);
  const formular = new URLSearchParams([['v', spur]]).toString();
  const wert = formular.slice(formular.indexOf('=') + 1);
  return anfrage.includes(spur) || anfrage.includes(json) || anfrage.includes(encodeURIComponent(spur)) || anfrage.includes(wert);
}
function antwortText(antwort: LightMyRequestResponse): string {
  const koepfe = Object.entries(antwort.headers)
    .map(([name, wert]) => `${name}: ${Array.isArray(wert) ? wert.join(',') : String(wert ?? '')}`)
    .join('\n');
  return `${antwort.body ?? ''}\n${koepfe}`;
}
function pruefeExportKopf(antwort: LightMyRequestResponse, methode: string, url: string, welt: Weltbezug): void {
  const roh = antwort.headers['content-disposition'];
  const kopf = Array.isArray(roh) ? roh.join(', ') : roh === undefined ? '' : String(roh);
  if (antwort.statusCode !== 200 && kopf === '') {
    return;
  }
  if (kopf.includes('/') || kopf.includes('\\')) {
    melde(methode, url, `content-disposition enthält ein Verzeichnis (${kopf})`);
  }
  if (!EXPORT_DATEI.test(kopf)) {
    melde(methode, url, `content-disposition ist kein Dateiname der Form stride-<Datum>.json (${kopf || 'fehlt'})`);
  }
  for (const spur of [...welt.spuren, welt.dateiname]) {
    if (spur !== '' && kopf.includes(spur)) {
      melde(methode, url, `content-disposition enthält einen Fremdpfad (${spur})`);
    }
  }
}
function legeMarker(fremdDatei: string): void {
  mitWelt(fremdDatei, () => {
    aendereEinstellungen({ charakterName: MARKER });
    const vorlage = erstelleVorlage({ name: MARKER, icon: 'kreis', gewichte: [] });
    const vision = erstelleVision({
      titel: 'Nebenvision', beschreibung: '', farbe: '#335577', woopErgebnis: '', woopHindernis: '', woopPlan: '', level: null,
    });
    const projekt = erstelleProjekt({
      name: 'Nebenprojekt', beschreibung: '', visionId: vision.id, organisationId: null, standardVorlageId: vorlage.id,
    });
    erstelleVorhaben(projekt.id, MARKER);
  });
}
function wirftBeiUngueltigerWeltdatei(): void {
  expect(() => loeseWeltdatei('')).toThrow();
  expect(() => loeseWeltdatei('..')).toThrow();
  expect(() => loeseWeltdatei(path.resolve(datenordner(), '..', 'absolut-ausserhalb.db'))).toThrow();
  const laufwerk = path.parse(datenordner()).root.slice(0, 1).toUpperCase();
  const ausserhalb = process.platform === 'win32' ? `${laufwerk === 'C' ? 'D' : 'C'}:ausserhalb.db` : path.join('..', 'ausserhalb.db');
  expect(() => loeseWeltdatei(ausserhalb)).toThrow();
}
async function rufe(
  app: FastifyInstance,
  methode: string,
  url: string,
  token: string,
  body: string | undefined,
  erwartet: string,
  welt: Weltbezug,
): Promise<void> {
  gebundenerPfad = null;
  const headers: Record<string, string> = { cookie: `${SITZUNG_COOKIE}=${encodeURIComponent(token)}` };
  const optionen: InjectOptions = { method: methode as InjectOptions['method'], url, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    optionen.payload = body;
  }
  const antwort = await app.inject(optionen);
  const anfrage = `${url}\n${body ?? ''}`;
  const text = antwortText(antwort);
  if (text.includes(MARKER)) melde(methode, url, 'Antwort enthält den Marker der Fremdwelt');
  for (const spur of welt.spuren) {
    if (!anfrageTraegt(anfrage, spur) && text.includes(spur)) melde(methode, url, 'Antwort enthält den Fremdpfad');
  }
  const pfad = url.split('?')[0] ?? url;
  if (pfad === '/api/export') pruefeExportKopf(antwort, methode, url, welt);
  if (pfad.startsWith('/api') && gebundenerPfad !== erwartet && !(url.includes('..') && gebundenerPfad === null)) {
    melde(methode, url, `Gebunden ist ${gebundenerPfad ?? 'nichts'}, erwartet ist die Datei der Sitzung`);
  }
  if (!fs.existsSync(welt.gastDatei) || !fs.existsSync(welt.fremdDatei)) melde(methode, url, 'Die Gast- oder Fremdwelt-Datei fehlt nach der Anfrage');
  if (mitWelt(welt.fremdDatei, () => ladeEinstellungen().charakterName) !== MARKER) melde(methode, url, 'Der Name in der Fremdwelt hat sich geändert');
}
describe('fremde Weltdatei', () => {
  it('lässt ein angemeldetes Konto nicht an die fremde Weltdatei', async () => {
    if ([GAST_PASSWORT, INHABER_PASSWORT, FREMD_PASSWORT].includes(FALSCHES_PASSWORT)) throw new Error('Das Probe-Passwort ist ein echtes Kontopasswort.');
    const indexText = fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(indexText).toContain('weltdateiDerSitzung');
    expect(indexText).toMatch(/mitWelt\(loeseWeltdatei\(weltdatei\),\s*weiter\)/);
    wirftBeiUngueltigerWeltdatei();
    const inhaber = legeBenutzerAn({
      benutzername: 'Inhaber',
      passwort: INHABER_PASSWORT,
      rolle: 'inhaber',
      weltdatei: 'app.db',
    });
    const gastSichtbar = erstelleMitglied({ benutzername: 'Gast', passwort: GAST_PASSWORT, profilname: 'Gast' });
    const fremdSichtbar = erstelleMitglied({ benutzername: 'Fremd', passwort: FREMD_PASSWORT, profilname: 'Fremd' });
    const konten = listeKonten();
    const gast = konten.find((konto) => konto.id === gastSichtbar.id);
    const fremd = konten.find((konto) => konto.id === fremdSichtbar.id);
    const inhaberZeile = konten.find((konto) => konto.id === inhaber.id);
    if (!gast || gast.rolle === 'inhaber' || !fremd || fremd.rolle === 'inhaber' || !inhaberZeile) {
      throw new Error('Gast und Fremd müssen Mitglieder mit eigener Weltdatei sein.');
    }
    const gastDatei = loeseWeltdatei(gast.weltdatei);
    const fremdDatei = loeseWeltdatei(fremd.weltdatei);
    const inhaberDatei = loeseWeltdatei(inhaberZeile.weltdatei);
    expect(fs.existsSync(gastDatei)).toBe(true);
    expect(fs.existsSync(fremdDatei)).toBe(true);
    legeMarker(fremdDatei);
    const welt: Weltbezug = {
      spuren: fremdSpuren(fremd.weltdatei, fremdDatei),
      dateiname: path.basename(fremdDatei),
      fremdDatei,
      gastDatei,
    };
    const ersterBody = JSON.stringify({ passwort: FALSCHES_PASSWORT });
    const gefahrBody = JSON.stringify({
      weltdatei: '..', pfad: '..\\', datei: fremdDatei, ziel: fremd.weltdatei, passwort: FALSCHES_PASSWORT,
      benutzername: 'niemand', adresse: 'keine-adresse', bisher: FALSCHES_PASSWORT, neu: FALSCHES_PASSWORT,
    });
    const suchPaare: [string, string][] = [['weltdatei', fremdDatei], ['pfad', '..\\'], ['datei', fremd.weltdatei.replaceAll('\\', '/')]];
    const suche = suchPaare.map(([name, wert]) => `${encodeURIComponent(name)}=${encodeURIComponent(wert)}`).join('&');
    let app: FastifyInstance | undefined;
    try {
      const gebaut = await baueApp(indexText);
      app = gebaut.app;
      pruefeRoutenliste(gebaut.routen);
      for (const route of gebaut.routen) {
        const mitInhalt = route.methode === 'POST' || route.methode === 'PUT' || route.methode === 'PATCH';
        const normal = setzeParameter(route.url, (name) => (name === 'id' && route.url.includes('/konten/') ? String(fremd.id) : '1'));
        const faelle = [
          { url: normal, body: mitInhalt ? ersterBody : undefined },
          { url: `${setzeParameter(route.url, () => '..')}?${suche}`, body: mitInhalt ? gefahrBody : undefined },
        ];
        for (const fall of faelle) {
          await rufe(app, route.methode, fall.url, oeffneSitzung(new Date(), gast.id), fall.body, gastDatei, welt);
        }
      }
      for (const url of ['/api/zugang/konten', '/api/zugang/admin/konten']) {
        await rufe(app, 'GET', url, oeffneSitzung(new Date(), inhaber.id), undefined, inhaberDatei, welt);
      }
      expect(fs.existsSync(gastDatei)).toBe(true);
      expect(fs.existsSync(fremdDatei)).toBe(true);
      expect(mitWelt(fremdDatei, () => ladeEinstellungen().charakterName)).toBe(MARKER);
    } finally {
      await app?.close();
      schliesseWelt(gastDatei);
      schliesseWelt(fremdDatei);
      schliesseWelt(inhaberDatei);
    }
  }, 120_000);
});
