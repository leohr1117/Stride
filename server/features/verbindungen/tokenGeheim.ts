import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import path from 'node:path';
import { SATZ_BETREIBER } from '../../../shared/verbindungsFehler.ts';
import { inTransaktion, mitWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { strideVariable } from '../../umgebung.ts';
import { leseWert, setzeWert } from './gemeinsam.ts';

const PRAEFIX = 'v1.';
const IV_LAENGE = 12;
const TAG_LAENGE = 16;
const SCHLUESSEL_LAENGE = 32;
const TOKEN_NAME = 'todoistToken';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const LOG_FEHLT =
  'Neue Todoist-Verbindungen sind nicht möglich. Vorhandene Tokens liegen unverschlüsselt.';
export const LOG_UNGUELTIG = 'STRIDE_TOKEN_SCHLUESSEL ist ungültig (32 Byte Base64 erwartet)';

export type SchluesselZustand = 'fehlt' | 'ungueltig' | 'gesetzt';

export type TokenLage =
  | { art: 'keiner' }
  | { art: 'klar' }
  | { art: 'unlesbar'; grund: 'kein-schluessel' | 'falsch' };

function dekodiere(roh: string): Buffer | null {
  const text = roh.trim();
  if (text.length === 0 || text.length % 4 !== 0 || !BASE64.test(text)) {
    return null;
  }
  const puffer = Buffer.from(text, 'base64');
  if (puffer.length !== SCHLUESSEL_LAENGE || puffer.toString('base64') !== text) {
    return null;
  }
  return puffer;
}

export function schluesselZustand(env: NodeJS.ProcessEnv = process.env): SchluesselZustand {
  const roh = strideVariable('TOKEN_SCHLUESSEL', env);
  if (roh === undefined) {
    return 'fehlt';
  }
  return dekodiere(roh) ? 'gesetzt' : 'ungueltig';
}

export function schluesselBrauchbar(env: NodeJS.ProcessEnv = process.env): boolean {
  return schluesselZustand(env) === 'gesetzt';
}

function schluesselBytes(): Buffer {
  const roh = strideVariable('TOKEN_SCHLUESSEL');
  if (roh === undefined) {
    throw new Error('Schluessel fehlt');
  }
  const puffer = dekodiere(roh);
  if (!puffer) {
    throw new Error('Schluessel ungueltig');
  }
  return puffer;
}

export function verlangeSchluessel(): void {
  if (!schluesselBrauchbar()) {
    throw new AppFehler(404, 'Auf diesem Server ist Todoist nicht eingerichtet. Der Betreiber muss es freischalten.');
  }
}

export function packeToken(klartext: string): string {
  const iv = randomBytes(IV_LAENGE);
  const cipher = createCipheriv('aes-256-gcm', schluesselBytes(), iv);
  const geheim = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LAENGE) {
    throw new Error('Paket ungueltig');
  }
  return PRAEFIX + Buffer.concat([iv, tag, geheim]).toString('base64');
}

export function entpackeToken(paket: string): string {
  if (!paket.startsWith(PRAEFIX)) {
    throw new Error('Paket ungueltig');
  }
  const text = paket.slice(PRAEFIX.length);
  if (!BASE64.test(text) || text.length % 4 !== 0) {
    throw new Error('Paket ungueltig');
  }
  const roh = Buffer.from(text, 'base64');
  if (roh.length < IV_LAENGE + TAG_LAENGE || roh.toString('base64') !== text) {
    throw new Error('Paket ungueltig');
  }
  const iv = roh.subarray(0, IV_LAENGE);
  const tag = roh.subarray(IV_LAENGE, IV_LAENGE + TAG_LAENGE);
  const geheim = roh.subarray(IV_LAENGE + TAG_LAENGE);
  try {
    const decipher = createDecipheriv('aes-256-gcm', schluesselBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(geheim), decipher.final()]).toString('utf8');
  } catch (fehler) {
    if (fehler instanceof Error && (fehler.message === 'Schluessel fehlt' || fehler.message === 'Schluessel ungueltig')) {
      throw fehler;
    }
    throw new Error('Paket ungueltig');
  }
}

export function liesToken(gespeichert: string | null): TokenLage {
  if (gespeichert === null) {
    return { art: 'keiner' };
  }
  if (!gespeichert.startsWith(PRAEFIX)) {
    return { art: 'klar' };
  }
  if (!schluesselBrauchbar()) {
    return { art: 'unlesbar', grund: 'kein-schluessel' };
  }
  try {
    entpackeToken(gespeichert);
    return { art: 'klar' };
  } catch {
    return { art: 'unlesbar', grund: 'falsch' };
  }
}

export function tokenFuerAufruf(gespeichert: string): string {
  if (!gespeichert.startsWith(PRAEFIX)) {
    return gespeichert;
  }
  if (!schluesselBrauchbar()) {
    throw new AppFehler(400, SATZ_BETREIBER, 'schluessel');
  }
  try {
    return entpackeToken(gespeichert);
  } catch {
    throw new AppFehler(400, 'Der gespeicherte Token ist nicht mehr lesbar. Gib ihn neu ein.', 'schluessel');
  }
}

function weltId(pfad: string): string {
  const name = path.basename(pfad);
  if (name.length > 3 && name.toLowerCase().endsWith('.db')) {
    return name.slice(0, -3);
  }
  return name.length > 0 ? name : 'unbekannt';
}

function packeKlartextDerWelt(): number {
  const wert = leseWert(TOKEN_NAME);
  if (wert === null || wert.startsWith(PRAEFIX)) {
    return 0;
  }
  setzeWert(TOKEN_NAME, packeToken(wert));
  return 1;
}

export function meldeTokenSchluessel(warnung: (text: string) => void): void {
  const zustand = schluesselZustand();
  if (zustand === 'fehlt') {
    warnung(LOG_FEHLT);
  } else if (zustand === 'ungueltig') {
    warnung(LOG_UNGUELTIG);
  }
}

export function verschluesseleVorhandeneTodoistTokens(
  welten: () => readonly string[],
  warnung: (text: string) => void,
): { tokens: number; welten: number } {
  if (!schluesselBrauchbar()) {
    return { tokens: 0, welten: 0 };
  }
  let pfade: readonly string[];
  try {
    pfade = welten();
  } catch {
    warnung('Die Todoist-Tokens konnten nicht verschlüsselt werden.');
    console.log('Todoist-Tokens verschlüsselt: 0 (Welten: 0)');
    return { tokens: 0, welten: 0 };
  }
  let tokens = 0;
  for (const pfad of pfade) {
    try {
      tokens += mitWelt(pfad, () => inTransaktion(packeKlartextDerWelt));
    } catch {
      warnung(`Todoist-Token der Welt ${weltId(pfad)} konnte nicht verschlüsselt werden.`);
    }
  }
  console.log(`Todoist-Tokens verschlüsselt: ${tokens} (Welten: ${pfade.length})`);
  return { tokens, welten: pfade.length };
}
