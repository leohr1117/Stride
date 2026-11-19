import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strideVariable } from './umgebung.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(WURZEL, 'data');
const WELTEN = path.resolve(DATA, 'welten');
const SPEICHER = ':memory:';

function gleicherOrdner(a: string, b: string): boolean {
  return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
}

function ohneNeben(absolut: string): string {
  return absolut.replace(/-(?:wal|shm|journal)$/i, '');
}

export function istTestlauf(): boolean {
  return process.env.VITEST === 'true' || strideVariable('TEST') === '1';
}

/** Echte Nutzerdaten: Dateien direkt unter data/ oder data/welten/. */
export function istEchteDatenbank(pfad: string): boolean {
  if (pfad === SPEICHER) {
    return false;
  }
  const stamm = ohneNeben(path.resolve(pfad));
  if (!stamm.toLowerCase().endsWith('.db')) {
    return false;
  }
  const ordner = path.dirname(stamm);
  return gleicherOrdner(ordner, DATA) || gleicherOrdner(ordner, WELTEN);
}

/**
 * Bricht ab, wenn der Pfad auf data/*.db oder data/welten/*.db zeigt.
 * Der Rückgabewert ist der aufgelöste Pfad, außer bei :memory:.
 */
export function verweigereEchteDatenbank(pfad: string): string {
  if (pfad === SPEICHER) {
    return pfad;
  }
  const absolut = path.resolve(pfad);
  if (istEchteDatenbank(absolut)) {
    throw new Error(`Abbruch: Dieser Pfad zeigt auf eine echte Datenbank (${absolut}). Tests nutzen eine Kopie.`);
  }
  return absolut;
}

export function sperreEchteDatenbankImTest(pfad: string): void {
  if (!istTestlauf()) {
    return;
  }
  verweigereEchteDatenbank(pfad);
}

/** Diese Namen leeren Tests immer, auch wenn sie in der Umgebung gerade fehlen. */
export const GEERBTE_ZUGANGS_NAMEN = [
  'STRIDE_SMTP_HOST',
  'STRIDE_SMTP_PORT',
  'STRIDE_SMTP_BENUTZER',
  'STRIDE_SMTP_PASSWORT',
  'ASCEND_SMTP_HOST',
  'ASCEND_SMTP_PORT',
  'ASCEND_SMTP_BENUTZER',
  'ASCEND_SMTP_PASSWORT',
  'STRIDE_GOOGLE',
  'ASCEND_GOOGLE',
  'STRIDE_GOOGLE_CLIENT_ID',
  'ASCEND_GOOGLE_CLIENT_ID',
  'STRIDE_GOOGLE_CLIENT_SECRET',
  'ASCEND_GOOGLE_CLIENT_SECRET',
  'STRIDE_REGISTRIERUNG',
  'ASCEND_REGISTRIERUNG',
] as const;

const ZUGANGS_MUSTER = /^(?:STRIDE|ASCEND)_(?:SMTP_|GOOGLE|REGISTRIERUNG)/i;

/** Entfernt SMTP-, Google- und Registrierungsvariablen aus der übergebenen Umgebung. */
export function leereGeerbteZugangsVariablen(env: NodeJS.ProcessEnv = process.env): string[] {
  const namen = new Set<string>(GEERBTE_ZUGANGS_NAMEN);
  for (const name of Object.keys(env)) {
    if (ZUGANGS_MUSTER.test(name)) {
      namen.add(name);
    }
  }
  for (const name of namen) {
    delete env[name];
  }
  return [...namen];
}
