import type { TodoistLabel, TodoistOhne, TodoistStatus, TodoistZuordnung } from '../../../shared/api/index.ts';
import { SATZ_BETREIBER, SATZ_UNLESBAR, artAusSpeicher } from '../../../shared/verbindungsFehler.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeLabels, ladeNutzername, ladeProjekte, type TodoistLabelQuelle, type TodoistProjekt } from '../../integrationen/todoist.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV } from '../ziele/kontext.ts';
import { pruefeAktiveVorlage } from '../taetigkeiten/vorlagen.ts';
import { type RegelAbschluss, type RegelQuelle, type ZielArt } from '../../services/todoistRegeln.ts';
import { leseWert, pruefeProjekt, setzeWert } from './gemeinsam.ts';
import { liesToken, packeToken, schluesselBrauchbar, verlangeSchluessel } from './tokenGeheim.ts';

export const SCHLUESSEL = {
  token: 'todoistToken',
  nutzer: 'todoistNutzer',
  seit: 'todoistSeit',
  abgleich: 'todoistAbgleich',
  fehler: 'todoistFehler',
  fehlerArt: 'todoistFehlerArt',
  ohne: 'todoistOhne',
  standard: 'todoistStandard',
} as const;

export interface TodoistZeile {
  todoistId: string;
  name: string;
  zielArt: string | null;
  zielId: number | null;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  faehigkeitId: number | null;
  abschluss: string | null;
  erkenntnis: string;
  notiz: string;
  meilenstein: number | null;
  aktiv: number;
}

export interface LabelZeile extends TodoistZeile {
  aktiv: number;
  rang: number;
  sortierung: number;
}

const PROJEKT_SPALTEN = `
  todoist_id AS todoistId, name, ziel_art AS zielArt, ziel_id AS zielId, projekt_id AS projektId,
  vorlage_id AS vorlageId, stunden, faehigkeit_id AS faehigkeitId, abschluss, erkenntnis, notiz, meilenstein,
  aktiv
`;

const LABEL_SPALTEN = `${PROJEKT_SPALTEN}, aktiv, rang, sortierung`;

export function alsZiel(wert: string | null): ZielArt | null {
  if (wert === 'vision' || wert === 'projekt' || wert === 'vorhaben') {
    return wert;
  }
  return null;
}

export function alsAbschluss(wert: string | null): RegelAbschluss | null {
  if (wert === 'geschafft' || wert === 'gescheitert' || wert === 'offen') {
    return wert;
  }
  return null;
}

export function ladeProjektZeilen(): TodoistZeile[] {
  return alle<TodoistZeile>(`SELECT ${PROJEKT_SPALTEN} FROM todoist_projekte ORDER BY sortierung, name`);
}

export function ladeLabelZeilen(): LabelZeile[] {
  return alle<LabelZeile>(`SELECT ${LABEL_SPALTEN} FROM todoist_labels`);
}

export function zuQuelle(zeile: TodoistZeile, meilenstein: boolean | null): RegelQuelle {
  return {
    zielArt: alsZiel(zeile.zielArt),
    zielId: zeile.zielId,
    projektId: zeile.projektId,
    vorlageId: zeile.vorlageId,
    stunden: zeile.stunden,
    faehigkeitId: zeile.faehigkeitId,
    abschluss: alsAbschluss(zeile.abschluss),
    erkenntnis: zeile.erkenntnis ?? '',
    notiz: zeile.notiz ?? '',
    meilenstein,
  };
}

function zuZuordnung(zeile: TodoistZeile): TodoistZuordnung {
  const abschluss = alsAbschluss(zeile.abschluss);
  return {
    todoistId: zeile.todoistId,
    name: zeile.name,
    zielArt: alsZiel(zeile.zielArt),
    zielId: zeile.zielId,
    projektId: zeile.projektId,
    vorlageId: zeile.vorlageId,
    stunden: zeile.stunden,
    faehigkeitId: zeile.faehigkeitId,
    abschluss: abschluss === 'offen' ? null : abschluss,
    erkenntnis: zeile.erkenntnis ?? '',
    notiz: zeile.notiz ?? '',
    meilenstein: zeile.meilenstein === 1,
    aktiv: zeile.aktiv === 1,
  };
}

