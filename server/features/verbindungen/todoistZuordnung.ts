import type { TodoistLabelDaten, TodoistStatus, TodoistZuordnungDaten } from '../../../shared/api/index.ts';
import { ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { pruefeAktiveFaehigkeit } from '../faehigkeiten/faehigkeiten.ts';
import { type ZielArt } from '../../services/todoistRegeln.ts';
import { pruefeAktiveVorlage, pruefeVorlageZumProjekt } from '../taetigkeiten/vorlagen.ts';
import { alsAbschluss, ladeLabelZeilen, ladeProjektZeilen, ladeTodoistStatus, loeseZiel } from './todoist.ts';

function schreibeProjekt(todoistId: string, werte: {
  zielArt: ZielArt | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: string | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: number;
}): void {
  ausfuehren(
    `UPDATE todoist_projekte
     SET ziel_art = ?, ziel_id = ?, projekt_id = ?, vorlage_id = ?, stunden = ?,
         faehigkeit_id = ?, abschluss = ?, erkenntnis = ?, notiz = ?, meilenstein = ?
     WHERE todoist_id = ?`,
    werte.zielArt,
    werte.zielId,
    werte.projektId,
    werte.vorlageId,
    werte.stunden,
    werte.faehigkeitId,
    werte.abschluss,
    werte.erkenntnis,
    werte.notiz,
    werte.meilenstein,
    todoistId,
  );
}

export function ordneTodoistProjektZu(todoistId: string, daten: TodoistZuordnungDaten): TodoistStatus {
  const bisher = ladeProjektZeilen().find((zeile) => zeile.todoistId === todoistId);
  if (!bisher) {
    throw nichtGefunden('Das Todoist-Projekt');
  }
  const zielArt: ZielArt | null =
    daten.zielArt === undefined ? (daten.projektId !== null ? 'projekt' : null) : daten.zielArt;
  const zielId = daten.zielArt === undefined ? daten.projektId : (daten.zielId ?? null);
  const faehigkeitId = daten.faehigkeitId !== undefined ? daten.faehigkeitId : bisher.faehigkeitId;
  const rohAbschluss = daten.abschluss !== undefined ? daten.abschluss : alsAbschluss(bisher.abschluss);
  const abschluss = rohAbschluss === 'offen' ? null : rohAbschluss;
  const erkenntnis = daten.erkenntnis !== undefined ? daten.erkenntnis : bisher.erkenntnis;
  const notiz = daten.notiz !== undefined ? daten.notiz : bisher.notiz;
  const meilenstein = daten.meilenstein !== undefined ? daten.meilenstein : bisher.meilenstein === 1;
  let projektId: number | null = null;
  if (zielArt !== null && zielId !== null) {
    projektId = loeseZiel(zielArt, zielId, daten.projektId).projektId;
    if (daten.vorlageId !== null) {
      pruefeAktiveVorlage(daten.vorlageId);
      pruefeVorlageZumProjekt(daten.vorlageId, projektId);
    }
  } else if (daten.vorlageId !== null) {
    pruefeAktiveVorlage(daten.vorlageId);
  }
  if ((zielArt !== null && zielId !== null || daten.vorlageId !== null) && faehigkeitId !== null && faehigkeitId > 0) {
    pruefeAktiveFaehigkeit(faehigkeitId);
  }
  schreibeProjekt(todoistId, {
    zielArt: zielArt !== null && zielId !== null ? zielArt : null,
    zielId: zielArt !== null ? zielId : null,
    projektId,
    vorlageId: daten.vorlageId,
    stunden: daten.stunden,
    faehigkeitId,
    abschluss,
    erkenntnis,
    notiz,
    meilenstein: meilenstein ? 1 : 0,
  });
  return ladeTodoistStatus();
}

export function ordneTodoistLabel(todoistId: string, daten: TodoistLabelDaten): TodoistStatus {
  const bisher = ladeLabelZeilen().find((zeile) => zeile.todoistId === todoistId);
  if (!bisher) {
    throw nichtGefunden('Das Label');
  }
  let projektId: number | null = null;
  if (daten.aktiv && daten.zielArt !== null && daten.zielId !== null) {
    projektId = loeseZiel(daten.zielArt, daten.zielId, daten.projektId).projektId;
    if (daten.vorlageId !== null) {
      pruefeAktiveVorlage(daten.vorlageId);
      pruefeVorlageZumProjekt(daten.vorlageId, projektId);
    }
  } else if (daten.aktiv && daten.vorlageId !== null) {
    pruefeAktiveVorlage(daten.vorlageId);
  }
  if (daten.aktiv && daten.faehigkeitId !== null && daten.faehigkeitId > 0) {
    pruefeAktiveFaehigkeit(daten.faehigkeitId);
  }
  let rang = bisher.rang;
  if (daten.aktiv && bisher.aktiv !== 1) {
    const max = eine<{ wert: number | null }>('SELECT MAX(rang) AS wert FROM todoist_labels WHERE aktiv = 1');
    rang = (max?.wert ?? -1) + 1;
  }
  ausfuehren(
    `UPDATE todoist_labels
     SET aktiv = ?, rang = ?, ziel_art = ?, ziel_id = ?, projekt_id = ?, vorlage_id = ?, stunden = ?,
         faehigkeit_id = ?, abschluss = ?, erkenntnis = ?, notiz = ?, meilenstein = ?
     WHERE todoist_id = ?`,
    daten.aktiv ? 1 : 0,
    rang,
    daten.zielArt,
    daten.zielId,
    projektId,
    daten.vorlageId,
    daten.stunden,
    daten.faehigkeitId,
    daten.abschluss,
    daten.erkenntnis,
    daten.notiz,
    daten.meilenstein === null ? null : daten.meilenstein ? 1 : 0,
    todoistId,
  );
  return ladeTodoistStatus();
}

export function ordneTodoistLabelReihenfolge(ids: string[]): TodoistStatus {
  const aktiv = ladeLabelZeilen().filter((zeile) => zeile.aktiv === 1);
  const menge = new Set(aktiv.map((zeile) => zeile.todoistId));
  if (ids.length !== menge.size || new Set(ids).size !== ids.length || ids.some((id) => !menge.has(id))) {
    throw ungueltig('Die Angaben sind unvollständig.');
  }
  inTransaktion(() => {
    ids.forEach((id, index) => {
      ausfuehren('UPDATE todoist_labels SET rang = ? WHERE todoist_id = ?', index, id);
    });
  });
  return ladeTodoistStatus();
}
