import type { KettenStand } from '../spiel/kette.ts';
import type { LevelInfo } from '../spiel/level.ts';
import type { Attribut, Erschoepfung } from './attribute.ts';
import type { VorhabenMitProjekt } from './ziele.ts';

export interface HeatmapTag {
  datum: string;
  xp: number;
}

export interface Identitaet {
  name: string;
  klasse: string;
  titel: string | null;
}

export interface Uebersicht extends Identitaet {
  level: LevelInfo;
  attribute: Attribut[];
  status: Attribut[];
  momentum: number;
  erschoepfungen: Erschoepfung[];
  serie: KettenStand;
  wocheXp: number;
  comebacks: VorhabenMitProjekt[];
  angriffe: VorhabenMitProjekt[];
  heatmap: HeatmapTag[];
}

export interface Charakter extends Identitaet {
  level: LevelInfo;
  attribute: Attribut[];
  status: Attribut[];
  erschoepfungen: Erschoepfung[];
  statistik: {
    eintraegeGesamt: number;
    meilensteine: number;
    vorhabenGeschafft: number;
    aktiveTage: number;
  };
}
