import type { EinheitUebung, Trainingseinheit, TrainingHeute, Trainingssatz } from '../../../shared/api/training.ts';
import { datumInZone } from '../../../shared/spiel/datum.ts';
import { ART_UNBEKANNT, EINHEIT_GESPERRT, einheitStunden, istUebungsArt, planLiegtAmTag } from '../../../shared/spiel/training.ts';
import { alle, eine, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeTrainingsplaene } from './plaene.ts';

export interface RohEinheit {
  id: number;
  planId: number | null;
  eintragId: number | null;
  status: string;
  begonnenAm: string;
  beendetAm: string | null;
}

interface EinheitZeile extends RohEinheit {
  planName: string;
}

interface SatzZeile {
  id: number;
  einheitId: number;
  uebungId: number;
  name: string;
  art: string;
  reihenfolge: number;
  gewichtG: number | null;
  wiederholungen: number | null;
  sekunden: number | null;
  aufwaermen: number;
  erledigt: number;
}

const EINHEIT_SQL = `
  SELECT e.id, e.plan_id AS planId, COALESCE(p.name, '') AS planName, e.eintrag_id AS eintragId,
         e.status, e.begonnen_am AS begonnenAm, e.beendet_am AS beendetAm
  FROM trainingseinheiten e
  LEFT JOIN trainingsplaene p ON p.id = e.plan_id
`;

export function ladeRohEinheit(id: number): RohEinheit {
  const zeile = eine<RohEinheit>(
    `SELECT id, plan_id AS planId, eintrag_id AS eintragId, status, begonnen_am AS begonnenAm, beendet_am AS beendetAm
     FROM trainingseinheiten WHERE id = ?`,
    id,
  );
  if (!zeile) {
    throw nichtGefunden('Die Einheit');
  }
  return zeile;
}

export function stundenDer(begonnenAm: string, beendetAm: string | null): number {
  return einheitStunden(Date.parse(begonnenAm), beendetAm === null ? null : Date.parse(beendetAm));
}

export function einheitAenderbar(einheit: RohEinheit, jetzt: Date): boolean {
  if (einheit.status === 'offen') {
    return true;
  }
  if (einheit.status !== 'fertig') {
    return false;
  }
  const zone = ladeEinstellungen().zeitzone;
  return datumInZone(new Date(einheit.begonnenAm), zone) === datumInZone(jetzt, zone);
}

export function pruefeAenderbar(id: number, jetzt = leseJetzt()): void {
  if (!einheitAenderbar(ladeRohEinheit(id), jetzt)) {
    throw ungueltig(EINHEIT_GESPERRT);
  }
}

function zuSatz(zeile: SatzZeile): Trainingssatz {
  return {
    id: zeile.id,
    uebungId: zeile.uebungId,
    reihenfolge: zeile.reihenfolge,
    gewichtG: zeile.gewichtG,
    wiederholungen: zeile.wiederholungen,
    sekunden: zeile.sekunden,
    aufwaermen: zeile.aufwaermen === 1,
    erledigt: zeile.erledigt === 1,
  };
}

function ladeSatzGruppen(ids: readonly number[]): Map<number, EinheitUebung[]> {
  const ergebnis = new Map<number, EinheitUebung[]>();
  if (ids.length === 0) {
    return ergebnis;
  }
  const saetze = alle<SatzZeile>(
    `SELECT s.id, s.einheit_id AS einheitId, s.uebung_id AS uebungId, u.name, u.art, s.reihenfolge,
            s.gewicht_g AS gewichtG, s.wiederholungen, s.sekunden, s.aufwaermen, s.erledigt
     FROM trainingssaetze s
     JOIN uebungen u ON u.id = s.uebung_id
     WHERE s.einheit_id IN (${platzhalter(ids.length)})
     ORDER BY s.reihenfolge, s.id`,
    ...ids,
  );
  for (const satz of saetze) {
    const liste = ergebnis.get(satz.einheitId) ?? [];
    let gruppe = liste.find((eintrag) => eintrag.uebungId === satz.uebungId);
    if (!gruppe) {
      if (!istUebungsArt(satz.art)) {
        throw ungueltig(ART_UNBEKANNT);
      }
      gruppe = { uebungId: satz.uebungId, name: satz.name, art: satz.art, saetze: [] };
      liste.push(gruppe);
      ergebnis.set(satz.einheitId, liste);
    }
    gruppe.saetze.push(zuSatz(satz));
  }
  return ergebnis;
}

function zuEinheit(zeile: EinheitZeile, uebungen: EinheitUebung[], jetzt: Date): Trainingseinheit {
  return {
    id: zeile.id,
    planId: zeile.planId,
    planName: zeile.planName,
    eintragId: zeile.eintragId,
    status: zeile.status === 'fertig' ? 'fertig' : 'offen',
    begonnenAm: zeile.begonnenAm,
    beendetAm: zeile.beendetAm,
    stunden: stundenDer(zeile.begonnenAm, zeile.beendetAm),
    aenderbar: einheitAenderbar(zeile, jetzt),
    uebungen,
  };
}

export function ladeEinheiten(jetzt = leseJetzt()): Trainingseinheit[] {
  const zeilen = alle<EinheitZeile>(`${EINHEIT_SQL} ORDER BY e.begonnen_am DESC, e.id DESC`);
  const saetze = ladeSatzGruppen(zeilen.map((zeile) => zeile.id));
  return zeilen.map((zeile) => zuEinheit(zeile, saetze.get(zeile.id) ?? [], jetzt));
}

export function ladeEinheit(id: number, jetzt = leseJetzt()): Trainingseinheit {
  const zeile = eine<EinheitZeile>(`${EINHEIT_SQL} WHERE e.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Einheit');
  }
  return zuEinheit(zeile, ladeSatzGruppen([id]).get(id) ?? [], jetzt);
}

export function ladeTrainingHeute(jetzt = leseJetzt()): TrainingHeute[] {
  const zone = ladeEinstellungen().zeitzone;
  const heute = datumInZone(jetzt, zone);
  const plaene = ladeTrainingsplaene(false).filter((plan) => planLiegtAmTag(plan.wochentage, heute));
  const fertig = new Set(
    alle<{ planId: number; begonnenAm: string }>(
      `SELECT plan_id AS planId, begonnen_am AS begonnenAm
       FROM trainingseinheiten WHERE status = 'fertig' AND plan_id IS NOT NULL`,
    )
      .filter((zeile) => datumInZone(new Date(zeile.begonnenAm), zone) === heute)
      .map((zeile) => zeile.planId),
  );
  const offen = eine<{ id: number; planId: number }>(
    `SELECT id, plan_id AS planId FROM trainingseinheiten WHERE status = 'offen' ORDER BY id LIMIT 1`,
  );
  const zeilen: TrainingHeute[] = [];
  for (const plan of plaene) {
    if (fertig.has(plan.id)) {
      continue;
    }
    const oeffnen = offen?.planId === plan.id;
    zeilen.push({
      planId: plan.id,
      name: plan.name,
      wochentage: plan.wochentage,
      uebungNamen: plan.uebungen.map((uebung) => uebung.name),
      aktion: oeffnen ? 'oeffnen' : 'starten',
      einheitId: oeffnen && offen ? offen.id : null,
    });
  }
  return zeilen;
}