function zuLabel(zeile: LabelZeile): TodoistLabel {
  return {
    ...zuZuordnung(zeile),
    aktiv: zeile.aktiv === 1,
    rang: zeile.rang,
    abschluss: alsAbschluss(zeile.abschluss),
    meilenstein: zeile.meilenstein === null ? null : zeile.meilenstein === 1,
  };
}

function sortiereLabels(zeilen: LabelZeile[]): LabelZeile[] {
  return [...zeilen].sort((links, rechts) => {
    if (links.aktiv !== rechts.aktiv) {
      return rechts.aktiv - links.aktiv;
    }
    if (links.aktiv === 1 && links.rang !== rechts.rang) {
      return links.rang - rechts.rang;
    }
    if (links.sortierung !== rechts.sortierung) {
      return links.sortierung - rechts.sortierung;
    }
    return links.name.localeCompare(rechts.name, 'de');
  });
}

export function loeseZiel(art: ZielArt, zielId: number, projektWahl: number | null): { projektId: number; vorhabenId: number | null } {
  if (art === 'projekt') {
    pruefeProjekt(zielId);
    return { projektId: zielId, vorhabenId: null };
  }
  if (art === 'vorhaben') {
    const vorhaben = eine<{ id: number; projektId: number | null; status: string }>(
      'SELECT id, projekt_id AS projektId, status FROM vorhaben WHERE id = ?',
      zielId,
    );
    if (!vorhaben) {
      throw nichtGefunden('Das Vorhaben');
    }
    if (vorhaben.status !== 'offen') {
      throw ungueltig('Das Vorhaben ist bereits abgeschlossen.');
    }
    if (vorhaben.projektId === null) {
      throw ungueltig('Das zugeordnete Projekt ist archiviert oder existiert nicht.');
    }
    pruefeProjekt(vorhaben.projektId);
    return { projektId: vorhaben.projektId, vorhabenId: vorhaben.id };
  }
  const vision = eine<{ id: number }>(
    'SELECT id FROM visionen WHERE id = ? AND archiviert = 0 AND erreicht_am IS NULL',
    zielId,
  );
  if (!vision) {
    throw ungueltig('Die Vision existiert nicht oder ist archiviert.');
  }
  const projekte = alle<{ id: number }>(
    `SELECT p.id FROM projekte p ${KONTEXT_JOINS}
     WHERE (p.vision_id = ? OR o.vision_id = ?) AND ${PROJEKT_AKTIV}
     ORDER BY p.name, p.id`,
    zielId,
    zielId,
  );
  if (projekte.length === 0) {
    throw ungueltig('Diese Vision hat kein aktives Projekt.');
  }
  if (projektWahl !== null && projekte.some((projekt) => projekt.id === projektWahl)) {
    return { projektId: projektWahl, vorhabenId: null };
  }
  if (projekte.length === 1) {
    return { projektId: projekte[0].id, vorhabenId: null };
  }
  throw ungueltig('Wähle ein Projekt für diese Vision.');
}

function zaehleUebernommen(): number {
  return eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM todoist_erledigt WHERE eintrag_id IS NOT NULL')?.wert ?? 0;
}

function ladeZuordnungen(): TodoistZuordnung[] {
  return ladeProjektZeilen().map(zuZuordnung);
}

export function liesTodoistOhne(): { art: TodoistOhne; vorlageId: number | null } {
  const art: TodoistOhne = leseWert(SCHLUESSEL.ohne) === 'standard' ? 'standard' : 'keine';
  const roh = leseWert(SCHLUESSEL.standard);
  const vorlageId = roh !== null && /^\d+$/.test(roh) ? Number(roh) : null;
  return { art, vorlageId: art === 'standard' ? vorlageId : null };
}

