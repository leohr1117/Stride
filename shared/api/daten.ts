export const SICHERUNG_APP = 'ascend';

export type DatenWert = string | number | null;
export type DatenZeile = Record<string, DatenWert>;

export interface DatenExport {
  app: typeof SICHERUNG_APP;
  schemaVersion: number;
  exportiertAm: string;
  tabellen: Record<string, DatenZeile[]>;
}

export interface ImportErgebnis {
  sicherung: string;
  zeilen: number;
}
