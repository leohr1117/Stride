import { isoWochentag } from './aufgabe.ts';
import { GRENZEN } from './begriffe.ts';

export const GEWICHT_EINHEITEN = ['kg', 'lb'] as const;
export type GewichtEinheit = (typeof GEWICHT_EINHEITEN)[number];

export const UEBUNGS_ARTEN = ['kraft', 'dauer'] as const;
export type UebungsArt = (typeof UEBUNGS_ARTEN)[number];

export const BESTWERT_ARTEN = ['gewicht', 'eins', 'dauer'] as const;
export type BestwertArt = (typeof BESTWERT_ARTEN)[number];

/** 1 lb in Gramm. Gespeichert wird immer in ganzen Gramm. */
export const LB_IN_GRAMM = 453.59237;
export const GRAMM_PRO_KG = 1000;
export const STANDARD_GEWICHT_EINHEIT: GewichtEinheit = 'kg';

/** Epley erst ab dieser Wiederholungszahl. Darunter ist die Schätzung das Satzgewicht. */
export const EPLEY_AB = 3;

/** Fehlt das Ende oder liegt es nicht nach dem Start, bleibt diese Dauer. */
export const STUNDEN_OHNE_ENDE = 1;

const MS_PRO_STUNDE = 60 * 60 * 1000;
const STUNDEN_RUNDUNG = 100;

export interface PlanVorgabe {
  uebungId: number;
  art: UebungsArt;
  zielSaetze: number;
  zielWiederholungen: number | null;
  zielGewichtG: number | null;
  zielSekunden: number | null;
  aufwaermSaetze: number | null;
  aufwaermWiederholungen: number | null;
  aufwaermGewichtG: number | null;
  aufwaermSekunden: number | null;
}

export interface Satzzeile {
  uebungId: number;
  reihenfolge: number;
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
  aufwaermen: boolean;
  erledigt: boolean;
}

export interface SatzFuerBestwert {
  art: UebungsArt;
  erledigt: boolean;
  aufwaermen: boolean;
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
}

export interface BestwertStand {
  art: BestwertArt;
  wert: number;
  wiederholungen: number | null;
}

/**
 * Stunden zwischen Start und Ende.
 * Dieselbe Rundung wie der Kalender: auf zwei Nachkommastellen, dann auf 0,25 bis 24.
 * Sätze verlängern die Dauer nicht. Die Argumente sind Millisekunden.
 */
export function einheitStunden(begonnenMs: number | null, beendetMs: number | null): number {
  if (
    begonnenMs === null ||
    beendetMs === null ||
    !Number.isFinite(begonnenMs) ||
    !Number.isFinite(beendetMs) ||
    beendetMs <= begonnenMs
  ) {
    return STUNDEN_OHNE_ENDE;
  }
  const roh = Math.round(((beendetMs - begonnenMs) / MS_PRO_STUNDE) * STUNDEN_RUNDUNG) / STUNDEN_RUNDUNG;
  return Math.min(GRENZEN.stundenMax, Math.max(GRENZEN.stundenMin, roh));
}

/** Anzeige mit genau einer Nachkommastelle, aus den gespeicherten Gramm. */
export function anzeigeAusGramm(gramm: number, einheit: GewichtEinheit): number {
  const teiler = einheit === 'kg' ? GRAMM_PRO_KG : LB_IN_GRAMM;
  return eineStelle(gramm / teiler);
}

/** Ganze Gramm aus der angezeigten Zahl. Eine unberührte Anzeige nimmt diesen Weg nicht. */
export function grammAusAnzeige(anzeige: number, einheit: GewichtEinheit): number {
  const faktor = einheit === 'kg' ? GRAMM_PRO_KG : LB_IN_GRAMM;
  return Math.round(eineStelle(anzeige) * faktor);
}

/**
 * Gleiche Anzeige behält die gespeicherten Gramm.
 * 176,4 lb neu gerechnet ist nicht mehr 80 000 g. Leer bleibt null.
 * Ein Wechsel der Einheit liest die gespeicherten Gramm neu und rechnet die sichtbare Zahl nicht um.
 */
export function grammBeimSpeichern(
  gespeichertG: number | null,
  eingabe: number | null,
  einheit: GewichtEinheit,
): number | null {
  if (eingabe === null || !Number.isFinite(eingabe)) {
    return null;
  }
  const sichtbar = eineStelle(eingabe);
  if (gespeichertG !== null && Number.isFinite(gespeichertG) && sichtbar === anzeigeAusGramm(gespeichertG, einheit)) {
    return gespeichertG;
  }
  return grammAusAnzeige(sichtbar, einheit);
}

/** Ab 3 Wiederholungen Gramm mal (1 + Wiederholungen / 30), gerundet. Darunter das Satzgewicht. */
export function epleyGramm(gewichtG: number, wiederholungen: number): number {
  if (wiederholungen < EPLEY_AB) {
    return gewichtG;
  }
  return Math.round(gewichtG * (1 + wiederholungen / 30));
}

/** Die Zeile Schätzung erscheint nur, wenn sie über dem Satzgewicht liegt. */
export function schaetzungSichtbar(gewichtG: number, wiederholungen: number): boolean {
  return epleyGramm(gewichtG, wiederholungen) > gewichtG;
}

/**
 * Ob der Plan an diesem zivilen Datum liegt. Ohne Wochentage nie.
 * Der ISO-Tag kommt aus `isoWochentag` in aufgabe.ts. Montag ist 1, Sonntag ist 7.
 */
