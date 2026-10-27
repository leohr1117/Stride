export const MEHR_BEREICH_IDS = [
  'profil',
  'taetigkeiten',
  'darstellung',
  'uebersicht',
  'app',
  'benachrichtigungen',
  'daten',
] as const;

export type MehrBereichId = (typeof MEHR_BEREICH_IDS)[number];

export interface MehrBereich {
  id: MehrBereichId;
  pfad: string;
  label: string;
  /** Sichtbare Kachel. Benachrichtigungen bleibt aus, bis die Seite da ist. */
  sichtbar: boolean;
}

/** Reihenfolge auf Mehr. Benachrichtigungen liegt fest zwischen App und Daten. */
export const MEHR_BEREICHE: readonly MehrBereich[] = [
  { id: 'profil', pfad: '/mehr/profil', label: 'Profil', sichtbar: true },
  { id: 'taetigkeiten', pfad: '/mehr/inhalte', label: 'Tätigkeiten', sichtbar: true },
  { id: 'darstellung', pfad: '/mehr/darstellung', label: 'Darstellung', sichtbar: true },
  { id: 'uebersicht', pfad: '/mehr/uebersicht', label: 'Übersicht', sichtbar: true },
  { id: 'app', pfad: '/mehr/funktionen', label: 'App & Verbindungen', sichtbar: true },
  { id: 'benachrichtigungen', pfad: '/mehr/benachrichtigungen', label: 'Benachrichtigungen', sichtbar: false },
  { id: 'daten', pfad: '/mehr/daten', label: 'Daten', sichtbar: true },
];

export function sichtbareMehrBereiche(): readonly MehrBereich[] {
  return MEHR_BEREICHE.filter((bereich) => bereich.sichtbar);
}
