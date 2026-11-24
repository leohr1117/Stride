import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { KONFIG } from './config.ts';
import { MIGRATIONEN } from './migrationen.ts';
import { sperreEchteDatenbankImTest } from './testpfad.ts';

export type Parameter = SQLInputValue;

const IN_MEMORY = ':memory:';
const BESCHAEFTIGT_MS = 5000;
export const WELT_LEERLAUF_MS = 10 * 60 * 1000;
export const WELT_OBERGRENZE = 32;
const LEERLAUF_PRUEFUNG_MS = 60_000;

function oeffneDatenbank(pfad: string): DatabaseSync {
  sperreEchteDatenbankImTest(pfad);
  if (pfad !== IN_MEMORY) {
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
  }
  const datenbank = new DatabaseSync(pfad);
  datenbank.exec(`PRAGMA busy_timeout = ${BESCHAEFTIGT_MS}`);
  datenbank.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migriere(datenbank);
  return datenbank;
}

export const AKTUELLE_SCHEMA_VERSION = MIGRATIONEN.length;

const anweisungen = new WeakMap<DatabaseSync, Map<string, StatementSync>>();
const lesecache = new WeakMap<DatabaseSync, Map<string, unknown>>();
const transaktionTiefe = new WeakMap<DatabaseSync, number>();
const SCHREIBT_EINTRAEGE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["']?eintraege["']?\b/i;

function vorbereitet(datenbank: DatabaseSync, sql: string): StatementSync {
  let cache = anweisungen.get(datenbank);
  if (!cache) {
    cache = new Map();
    anweisungen.set(datenbank, cache);
  }
  const vorhanden = cache.get(sql);
  if (vorhanden) {
    return vorhanden;
  }
  const anweisung = datenbank.prepare(sql);
  cache.set(sql, anweisung);
  return anweisung;
}

function tiefe(datenbank: DatabaseSync): number {
  return transaktionTiefe.get(datenbank) ?? 0;
}

function setzeTiefe(datenbank: DatabaseSync, wert: number): void {
  if (wert <= 0) {
    transaktionTiefe.delete(datenbank);
    return;
  }
  transaktionTiefe.set(datenbank, wert);
}

function verwirfLesecache(datenbank: DatabaseSync): void {
  lesecache.delete(datenbank);
}

export function gemerkt<T>(schluessel: string, laden: () => T): T {
  const datenbank = aktiveDatenbank();
  if (tiefe(datenbank) > 0) {
    return laden();
  }
  let werte = lesecache.get(datenbank);
  if (!werte) {
    werte = new Map();
    lesecache.set(datenbank, werte);
  }
  if (werte.has(schluessel)) {
    return werte.get(schluessel) as T;
  }
  const wert = laden();
  werte.set(schluessel, wert);
  return wert;
}

export function schemaVersion(datenbank = aktiveDatenbank()): number {
  return (vorbereitet(datenbank, 'PRAGMA user_version').get() as { user_version: number }).user_version;
}

export function migriere(datenbank: DatabaseSync, zielVersion = AKTUELLE_SCHEMA_VERSION): void {
  for (let index = schemaVersion(datenbank); index < zielVersion; index++) {
    const version = index + 1;
    const schluesselOffen =
      MIGRATIONEN[index].includes('CREATE TABLE projekte_neu') || MIGRATIONEN[index].includes('CREATE TABLE kalender_neu');
    if (schluesselOffen) {
      datenbank.exec('PRAGMA foreign_keys = OFF');
    }
    datenbank.exec('BEGIN');
    try {
      datenbank.exec(MIGRATIONEN[index]);
      if (schluesselOffen) {
        const verstoesse = datenbank.prepare('PRAGMA foreign_key_check').all() as { table: string }[];
        if (verstoesse.length > 0) {
          const tabellen = [...new Set(verstoesse.map((zeile) => zeile.table))].join(', ');
          throw new Error(`Fremdschlüssel verletzt: ${tabellen}`);
        }
      }
      datenbank.exec(`PRAGMA user_version = ${version}`);
      datenbank.exec('COMMIT');
    } catch (fehler) {
      datenbank.exec('ROLLBACK');
      throw new Error(`Migration ${version} ist fehlgeschlagen: ${(fehler as Error).message}`, { cause: fehler });
    } finally {
      if (schluesselOffen) {
        datenbank.exec('PRAGMA foreign_keys = ON');
      }
    }
  }
}

interface Welt {
  datenbank: DatabaseSync;
  pfad: string;
}

interface Geoeffnet {
  datenbank: DatabaseSync;
  zuletzt: number;
  belegt: number;
}

const oeffnenGesperrt = new Map<string, number>();

const welten = new AsyncLocalStorage<Welt>();
const geoeffnet = new Map<string, Geoeffnet>();

function schluessel(pfad: string): string {
  return path.resolve(pfad);
}

const standardDb = oeffneDatenbank(KONFIG.datenbankPfad);
const standardPfad = schluessel(KONFIG.datenbankPfad);
geoeffnet.set(standardPfad, { datenbank: standardDb, zuletzt: Date.now(), belegt: 0 });

function aktiveDatenbank(): DatabaseSync {
  const welt = welten.getStore();
  if (!welt) {
    return standardDb;
  }
  if (welt.datenbank.isOpen) {
    return welt.datenbank;
  }
  const neu = weltVon(welt.pfad).datenbank;
  welt.datenbank = neu;
  return neu;
}

function anzahlWelten(): number {
  let anzahl = 0;
  for (const pfad of geoeffnet.keys()) {
    if (pfad !== standardPfad) {
      anzahl += 1;
    }
  }
  return anzahl;
}

function darfSchliessen(pfad: string, eintrag: Geoeffnet): boolean {
  return pfad !== standardPfad && eintrag.belegt === 0 && tiefe(eintrag.datenbank) === 0;
}

function schliesseEintrag(pfad: string): void {
  const eintrag = geoeffnet.get(pfad);
  if (!eintrag || !darfSchliessen(pfad, eintrag)) {
    return;
  }
  geoeffnet.delete(pfad);
  if (eintrag.datenbank.isOpen) {
    eintrag.datenbank.close();
  }
}

function laengstUngenutzt(behalten: string | null): string | null {
  let opfer: string | null = null;
  let zeit = Number.POSITIVE_INFINITY;
  for (const [pfad, eintrag] of geoeffnet) {
    if (pfad === behalten || !darfSchliessen(pfad, eintrag)) {
      continue;
    }
    if (eintrag.zuletzt < zeit) {
      zeit = eintrag.zuletzt;
      opfer = pfad;
    }
  }
  return opfer;
}

function raeume(behalten: string | null): void {
  const jetzt = Date.now();
  for (const [pfad, eintrag] of [...geoeffnet]) {
    if (pfad === behalten || jetzt - eintrag.zuletzt < WELT_LEERLAUF_MS) {
      continue;
    }
    schliesseEintrag(pfad);
  }
  const plaetze = behalten !== null && !geoeffnet.has(behalten) ? WELT_OBERGRENZE - 1 : WELT_OBERGRENZE;
  while (anzahlWelten() > plaetze) {
    const opfer = laengstUngenutzt(behalten);
    if (!opfer) {
      return;
    }
    const vorher = geoeffnet.size;
    schliesseEintrag(opfer);
    if (geoeffnet.size === vorher) {
      return;
    }
  }
}

export function schliesseUnbenutzteWelten(): void {
  raeume(null);
}

function belege(pfad: string): void {
  const eintrag = geoeffnet.get(pfad);
  if (!eintrag) {
    return;
  }
  eintrag.belegt += 1;
  eintrag.zuletzt = Date.now();
}

function gibFrei(pfad: string): void {
  const rest = oeffnenGesperrt.get(pfad);
  if (rest !== undefined) {
    if (rest <= 1) {
      oeffnenGesperrt.delete(pfad);
    } else {
      oeffnenGesperrt.set(pfad, rest - 1);
    }
    return;
  }
  const eintrag = geoeffnet.get(pfad);
  if (!eintrag) {
    return;
  }
  eintrag.belegt = Math.max(0, eintrag.belegt - 1);
  eintrag.zuletzt = Date.now();
}

function istThenable(wert: unknown): wert is PromiseLike<unknown> {
  return typeof wert === 'object' && wert !== null && typeof (wert as { then?: unknown }).then === 'function';
}

const leerlaufTimer = setInterval(schliesseUnbenutzteWelten, LEERLAUF_PRUEFUNG_MS);
leerlaufTimer.unref();

export function aktiverPfad(): string {
  return welten.getStore()?.pfad ?? schluessel(KONFIG.datenbankPfad);
}

function weltVon(pfad: string): Welt {
  const kanonisch = schluessel(pfad);
  if (oeffnenGesperrt.has(kanonisch)) {
    throw new Error('Die Welt ist zum Löschen geschlossen.');
  }
  raeume(kanonisch);
  let eintrag = geoeffnet.get(kanonisch);
  if (!eintrag) {
    eintrag = { datenbank: oeffneDatenbank(kanonisch), zuletzt: Date.now(), belegt: 0 };
    geoeffnet.set(kanonisch, eintrag);
  }
  eintrag.zuletzt = Date.now();
  return { datenbank: eintrag.datenbank, pfad: kanonisch };
}

function imBereich<T>(pfad: string, arbeit: () => T): T {
  const welt = weltVon(pfad);
  belege(welt.pfad);
  let spaeter = false;
  try {
    const ergebnis = welten.run(welt, arbeit);
    if (istThenable(ergebnis)) {
      spaeter = true;
      return Promise.resolve(ergebnis).finally(() => gibFrei(welt.pfad)) as T;
    }
    return ergebnis;
  } catch (fehler) {
    spaeter = true;
    gibFrei(welt.pfad);
    throw fehler;
  } finally {
    if (!spaeter) {
      gibFrei(welt.pfad);
    }
  }
}

export function mitWelt<T>(pfad: string, arbeit: () => T): T {
  return imBereich(pfad, arbeit);
}

export function mitWeltAsync<T>(pfad: string, arbeit: () => Promise<T>): Promise<T> {
  return imBereich(pfad, arbeit);
}

export function halteWelt(pfad: string): () => void {
  const kanonisch = schluessel(pfad);
  weltVon(kanonisch);
  belege(kanonisch);
  let aktiv = true;
  return () => {
    if (!aktiv) {
      return;
    }
    aktiv = false;
    gibFrei(kanonisch);
  };
}

export function istWeltGeoeffnet(pfad: string): boolean {
  return geoeffnet.has(schluessel(pfad));
}

function schliesseVerbindung(datenbank: DatabaseSync): void {
  if (!datenbank.isOpen) {
    return;
  }
  if (tiefe(datenbank) > 0) {
    try {
      datenbank.exec('ROLLBACK');
    } catch (fehler) {
      if (!(fehler instanceof Error)) {
        throw fehler;
      }
    }
    setzeTiefe(datenbank, 0);
  }
  anweisungen.delete(datenbank);
  lesecache.delete(datenbank);
  datenbank.close();
}

function schliesseErzwungen(kanonisch: string): void {
  if (kanonisch === standardPfad) {
    return;
  }
  const eintrag = geoeffnet.get(kanonisch);
  const haelt = eintrag?.belegt ?? 0;
  if (eintrag) {
    schliesseVerbindung(eintrag.datenbank);
    geoeffnet.delete(kanonisch);
  }
  oeffnenGesperrt.set(kanonisch, haelt);
}

export function schliesseWelt(pfad: string, optionen?: { erzwungen?: boolean }): void {
  const kanonisch = schluessel(pfad);
  if (optionen?.erzwungen) {
    schliesseErzwungen(kanonisch);
    return;
  }
  schliesseEintrag(kanonisch);
}

export function beendeLoeschsperre(pfad: string): void {
  const kanonisch = schluessel(pfad);
  if (oeffnenGesperrt.get(kanonisch) === 0) {
    oeffnenGesperrt.delete(kanonisch);
  }
}

export function alle<T>(sql: string, ...parameter: Parameter[]): T[] {
  return vorbereitet(aktiveDatenbank(), sql).all(...parameter) as T[];
}

export function eine<T>(sql: string, ...parameter: Parameter[]): T | undefined {
  return vorbereitet(aktiveDatenbank(), sql).get(...parameter) as T | undefined;
}

export function ausfuehren(sql: string, ...parameter: Parameter[]): { id: number; geaendert: number } {
  const datenbank = aktiveDatenbank();
  const ergebnis = vorbereitet(datenbank, sql).run(...parameter);
  if (SCHREIBT_EINTRAEGE.test(sql)) {
    verwirfLesecache(datenbank);
  }
  return { id: Number(ergebnis.lastInsertRowid), geaendert: Number(ergebnis.changes) };
}

export function aktualisiere(tabelle: string, id: number, werte: Record<string, Parameter | undefined>): void {
  const spalten: string[] = [];
  const parameter: Parameter[] = [];

  for (const [spalte, wert] of Object.entries(werte)) {
    if (wert !== undefined) {
      spalten.push(`${spalte} = ?`);
      parameter.push(wert);
    }
  }
  if (spalten.length === 0) {
    return;
  }
  ausfuehren(`UPDATE ${tabelle} SET ${spalten.join(', ')} WHERE id = ?`, ...parameter, id);
}

export function inTransaktion<T>(arbeit: () => T): T {
  const datenbank = aktiveDatenbank();
  if (tiefe(datenbank) > 0) {
    return arbeit();
  }
  setzeTiefe(datenbank, 1);
  try {
    datenbank.exec('BEGIN');
    try {
      const ergebnis = arbeit();
      datenbank.exec('COMMIT');
      return ergebnis;
    } catch (fehler) {
      datenbank.exec('ROLLBACK');
      throw fehler;
    }
  } finally {
    setzeTiefe(datenbank, 0);
  }
}

export function platzhalter(anzahl: number): string {
  return new Array(anzahl).fill('?').join(', ');
}

export function alsZahl(wert: boolean | undefined): number | undefined {
  return wert === undefined ? undefined : Number(wert);
}

export function schliesseDatenbank(): void {
  oeffnenGesperrt.clear();
  for (const eintrag of [...geoeffnet.values()]) {
    if (eintrag.datenbank.isOpen) {
      eintrag.datenbank.close();
    }
  }
  geoeffnet.clear();
}

export function tabellen(datenbank = aktiveDatenbank()): string[] {
  const zeilen = vorbereitet(
    datenbank,
    `SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).all() as { name: string }[];
  return zeilen.map((zeile) => zeile.name);
}

export function spalten(tabelle: string, datenbank = aktiveDatenbank()): string[] {
  const zeilen = vorbereitet(datenbank, `SELECT name FROM pragma_table_info(?)`).all(tabelle) as { name: string }[];
  return zeilen.map((zeile) => zeile.name);
}

function sqlText(wert: string): string {
  return `'${wert.replace(/'/g, "''")}'`;
}

