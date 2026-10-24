import type { LevelInfo } from '../spiel/level.ts';
import type { Belohnung } from './belohnung.ts';

export interface SkillKnoten {
  id: number;
  elternId: number | null;
  titel: string;
  beschreibung: string;
  freigeschaltetAm: string | null;
  xp: number;
  loeschbar: boolean;
}

export interface SkillKnotenDaten {
  titel: string;
  beschreibung: string;
  elternId: number | null;
}

export interface Faehigkeit {
  id: number;
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
  archiviert: boolean;
  loeschbar: boolean;
  level: LevelInfo;
  stufe: string;
  anzahlEintraege: number;
  knoten: SkillKnoten[];
}

export interface FaehigkeitDaten {
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
}

export interface SkillErgebnis {
  faehigkeit: Faehigkeit;
  belohnung: Belohnung;
}
