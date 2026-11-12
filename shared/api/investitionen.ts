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
  attributId: number | null;
  attributName: string | null;
  faehigkeitId: number | null;
  faehigkeitName: string | null;
  bezahltAttributId: number | null;
  betrag: number;
  archiviert: boolean;
  loeschbar: boolean;
  erstelltAm: string;
}

export interface InvestitionDaten {
  name: string;
  icon: string;
  groesse: number;
  attributId?: number | null;
  ziel?: InvestitionsZiel | null;
  faehigkeitId?: number | null;
  bezahltAttributId?: number | null;
  betrag?: number;
}

export interface InvestitionAenderung {
  name?: string;
  icon?: string;
  groesse?: number;
  attributId?: number | null;
  ziel?: InvestitionsZiel | null;
  faehigkeitId?: number | null;
  bezahltAttributId?: number | null;
  betrag?: number;
  archiviert?: boolean;
}

export function investitionsZieleGueltig(
  attributId: number | null,
  ziel: InvestitionsZiel | null,
  faehigkeitId: number | null = null,
): boolean {
  if (ziel?.art === 'attribut') {
    return attributId !== null;
  }
  return attributId !== null || ziel !== null || faehigkeitId !== null;
}
