export interface VorlageGewicht {
  attributId: number;
  gewicht: number;
}

export interface Vorlage {
  id: number;
  name: string;
  icon: string;
  archiviert: boolean;
  loeschbar: boolean;
  projektId: number | null;
  projektName: string | null;
  gewichte: VorlageGewicht[];
}

export interface VorlageDaten {
  name: string;
  icon: string;
  gewichte: VorlageGewicht[];
  projektId?: number | null;
}
