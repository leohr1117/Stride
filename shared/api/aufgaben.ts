import type { Wiederholung } from '../spiel/aufgabe.ts';

export interface Aufgabe {
  id: number;
  name: string;
  icon: 'clipboard-list';
  projektId: number | null;
  projektName: string | null;
  farbe: string;
  organisationId: number | null;
  organisationName: string | null;
  visionId: number | null;
  visionTitel: string | null;
  vorlageId: number | null;
  vorlageName: string;
  vorlageIcon: string;
  stunden: number | null;
  faelligAm: string | null;
  faelligUm: string | null;
  wiederholung: Wiederholung;
  wochentage: number[];
  monatstag: number | null;
  prioritaet: number | null;
  nurHeuteAm: string | null;
  meilenstein: boolean;
  gegner: boolean;
  boss: boolean;
  deadline: string | null;
  erstelltAm: string;
  archiviert: boolean;
  loeschbar: boolean;
  heuteEintragId: number | null;
}

export interface AufgabeDaten {
  name: string;
  icon: 'clipboard-list';
  projektId: number | null;
  organisationId: number | null;
  visionId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faelligAm: string | null;
  faelligUm: string | null;
  wiederholung: Wiederholung;
  wochentage: number[];
  prioritaet: number | null;
  nurHeute: boolean;
  meilenstein: boolean;
  gegner: boolean;
  boss: boolean;
  deadline: string | null;
}
