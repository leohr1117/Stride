export type RechtBlock =
  | { art: 'h'; text: string }
  | { art: 'p'; text: string }
  | { art: 'liste'; punkte: readonly string[] }
  | { art: 'quelle' };

export type RechtId = 'impressum' | 'datenschutz' | 'nutzung' | 'lizenzen';

export interface RechtSeite {
  id: RechtId;
  pfad: string;
  titel: string;
}
