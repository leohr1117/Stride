export interface BasisAufgabe {
  id: number;
  name: string;
  icon: string;
  projektId: number | null;
  projektName: string | null;
  farbe: string;
  vorlageId: number | null;
  stunden: number | null;
  archiviert: boolean;
  loeschbar: boolean;
  anzahl: number;
  heuteEintragId: number | null;
}

export interface BasisAufgabeDaten {
  name: string;
  icon: string;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
}
