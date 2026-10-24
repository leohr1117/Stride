import type { UebungsArt } from '../spiel/training.ts';

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
