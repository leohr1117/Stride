import type { EintragErgebnis } from '../../../shared/api/index.ts';
import type { Trainingseinheit } from '../../../shared/api/training.ts';
import { GRENZEN } from '../../../shared/spiel/begriffe.ts';
import {
  EINHEIT_LAEUFT,
  NUR_OFFEN_VERWERFEN,
  PLAN_ARCHIVIERT,
  PLAN_OHNE_EINTRAG,
  satzzeilen,
} from '../../../shared/spiel/training.ts';
import { ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { erstelleEintrag, loescheEintrag } from '../eintraege/eintraege.ts';
import { ersterBestwert } from './bestwerte.ts';
import { ladeEinheit, ladeRohEinheit, stundenDer, type RohEinheit } from './lesen.ts';
import { bucheNeu, gespeichertesErgebnis } from './neubuchung.ts';
import { ladeTrainingsplan } from './plaene.ts';
import { gewichtePassen, projektFuerPlan, vorlageFuerPlan } from './zuordnung.ts';

export function starteEinheit(planId: number, jetzt = new Date()): Trainingseinheit {
  const plan = ladeTrainingsplan(planId);
  const offen = eine<{ id: number; planId: number }>(
    `SELECT id, plan_id AS planId FROM trainingseinheiten WHERE status = 'offen' ORDER BY id LIMIT 1`,
  );
  if (offen?.planId === planId) {
    return ladeEinheit(offen.id, jetzt);
  }
  if (offen) {
    throw ungueltig(EINHEIT_LAEUFT);
  }
  if (plan.archiviert) {
    throw ungueltig(PLAN_ARCHIVIERT);
  }
  if (plan.uebungen.length === 0) {
    throw ungueltig(PLAN_OHNE_EINTRAG);
  }
  const id = inTransaktion(() => {
    const einheitId = ausfuehren(
      `INSERT INTO trainingseinheiten (plan_id, eintrag_id, status, begonnen_am, beendet_am, krit_festgelegt)
       VALUES (?, NULL, 'offen', ?, NULL, 0)`,
      planId,
      jetzt.toISOString(),
    ).id;
    for (const zeile of satzzeilen(plan.uebungen)) {
      ausfuehren(
        `INSERT INTO trainingssaetze (
           einheit_id, uebung_id, reihenfolge, gewicht_g, wiederholungen, sekunden, aufwaermen, erledigt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        einheitId,
        zeile.uebungId,
        zeile.reihenfolge,
        zeile.gewichtG,
        zeile.wiederholungen,
        zeile.sekunden,
        Number(zeile.aufwaermen),
      );
    }
    return einheitId;
  });
  return ladeEinheit(id, jetzt);
}

export function legeEintragAn(einheitId: number, meilenstein: boolean): EintragErgebnis {
  const einheit = ladeRohEinheit(einheitId);
  if (einheit.planId === null) {
    throw ungueltig(PLAN_OHNE_EINTRAG);
  }
  const plan = ladeTrainingsplan(einheit.planId);
  const vorlageId = vorlageFuerPlan(plan);
  const begonnen = new Date(einheit.begonnenAm);
  const stunden = stundenDer(einheit.begonnenAm, einheit.beendetAm);
  const ergebnis = erstelleEintrag(
    {
      projektId: projektFuerPlan(plan.projektId),
      vorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden,
      notiz: plan.name.slice(0, GRENZEN.notizMax),
      meilenstein,
      faehigkeitId: null,
      datum: null,
    },
    begonnen,
  );
  ausfuehren('UPDATE trainingseinheiten SET eintrag_id = ? WHERE id = ?', ergebnis.eintrag.id, einheitId);
  if (!gewichtePassen(vorlageId, plan)) {
    return bucheNeu(ergebnis.eintrag.id, einheitId, stunden, meilenstein);
  }
  return ergebnis;
}

export function loeseEintrag(einheitId: number): void {
  const einheit = ladeRohEinheit(einheitId);
  if (einheit.eintragId === null) {
    return;
  }
  ausfuehren('UPDATE trainingseinheiten SET eintrag_id = NULL WHERE id = ?', einheitId);
  loescheEintrag(einheit.eintragId);
}

export function bucheEinheit(einheitId: number, meilenstein: boolean): EintragErgebnis {
  const einheit = ladeRohEinheit(einheitId);
  const stunden = stundenDer(einheit.begonnenAm, einheit.beendetAm);
  if (einheit.eintragId === null) {
    return legeEintragAn(einheitId, meilenstein);
  }
  return bucheNeu(einheit.eintragId, einheitId, stunden, meilenstein);
}

export function schliesseEinheitAb(id: number, jetzt = new Date()): EintragErgebnis {
  const roh = ladeRohEinheit(id);
  if (roh.status === 'fertig' && roh.eintragId !== null) {
    return gespeichertesErgebnis(roh.eintragId);
  }
  return inTransaktion(() => schliesseOffene(id, roh, jetzt));
}

function schliesseOffene(id: number, roh: RohEinheit, jetzt: Date): EintragErgebnis {
  if (roh.status !== 'fertig') {
    ausfuehren(`UPDATE trainingseinheiten SET status = 'fertig', beendet_am = ? WHERE id = ?`, jetzt.toISOString(), id);
  }
  const aktuell = ladeRohEinheit(id);
  const meilenstein = ersterBestwert(id);
  if (aktuell.eintragId === null) {
    return legeEintragAn(id, meilenstein);
  }
  return bucheNeu(aktuell.eintragId, id, stundenDer(aktuell.begonnenAm, aktuell.beendetAm), meilenstein);
}

export function verwirfEinheit(id: number): void {
  const einheit = ladeRohEinheit(id);
  if (einheit.status !== 'offen') {
    throw ungueltig(NUR_OFFEN_VERWERFEN);
  }
  if (einheit.eintragId !== null) {
    loescheEintrag(einheit.eintragId);
    return;
  }
  ausfuehren('DELETE FROM trainingseinheiten WHERE id = ?', id);
}
