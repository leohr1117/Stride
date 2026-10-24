import type { PlanEintragDaten } from '../../../shared/api/training.ts';
import { WOCHENTAG_FORMAT } from '../../../shared/spiel/aufgabe.ts';
import { GRENZEN } from '../../../shared/spiel/begriffe.ts';
import {
  AUFWAERM_BRAUCHT_SAETZE,
  AUFWAERM_BRAUCHT_SEKUNDEN,
  AUFWAERM_BRAUCHT_WIEDERHOLUNGEN,
  ART_UNBEKANNT,
  DAUER_BRAUCHT_SEKUNDEN,
  DAUER_OHNE_GEWICHT,
  GEWICHT_MINDEST,
  KRAFT_BRAUCHT_WIEDERHOLUNGEN,
  SAETZE_BIS,
  SAETZE_HINWEIS,
  SEKUNDEN_MINDEST,
  VORGABE_MISCHUNG,
  WIEDERHOLUNGEN_MINDEST,
  istUebungsArt,
  type UebungsArt,
} from '../../../shared/spiel/training.ts';
import { ungueltig } from '../../fehler.ts';

export function pruefeName(name: string): string {
  const sauber = name.trim();
  if (sauber.length === 0) {
    throw ungueltig('Der Name darf nicht leer sein.');
  }
  if (sauber.length > GRENZEN.nameMax) {
    throw ungueltig(`Der Name darf höchstens ${GRENZEN.nameMax} Zeichen haben.`);
  }
  return sauber;
}

export function pruefeArt(art: string): UebungsArt {
  if (!istUebungsArt(art)) {
    throw ungueltig(ART_UNBEKANNT);
  }
  return art;
}

export function normalisiereWochentage(tage: readonly number[]): number[] {
  const sauber: number[] = [];
  for (const tag of tage) {
    if (!Number.isInteger(tag) || tag < 1 || tag > 7) {
      throw ungueltig(WOCHENTAG_FORMAT);
    }
    if (!sauber.includes(tag)) {
      sauber.push(tag);
    }
  }
  sauber.sort((links, rechts) => links - rechts);
  return sauber;
}

export function pruefeEintrag(eintrag: PlanEintragDaten): void {
  pruefeName(eintrag.name);
  const art = pruefeArt(eintrag.art);
  if (eintrag.zielSaetze !== null) {
    pruefeSaetze(eintrag.zielSaetze);
  }
  pruefeSeite(art, eintrag.zielWiederholungen, eintrag.zielSekunden, eintrag.zielGewichtG, false);
  if (eintrag.aufwaermSaetze === null) {
    if (
      eintrag.aufwaermWiederholungen !== null ||
      eintrag.aufwaermSekunden !== null ||
      eintrag.aufwaermGewichtG !== null
    ) {
      throw ungueltig(AUFWAERM_BRAUCHT_SAETZE);
    }
    return;
  }
  pruefeSaetze(eintrag.aufwaermSaetze);
  pruefeSeite(art, eintrag.aufwaermWiederholungen, eintrag.aufwaermSekunden, eintrag.aufwaermGewichtG, true);
}

function pruefeSaetze(wert: number): void {
  if (!Number.isInteger(wert) || wert < 1 || wert > SAETZE_BIS) {
    throw ungueltig(SAETZE_HINWEIS);
  }
}

function pruefeSeite(
  art: UebungsArt,
  wiederholungen: number | null,
  sekunden: number | null,
  gewichtG: number | null,
  aufwaermen: boolean,
): void {
  if (wiederholungen !== null && sekunden !== null) {
    throw ungueltig(VORGABE_MISCHUNG);
  }
  pruefeZahl(wiederholungen, WIEDERHOLUNGEN_MINDEST);
  pruefeZahl(sekunden, SEKUNDEN_MINDEST);
  if (gewichtG !== null && (!Number.isInteger(gewichtG) || gewichtG < 1)) {
    throw ungueltig(GEWICHT_MINDEST);
  }
  if (art === 'kraft') {
    if (wiederholungen === null) {
      throw ungueltig(aufwaermen ? AUFWAERM_BRAUCHT_WIEDERHOLUNGEN : KRAFT_BRAUCHT_WIEDERHOLUNGEN);
    }
    if (sekunden !== null) {
      throw ungueltig(VORGABE_MISCHUNG);
    }
    return;
  }
  if (sekunden === null) {
    throw ungueltig(aufwaermen ? AUFWAERM_BRAUCHT_SEKUNDEN : DAUER_BRAUCHT_SEKUNDEN);
  }
  if (wiederholungen !== null) {
    throw ungueltig(VORGABE_MISCHUNG);
  }
  if (gewichtG !== null) {
    throw ungueltig(DAUER_OHNE_GEWICHT);
  }
}

function pruefeZahl(wert: number | null, hinweis: string): void {
  if (wert !== null && (!Number.isInteger(wert) || wert < 1)) {
    throw ungueltig(hinweis);
  }
}
