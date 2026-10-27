import type { PlanEintragDaten, Trainingsplan, TrainingsplanDaten, TrainingsplanUebung } from '../../../shared/api/training.ts';
import { alle, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { nichtGefunden } from '../../fehler.ts';
import { loeschbareMenge, loescheTrainingsplan as loeschePlanZeile } from '../../services/loeschen.ts';
import { pruefeProjektUndVorlage } from '../basis/basis.ts';
import { pruefeEbene } from '../einstellungen/einstellungen.ts';
import { uebungFuerEintrag } from './uebungen.ts';
import { normalisiereWochentage, pruefeEintrag, pruefeName, pruefeArt } from './vorgabe.ts';

export type TrainingsplanAenderung = Partial<TrainingsplanDaten> & { archiviert?: boolean };

interface PlanZeile {
  id: number;
  name: string;
  wochentage: string | null;
  vorlageId: number | null;
  vorlageName: string | null;
  projektId: number | null;
  projektName: string | null;
  archiviert: number;
}

interface ZuordnungZeile {
  id: number;
  planId: number;
  uebungId: number;
  name: string;
  art: string;
  zielSaetze: number | null;
  zielWiederholungen: number | null;
  zielGewichtG: number | null;
  zielSekunden: number | null;
  aufwaermSaetze: number | null;
  aufwaermWiederholungen: number | null;
  aufwaermGewichtG: number | null;
  aufwaermSekunden: number | null;
}

const PLAN_VON = `
  FROM trainingsplaene p
  LEFT JOIN vorlagen tv ON tv.id = p.vorlage_id
  LEFT JOIN projekte pr ON pr.id = p.projekt_id
`;

const PLAN_SPALTEN = `
  SELECT p.id, p.name, p.wochentage, p.vorlage_id AS vorlageId, tv.name AS vorlageName,
         p.projekt_id AS projektId, pr.name AS projektName, p.archiviert
  ${PLAN_VON}
`;

function nurArchiv(aenderung: TrainingsplanAenderung): boolean {
  const schluessel = Object.entries(aenderung)
    .filter((eintrag) => eintrag[1] !== undefined)
    .map((eintrag) => eintrag[0]);
  return schluessel.length > 0 && schluessel.every((name) => name === 'archiviert');
}

function liesWochentage(text: string | null): number[] {
  if (text === null || text === '') {
    return [];
  }
  const tage: number[] = [];
  for (const teil of text.split(',')) {
    const zahl = Number(teil);
    if (Number.isInteger(zahl) && zahl >= 1 && zahl <= 7 && !tage.includes(zahl)) {
      tage.push(zahl);
    }
  }
  return tage;
}

function schreibeWochentage(tage: readonly number[]): string | null {
  return tage.length === 0 ? null : tage.join(',');
}

function zuEintrag(zeile: ZuordnungZeile): TrainingsplanUebung {
  return {
    id: zeile.id,
    uebungId: zeile.uebungId,
    name: zeile.name,
    art: pruefeArt(zeile.art),
    zielSaetze: zeile.zielSaetze,
    zielWiederholungen: zeile.zielWiederholungen,
    zielGewichtG: zeile.zielGewichtG,
    zielSekunden: zeile.zielSekunden,
    aufwaermSaetze: zeile.aufwaermSaetze,
    aufwaermWiederholungen: zeile.aufwaermWiederholungen,
    aufwaermGewichtG: zeile.aufwaermGewichtG,
    aufwaermSekunden: zeile.aufwaermSekunden,
  };
}

function ladeZuordnungen(planIds: readonly number[]): Map<number, TrainingsplanUebung[]> {
  const gruppen = new Map<number, TrainingsplanUebung[]>();
  if (planIds.length === 0) {
    return gruppen;
  }
  const zeilen = alle<ZuordnungZeile>(
    `SELECT z.id, z.plan_id AS planId, z.uebung_id AS uebungId, u.name, u.art,
            z.ziel_saetze AS zielSaetze, z.ziel_wiederholungen AS zielWiederholungen,
            z.ziel_gewicht_g AS zielGewichtG, z.ziel_sekunden AS zielSekunden,
            z.aufwaerm_saetze AS aufwaermSaetze, z.aufwaerm_wiederholungen AS aufwaermWiederholungen,
            z.aufwaerm_gewicht_g AS aufwaermGewichtG, z.aufwaerm_sekunden AS aufwaermSekunden
     FROM trainingsplan_uebungen z
     JOIN uebungen u ON u.id = z.uebung_id
     WHERE z.plan_id IN (${platzhalter(planIds.length)})
     ORDER BY z.reihenfolge, z.id`,
    ...planIds,
  );
  for (const zeile of zeilen) {
    const liste = gruppen.get(zeile.planId) ?? [];
    liste.push(zuEintrag(zeile));
    gruppen.set(zeile.planId, liste);
  }
  return gruppen;
}

function zuPlan(zeile: PlanZeile, eintraege: TrainingsplanUebung[], loeschbar: ReadonlySet<number>): Trainingsplan {
  return {
    id: zeile.id,
    name: zeile.name,
    wochentage: liesWochentage(zeile.wochentage),
    vorlageId: zeile.vorlageId,
    vorlageName: zeile.vorlageName,
    projektId: zeile.projektId,
    projektName: zeile.projektName,
    archiviert: zeile.archiviert === 1,
    loeschbar: loeschbar.has(zeile.id),
    uebungen: eintraege,
  };
}

function ladeZeile(id: number): PlanZeile {
  const zeile = eine<PlanZeile>(`${PLAN_SPALTEN} WHERE p.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Der Trainingsplan');
  }
  return zeile;
}

function liefere(id: number): Trainingsplan {
  const zeile = ladeZeile(id);
  const eintraege = ladeZuordnungen([id]).get(id) ?? [];
  return zuPlan(zeile, eintraege, loeschbareMenge('trainingsplan'));
}

function ersetzeEintraege(planId: number, eintraege: readonly PlanEintragDaten[]): void {
  ausfuehren('DELETE FROM trainingsplan_uebungen WHERE plan_id = ?', planId);
  eintraege.forEach((eintrag, index) => {
    pruefeEintrag(eintrag);
    const uebungId = uebungFuerEintrag(eintrag.name, eintrag.art);
    ausfuehren(
      `INSERT INTO trainingsplan_uebungen (
         plan_id, uebung_id, reihenfolge, ziel_saetze, ziel_wiederholungen, ziel_gewicht_g, ziel_sekunden,
         aufwaerm_saetze, aufwaerm_wiederholungen, aufwaerm_gewicht_g, aufwaerm_sekunden
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      planId,
      uebungId,
      index + 1,
      eintrag.zielSaetze,
      eintrag.zielWiederholungen,
      eintrag.zielGewichtG,
      eintrag.zielSekunden,
      eintrag.aufwaermSaetze,
      eintrag.aufwaermWiederholungen,
      eintrag.aufwaermGewichtG,
      eintrag.aufwaermSekunden,
    );
  });
}

