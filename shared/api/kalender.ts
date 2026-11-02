export interface Kalender {
  id: number;
  name: string;
  projektId: number | null;
  vorlageId: number | null;
  filter: string;
  seit: string;
  letzterAbgleich: string | null;
  fehler: string | null;
  uebernommen: number;
}

export interface KalenderDaten {
  name: string;
  adresse: string;
  projektId: number | null;
  vorlageId: number | null;
  filter: string;
}

export type KalenderAenderung = Partial<Omit<KalenderDaten, 'adresse'>>;

export interface KalenderPruefung {
  name: string;
}
