import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Rolle, ZugangStatus } from '../../../shared/api/index.ts';
import { KONFIG } from '../../config.ts';
import { ungueltig } from '../../fehler.ts';
import { sperreEchteDatenbankImTest } from '../../testpfad.ts';
import { BENUTZER_MAX, PASSWORT_MAX, PASSWORT_MIN } from '../../validierung.ts';

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;
const GLOBAL = 'global';

export const ZUGANG = {
  saltBytes: 16,
  hashLaenge: 64,
  tokenBytes: 32,
  sitzungMs: 30 * 24 * 60 * 60 * 1000,
  sitzungSekunden: 30 * 24 * 60 * 60,
  versucheMax: 8,
  versucheGlobalMax: 40,
  sperreMs: 15 * 60 * 1000,
} as const;

interface Sperre {
  versuche: number;
  gesperrtBis: number | null;
}

interface PasswortZeile {
  salt: string;
  hash: string;
}

const sperren = new Map<string, Sperre>();
let geoffnet: DatabaseSync | null = null;
let zugangDatei = KONFIG.zugangPfad;

function oeffne(pfad: string): DatabaseSync {
  sperreEchteDatenbankImTest(pfad);
  if (pfad !== ':memory:') {
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
  }
  const datenbank = new DatabaseSync(pfad);
  datenbank.exec(`
    CREATE TABLE IF NOT EXISTS passwort (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      geaendert_am TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sitzungen (
      token_hash TEXT PRIMARY KEY,
      erstellt_am TEXT NOT NULL,
      laeuft_ab TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS benutzer (
      id INTEGER PRIMARY KEY,
      benutzername TEXT NOT NULL,
      name_norm TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      rolle TEXT NOT NULL CHECK (rolle IN ('inhaber', 'mitglied')),
      weltdatei TEXT NOT NULL,
      geaendert_am TEXT NOT NULL
    );
  `);
  const spalten = datenbank.prepare(`SELECT name FROM pragma_table_info('sitzungen')`).all() as { name: string }[];
  if (!spalten.some((spalte) => spalte.name === 'benutzer_id')) {
    datenbank.exec('ALTER TABLE sitzungen ADD COLUMN benutzer_id INTEGER REFERENCES benutzer(id)');
  }
  sichereNamensindex(datenbank);
  return datenbank;
}

