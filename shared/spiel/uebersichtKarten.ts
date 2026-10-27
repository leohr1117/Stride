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
  /** Sprung zur bestehenden Einstellung. Die Karte selbst hat keinen zweiten Schalter. */
  nach?: string;
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
    nach: '/mehr/funktionen#funktion-bossAngriffe',
  },
  {
    id: 'comeback',
    label: 'Zurück aufstehen',
    regel: 'Vorhaben an',
    info: 'Nur wenn ein Vorhaben neu starten kann.',
    nach: '/mehr/funktionen#ziel-stufen',
  },
  {
    id: 'basis',
    label: 'Basis',
    regel: 'Basis an',
    info: 'Tägliche Aufgaben zum Abhaken.',
    nach: '/mehr/funktionen#funktion-basis',
  },
  {
    id: 'werte',
    label: 'Werte',
    regel: 'Können oder Haben',
    info: 'Haben steht direkt darunter.',
    nach: '/mehr/funktionen#funktion-koennen',
  },
  {
    id: 'aktivitaet',
    label: 'Aktivität',
    regel: 'Immer',
    info: 'XP je Tag.',
  },
];
