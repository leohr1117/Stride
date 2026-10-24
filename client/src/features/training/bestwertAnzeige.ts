import type { Bestwert } from '../../../../shared/api/training.ts';
import { anzeigeAusGramm, epleyGramm, schaetzungSichtbar, type GewichtEinheit } from '../../../../shared/spiel/training.ts';
import { eineNachkommastelle, kurzesDatum } from '../../format.ts';
import { tx } from '../../text.ts';
import { satzText } from './satzAnzeige.ts';

export interface BestwertZeile {
  id: number;
  haupt: string;
  datum: string;
  schaetzung: string | null;
}

function einheitText(gewicht: GewichtEinheit): string {
  return gewicht === 'lb' ? tx('lb') : tx('kg');
}

function zeileAus(wert: Bestwert, gewicht: GewichtEinheit): BestwertZeile | null {
  if (wert.art === 'eins') {
    return null;
  }
  if (wert.art === 'dauer') {
    return { id: wert.id, haupt: tx('{sekunden} s', { sekunden: wert.wert }), datum: kurzesDatum(wert.erreichtAm), schaetzung: null };
  }
  const haupt = satzText({ gewichtG: wert.wert, wiederholungen: wert.wiederholungen, sekunden: null }, 'kraft', gewicht);
  if (haupt === '' || wert.wiederholungen === null) {
    return null;
  }
  const sichtbar = schaetzungSichtbar(wert.wert, wert.wiederholungen);
  const schaetzung = sichtbar
    ? tx('Schätzung {wert}', {
        wert: `${eineNachkommastelle(anzeigeAusGramm(epleyGramm(wert.wert, wert.wiederholungen), gewicht))} ${einheitText(gewicht)}`,
      })
    : null;
  return { id: wert.id, haupt, datum: kurzesDatum(wert.erreichtAm), schaetzung };
}

/** Neueste zuerst, wie die API. Die Schätzung hängt am Gewicht, sie ist keine eigene Zeile. */
export function bestwertZeilen(werte: readonly Bestwert[], gewicht: GewichtEinheit): BestwertZeile[] {
  const zeilen: BestwertZeile[] = [];
  for (const wert of werte) {
    const zeile = zeileAus(wert, gewicht);
    if (zeile) {
      zeilen.push(zeile);
    }
  }
  return zeilen;
}
