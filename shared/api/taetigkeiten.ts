export interface VorlageGewicht {
  attributId: number;
  gewicht: number;
}

export interface VorlageAbzug {
  attributId: number;
  prozent: number;
}

export interface Vorlage {
  id: number;
  name: string;
  icon: string;
  archiviert: boolean;
  loeschbar: boolean;
  projektId: number | null;
  projektName: string | null;
  festeAnteile: boolean;
  gewichte: VorlageGewicht[];
  abzuege: VorlageAbzug[];
}

export interface VorlageDaten {
  name: string;
  icon: string;
  gewichte: VorlageGewicht[];
  projektId?: number | null;
  festeAnteile?: boolean;
  abzuege?: VorlageAbzug[];
}
