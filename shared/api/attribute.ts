import type { AttributKennung, AttributTyp } from '../spiel/begriffe.ts';
import type { VerfallStufe } from '../spiel/belastung.ts';
import type { LevelInfo } from '../spiel/level.ts';

export interface Attribut {
  id: number;
  typ: AttributTyp;
  kennung: AttributKennung | null;
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
  archiviert: boolean;
  loeschbar: boolean;
  level: LevelInfo;
  /** Höchster XP-Stand, den das Attribut je hatte. */
  hoechstXp: number;
  verfallZeit: VerfallStufe;
  erschoepfung: boolean;
  erschoepfungZiel: number | null;
  archivAnteil: number | null;
}

export interface AttributDaten {
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
  verfallZeit: VerfallStufe;
  erschoepfung: boolean;
  erschoepfungZiel: number | null;
}

/** Änderung ohne Namen. Der gespeicherte Name bleibt. */
export type AttributAenderung = Omit<AttributDaten, 'name'>;

export const AKTIVIERUNGS_MODI = ['behalten', 'anteil', 'level'] as const;
export type AktivierungsModus = (typeof AKTIVIERUNGS_MODI)[number];

export interface AttributAktivierung {
  kennung: AttributKennung;
  modus: AktivierungsModus;
  level: number | null;
}

export interface Erschoepfung {
  attributId: number;
  faktor: number;
  zielId: number | null;
  zielName: string | null;
}