export function ladeTodoistStatus(): TodoistStatus {
  const gespeichert = leseWert(SCHLUESSEL.token);
  const lage = liesToken(gespeichert);
  const verbunden = lage.art !== 'keiner';
  const ohne = liesTodoistOhne();
  let fehler = leseWert(SCHLUESSEL.fehler);
  let fehlerArt = artAusSpeicher(leseWert(SCHLUESSEL.fehlerArt), fehler);
  if (lage.art === 'unlesbar') {
    fehler = lage.grund === 'kein-schluessel' ? SATZ_BETREIBER : SATZ_UNLESBAR;
    fehlerArt = 'schluessel';
  }
  return {
    verbunden,
    verfuegbar: schluesselBrauchbar() || verbunden,
    nutzer: leseWert(SCHLUESSEL.nutzer),
    seit: leseWert(SCHLUESSEL.seit),
    letzterAbgleich: leseWert(SCHLUESSEL.abgleich),
    fehler,
    fehlerArt,
    uebernommen: zaehleUebernommen(),
    ohneZuordnung: ohne.art,
    standardVorlageId: ohne.vorlageId,
    projekte: verbunden ? ladeZuordnungen() : [],
    labels: verbunden ? sortiereLabels(ladeLabelZeilen()).map(zuLabel) : [],
  };
}

export function setzeTodoistOhne(art: TodoistOhne, vorlageId: number | null): TodoistStatus {
  if (leseWert(SCHLUESSEL.token) === null) {
    return ladeTodoistStatus();
  }
  if (art === 'standard') {
    if (vorlageId === null) {
      throw ungueltig('Wähle eine Tätigkeit.');
    }
    pruefeAktiveVorlage(vorlageId);
    setzeWert(SCHLUESSEL.ohne, 'standard');
    setzeWert(SCHLUESSEL.standard, String(vorlageId));
  } else {
    setzeWert(SCHLUESSEL.ohne, 'keine');
    setzeWert(SCHLUESSEL.standard, null);
  }
  return ladeTodoistStatus();
}

export function speichereProjekte(projekte: TodoistProjekt[]): void {
  inTransaktion(() => {
    const vorhanden = new Set(projekte.map((projekt) => projekt.id));
    for (const { todoistId } of ladeZuordnungen()) {
      if (!vorhanden.has(todoistId)) {
        ausfuehren('DELETE FROM todoist_projekte WHERE todoist_id = ?', todoistId);
      }
    }
    for (const projekt of projekte) {
      ausfuehren(
        `INSERT INTO todoist_projekte (todoist_id, name, sortierung) VALUES (?, ?, ?)
         ON CONFLICT (todoist_id) DO UPDATE SET name = excluded.name, sortierung = excluded.sortierung`,
        projekt.id,
        projekt.name,
        projekt.sortierung,
      );
    }
  });
}

export function speichereLabels(labels: TodoistLabelQuelle[]): void {
  inTransaktion(() => {
    const vorhanden = new Set(labels.map((label) => label.id));
    for (const zeile of ladeLabelZeilen()) {
      if (!vorhanden.has(zeile.todoistId)) {
        ausfuehren('DELETE FROM todoist_labels WHERE todoist_id = ?', zeile.todoistId);
      }
    }
    for (const label of labels) {
      ausfuehren(
        `INSERT INTO todoist_labels (todoist_id, name, sortierung, rang) VALUES (?, ?, ?, ?)
         ON CONFLICT (todoist_id) DO UPDATE SET name = excluded.name, sortierung = excluded.sortierung`,
        label.id,
        label.name,
        label.sortierung,
        label.sortierung,
      );
    }
  });
}

export async function verbindeTodoist(token: string, jetzt = leseJetzt()): Promise<TodoistStatus> {
  verlangeSchluessel();
  const nutzer = await ladeNutzername(token);
  const projekte = await ladeProjekte(token);
  const labels = await ladeLabels(token);
  inTransaktion(() => {
    setzeWert(SCHLUESSEL.token, packeToken(token));
    setzeWert(SCHLUESSEL.nutzer, nutzer);
    setzeWert(SCHLUESSEL.seit, jetzt.toISOString());
    setzeWert(SCHLUESSEL.fehler, null);
    setzeWert(SCHLUESSEL.fehlerArt, null);
  });
  speichereProjekte(projekte);
  speichereLabels(labels);
  return ladeTodoistStatus();
}

export function trenneTodoist(): void {
  inTransaktion(() => {
    for (const schluessel of Object.values(SCHLUESSEL)) {
      setzeWert(schluessel, null);
    }
    ausfuehren('DELETE FROM todoist_projekte');
    ausfuehren('DELETE FROM todoist_labels');
  });
}
