import type { AttributTyp } from '../spiel/begriffe.ts';
import type { Multiplikator } from '../spiel/xp.ts';

export interface XpAnteilMitName {
  attributId: number;
  typ: AttributTyp;
  name: string;
  farbe: string;
  xp: number;
}

export const BONUS_QUELLEN = [
  'bestaendigkeit',
  'weitermachen',
  'anlauf',
  'rueckkehr',
  'meilenstein',
  'comeback',
  'knoten',
  'basis',
  'beute',
  'rueckblick',
  'vision',
  'abschluss',
] as const;
export type BonusQuelle = (typeof BONUS_QUELLEN)[number];

export interface Bonus {
  quelle: BonusQuelle;
  label: string;
  xp: number;
}

export interface LevelAufstieg {
  art: 'charakter' | 'attribut' | 'status' | 'projekt' | 'organisation' | 'faehigkeit';
  name: string;
  farbe: string | null;
  vorher: number;
  nachher: number;
}

export interface Belohnung {
  xp: number;
  meilenstein: boolean;
  anteile: XpAnteilMitName[];
  projekt: { name: string; xp: number } | null;
  faehigkeit: { name: string; xp: number } | null;
  boss: { titel: string; level: number; kampfXp: number } | null;
  multiplikatoren: Multiplikator[];
  boni: Bonus[];
  aufstiege: LevelAufstieg[];
  erfolge: string[];
}
