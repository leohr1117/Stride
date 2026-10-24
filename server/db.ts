import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { KONFIG } from './config.ts';
import { MIGRATIONEN } from './migrationen.ts';
import { sperreEchteDatenbankImTest } from './testpfad.ts';

export type Parameter = SQLInputValue;

const IN_MEMORY = ':memory:';

function oeffneDatenbank(pfad: string): DatabaseSync {
  sperreEchteDatenbankImTest(pfad);
  if (pfad !== IN_MEMORY) {
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
  }
  const datenbank = new DatabaseSync(pfad);
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
    const schluesselOffen = MIGRATIONEN[index].includes('CREATE TABLE projekte_neu');
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

const welten = new AsyncLocalStorage<Welt>();
const geoeffnet = new Map<string, DatabaseSync>();

function schluessel(pfad: string): string {
  return path.resolve(pfad);
}

function merke(pfad: string, datenbank: DatabaseSync): DatabaseSync {
  const kanonisch = schluessel(pfad);
  geoeffnet.set(kanonisch, datenbank);
  return datenbank;
}

const standardDb = merke(KONFIG.datenbankPfad, oeffneDatenbank(KONFIG.datenbankPfad));

function aktiveDatenbank(): DatabaseSync {
  return welten.getStore()?.datenbank ?? standardDb;
}

export function aktiverPfad(): string {
  return welten.getStore()?.pfad ?? schluessel(KONFIG.datenbankPfad);
}

function weltVon(pfad: string): Welt {
  const kanonisch = schluessel(pfad);
  const vorhanden = geoeffnet.get(kanonisch);
  const datenbank = vorhanden ?? merke(kanonisch, oeffneDatenbank(kanonisch));
  return { datenbank, pfad: kanonisch };
}

export function mitWelt<T>(pfad: string, arbeit: () => T): T {
  return welten.run(weltVon(pfad), arbeit);
}

export function mitWeltAsync<T>(pfad: string, arbeit: () => Promise<T>): Promise<T> {
  return welten.run(weltVon(pfad), arbeit);
}

export function schliesseWelt(pfad: string): void {
  const kanonisch = schluessel(pfad);
  if (kanonisch === schluessel(KONFIG.datenbankPfad)) {
    return;
  }
  const datenbank = geoeffnet.get(kanonisch);
  if (!datenbank) {
    return;
  }
  datenbank.close();
  geoeffnet.delete(kanonisch);
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
  for (const datenbank of geoeffnet.values()) {
    datenbank.close();
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

export function sichereDatenbank(anlass: string, jetzt = new Date()): string {
  const pfad = aktiverPfad();
  if (pfad === IN_MEMORY) {
    throw new Error('Eine Datenbank im Arbeitsspeicher kann nicht gesichert werden.');
  }
  const ordner = path.join(path.dirname(KONFIG.datenbankPfad), 'sicherungen');
  fs.mkdirSync(ordner, { recursive: true });
  const stamm = path.resolve(pfad) === path.resolve(KONFIG.datenbankPfad) ? anlass : `${path.basename(pfad, '.db')}-${anlass}`;
  const datei = path.join(ordner, `${stamm}-${jetzt.toISOString().replace(/[:.]/g, '-')}.db`);
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
