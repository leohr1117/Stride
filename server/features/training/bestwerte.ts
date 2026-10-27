import type { Bestwert } from '../../../shared/api/training.ts';
import type { BestwertArt, BestwertStand, SatzFuerBestwert } from '../../../shared/spiel/training.ts';
import {
  ART_UNBEKANNT,
  bestwertZeilen,
  istErsterBestwert,
  istUebungsArt,
} from '../../../shared/spiel/training.ts';
import { alle, ausfuehren, eine, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';

interface SatzZeile {
  id: number;
  uebungId: number;
  art: string;
  erledigt: number;
  aufwaermen: number;
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
}

interface NeueZeile extends BestwertStand {
  uebungId: number;
  satzId: number;
}

interface Bestand {
  zeilen: NeueZeile[];
  erster: boolean;
}

function bestwertArt(wert: string): BestwertArt {
  if (wert === 'gewicht' || wert === 'eins' || wert === 'dauer') {
    return wert;
  }
  throw ungueltig(ART_UNBEKANNT);
}

function historie(uebungId: number, ohne: readonly number[]): BestwertStand[] {
  const ausschluss = ohne.length === 0 ? '' : `AND satz_id NOT IN (${platzhalter(ohne.length)})`;
  return alle<{ art: string; wert: number; wiederholungen: number | null }>(
    `SELECT art, wert, wiederholungen FROM bestwerte WHERE uebung_id = ? ${ausschluss}`,
    uebungId,
    ...ohne,
  ).map((zeile) => ({
    art: bestwertArt(zeile.art),
    wert: zeile.wert,
    wiederholungen: zeile.wiederholungen,
  }));
}

function planeBestwerte(einheitId: number): Bestand {
  const saetze = alle<SatzZeile>(
    `SELECT s.id, s.uebung_id AS uebungId, u.art, s.erledigt, s.aufwaermen,
            s.gewicht_g AS gewichtG, s.wiederholungen, s.sekunden
     FROM trainingssaetze s
     JOIN uebungen u ON u.id = s.uebung_id
     WHERE s.einheit_id = ?
     ORDER BY s.reihenfolge, s.id`,
    einheitId,
  );
  const ohne = saetze.map((satz) => satz.id);
  const verlauf = new Map<number, BestwertStand[]>();
  const zeilen: NeueZeile[] = [];
  let erster = false;
  for (const satz of saetze) {
    if (satz.erledigt !== 1 || satz.aufwaermen !== 0) {
      continue;
    }
    if (!istUebungsArt(satz.art)) {
      throw ungueltig(ART_UNBEKANNT);
    }
    const bisher = verlauf.get(satz.uebungId) ?? historie(satz.uebungId, ohne);
    const stand: SatzFuerBestwert = {
      art: satz.art,
      erledigt: true,
      aufwaermen: false,
      gewichtG: satz.gewichtG,
      wiederholungen: satz.wiederholungen,
      sekunden: satz.sekunden,
    };
    if (istErsterBestwert(stand, bisher)) {
      erster = true;
    }
    for (const zeile of bestwertZeilen(stand, bisher)) {
      zeilen.push({ ...zeile, uebungId: satz.uebungId, satzId: satz.id });
      bisher.push(zeile);
    }
    verlauf.set(satz.uebungId, bisher);
  }
  return { zeilen, erster };
}

export function schreibeBestwerte(einheitId: number, jetzt: Date): boolean {
  const plan = planeBestwerte(einheitId);
  const ids = alle<{ id: number }>('SELECT id FROM trainingssaetze WHERE einheit_id = ?', einheitId).map((zeile) => zeile.id);
  if (ids.length > 0) {
    ausfuehren(`DELETE FROM bestwerte WHERE satz_id IN (${platzhalter(ids.length)})`, ...ids);
  }
  for (const zeile of plan.zeilen) {
    ausfuehren(
      `INSERT INTO bestwerte (uebung_id, art, wert, wiederholungen, satz_id, erreicht_am)
       VALUES (?, ?, ?, ?, ?, ?)`,
      zeile.uebungId,
      zeile.art,
      zeile.wert,
      zeile.wiederholungen,
      zeile.satzId,
      jetzt.toISOString(),
    );
  }
  return plan.erster;
}

export function ersterBestwert(einheitId: number): boolean {
  return planeBestwerte(einheitId).erster;
}

export function ladeBestwerte(uebungId: number): Bestwert[] {
  if (!eine('SELECT id FROM uebungen WHERE id = ?', uebungId)) {
    throw nichtGefunden('Die Übung');
  }
  return alle<{ id: number; art: string; wert: number; wiederholungen: number | null; erreichtAm: string }>(
    `SELECT id, art, wert, wiederholungen, erreicht_am AS erreichtAm
     FROM bestwerte WHERE uebung_id = ? ORDER BY erreicht_am DESC, id DESC`,
    uebungId,
  ).map((zeile) => ({
    id: zeile.id,
    art: bestwertArt(zeile.art),
    wert: zeile.wert,
    wiederholungen: zeile.wiederholungen,
    erreichtAm: zeile.erreichtAm,
  }));
}
