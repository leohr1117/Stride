import fs from 'node:fs';
import path from 'node:path';
import { istTestlauf, verweigereEchteDatenbank } from './testpfad.ts';
import { strideVariable } from './umgebung.ts';

const PROJEKT_WURZEL = path.resolve(import.meta.dirname, '..');
export const BAU_CLIENT_PFAD = path.join(PROJEKT_WURZEL, 'client', 'dist');
export const LIVE_CLIENT_PFAD = path.join(PROJEKT_WURZEL, 'client', 'dist-live');
const STANDARD_PORT = 3000;
const ECHTE_DATENBANK = path.join(PROJEKT_WURZEL, 'data', 'app.db');

function datenbankPfadAufloesen(): string {
  const gesetzt = process.env.DB_PFAD;
  if (istTestlauf()) {
    if (!gesetzt) {
      throw new Error('Abbruch: Tests brauchen DB_PFAD auf eine Kopie. Echte Dateien unter data/ sind gesperrt.');
    }
    return verweigereEchteDatenbank(gesetzt);
  }
  return gesetzt ?? ECHTE_DATENBANK;
}

const datenbankPfad = datenbankPfadAufloesen();

function zugangPfadAufloesen(): string {
  const standard = path.join(path.dirname(datenbankPfad), 'zugang.db');
  const gesetzt = process.env.ZUGANG_PFAD ?? standard;
  if (istTestlauf()) {
    return verweigereEchteDatenbank(gesetzt);
  }
  return gesetzt;
}

function sauber(wert: string | undefined): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

function aufloesen(wert: string): string {
  return path.isAbsolute(wert) ? path.normalize(wert) : path.resolve(PROJEKT_WURZEL, wert);
}

function gleicherPfad(a: string, b: string): boolean {
  return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
}

export function clientPfadAus(env: NodeJS.ProcessEnv = process.env): string {
  const gewaehlt = sauber(strideVariable('CLIENT_DIR', env));
  const wert = gewaehlt.length > 0 ? gewaehlt : sauber(env.ASCEND_CLIENT_DIR);
  return wert.length > 0 ? aufloesen(wert) : LIVE_CLIENT_PFAD;
}

function lesePort(wert: string | undefined): number {
  if (wert === undefined || wert === '') {
    return STANDARD_PORT;
  }
  const port = Number(wert);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Ungültiger PORT "${wert}". Erlaubt sind ganze Zahlen von 1 bis 65535.`);
  }
  return port;
}

export const KONFIG = {
  port: lesePort(process.env.PORT),
  host: '127.0.0.1',
  logLevel: process.env.LOG_LEVEL ?? 'warn',
  datenbankPfad,
  zugangPfad: zugangPfadAufloesen(),
  clientPfad: clientPfadAus(),
  todoistApi: process.env.TODOIST_API ?? 'https://api.todoist.com/api/v1/',
} as const;

function hatIndex(ordner: string): boolean {
  return fs.existsSync(path.join(ordner, 'index.html'));
}

export function kopiereDistInLeerenOrdner(ziel: string, quelle: string): boolean {
  if (gleicherPfad(ziel, quelle) || hatIndex(ziel) || !hatIndex(quelle)) {
    return false;
  }
  fs.cpSync(quelle, ziel, { recursive: true });
  return true;
}

export function stelleLiveClientBereit(
  ziel = KONFIG.clientPfad,
  quelle = BAU_CLIENT_PFAD,
  livePfad = LIVE_CLIENT_PFAD,
  testlauf = istTestlauf(),
): boolean {
  if (testlauf || !gleicherPfad(ziel, livePfad)) {
    return false;
  }
  return kopiereDistInLeerenOrdner(ziel, quelle);
}

export interface VapidZumSenden {
  oeffentlich: string;
  privat: string;
  betreff: string;
}

function vapidRoh(env: NodeJS.ProcessEnv, name: string): string | null {
  const wert = env[name];
  if (typeof wert !== 'string') {
    return null;
  }
  const sauber = wert.trim();
  return sauber.length > 0 ? sauber : null;
}

function betreffGueltig(wert: string): boolean {
  return /^mailto:\S+$/i.test(wert) || /^https:\/\/\S+$/i.test(wert);
}

/**
 * Liest VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT.
 * Der private Schlüssel liegt nicht an KONFIG, damit ein Log der Konfiguration ihn nicht mitnimmt.
 * Fehlt ein Wert oder ist der Betreff kein mailto: und kein https:, ist das Ergebnis null.
 */
export function leseVapid(env: NodeJS.ProcessEnv = process.env): VapidZumSenden | null {
  const oeffentlich = vapidRoh(env, 'VAPID_PUBLIC_KEY');
  const privat = vapidRoh(env, 'VAPID_PRIVATE_KEY');
  const betreff = vapidRoh(env, 'VAPID_SUBJECT');
  if (oeffentlich === null || privat === null || betreff === null || !betreffGueltig(betreff)) {
    return null;
  }
  return { oeffentlich, privat, betreff };
}

export function oeffentlicherVapidSchluessel(env: NodeJS.ProcessEnv = process.env): string | null {
  return leseVapid(env)?.oeffentlich ?? null;
}
