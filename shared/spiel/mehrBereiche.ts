export const MEHR_BEREICH_IDS = [
  'konto',
  'verbindungen',
  'bereiche',
  'karten',
  'darstellung',
  'benachrichtigungen',
  'daten',
] as const;

export type MehrBereichId = (typeof MEHR_BEREICH_IDS)[number];

export interface MehrBereich {
  id: MehrBereichId;
  pfad: string;
  label: string;
  /** Sichtbare Zeile unter Einstellungen. */
  sichtbar: boolean;
}

/** Reihenfolge der Einstellungen unter Mehr. Tätigkeiten steht im Seitenverzeichnis. */
export const MEHR_BEREICHE: readonly MehrBereich[] = [
  { id: 'konto', pfad: '/mehr/profil', label: 'Konto', sichtbar: true },
  { id: 'verbindungen', pfad: '/mehr/inhalte/verbindungen', label: 'Verbindungen', sichtbar: true },
  { id: 'bereiche', pfad: '/mehr/funktionen', label: 'Bereiche', sichtbar: true },
  { id: 'karten', pfad: '/mehr/uebersicht', label: 'Karten auf Heute', sichtbar: true },
  { id: 'darstellung', pfad: '/mehr/darstellung', label: 'Darstellung', sichtbar: true },
  { id: 'benachrichtigungen', pfad: '/mehr/benachrichtigungen', label: 'Benachrichtigungen', sichtbar: true },
  { id: 'daten', pfad: '/mehr/daten', label: 'Daten', sichtbar: true },
];

export function sichtbareMehrBereiche(): readonly MehrBereich[] {
  return MEHR_BEREICHE.filter((bereich) => bereich.sichtbar);
}
