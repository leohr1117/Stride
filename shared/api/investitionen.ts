export const INVESTITIONS_ARTEN = ['vision', 'projekt', 'attribut'] as const;
export type InvestitionsArt = (typeof INVESTITIONS_ARTEN)[number];

export interface InvestitionsZiel {
  art: InvestitionsArt;
  id: number;
}

export interface Investition {
  id: number;
  name: string;
  icon: string;
  groesse: number;
  bonus: number;
  ziel: InvestitionsZiel | null;
  zielName: string | null;
  attributId: number;
  attributName: string;
  archiviert: boolean;
  loeschbar: boolean;
  erstelltAm: string;
}

export interface InvestitionDaten {
  name: string;
  icon: string;
  groesse: number;
  attributId: number;
  ziel?: InvestitionsZiel | null;
}

export interface InvestitionAenderung {
  name?: string;
  icon?: string;
  groesse?: number;
  attributId?: number;
  ziel?: InvestitionsZiel | null;
  archiviert?: boolean;
}