/** Vorhandene Doppelte bleiben. Ein Index entstünde sonst nur durch stilles Umbenennen. */
function sichereNamensindex(db: DatabaseSync): void {
  const doppelt = db
    .prepare('SELECT name_norm FROM benutzer GROUP BY name_norm HAVING COUNT(*) > 1 LIMIT 1')
    .get();
  if (doppelt) {
    return;
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS benutzer_name_norm ON benutzer(name_norm)');
}

export function verwendeZugang(pfad: string): void {
  geoffnet?.close();
  zugangDatei = pfad;
  geoffnet = oeffne(pfad);
}

export function datenordner(): string {
  return path.dirname(zugangDatei);
}

export function schliesseZugang(): void {
  geoffnet?.close();
  geoffnet = null;
}

function datenbank(): DatabaseSync {
  if (!geoffnet) {
    geoffnet = oeffne(zugangDatei);
  }
  return geoffnet;
}

export function setzeSperrenZurueck(): void {
  sperren.clear();
}

function pruefePasswortLaenge(passwort: string): void {
  if (passwort.length < PASSWORT_MIN) {
    throw ungueltig(`Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen haben.`);
  }
  if (passwort.length > PASSWORT_MAX) {
    throw ungueltig(`Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen haben.`);
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function loescheAbgelaufene(jetzt: Date): void {
  datenbank().prepare('DELETE FROM sitzungen WHERE laeuft_ab <= ?').run(jetzt.toISOString());
}

function hatAltesPasswort(): boolean {
  return datenbank().prepare('SELECT id FROM passwort WHERE id = 1').get() !== undefined;
}

export function istEingerichtet(): boolean {
  return hatAltesPasswort() || anzahlBenutzer() > 0;
}

export function hatKeinKonto(): boolean {
  return !hatAltesPasswort() && anzahlBenutzer() === 0;
}

export function legePasswortAn(passwort: string, jetzt = new Date()): void {
  pruefePasswortLaenge(passwort);
  const salt = randomBytes(ZUGANG.saltBytes);
  const hash = scryptSync(passwort, salt, ZUGANG.hashLaenge, SCRYPT);
  const db = datenbank();
  db.exec('BEGIN');
  try {
    if (db.prepare('SELECT id FROM passwort WHERE id = 1').get() !== undefined) {
      throw ungueltig('Ein Passwort ist bereits festgelegt.');
    }
    db.prepare('INSERT INTO passwort (id, salt, hash, geaendert_am) VALUES (1, ?, ?, ?)').run(
      salt.toString('hex'),
      hash.toString('hex'),
      jetzt.toISOString(),
    );
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  }
}

export function passwortStimmt(passwort: string): boolean {
  const zeile = datenbank().prepare('SELECT salt, hash FROM passwort WHERE id = 1').get() as PasswortZeile | undefined;
  if (!zeile) {
    return false;
  }
  const erwartet = Buffer.from(zeile.hash, 'hex');
  const berechnet = scryptSync(passwort, Buffer.from(zeile.salt, 'hex'), erwartet.length, SCRYPT);
  if (berechnet.length !== erwartet.length) {
    return false;
  }
  return timingSafeEqual(berechnet, erwartet);
}

export function aenderePasswort(neu: string, token: string, jetzt = new Date()): void {
  pruefePasswortLaenge(neu);
  const sitzung = leseSitzung(token, jetzt);
  if (!sitzung) {
    throw ungueltig('Die Sitzung ist abgelaufen.');
  }
  const salt = randomBytes(ZUGANG.saltBytes);
  const hash = scryptSync(neu, salt, ZUGANG.hashLaenge, SCRYPT);
  const db = datenbank();
  db.exec('BEGIN');
  try {
    const geaendert =
      sitzung.benutzerId === null
        ? db.prepare('UPDATE passwort SET salt = ?, hash = ?, geaendert_am = ? WHERE id = 1').run(salt.toString('hex'), hash.toString('hex'), jetzt.toISOString())
        : db
            .prepare('UPDATE benutzer SET salt = ?, hash = ?, geaendert_am = ? WHERE id = ?')
            .run(salt.toString('hex'), hash.toString('hex'), jetzt.toISOString(), sitzung.benutzerId);
    if (Number(geaendert.changes) !== 1) {
      throw ungueltig('Es ist noch kein Passwort festgelegt.');
    }
    if (sitzung.benutzerId === null) {
      db.prepare('DELETE FROM sitzungen WHERE token_hash != ?').run(tokenHash(token));
    } else {
      db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ? AND token_hash != ?').run(sitzung.benutzerId, tokenHash(token));
    }
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  }
}

export function oeffneSitzung(jetzt = new Date(), benutzerId: number | null = null): string {
  loescheAbgelaufene(jetzt);
  const token = randomBytes(ZUGANG.tokenBytes).toString('base64url');
  const ablauf = new Date(jetzt.getTime() + ZUGANG.sitzungMs);
  datenbank()
    .prepare('INSERT INTO sitzungen (token_hash, benutzer_id, erstellt_am, laeuft_ab) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), benutzerId, jetzt.toISOString(), ablauf.toISOString());
  return token;
}

interface SitzungIntern {
  benutzerId: number | null;
  laeuftAb: string;
}

interface BenutzerIntern {
  id: number;
  benutzername: string;
  rolle: Rolle;
  weltdatei: string;
  salt: string;
  hash: string;
}

function leseSitzung(token: string | undefined, jetzt: Date): SitzungIntern | null {
  if (!token) {
    return null;
  }
  const zeile = datenbank()
    .prepare('SELECT benutzer_id AS benutzerId, laeuft_ab AS laeuftAb FROM sitzungen WHERE token_hash = ?')
    .get(tokenHash(token)) as SitzungIntern | undefined;
  if (!zeile) {
    return null;
  }
  if (Date.parse(zeile.laeuftAb) <= jetzt.getTime()) {
    datenbank().prepare('DELETE FROM sitzungen WHERE token_hash = ?').run(tokenHash(token));
    return null;
  }
  const rest = Date.parse(zeile.laeuftAb) - jetzt.getTime();
  if (rest < ZUGANG.sitzungMs / 2) {
    const neu = new Date(jetzt.getTime() + ZUGANG.sitzungMs).toISOString();
    datenbank().prepare('UPDATE sitzungen SET laeuft_ab = ? WHERE token_hash = ?').run(neu, tokenHash(token));
  }
  return zeile;
}

export function sitzungGueltig(token: string | undefined, jetzt = new Date()): boolean {
  return leseSitzung(token, jetzt) !== null;
}

export function schliesseSitzung(token: string | undefined): void {
  if (!token) {
    return;
  }
  datenbank().prepare('DELETE FROM sitzungen WHERE token_hash = ?').run(tokenHash(token));
}

function nameNorm(benutzername: string): string {
  return benutzername.trim().toLocaleLowerCase('de-DE');
}

function nameVergeben(benutzername: string, ausserId?: number): boolean {
  const zeile =
    ausserId === undefined
      ? (datenbank().prepare('SELECT id FROM benutzer WHERE name_norm = ?').get(nameNorm(benutzername)) as { id: number } | undefined)
      : (datenbank()
          .prepare('SELECT id FROM benutzer WHERE name_norm = ? AND id != ?')
          .get(nameNorm(benutzername), ausserId) as { id: number } | undefined);
  return zeile !== undefined;
}

function istNamenkollision(fehler: unknown): boolean {
  if (!(fehler instanceof Error)) {
    return false;
  }
  const extra = fehler as { code?: string; errcode?: number };
  return fehler.message.includes('UNIQUE') || extra.code === 'SQLITE_CONSTRAINT_UNIQUE' || extra.errcode === 2067;
}

function pruefeBenutzername(benutzername: string): string {
  const name = benutzername.trim();
  if (name.length < 1) {
    throw ungueltig('Der Benutzername darf nicht leer sein.');
  }
  if (name.length > BENUTZER_MAX) {
    throw ungueltig(`Der Benutzername darf höchstens ${BENUTZER_MAX} Zeichen haben.`);
  }
  return name;
}

function anzahlBenutzer(): number {
  const zeile = datenbank().prepare('SELECT COUNT(*) AS anzahl FROM benutzer').get() as { anzahl: number };
  return zeile.anzahl;
}

function holeBenutzer(id: number): BenutzerIntern | undefined {
  return datenbank()
    .prepare(
      `SELECT id, benutzername, rolle, weltdatei, salt, hash
       FROM benutzer WHERE id = ?`,
    )
    .get(id) as BenutzerIntern | undefined;
}

function hashesPassen(passwort: string, salt: string, hash: string): boolean {
  const erwartet = Buffer.from(hash, 'hex');
  const berechnet = scryptSync(passwort, Buffer.from(salt, 'hex'), erwartet.length, SCRYPT);
  if (berechnet.length !== erwartet.length) {
    return false;
  }
  return timingSafeEqual(berechnet, erwartet);
}

export function listeKonten(): { id: number; benutzername: string; rolle: Rolle; weltdatei: string }[] {
  return datenbank()
    .prepare('SELECT id, benutzername, rolle, weltdatei FROM benutzer ORDER BY id')
    .all() as { id: number; benutzername: string; rolle: Rolle; weltdatei: string }[];
}

export function legeBenutzerAn(
  daten: { benutzername: string; passwort: string; rolle: Rolle; weltdatei: string },
  jetzt = new Date(),
): { id: number; benutzername: string; rolle: Rolle } {
  const benutzername = pruefeBenutzername(daten.benutzername);
  pruefePasswortLaenge(daten.passwort);
  if (nameVergeben(benutzername)) {
    throw ungueltig('Der Benutzername ist schon vergeben.');
  }
  const salt = randomBytes(ZUGANG.saltBytes);
  const hash = scryptSync(daten.passwort, salt, ZUGANG.hashLaenge, SCRYPT);
  try {
    const ergebnis = datenbank()
      .prepare(
        `INSERT INTO benutzer (benutzername, name_norm, salt, hash, rolle, weltdatei, geaendert_am)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(benutzername, nameNorm(benutzername), salt.toString('hex'), hash.toString('hex'), daten.rolle, daten.weltdatei, jetzt.toISOString());
    return { id: Number(ergebnis.lastInsertRowid), benutzername, rolle: daten.rolle };
  } catch (fehler) {
    if (istNamenkollision(fehler)) {
      throw ungueltig('Der Benutzername ist schon vergeben.');
    }
    throw fehler;
  }
}

export function setzeWeltdatei(id: number, weltdatei: string): void {
  const ergebnis = datenbank().prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?').run(weltdatei, id);
  if (Number(ergebnis.changes) !== 1) {
    throw ungueltig('Der Account existiert nicht.');
  }
}

export function loescheBenutzer(id: number): { weltdatei: string; rolle: Rolle } {
  const vorhanden = holeBenutzer(id);
  if (!vorhanden) {
    throw ungueltig('Der Account existiert nicht.');
  }
  const db = datenbank();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?').run(id);
    db.prepare('DELETE FROM benutzer WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  }
  return { weltdatei: vorhanden.weltdatei, rolle: vorhanden.rolle };
}

export function benenneBenutzer(id: number, benutzername: string, jetzt = new Date()): void {
  const name = pruefeBenutzername(benutzername);
  if (!holeBenutzer(id)) {
    throw ungueltig('Der Account existiert nicht.');
  }
  if (nameVergeben(name, id)) {
    throw ungueltig('Der Benutzername ist schon vergeben.');
  }
  try {
    const ergebnis = datenbank()
      .prepare('UPDATE benutzer SET benutzername = ?, name_norm = ?, geaendert_am = ? WHERE id = ?')
      .run(name, nameNorm(name), jetzt.toISOString(), id);
    if (Number(ergebnis.changes) !== 1) {
      throw ungueltig('Der Account existiert nicht.');
    }
  } catch (fehler) {
    if (istNamenkollision(fehler)) {
      throw ungueltig('Der Benutzername ist schon vergeben.');
    }
    throw fehler;
  }
}

export function uebernimmAltesPasswort(benutzername: string, weltdatei: string, jetzt = new Date()): number {
  const name = pruefeBenutzername(benutzername);
  if (nameVergeben(name)) {
    throw ungueltig('Der Benutzername ist schon vergeben.');
  }
  const alt = datenbank().prepare('SELECT salt, hash FROM passwort WHERE id = 1').get() as PasswortZeile | undefined;
  if (!alt) {
    throw ungueltig('Es ist noch kein Passwort festgelegt.');
  }
  const db = datenbank();
  db.exec('BEGIN');
  try {
    const ergebnis = db
      .prepare(
        `INSERT INTO benutzer (benutzername, name_norm, salt, hash, rolle, weltdatei, geaendert_am)
         VALUES (?, ?, ?, ?, 'inhaber', ?, ?)`,
      )
      .run(name, nameNorm(name), alt.salt, alt.hash, weltdatei, jetzt.toISOString());
    db.prepare('DELETE FROM passwort WHERE id = 1').run();
    const id = Number(ergebnis.lastInsertRowid);
    db.prepare('UPDATE sitzungen SET benutzer_id = ? WHERE benutzer_id IS NULL').run(id);
    db.exec('COMMIT');
    return id;
  } catch (fehler) {
    db.exec('ROLLBACK');
    if (istNamenkollision(fehler)) {
      throw ungueltig('Der Benutzername ist schon vergeben.');
    }
    throw fehler;
  }
}

export function benutzerPasswortStimmt(benutzername: string, passwort: string): BenutzerIntern | null {
  const zeile = datenbank()
    .prepare('SELECT id, benutzername, rolle, weltdatei, salt, hash FROM benutzer WHERE name_norm = ?')
    .get(nameNorm(benutzername)) as BenutzerIntern | undefined;
  if (!zeile || !hashesPassen(passwort, zeile.salt, zeile.hash)) {
    return null;
  }
  return zeile;
}

export function passwortDerSitzungStimmt(token: string | undefined, passwort: string, jetzt = new Date()): boolean {
  const sitzung = leseSitzung(token, jetzt);
  if (!sitzung) {
    return false;
  }
  if (sitzung.benutzerId === null) {
    return passwortStimmt(passwort);
  }
  const benutzer = holeBenutzer(sitzung.benutzerId);
  return benutzer !== undefined && hashesPassen(passwort, benutzer.salt, benutzer.hash);
}

export function kontenSichtbar(token: string | undefined, jetzt = new Date()): boolean {
  const sitzung = leseSitzung(token, jetzt);
  if (!sitzung?.benutzerId) {
    return false;
  }
  return holeBenutzer(sitzung.benutzerId)?.rolle === 'inhaber';
}

export function sitzungsBenutzer(token: string | undefined, jetzt = new Date()): BenutzerIntern | null {
  const sitzung = leseSitzung(token, jetzt);
  if (!sitzung?.benutzerId) {
    return null;
  }
  return holeBenutzer(sitzung.benutzerId) ?? null;
}

export function weltdateiDerSitzung(token: string | undefined, jetzt = new Date()): string | null {
  const sitzung = leseSitzung(token, jetzt);
  if (!sitzung) {
    return null;
  }
  if (sitzung.benutzerId === null) {
    return path.basename(KONFIG.datenbankPfad);
  }
  return holeBenutzer(sitzung.benutzerId)?.weltdatei ?? null;
}

export function loeseWeltdatei(relativ: string): string {
  if (relativ === '' || relativ.includes('..') || path.isAbsolute(relativ)) {
    throw ungueltig('Die Weltdatei ist ungültig.');
  }
  const basis = path.resolve(datenordner());
  const ziel = path.resolve(basis, relativ);
  if (ziel !== basis && !ziel.startsWith(basis + path.sep)) {
    throw ungueltig('Die Weltdatei ist ungültig.');
  }
  return ziel;
}

export function weltenPfade(): string[] {
  const konten = listeKonten();
  if (konten.length === 0) {
    return [KONFIG.datenbankPfad];
  }
  return [...new Set(konten.map((konto) => loeseWeltdatei(konto.weltdatei)))];
}

function schreibePasswort(passwort: string, jetzt: Date, ziel: { art: 'alt' } | { art: 'benutzer'; id: number }): void {
  pruefePasswortLaenge(passwort);
  const salt = randomBytes(ZUGANG.saltBytes);
  const hash = scryptSync(passwort, salt, ZUGANG.hashLaenge, SCRYPT);
  const db = datenbank();
  db.exec('BEGIN');
  try {
    if (ziel.art === 'alt') {
      db.prepare('DELETE FROM passwort WHERE id = 1').run();
      db.prepare('INSERT INTO passwort (id, salt, hash, geaendert_am) VALUES (1, ?, ?, ?)').run(
        salt.toString('hex'),
        hash.toString('hex'),
        jetzt.toISOString(),
      );
      db.prepare('DELETE FROM sitzungen').run();
    } else {
      const ergebnis = db
        .prepare('UPDATE benutzer SET salt = ?, hash = ?, geaendert_am = ? WHERE id = ?')
        .run(salt.toString('hex'), hash.toString('hex'), jetzt.toISOString(), ziel.id);
      if (Number(ergebnis.changes) !== 1) {
        throw ungueltig('Der Account existiert nicht.');
      }
      db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?').run(ziel.id);
    }
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  }
}

export function ersetzeZugangspasswort(passwort: string, benutzername?: string, jetzt = new Date()): void {
  const konten = listeKonten();
  if (konten.length === 0) {
    schreibePasswort(passwort, jetzt, { art: 'alt' });
    return;
  }
  if (benutzername === undefined) {
    if (konten.length !== 1) {
      throw ungueltig('Der Benutzername fehlt.');
    }
    schreibePasswort(passwort, jetzt, { art: 'benutzer', id: konten[0].id });
    return;
  }
  const ziel = konten.find((konto) => nameNorm(konto.benutzername) === nameNorm(benutzername));
  if (!ziel) {
    throw ungueltig('Der Benutzername ist unbekannt.');
  }
  schreibePasswort(passwort, jetzt, { art: 'benutzer', id: ziel.id });
}

export function anzahlKonten(): number {
  return anzahlBenutzer();
}

export function zugangStatus(token: string | undefined, jetzt = new Date()): ZugangStatus {
  const sitzung = leseSitzung(token, jetzt);
  const benutzer = sitzung?.benutzerId ? holeBenutzer(sitzung.benutzerId) : undefined;
  if (benutzer) {
    return { modus: 'bereit', benutzername: benutzer.benutzername, rolle: benutzer.rolle };
  }
  const hatBenutzer = anzahlBenutzer() > 0;
  const hatPasswort = hatAltesPasswort();
  if (sitzung && hatPasswort && !hatBenutzer) {
    return { modus: 'benutzername', benutzername: null, rolle: null };
  }
  if (!hatPasswort && !hatBenutzer) {
    return { modus: 'einrichten', benutzername: null, rolle: null };
  }
  if (hatPasswort && !hatBenutzer) {
    return { modus: 'passwort', benutzername: null, rolle: null };
  }
  return { modus: 'anmelden', benutzername: null, rolle: null };
}

function holeSperre(schluessel: string, jetzt: number): Sperre {
  const vorhanden = sperren.get(schluessel);
  if (!vorhanden || (vorhanden.gesperrtBis !== null && vorhanden.gesperrtBis <= jetzt)) {
    const frisch = { versuche: 0, gesperrtBis: null };
    sperren.set(schluessel, frisch);
    return frisch;
  }
  return vorhanden;
}

function merkmalGesperrt(schluessel: string, jetzt: number): boolean {
  const vorhanden = sperren.get(schluessel);
  return vorhanden?.gesperrtBis !== null && vorhanden !== undefined && (vorhanden.gesperrtBis ?? 0) > jetzt;
}

export function istGesperrt(schluessel: string, jetzt = Date.now()): boolean {
  return merkmalGesperrt(schluessel, jetzt) || merkmalGesperrt(GLOBAL, jetzt);
}

function merkeEinen(schluessel: string, jetzt: number, grenze: number): void {
  if (merkmalGesperrt(schluessel, jetzt)) {
    return;
  }
  const eintrag = holeSperre(schluessel, jetzt);
  eintrag.versuche += 1;
  if (eintrag.versuche >= grenze) {
    eintrag.gesperrtBis = jetzt + ZUGANG.sperreMs;
    eintrag.versuche = 0;
  }
}

export function merkeFehlversuch(schluessel: string, jetzt = Date.now()): void {
  merkeEinen(schluessel, jetzt, ZUGANG.versucheMax);
  merkeEinen(GLOBAL, jetzt, ZUGANG.versucheGlobalMax);
}

export function setzeFehlversucheZurueck(schluessel: string): void {
  sperren.delete(schluessel);
}
