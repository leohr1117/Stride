import type { ErfolgKennzahl } from '../spiel/erfolge.ts';

export interface ErfolgStufe {
  schluessel: string;
  name: string;
  schwelle: number;
  erreichtAm: string | null;
}

export interface ErfolgKategorie {
  kennzahl: ErfolgKennzahl;
  label: string;
  wert: number;
  stufen: ErfolgStufe[];
}

export interface Erfolge {
  kategorien: ErfolgKategorie[];
  titel: string | null;
}
