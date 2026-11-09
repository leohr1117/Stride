import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { strideVariable } from '../../umgebung.ts';

/** Authorization- und Token-Endpunkt. Kein zusätzliches Paket. */
export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

const ALTER_MS = 10 * 60 * 1000;
const ALTER_SEKUNDEN = 10 * 60;

export const GOOGLE_COOKIE = 'ascend_google';

const GOOGLE_MIGRATIONEN = [
  `CREATE TABLE IF NOT EXISTS google_konto (
    benutzer_id INTEGER NOT NULL UNIQUE REFERENCES benutzer(id),
    sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL
  )`,
];

export const FREMD = 'Dieses Google-Konto ist schon mit einem anderen Stride-Konto verknüpft.';
export const LOESEN_GESPERRT =
  'Lösen geht erst, wenn das Konto ein Passwort hat. Sonst kommst du nicht mehr hinein.';

interface Fluss {
  art: 'fluss';
  state: string;
  nonce: string;
  verifier: string;
  zweck: 'anmelden' | 'verknuepfen';
  benutzerId: number | null;
  weiterleitung: string;
  ablauf: number;
}

interface Anlage {
  art: 'anlage';
  sub: string;
  email: string;
  ablauf: number;
}

type Eintrag = Fluss | Anlage;

const ablage = new Map<string, Eintrag>();
let holeDb: (() => DatabaseSync) | null = null;
let uhr: () => number = () => Date.now();

export function verbindeGoogle(hole: () => DatabaseSync): void {
  holeDb = hole;
}

export function leereGoogleAblage(): void {
  ablage.clear();
  uhr = () => Date.now();
}

export function setzeGoogleUhr(fn: () => number): void {
  uhr = fn;
}

function hole(): DatabaseSync {
  if (!holeDb) {
    throw new Error('Die Zugangsdatenbank ist nicht verbunden.');
  }
  return holeDb();
}

function zufall(): string {
  return randomBytes(32).toString('base64url');
}

export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function gleich(a: string, b: string): boolean {
  const links = Buffer.from(a);
  const rechts = Buffer.from(b);
  if (links.length !== rechts.length) {
    return false;
  }
  return timingSafeEqual(links, rechts);
}

export interface GoogleKonfig {
  clientId: string;
  geheim: string;
}

/** Je Anfrage neu gelesen. Aktiv nur, wenn Schalter und beide Client-Werte gesetzt sind. */
export function googleKonfig(): GoogleKonfig | null {
  if (strideVariable('GOOGLE') !== '1') {
    return null;
  }
  const clientId = strideVariable('GOOGLE_CLIENT_ID')?.trim() ?? '';
  const geheim = strideVariable('GOOGLE_CLIENT_SECRET')?.trim() ?? '';
  if (!clientId || !geheim) {
    return null;
  }
  return { clientId, geheim };
}

export function googleAktiv(): boolean {
  return googleKonfig() !== null;
}

/** Versionierte, beim zweiten Lauf leere Migration der Zugangsdatenbank. */
export function migriereGoogle(db: DatabaseSync): void {
  let version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  while (version < GOOGLE_MIGRATIONEN.length) {
    const sql = GOOGLE_MIGRATIONEN[version] ?? '';
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec('COMMIT');
    } catch (fehler) {
      db.exec('ROLLBACK');
      throw fehler;
    }
    version += 1;
    db.exec(`PRAGMA user_version = ${version}`);
  }
}

