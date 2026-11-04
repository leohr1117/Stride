import { farbtonHalten, helligkeit, kontrast, lesbareFarbe, MINDEST_KONTRAST } from '../../spiel/farben.ts';
import { type Bedeutungsfarben } from './bedeutung.ts';
import { type Erscheinung } from './paletten.ts';

/** Nicht-Text, WCAG 1.4.11. Text bleibt bei MINDEST_KONTRAST. */
const UI = 3;

export const FLAECHE_GEGEN_GRUND = 1.12;

export function flaecheHebtSich(flaeche: string, grund: string): boolean {
  return Number(kontrast(flaeche, grund).toFixed(2)) >= FLAECHE_GEGEN_GRUND;
}

/** Feldrand aus der Ansicht, solange er gegen die Fläche besteht. */
export const FELD_RAND = '#767676';

export interface GewachteFarben {
  flaeche: string;
  flaeche2: string;
  haupt: string;
  leise: string;
  gefahr: string;
  gefahrText: string;
  streak: string;
  fortschritt: string;
  schalterAn: string;
  schalterKnopfAn: string;
  schalterAus: string;
  schalterKnopfAus: string;
  feldrand: string;
  fokus: string;
  aktion: string;
  aktionText: string;
}

function besteht(farbe: string, hintergruende: readonly string[], mindest: number): boolean {
  return hintergruende.every((hintergrund) => kontrast(farbe, hintergrund) >= mindest);
}

function vordergrund(
  farbe: string,
  hintergruende: readonly string[],
  haupt: string,
  mindest: number,
  farbton: boolean,
): string {
  if (besteht(farbe, hintergruende, mindest)) {
    return farbe;
  }
  if (farbton) {
    return farbtonHalten(farbe, hintergruende, haupt, mindest);
  }
  return lesbareFarbe(farbe, hintergruende, mindest, haupt);
}

function knopf(bisher: string, bahn: string, grund: string): string {
  if (kontrast(bisher, bahn) >= UI) {
    return bisher;
  }
  const weiss = '#ffffff';
  return kontrast(grund, bahn) >= kontrast(weiss, bahn) ? grund : weiss;
}

function kanalVersatz(farbe: string, schritte: number): string {
  const roh = farbe.replace('#', '');
  const kanal = (start: number) => {
    const wert = Number.parseInt(roh.slice(start, start + 2), 16) + schritte;
    return Math.max(0, Math.min(255, wert)).toString(16).padStart(2, '0');
  };
  return `#${kanal(0)}${kanal(2)}${kanal(4)}`;
}

function textBleibt(flaeche: string, flaeche2: string, texte: readonly string[]): boolean {
  return texte.every((farbe) => kontrast(farbe, flaeche) >= MINDEST_KONTRAST && kontrast(farbe, flaeche2) >= MINDEST_KONTRAST);
}

function hebeFlaechen(
  flaeche: string,
  flaeche2: string,
  grund: string,
  texte: readonly string[],
): { flaeche: string; flaeche2: string } {
  if (flaecheHebtSich(flaeche, grund)) {
    return { flaeche, flaeche2 };
  }
  const aufhellen = helligkeit(grund) < 0.4;
  const richtung = aufhellen ? 1 : -1;
  let beste = { flaeche, flaeche2 };
  let vorher = flaeche;
  for (let schritt = 1; schritt <= 48; schritt += 1) {
    const naechste = kanalVersatz(flaeche, richtung * schritt);
    if (naechste === vorher) {
      break;
    }
    vorher = naechste;
    const zweite = aufhellen ? kanalVersatz(flaeche2, richtung * schritt) : flaeche2;
    if (!textBleibt(naechste, zweite, texte)) {
      break;
    }
    beste = { flaeche: naechste, flaeche2: zweite };
    if (flaecheHebtSich(naechste, grund)) {
      return beste;
    }
  }
  return beste;
}

/** Prüfpaare nach Palette und eigenen Farben. Bestehende Paare bleiben unverändert. */
export function wacheKontrast(bild: Erscheinung, bedeutung: Bedeutungsfarben, feldrand = FELD_RAND): GewachteFarben {
  const grund = bild.hintergrund;
  const gehoben = hebeFlaechen(bild.flaechen.flaeche, bild.flaechen.flaeche2, grund, [bild.primaer]);
  const flaeche = gehoben.flaeche;
  const flaeche2 = gehoben.flaeche2;
  const flaechen = [grund, flaeche, flaeche2];
  const haupt = besteht(bild.flaechen.haupt, flaechen, MINDEST_KONTRAST)
    ? bild.flaechen.haupt
    : lesbareFarbe(bild.flaechen.haupt, flaechen, MINDEST_KONTRAST);
  const leise = vordergrund(bild.flaechen.leise, flaechen, haupt, MINDEST_KONTRAST, false);
  const gefahr = vordergrund(bedeutung.gefahr, flaechen, haupt, MINDEST_KONTRAST, true);
  const streak = vordergrund(bedeutung.streak, flaechen, haupt, MINDEST_KONTRAST, true);
  const fortschritt = vordergrund(bedeutung.fortschritt, flaechen, haupt, MINDEST_KONTRAST, true);
  const schalterAn = vordergrund(bedeutung.schalterAn, [flaeche], haupt, UI, true);
  const schalterAus = bedeutung.schalterAus;
  const fokus = vordergrund(bedeutung.fokus, [grund], haupt, UI, true);
  const rand = vordergrund(feldrand, [flaeche], haupt, UI, false);
  const aktion = bild.primaer;
  const aktionText = besteht(bild.text, [aktion], MINDEST_KONTRAST)
    ? bild.text
    : lesbareFarbe(bild.text, [aktion], MINDEST_KONTRAST);
  const gefahrText = besteht(bedeutung.gefahrText, [gefahr], MINDEST_KONTRAST)
    ? bedeutung.gefahrText
    : lesbareFarbe(bedeutung.gefahrText, [gefahr], MINDEST_KONTRAST);
  return {
    flaeche,
    flaeche2,
    haupt,
    leise,
    gefahr,
    gefahrText,
    streak,
    fortschritt,
    schalterAn,
    schalterKnopfAn: knopf(bedeutung.schalterKnopfAn, schalterAn, grund),
    schalterAus,
    schalterKnopfAus: knopf(bedeutung.schalterKnopfAus, schalterAus, grund),
    feldrand: rand,
    fokus,
    aktion,
    aktionText,
  };
}
