import { strideVariable } from '../../umgebung.ts';
import { HINWEIS_SCHLUESSEL, type HinweisSchluessel } from '../../../shared/spiel/hinweis.ts';
import { ausfuehren, eine } from '../../db.ts';

const RUHE_VON_STANDARD = '22:00';
const RUHE_BIS_STANDARD = '08:00';
const ANGEBOT_GESEHEN = 'gesehen';
const NICHT_VOR_MS = 60_000;
const UHR = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const SCHALTER = {
  streak: HINWEIS_SCHLUESSEL.streak,
  rueckkehr: HINWEIS_SCHLUESSEL.rueckkehr,
  boss: HINWEIS_SCHLUESSEL.boss,
} as const;

export type HinweisSchalter = Record<keyof typeof SCHALTER, boolean>;

function speichere(schluessel: HinweisSchluessel, wert: unknown): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

function loesche(schluessel: HinweisSchluessel): void {
  ausfuehren('DELETE FROM einstellungen WHERE schluessel = ?', schluessel);
}

function rohwert(schluessel: HinweisSchluessel): string | undefined {
  return eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel)?.wert;
}

function leseJson(schluessel: HinweisSchluessel): unknown {
  const roh = rohwert(schluessel);
  if (roh === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(roh) as unknown;
  } catch {
    return undefined;
  }
}

function leseBool(schluessel: HinweisSchluessel): boolean {
  return leseJson(schluessel) === true;
}

function leseUhr(schluessel: HinweisSchluessel, standard: string): string {
  const wert = leseJson(schluessel);
  return typeof wert === 'string' && UHR.test(wert) ? wert : standard;
}

export function leseHinweisRuhe(): { von: string; bis: string } {
  return {
    von: leseUhr(HINWEIS_SCHLUESSEL.ruheVon, RUHE_VON_STANDARD),
    bis: leseUhr(HINWEIS_SCHLUESSEL.ruheBis, RUHE_BIS_STANDARD),
  };
}

export function leseHinweisSchalter(): HinweisSchalter {
  return {
    streak: leseBool(SCHALTER.streak),
    rueckkehr: leseBool(SCHALTER.rueckkehr),
    boss: leseBool(SCHALTER.boss),
  };
}

export function leseHinweisAngebotGesehen(): boolean {
  return leseJson(HINWEIS_SCHLUESSEL.angebot) === ANGEBOT_GESEHEN;
}

export function leseHinweisNichtVor(): string | null {
  const wert = leseJson(HINWEIS_SCHLUESSEL.nichtVor);
  return typeof wert === 'string' && ISO_ZEIT.test(wert) ? wert : null;
}

export function leseHinweisAngebotTesten(): boolean {
  return leseBool(HINWEIS_SCHLUESSEL.angebotTesten);
}

export function schreibeHinweisRuhe(von: string, bis: string): void {
  if (!UHR.test(von) || !UHR.test(bis)) {
    return;
  }
  speichere(HINWEIS_SCHLUESSEL.ruheVon, von);
  speichere(HINWEIS_SCHLUESSEL.ruheBis, bis);
}

export function schreibeHinweisSchalter(teil: Partial<HinweisSchalter>): void {
  for (const art of Object.keys(SCHALTER) as (keyof typeof SCHALTER)[]) {
    const wert = teil[art];
    if (typeof wert === 'boolean') {
      speichere(SCHALTER[art], wert);
    }
  }
}

export function schreibeHinweisAngebotGesehen(): void {
  speichere(HINWEIS_SCHLUESSEL.angebot, ANGEBOT_GESEHEN);
}

export function schreibeHinweisAngebotTesten(an: boolean): void {
  if (!an) {
    loesche(HINWEIS_SCHLUESSEL.angebotTesten);
    return;
  }
  if (strideVariable('TEST') !== '1') {
    return;
  }
  speichere(HINWEIS_SCHLUESSEL.angebotTesten, true);
}

export function setzeHinweisNichtVorWennFehlt(jetzt: Date): void {
  if (rohwert(HINWEIS_SCHLUESSEL.nichtVor) !== undefined) {
    return;
  }
  const ziel = new Date(jetzt.getTime() + NICHT_VOR_MS);
  if (Number.isNaN(ziel.getTime())) {
    return;
  }
  speichere(HINWEIS_SCHLUESSEL.nichtVor, ziel.toISOString());
}