export function planLiegtAmTag(wochentage: readonly number[], datum: string): boolean {
  return wochentage.length > 0 && wochentage.includes(isoWochentag(datum));
}

/** Erledigt und kein Aufwärmen. */
export function istArbeitssatz(satz: { erledigt: boolean; aufwaermen: boolean }): boolean {
  return satz.erledigt && !satz.aufwaermen;
}

/**
 * Neue Zeilen für den Verlauf. Leer heißt kein Bestwert.
 * Kraft ohne Gramm schreibt weder Gewicht noch Schätzung. Aufwärmen schreibt nichts.
 * Der Vergleich nimmt das Maximum im Verlauf, nicht die letzte Zeile, und nur einen strikt besseren Wert.
 * Der erste Bestwert der Übung ist eine nicht leere Antwort bei leerem `bisher`.
 */
export function bestwertZeilen(satz: SatzFuerBestwert, bisher: readonly BestwertStand[]): BestwertStand[] {
  if (!istArbeitssatz(satz)) {
    return [];
  }
  if (satz.art === 'dauer') {
    return dauerZeile(satz, bisher);
  }
  return kraftZeilen(satz, bisher);
}

export function istBestwert(satz: SatzFuerBestwert, bisher: readonly BestwertStand[]): boolean {
  return bestwertZeilen(satz, bisher).length > 0;
}

/** Einmal, wenn die Übung vorher keinen Bestwert hatte und dieser Satz einen liefert. */
export function istErsterBestwert(satz: SatzFuerBestwert, bisher: readonly BestwertStand[]): boolean {
  return bisher.length === 0 && istBestwert(satz, bisher);
}

/**
 * Pro Vorgabe zuerst die Aufwärmzeilen, dann die Arbeitssätze.
 * Die Reihenfolge zählt ab 1 über den ganzen Plan. Leeres Gewicht bleibt null.
 * Dauer trägt Sekunden und kein Gewicht, Kraft Wiederholungen und keine Sekunden.
 */
export function satzzeilen(vorgaben: readonly PlanVorgabe[]): Satzzeile[] {
  const zeilen: Satzzeile[] = [];
  for (const vorgabe of vorgaben) {
    haengeAn(zeilen, vorgabe, true, satzAnzahl(vorgabe.aufwaermSaetze));
    haengeAn(zeilen, vorgabe, false, satzAnzahl(vorgabe.zielSaetze));
  }
  return zeilen;
}

function eineStelle(wert: number): number {
  return Math.round(wert * 10) / 10;
}

function satzAnzahl(wert: number | null): number {
  if (wert === null || wert < 1) {
    return 0;
  }
  return Math.floor(wert);
}

function haengeAn(ziel: Satzzeile[], vorgabe: PlanVorgabe, aufwaermen: boolean, anzahl: number): void {
  for (let index = 0; index < anzahl; index += 1) {
    ziel.push(zeileAus(vorgabe, aufwaermen, ziel.length + 1));
  }
}

function zeileAus(vorgabe: PlanVorgabe, aufwaermen: boolean, reihenfolge: number): Satzzeile {
  const kraft = vorgabe.art === 'kraft';
  return {
    uebungId: vorgabe.uebungId,
    reihenfolge,
    gewichtG: kraft ? (aufwaermen ? vorgabe.aufwaermGewichtG : vorgabe.zielGewichtG) : null,
    wiederholungen: kraft ? (aufwaermen ? vorgabe.aufwaermWiederholungen : vorgabe.zielWiederholungen) : null,
    sekunden: kraft ? null : aufwaermen ? vorgabe.aufwaermSekunden : vorgabe.zielSekunden,
    aufwaermen,
    erledigt: false,
  };
}

function kraftZeilen(satz: SatzFuerBestwert, bisher: readonly BestwertStand[]): BestwertStand[] {
  if (satz.gewichtG === null || satz.wiederholungen === null || satz.wiederholungen < 1) {
    return [];
  }
  const zeilen: BestwertStand[] = [];
  const gewicht = besterWert(bisher, 'gewicht', satz.wiederholungen);
  if (gewicht === null || satz.gewichtG > gewicht) {
    zeilen.push({ art: 'gewicht', wert: satz.gewichtG, wiederholungen: satz.wiederholungen });
  }
  const schaetzung = epleyGramm(satz.gewichtG, satz.wiederholungen);
  const eins = besterWert(bisher, 'eins', null);
  if (eins === null || schaetzung > eins) {
    zeilen.push({ art: 'eins', wert: schaetzung, wiederholungen: satz.wiederholungen });
  }
  return zeilen;
}

function dauerZeile(satz: SatzFuerBestwert, bisher: readonly BestwertStand[]): BestwertStand[] {
  if (satz.sekunden === null || satz.sekunden < 1) {
    return [];
  }
  const dauer = besterWert(bisher, 'dauer', null);
  if (dauer !== null && satz.sekunden <= dauer) {
    return [];
  }
  return [{ art: 'dauer', wert: satz.sekunden, wiederholungen: null }];
}

function besterWert(bisher: readonly BestwertStand[], art: BestwertArt, wiederholungen: number | null): number | null {
  let best: number | null = null;
  for (const zeile of bisher) {
    if (zeile.art !== art) {
      continue;
    }
    if (art === 'gewicht' && zeile.wiederholungen !== wiederholungen) {
      continue;
    }
    if (best === null || zeile.wert > best) {
      best = zeile.wert;
    }
  }
  return best;
}
