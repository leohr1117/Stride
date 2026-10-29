import { EBENEN } from '../../../../shared/spiel/ebenen.ts';
import { FUNKTIONEN } from '../../../../shared/spiel/funktionen.ts';
import { istAn, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { karteGewaehlt, karteSichtbar, UEBERSICHT_KARTEN, type UebersichtKartenWahl } from '../../../../shared/spiel/uebersichtKarten.ts';
import { tx } from '../../text.ts';

/**
 * Schalter, die auf Bereiche an stehen.
 * Funktionen nutzen istAn, Ebenen den gespeicherten Wert, so wie die Schalter selbst.
 */
export function bereicheAn(sichtbarkeit: Sichtbarkeit): number {
  const funktionen = FUNKTIONEN.filter((funktion) => istAn(funktion, sichtbarkeit)).length;
  const ebenen = EBENEN.filter((ebene) => sichtbarkeit.ebenen[ebene]).length;
  return funktionen + ebenen;
}

export function kartenStand(
  wahl: Partial<UebersichtKartenWahl> | undefined,
  sichtbarkeit?: Sichtbarkeit,
): { an: number; gesamt: number } {
  const karten = sichtbarkeit
    ? UEBERSICHT_KARTEN.filter((karte) => karteSichtbar(karte.id, sichtbarkeit))
    : UEBERSICHT_KARTEN;
  const gesamt = karten.length;
  const an = karten.filter((karte) => karteGewaehlt(karte.id, wahl)).length;
  return { an, gesamt };
}

/** Rechtswert der Zeile Verbindungen: verbundene Arten, sonst Aus. */
export function verbindungsKurz(daten: { todoist: { verbunden: boolean }; kalender: readonly unknown[] }): string {
  const teile: string[] = [];
  if (daten.todoist.verbunden) {
    teile.push(tx('Todoist'));
  }
  if (daten.kalender.length > 0) {
    teile.push(tx('Kalender'));
  }
  return teile.length > 0 ? teile.join(', ') : tx('Aus');
}
