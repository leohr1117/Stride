import { farbtonHalten, kontrast, lesbareFarbe, MINDEST_KONTRAST } from '../../spiel/farben.ts';
import { type Bedeutungsfarben } from './bedeutung.ts';
import { type Erscheinung } from './paletten.ts';

/** Nicht-Text, WCAG 1.4.11. Text bleibt bei MINDEST_KONTRAST. */
const UI = 3;

/** Feldrand aus der Ansicht, solange er gegen die Fläche besteht. */
export const FELD_RAND = '#767676';

export interface GewachteFarben {
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

/** Prüfpaare nach Palette und eigenen Farben. Bestehende Paare bleiben unverändert. */
export function wacheKontrast(bild: Erscheinung, bedeutung: Bedeutungsfarben, feldrand = FELD_RAND): GewachteFarben {
  const grund = bild.hintergrund;
  const flaeche = bild.flaechen.flaeche;
  const flaeche2 = bild.flaechen.flaeche2;
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
