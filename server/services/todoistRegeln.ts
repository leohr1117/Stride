import { GRENZEN } from '../../shared/spiel/begriffe.ts';

/** Nachts, Stunde inklusive 23 bis exklusive 6, Ortszeit des Nutzers. */
export const NACHT_VON = 23;
export const NACHT_BIS = 6;
export const NACHT_INTERVALL_MS = 3 * 60 * 60 * 1000;

export type ZielArt = 'vision' | 'projekt' | 'vorhaben';
export type RegelAbschluss = 'geschafft' | 'gescheitert' | 'offen';

export interface TodoistDauer {
  amount: number;
  unit: 'minute' | 'day';
}

/** null bei Tätigkeit und Ziel heißt: diese Quelle ersetzt nichts. 0 und „offen“ leeren den Wert, wenn die Quelle gewinnt. */
export interface RegelQuelle {
  zielArt: ZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: RegelAbschluss | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean | null;
}

export interface RegelErgebnis {
  zielArt: ZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: 'geschafft' | 'gescheitert' | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: boolean;
}

export function istNachtstunde(stunde: number): boolean {
  return stunde >= NACHT_VON || stunde < NACHT_BIS;
}

export function stundeInZone(jetzt: Date, zone: string): number | null {
  try {
    const teile = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(jetzt);
    const wert = Number(teile.find((teil) => teil.type === 'hour')?.value);
    if (!Number.isInteger(wert)) {
      return null;
    }
    return wert === 24 ? 0 : wert;
  } catch {
    return null;
  }
}

/** Tagsüber immer. Nachts nur, wenn der letzte Abgleich fehlt oder mindestens drei Stunden her ist. Ungültige Zone bremst nicht. */
export function istTodoistFaellig(jetzt: Date, zone: string | null, letzterIso: string | null): boolean {
  const stunde = zone ? stundeInZone(jetzt, zone) : null;
  if (stunde === null || !istNachtstunde(stunde)) {
    return true;
  }
  if (!letzterIso) {
    return true;
  }
  const letzter = new Date(letzterIso);
  if (Number.isNaN(letzter.getTime())) {
    return true;
  }
  return jetzt.getTime() - letzter.getTime() >= NACHT_INTERVALL_MS;
}

export function stundenAusDauer(dauer: TodoistDauer | null | undefined): number | null {
  if (!dauer || !Number.isFinite(dauer.amount) || dauer.amount <= 0) {
    return null;
  }
  const stunden = dauer.unit === 'day' ? dauer.amount * 24 : dauer.amount / 60;
  const gerundet = Math.round(stunden * 100) / 100;
  if (gerundet < GRENZEN.stundenMin) {
    return GRENZEN.stundenMin;
  }
  return Math.min(GRENZEN.stundenMax, gerundet);
}

export function notizFuerEintrag(aufgabe: string, regel: string): string {
  const teile = [aufgabe.trim(), regel.trim()].filter((teil) => teil !== '');
  return teile.join('\n').slice(0, GRENZEN.notizMax);
}

function hatWahl(regel: RegelQuelle): boolean {
  return regel.vorlageId !== null || (regel.zielArt !== null && regel.zielId !== null);
}

function leeresErgebnis(): RegelErgebnis {
  return {
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId: null,
    stunden: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    notiz: '',
    meilenstein: false,
  };
}

function ausQuelle(regel: RegelQuelle): RegelErgebnis {
  const hatZiel = regel.zielArt !== null && regel.zielId !== null;
  const abschluss = regel.abschluss === 'geschafft' || regel.abschluss === 'gescheitert' ? regel.abschluss : null;
  return {
    zielArt: hatZiel ? regel.zielArt : null,
    zielId: hatZiel ? regel.zielId : null,
    projektId: hatZiel ? regel.projektId : null,
    vorlageId: regel.vorlageId,
    stunden: regel.stunden === null || regel.stunden === 0 ? null : regel.stunden,
    faehigkeitId: regel.faehigkeitId === null || regel.faehigkeitId === 0 ? null : regel.faehigkeitId,
    abschluss,
    erkenntnis: regel.erkenntnis.trim(),
    notiz: regel.notiz.trim(),
    meilenstein: regel.meilenstein === true,
  };
}

/** Das oberste Label mit Tätigkeit oder Ziel ersetzt das Projekt ganz. Sonst gilt das Projekt, wenn es selbst eines von beiden hat. */
export function fuehreRegelnZusammen(labels: RegelQuelle[], basis: RegelQuelle | null): RegelErgebnis {
  const gewinner = labels.find(hatWahl) ?? (basis !== null && hatWahl(basis) ? basis : null);
  return gewinner === null ? leeresErgebnis() : ausQuelle(gewinner);
}