const MAX_SICHERUNGS_SUFFIX = 999;

function freieSicherungsDatei(ordner: string, name: string): string {
  const erste = path.join(ordner, `${name}.db`);
  if (!fs.existsSync(erste)) {
    return erste;
  }
  for (let suffix = 2; suffix <= MAX_SICHERUNGS_SUFFIX; suffix += 1) {
    const kandidat = path.join(ordner, `${name}-${suffix}.db`);
    if (!fs.existsSync(kandidat)) {
      return kandidat;
    }
  }
  throw new Error('Für diesen Zeitpunkt gibt es keine freie Sicherungsdatei.');
}

export function sichereDatenbank(anlass: string, jetzt = new Date()): string {
  const pfad = aktiverPfad();
  if (pfad === IN_MEMORY) {
    throw new Error('Eine Datenbank im Arbeitsspeicher kann nicht gesichert werden.');
  }
  const ordner = path.join(path.dirname(KONFIG.datenbankPfad), 'sicherungen');
  fs.mkdirSync(ordner, { recursive: true });
  const stamm = path.resolve(pfad) === path.resolve(KONFIG.datenbankPfad) ? anlass : `${path.basename(pfad, '.db')}-${anlass}`;
  const datei = freieSicherungsDatei(ordner, `${stamm}-${jetzt.toISOString().replace(/[:.]/g, '-')}`);
  aktiveDatenbank().exec(`VACUUM INTO ${sqlText(datei)}`);
  return datei;
}

export function uebernimmDatenbank(pfad: string): void {
  const datenbank = aktiveDatenbank();
  datenbank.exec('PRAGMA foreign_keys = OFF');
  datenbank.exec(`ATTACH DATABASE ${sqlText(pfad)} AS uebernahme`);
  try {
    inTransaktion(() => {
      for (const tabelle of tabellen()) {
        const liste = spalten(tabelle)
          .map((spalte) => `"${spalte}"`)
          .join(', ');
        datenbank.exec(`DELETE FROM main."${tabelle}"`);
        datenbank.exec(`INSERT INTO main."${tabelle}" (${liste}) SELECT ${liste} FROM uebernahme."${tabelle}"`);
      }
      if (vorbereitet(datenbank, 'PRAGMA main.foreign_key_check').all().length > 0) {
        throw new Error('Nach der Übernahme zeigen Verweise ins Leere.');
      }
    });
  } finally {
    datenbank.exec('DETACH DATABASE uebernahme');
    datenbank.exec('PRAGMA foreign_keys = ON');
    verwirfLesecache(datenbank);
  }
}
