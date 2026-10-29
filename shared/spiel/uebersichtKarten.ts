import { istAn, type Schalter, type Sichtbarkeit } from './sichtbarkeit.ts';

export const UEBERSICHT_KARTEN_IDS = [
  'identitaet',
  'bosse',
  'comeback',
  'basis',
  'werte',
  'aktivitaet',
] as const;

export type UebersichtKarteId = (typeof UEBERSICHT_KARTEN_IDS)[number];

export interface UebersichtKarte {
  id: UebersichtKarteId;
  label: string;
  regel: string;
  info: string;
}

export type UebersichtKartenWahl = Record<UebersichtKarteId, boolean>;

/** Fehlende, unbekannte oder kaputte Einträge zählen als an. Nur `false` blendet aus. */
export function kartenWahl(roh: unknown): UebersichtKartenWahl {
  const quelle =
    typeof roh === 'object' && roh !== null && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
  const wahl = {} as UebersichtKartenWahl;
  for (const id of UEBERSICHT_KARTEN_IDS) {
    wahl[id] = quelle[id] !== false;
  }
  return wahl;
}

export function karteGewaehlt(id: UebersichtKarteId, wahl: Partial<UebersichtKartenWahl> | undefined): boolean {
  return wahl?.[id] !== false;
}

const KARTE_BEREICH: Partial<Record<UebersichtKarteId, Schalter | readonly Schalter[]>> = {
  bosse: 'bossAngriffe',
  comeback: 'vorhaben',
  basis: 'basis',
  werte: ['koennen', 'status'],
};

/** Zeile in S34 nur, wenn der Bereich an ist (11.2 d). */
export function karteSichtbar(id: UebersichtKarteId, sichtbarkeit: Sichtbarkeit): boolean {
  const bedarf = KARTE_BEREICH[id];
  if (bedarf === undefined) {
    return true;
  }
  if (typeof bedarf === 'string') {
    return istAn(bedarf, sichtbarkeit);
  }
  return bedarf.some((schalter) => istAn(schalter, sichtbarkeit));
}

/** Karten der Übersicht, in der Reihenfolge auf der Startseite. Die Willkommenskarte entfällt. */
export const UEBERSICHT_KARTEN: readonly UebersichtKarte[] = [
  {
    id: 'identitaet',
    label: 'Identität',
    regel: 'Immer',
    info: 'Name, Level, Woche, Streak und Momentum.',
  },
  {
    id: 'bosse',
    label: 'Bosse',
    regel: 'Bosse an',
    info: 'Solange ein Boss angreift.',
  },
  {
    id: 'comeback',
    label: 'Zurück aufstehen',
    regel: 'Vorhaben an',
    info: 'Nur wenn ein Vorhaben neu starten kann.',
  },
  {
    id: 'basis',
    label: 'Basis',
    regel: 'Basis an',
    info: 'Tägliche Aufgaben zum Abhaken.',
  },
  {
    id: 'werte',
    label: 'Werte',
    regel: 'Können oder Haben',
    info: 'Haben steht direkt darunter.',
  },
  {
    id: 'aktivitaet',
    label: 'Aktivität',
    regel: 'Immer',
    info: 'XP je Tag.',
  },
];