function speichern(id: number | null, aenderung: TrainingsplanAenderung): Trainingsplan {
  return inTransaktion(() => {
    const bisher = id === null ? null : ladeZeile(id);
    if (bisher && nurArchiv(aenderung)) {
      ausfuehren('UPDATE trainingsplaene SET archiviert = ? WHERE id = ?', Number(aenderung.archiviert), bisher.id);
      return liefere(bisher.id);
    }
    const name = pruefeName(aenderung.name ?? bisher?.name ?? '');
    const wochentage = normalisiereWochentage(aenderung.wochentage ?? liesWochentage(bisher?.wochentage ?? null));
    const projektId = aenderung.projektId !== undefined ? aenderung.projektId : (bisher?.projektId ?? null);
    const vorlageId = aenderung.vorlageId !== undefined ? aenderung.vorlageId : (bisher?.vorlageId ?? null);
    const archiviert = aenderung.archiviert ?? bisher?.archiviert === 1;
    if (id === null || aenderung.projektId !== undefined || aenderung.vorlageId !== undefined) {
      if (projektId !== null) {
        pruefeEbene('projekte');
      }
      pruefeProjektUndVorlage(projektId, vorlageId);
    }
    const zielId =
      id ??
      ausfuehren(
        `INSERT INTO trainingsplaene (name, wochentage, vorlage_id, projekt_id, archiviert) VALUES (?, ?, ?, ?, ?)`,
        name,
        schreibeWochentage(wochentage),
        vorlageId,
        projektId,
        Number(archiviert),
      ).id;
    if (id !== null) {
      ausfuehren(
        `UPDATE trainingsplaene SET name = ?, wochentage = ?, vorlage_id = ?, projekt_id = ?, archiviert = ? WHERE id = ?`,
        name,
        schreibeWochentage(wochentage),
        vorlageId,
        projektId,
        Number(archiviert),
        id,
      );
    }
    if (id === null || aenderung.uebungen !== undefined) {
      ersetzeEintraege(zielId, aenderung.uebungen ?? []);
    }
    return liefere(zielId);
  });
}

export function ladeTrainingsplan(id: number): Trainingsplan {
  const zeile = eine<PlanZeile>(`${PLAN_SPALTEN} WHERE p.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Der Trainingsplan');
  }
  return zuPlan(zeile, ladeZuordnungen([id]).get(id) ?? [], loeschbareMenge('trainingsplan'));
}

export function ladeTrainingsplaene(archiv = false): Trainingsplan[] {
  const zeilen = alle<PlanZeile>(
    `${PLAN_SPALTEN} WHERE p.archiviert = ? ORDER BY p.name COLLATE NOCASE, p.id`,
    Number(archiv),
  );
  const eintraege = ladeZuordnungen(zeilen.map((zeile) => zeile.id));
  const loeschbar = loeschbareMenge('trainingsplan');
  return zeilen.map((zeile) => zuPlan(zeile, eintraege.get(zeile.id) ?? [], loeschbar));
}

export function erstelleTrainingsplan(daten: TrainingsplanDaten): Trainingsplan {
  return speichern(null, daten);
}

export function aendereTrainingsplan(id: number, aenderung: TrainingsplanAenderung): Trainingsplan {
  return speichern(id, aenderung);
}

export function loescheTrainingsplan(id: number): void {
  loeschePlanZeile(id);
}
