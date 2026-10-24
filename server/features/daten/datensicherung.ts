import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SICHERUNG_APP, type DatenExport, type DatenZeile, type ImportErgebnis } from '../../../shared/api/index.ts';
import { KONFIG } from '../../config.ts';
import {
  AKTUELLE_SCHEMA_VERSION,
  alle,
  migriere,
  platzhalter,
  schemaVersion,
  sichereDatenbank,
  spalten,
  tabellen,
  uebernimmDatenbank,
} from '../../db.ts';
import { AppFehler, ungueltig } from '../../fehler.ts';
import { sperreEchteDatenbankImTest } from '../../testpfad.ts';
import { schalteErfolgeFrei } from '../erfolge/erfolge.ts';

const SICHERUNGS_ANLASS = 'vor-import';
const NEBENDATEIEN = ['', '-journal', '-wal', '-shm'];

export function exportiereDaten(jetzt = new Date()): DatenExport {
  const daten: Record<string, DatenZeile[]> = {};
  for (const tabelle of tabellen()) {
    daten[tabelle] = alle<DatenZeile>(`SELECT * FROM "${tabelle}"`);
  }
  return {
    app: SICHERUNG_APP,
    schemaVersion: schemaVersion(),
    exportiertAm: jetzt.toISOString(),
    tabellen: daten,
  };
}

function leere(datenbank: DatabaseSync): void {
  for (const tabelle of tabellen(datenbank)) {
    datenbank.exec(`DELETE FROM "${tabelle}"`);
  }
}

function pruefeSpalten(tabelle: string, zeile: DatenZeile, erlaubt: Set<string>): string[] {
  const namen = Object.keys(zeile);
  for (const name of namen) {
    if (!erlaubt.has(name)) {
      throw ungueltig(`Die Sicherung enthält die unbekannte Spalte "${name}" in "${tabelle}".`);
    }
  }
  return namen;
}

function fuelle(datenbank: DatabaseSync, daten: Record<string, DatenZeile[]>): number {
  const bekannt = new Set(tabellen(datenbank));
  let anzahl = 0;
  for (const [tabelle, zeilen] of Object.entries(daten)) {
    if (!bekannt.has(tabelle)) {
      throw ungueltig(`Die Sicherung enthält die unbekannte Tabelle "${tabelle}".`);
    }
    const erlaubt = new Set(spalten(tabelle, datenbank));
    for (const zeile of zeilen) {
      const namen = pruefeSpalten(tabelle, zeile, erlaubt);
      if (namen.length === 0) {
        continue;
      }
      datenbank
        .prepare(`INSERT INTO "${tabelle}" (${namen.map((name) => `"${name}"`).join(', ')}) VALUES (${platzhalter(namen.length)})`)
        .run(...namen.map((name) => zeile[name]));
      anzahl++;
    }
  }
  return anzahl;
}

function baueImportDatenbank(pfad: string, sicherung: DatenExport): number {
  sperreEchteDatenbankImTest(pfad);
  const datenbank = new DatabaseSync(pfad);
  try {
    datenbank.exec('PRAGMA foreign_keys = OFF');
    migriere(datenbank, sicherung.schemaVersion);
    datenbank.exec('BEGIN');
    let zeilen: number;
    try {
      leere(datenbank);
      zeilen = fuelle(datenbank, sicherung.tabellen);
      datenbank.exec('COMMIT');
    } catch (fehler) {
      datenbank.exec('ROLLBACK');
      throw fehler;
    }
    migriere(datenbank);
    if (datenbank.prepare('PRAGMA foreign_key_check').all().length > 0) {
      throw ungueltig('Die Sicherung ist unvollständig: Einige Verweise zeigen ins Leere.');
    }
    return zeilen;
  } finally {
    datenbank.close();
  }
}

function entferneImportDatei(pfad: string): void {
  for (const endung of NEBENDATEIEN) {
    fs.rmSync(`${pfad}${endung}`, { force: true });
  }
}

export function importiereDaten(sicherung: DatenExport, jetzt = new Date()): ImportErgebnis {
  if (sicherung.schemaVersion > AKTUELLE_SCHEMA_VERSION) {
    throw ungueltig('Die Sicherung stammt aus einer neueren Version von Ascend. Bitte zuerst Ascend aktualisieren.');
  }
  const importPfad = path.join(path.dirname(KONFIG.datenbankPfad), `import-${jetzt.getTime()}.db`);
  try {
    const zeilen = baueImportDatenbank(importPfad, sicherung);
    const sicherungsDatei = sichereDatenbank(SICHERUNGS_ANLASS, jetzt);
    uebernimmDatenbank(importPfad);
    schalteErfolgeFrei();
    return { sicherung: path.basename(sicherungsDatei), zeilen };
  } catch (fehler) {
    if (fehler instanceof AppFehler) {
      throw fehler;
    }
    throw ungueltig(`Die Sicherung passt nicht zur Datenbank: ${(fehler as Error).message}`);
  } finally {
    entferneImportDatei(importPfad);
  }
}