export function googleSchemaVersion(): number {
  return (hole().prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

export function entferneGoogle(db: DatabaseSync, benutzerId: number): void {
  db.prepare('DELETE FROM google_konto WHERE benutzer_id = ?').run(benutzerId);
}

export function googleSub(benutzerId: number): string | null {
  const zeile = hole().prepare('SELECT sub FROM google_konto WHERE benutzer_id = ?').get(benutzerId) as
    | { sub: string }
    | undefined;
  return zeile?.sub ?? null;
}

function hatPasswort(db: DatabaseSync, id: number): boolean {
  const zeile = db.prepare('SELECT salt, hash FROM benutzer WHERE id = ?').get(id) as
    | { salt: string; hash: string }
    | undefined;
  return zeile !== undefined && zeile.salt.length > 0 && zeile.hash.length > 0;
}

export interface GoogleTeil {
  google: boolean;
  googleEmail: string | null;
  googleAnlage: string | null;
  googleLoesen: boolean;
}

const LEER: GoogleTeil = { google: false, googleEmail: null, googleAnlage: null, googleLoesen: false };

export function googleTeil(benutzerId: number | null, schluessel: string | undefined): GoogleTeil {
  if (!googleAktiv()) {
    return LEER;
  }
  const db = hole();
  const zeile =
    benutzerId === null
      ? undefined
      : (db.prepare('SELECT email FROM google_konto WHERE benutzer_id = ?').get(benutzerId) as { email: string } | undefined);
  const anlage = anlageVon(schluessel);
  return {
    google: true,
    googleEmail: zeile?.email ?? null,
    googleAnlage: anlage?.email ?? null,
    googleLoesen: zeile !== undefined && benutzerId !== null && hatPasswort(db, benutzerId),
  };
}

export function googleCookie(wert: string, sicher: boolean, maxAlter = ALTER_SEKUNDEN): string {
  const teile = [`${GOOGLE_COOKIE}=${encodeURIComponent(wert)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAlter}`];
  if (sicher) {
    teile.push('Secure');
  }
  return teile.join('; ');
}

export function leeresGoogleCookie(sicher: boolean): string {
  return googleCookie('', sicher, 0);
}

export function googleSchluessel(cookieKopf: string | string[] | undefined): string | undefined {
  const kopf = Array.isArray(cookieKopf) ? cookieKopf.join('; ') : cookieKopf;
  if (!kopf) {
    return undefined;
  }
  for (const teil of kopf.split(';')) {
    const trenn = teil.indexOf('=');
    if (trenn === -1 || teil.slice(0, trenn).trim() !== GOOGLE_COOKIE) {
      continue;
    }
    const wert = teil.slice(trenn + 1).trim();
    return wert ? decodeURIComponent(wert) : undefined;
  }
  return undefined;
}

function lies(schluessel: string | undefined): Eintrag | null {
  if (!schluessel) {
    return null;
  }
  const eintrag = ablage.get(schluessel);
  if (!eintrag) {
    return null;
  }
  if (eintrag.ablauf <= uhr()) {
    ablage.delete(schluessel);
    return null;
  }
  return eintrag;
}

export function anlageVon(schluessel: string | undefined): { sub: string; email: string } | null {
  const eintrag = lies(schluessel);
  if (!eintrag || eintrag.art !== 'anlage') {
    return null;
  }
  return { sub: eintrag.sub, email: eintrag.email };
}

export function nimmAnlage(schluessel: string | undefined): { sub: string; email: string } | null {
  const anlage = anlageVon(schluessel);
  if (anlage && schluessel) {
    ablage.delete(schluessel);
  }
  return anlage;
}

export type Verknuepfung = 'ok' | 'fremd' | 'belegt';

/** Zuordnung nur über sub. Die E-Mail wird nur gespeichert, nie zum Suchen benutzt. */
export function verknuepfeGoogle(benutzerId: number, sub: string, email: string): Verknuepfung {
  const db = hole();
  const fremd = db.prepare('SELECT benutzer_id AS id FROM google_konto WHERE sub = ?').get(sub) as { id: number } | undefined;
  if (fremd && fremd.id !== benutzerId) {
    return 'fremd';
  }
  const eigen = db.prepare('SELECT sub FROM google_konto WHERE benutzer_id = ?').get(benutzerId) as { sub: string } | undefined;
  if (eigen && eigen.sub !== sub) {
    return 'belegt';
  }
  if (eigen) {
    db.prepare('UPDATE google_konto SET email = ? WHERE benutzer_id = ?').run(email, benutzerId);
    return 'ok';
  }
  db.prepare('INSERT INTO google_konto (benutzer_id, sub, email) VALUES (?, ?, ?)').run(benutzerId, sub, email);
  return 'ok';
}

export type Loesung = 'ok' | 'gesperrt' | 'keine';

export function loeseGoogle(benutzerId: number): Loesung {
  const db = hole();
  const zeile = db.prepare('SELECT sub FROM google_konto WHERE benutzer_id = ?').get(benutzerId) as { sub: string } | undefined;
  if (!zeile) {
    return 'keine';
  }
  if (!hatPasswort(db, benutzerId)) {
    return 'gesperrt';
  }
  db.prepare('DELETE FROM google_konto WHERE benutzer_id = ?').run(benutzerId);
  return 'ok';
}

export type GoogleStart = { art: 'weiter'; ort: string; cookie: string } | { art: 'abgewiesen'; ort: string };

export function beginneGoogle(eingabe: {
  zweck: 'anmelden' | 'verknuepfen';
  benutzerId: number | null;
  sicher: boolean;
  weiterleitung: string;
}): GoogleStart {
  const konfig = googleKonfig();
  if (!konfig) {
    return { art: 'abgewiesen', ort: '/?google=d' };
  }
  if (eingabe.zweck === 'verknuepfen' && eingabe.benutzerId === null) {
    return { art: 'abgewiesen', ort: '/?google=d' };
  }
  const state = zufall();
  const nonce = zufall();
  const verifier = zufall();
  const schluessel = zufall();
  ablage.set(schluessel, {
    art: 'fluss',
    state,
    nonce,
    verifier,
    zweck: eingabe.zweck,
    benutzerId: eingabe.benutzerId,
    weiterleitung: eingabe.weiterleitung,
    ablauf: uhr() + ALTER_MS,
  });
  const parameter = new URLSearchParams({
    client_id: konfig.clientId,
    redirect_uri: eingabe.weiterleitung,
    response_type: 'code',
    scope: 'openid email',
    state,
    nonce,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: 'S256',
  });
  return {
    art: 'weiter',
    ort: `${GOOGLE_AUTH}?${parameter.toString()}`,
    cookie: googleCookie(schluessel, eingabe.sicher),
  };
}

export interface GoogleFluss {
  state: string;
  nonce: string;
  verifier: string;
  zweck: 'anmelden' | 'verknuepfen';
  benutzerId: number | null;
  weiterleitung: string;
}

export function liesFluss(schluessel: string | undefined): GoogleFluss | null {
  const eintrag = lies(schluessel);
  if (!eintrag || eintrag.art !== 'fluss') {
    return null;
  }
  return {
    state: eintrag.state,
    nonce: eintrag.nonce,
    verifier: eintrag.verifier,
    zweck: eintrag.zweck,
    benutzerId: eintrag.benutzerId,
    weiterleitung: eintrag.weiterleitung,
  };
}

export function vergissGoogleSchluessel(schluessel: string | undefined): void {
  if (schluessel) {
    ablage.delete(schluessel);
  }
}

export function legeAnlageCookie(sub: string, email: string, sicher: boolean): string {
  const neu = zufall();
  ablage.set(neu, { art: 'anlage', sub, email, ablauf: uhr() + ALTER_MS });
  return googleCookie(neu, sicher);
}

export function googleJetzt(): number {
  return uhr();
}

export function googleGleich(links: string, rechts: string): boolean {
  return gleich(links, rechts);
}

export function googleDatenbank(): DatabaseSync {
  return hole();
}
