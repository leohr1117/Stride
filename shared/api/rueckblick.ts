import type { Belohnung } from './belohnung.ts';

export interface RueckblickAntworten {
  gut: string;
  lernen: string;
  fokus: string;
}

export interface Rueckblick {
  woche: string;
  wocheBis: string;
  aktuelleWoche: boolean;
  xp: number;
  xpVorwoche: number;
  eintraege: number;
  aktiveTage: number;
  besterTag: { datum: string; xp: number } | null;
  attribute: { attributId: number; name: string; farbe: string; xp: number }[];
  meilensteine: { titel: string; projektName: string | null }[];
  erfolge: string[];
  antworten: RueckblickAntworten;
  belohnt: boolean;
  bonusMoeglich: boolean;
}

export interface RueckblickErgebnis {
  rueckblick: Rueckblick;
  belohnung: Belohnung | null;
}
