import type { BestwertArt, UebungsArt } from '../spiel/training.ts';

export interface TrainingsplanUebung {
  id: number;
  uebungId: number;
  name: string;
  art: UebungsArt;
  zielSaetze: number | null;
  zielWiederholungen: number | null;
  zielGewichtG: number | null;
  zielSekunden: number | null;
  aufwaermSaetze: number | null;
  aufwaermWiederholungen: number | null;
  aufwaermGewichtG: number | null;
  aufwaermSekunden: number | null;
}

export interface Trainingsplan {
  id: number;
  name: string;
  wochentage: number[];
  vorlageId: number | null;
  vorlageName: string | null;
  projektId: number | null;
  projektName: string | null;
  archiviert: boolean;
  loeschbar: boolean;
  uebungen: TrainingsplanUebung[];
}

export interface PlanEintragDaten {
  name: string;
  art: UebungsArt;
  zielSaetze: number | null;
  zielWiederholungen: number | null;
  zielGewichtG: number | null;
  zielSekunden: number | null;
  aufwaermSaetze: number | null;
  aufwaermWiederholungen: number | null;
  aufwaermGewichtG: number | null;
  aufwaermSekunden: number | null;
}

export interface TrainingsplanDaten {
  name: string;
  wochentage: number[];
  projektId: number | null;
  vorlageId: number | null;
  uebungen: PlanEintragDaten[];
}

export interface Uebung {
  id: number;
  name: string;
  art: UebungsArt;
  archiviert: boolean;
  loeschbar: boolean;
}

export interface UebungDaten {
  name: string;
  art: UebungsArt;
}

export interface Trainingssatz {
  id: number;
  uebungId: number;
  reihenfolge: number;
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
  aufwaermen: boolean;
  erledigt: boolean;
}

export interface EinheitUebung {
  uebungId: number;
  name: string;
  art: UebungsArt;
  saetze: Trainingssatz[];
}

export interface Trainingseinheit {
  id: number;
  planId: number | null;
  planName: string;
  eintragId: number | null;
  status: 'offen' | 'fertig';
  begonnenAm: string;
  beendetAm: string | null;
  stunden: number;
  aenderbar: boolean;
  uebungen: EinheitUebung[];
}

export interface Bestwert {
  id: number;
  art: BestwertArt;
  wert: number;
  wiederholungen: number | null;
  erreichtAm: string;
}

export interface TrainingHeute {
  planId: number;
  name: string;
  wochentage: number[];
  uebungNamen: string[];
  aktion: 'starten' | 'oeffnen';
  einheitId: number | null;
}
