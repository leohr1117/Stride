import type { Faehigkeit, FaehigkeitDaten, SkillErgebnis, SkillKnoten, SkillKnotenDaten } from '../../../shared/api/index.ts';
import { dreyfusStufe } from '../../../shared/spiel/begriffe.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../../shared/spiel/level.ts';
import { skillXp } from '../../../shared/spiel/xp.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { istLoeschbar, loeschbareMenge, pruefeKnotenLoeschbar } from '../../services/loeschen.ts';
import { pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { erstelleBelohnung, ladeLevelStand } from '../../services/fortschritt.ts';

interface FaehigkeitZeile {
  id: number;
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
  archiviert: number;
  xp: number;
  anzahlEintraege: number;
}

interface KnotenZeile {
  id: number;
  faehigkeitId: number;
  elternId: number | null;
  titel: string;
  beschreibung: string;
  freigeschaltetAm: string | null;
}

const FAEHIGKEIT_ABFRAGE = `
  SELECT f.id, f.name, f.beschreibung, f.farbe, f.icon, f.archiviert,
         COALESCE((SELECT SUM(xp) FROM faehigkeit_xp WHERE faehigkeit_id = f.id), 0) AS xp,
         (SELECT COUNT(*) FROM eintraege WHERE faehigkeit_id = f.id) AS anzahlEintraege
  FROM faehigkeiten f
`;

const KNOTEN_ABFRAGE = `
  SELECT id, faehigkeit_id AS faehigkeitId, eltern_id AS elternId, titel, beschreibung,
         freigeschaltet_am AS freigeschaltetAm
  FROM skill_knoten
`;

function tiefeVon(knoten: KnotenZeile, nachId: Map<number, KnotenZeile>): number {
  let tiefe = 0;
  let eltern = knoten.elternId === null ? undefined : nachId.get(knoten.elternId);
  while (eltern) {
    tiefe++;
    eltern = eltern.elternId === null ? undefined : nachId.get(eltern.elternId);
  }
  return tiefe;
}

function ladeKnotenJeFaehigkeit(faehigkeitId?: number): Map<number, SkillKnoten[]> {
  const zeilen = alle<KnotenZeile>(
    `${KNOTEN_ABFRAGE} ${faehigkeitId === undefined ? '' : 'WHERE faehigkeit_id = ?'} ORDER BY id`,
    ...(faehigkeitId === undefined ? [] : [faehigkeitId]),
  );
  const nachId = new Map(zeilen.map((zeile) => [zeile.id, zeile]));
  const frei = loeschbareMenge('knoten');
  const knoten = new Map<number, SkillKnoten[]>();
  for (const zeile of zeilen) {
    const liste = knoten.get(zeile.faehigkeitId) ?? [];
    liste.push({
      id: zeile.id,
      elternId: zeile.elternId,
      titel: zeile.titel,
      beschreibung: zeile.beschreibung,
      freigeschaltetAm: zeile.freigeschaltetAm,
      xp: skillXp(tiefeVon(zeile, nachId)),
      loeschbar: frei.has(zeile.id),
    });
    knoten.set(zeile.faehigkeitId, liste);
  }
  return knoten;
}

function zuFaehigkeit(zeile: FaehigkeitZeile, knoten: Map<number, SkillKnoten[]>): Faehigkeit {
  const level = berechneLevel(zeile.xp, LEVEL_KURVEN.faehigkeit);
  return {
    id: zeile.id,
    name: zeile.name,
    beschreibung: zeile.beschreibung,
    farbe: zeile.farbe,
    icon: zeile.icon,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('faehigkeit', zeile.id),
    level,
    stufe: dreyfusStufe(level.level),
    anzahlEintraege: zeile.anzahlEintraege,
    knoten: knoten.get(zeile.id) ?? [],
  };
}

export function ladeFaehigkeiten(): Faehigkeit[] {
  const knoten = ladeKnotenJeFaehigkeit();
  return alle<FaehigkeitZeile>(`${FAEHIGKEIT_ABFRAGE} ORDER BY f.archiviert, f.name COLLATE NOCASE`).map((zeile) =>
    zuFaehigkeit(zeile, knoten),
  );
}

export function ladeFaehigkeit(id: number): Faehigkeit {
  const zeile = eine<FaehigkeitZeile>(`${FAEHIGKEIT_ABFRAGE} WHERE f.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Fähigkeit');
  }
  return zuFaehigkeit(zeile, ladeKnotenJeFaehigkeit(id));
}

export function pruefeAktiveFaehigkeit(id: number): { name: string } {
  const faehigkeit = ladeFaehigkeit(id);
  if (faehigkeit.archiviert) {
    throw ungueltig('Die gewählte Fähigkeit ist archiviert.');
  }
  return { name: faehigkeit.name };
}

export function erstelleFaehigkeit(daten: FaehigkeitDaten): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  const { id } = ausfuehren(
    'INSERT INTO faehigkeiten (name, beschreibung, farbe, icon) VALUES (?, ?, ?, ?)',
    daten.name,
    daten.beschreibung,
    daten.farbe,
    daten.icon,
  );
  return ladeFaehigkeit(id);
}

export function aendereFaehigkeit(id: number, aenderung: Partial<FaehigkeitDaten> & { archiviert?: boolean }): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  ladeFaehigkeit(id);
  aktualisiere('faehigkeiten', id, {
    name: aenderung.name,
    beschreibung: aenderung.beschreibung,
    farbe: aenderung.farbe,
    icon: aenderung.icon,
    archiviert: alsZahl(aenderung.archiviert),
  });
  return ladeFaehigkeit(id);
}

function ladeKnoten(id: number): KnotenZeile {
  const knoten = eine<KnotenZeile>(`${KNOTEN_ABFRAGE} WHERE id = ?`, id);
  if (!knoten) {
    throw nichtGefunden('Der Skill');
  }
  return knoten;
}

function ladeSkillKnoten(id: number): SkillKnoten {
  const knoten = ladeKnoten(id);
  const gefunden = ladeKnotenJeFaehigkeit(knoten.faehigkeitId)
    .get(knoten.faehigkeitId)
    ?.find((eintrag) => eintrag.id === id);
  if (!gefunden) {
    throw nichtGefunden('Der Skill');
  }
  return gefunden;
}

export function erstelleKnoten(faehigkeitId: number, daten: SkillKnotenDaten): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  pruefeAktiveFaehigkeit(faehigkeitId);
  if (daten.elternId !== null && ladeKnoten(daten.elternId).faehigkeitId !== faehigkeitId) {
    throw ungueltig('Der übergeordnete Skill gehört zu einer anderen Fähigkeit.');
  }
  ausfuehren(
    'INSERT INTO skill_knoten (faehigkeit_id, eltern_id, titel, beschreibung) VALUES (?, ?, ?, ?)',
    faehigkeitId,
    daten.elternId,
    daten.titel,
    daten.beschreibung,
  );
  return ladeFaehigkeit(faehigkeitId);
}

export function aendereKnoten(id: number, aenderung: { titel?: string; beschreibung?: string }): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  const knoten = ladeKnoten(id);
  aktualisiere('skill_knoten', id, { titel: aenderung.titel, beschreibung: aenderung.beschreibung });
  return ladeFaehigkeit(knoten.faehigkeitId);
}

export function loescheKnoten(id: number): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  const knoten = ladeKnoten(id);
  pruefeKnotenLoeschbar(id);
  ausfuehren('DELETE FROM skill_knoten WHERE id = ?', id);
  return ladeFaehigkeit(knoten.faehigkeitId);
}

export function schalteSkillFrei(id: number, jetzt = leseJetzt()): SkillErgebnis {
  pruefeFunktion('faehigkeiten');
  const knoten = ladeSkillKnoten(id);
  const faehigkeitId = ladeKnoten(id).faehigkeitId;
  const { name } = pruefeAktiveFaehigkeit(faehigkeitId);
  if (knoten.freigeschaltetAm !== null) {
    throw ungueltig('Der Skill ist bereits freigeschaltet.');
  }

  const zeitpunkt = jetzt.toISOString();
  const vorher = ladeLevelStand(null, faehigkeitId);
  inTransaktion(() => {
    ausfuehren('UPDATE skill_knoten SET freigeschaltet_am = ? WHERE id = ?', zeitpunkt, id);
    ausfuehren(
      `INSERT INTO faehigkeit_xp (quelle, faehigkeit_id, knoten_id, xp, erstellt_am) VALUES ('knoten', ?, ?, ?, ?)`,
      faehigkeitId,
      id,
      knoten.xp,
      zeitpunkt,
    );
  });
  const nachher = ladeLevelStand(null, faehigkeitId);

  return {
    faehigkeit: ladeFaehigkeit(faehigkeitId),
    belohnung: erstelleBelohnung({
      buchungen: [],
      boni: [{ quelle: 'knoten', label: `Skill freigeschaltet: ${knoten.titel}`, xp: knoten.xp }],
      meilenstein: true,
      projekt: null,
      faehigkeit: { name, xp: knoten.xp },
      vorher,
      nachher,
    }),
  };
}

export function sperreSkill(id: number): Faehigkeit {
  pruefeFunktion('faehigkeiten');
  const knoten = ladeKnoten(id);
  if (knoten.freigeschaltetAm === null) {
    throw ungueltig('Der Skill ist nicht freigeschaltet.');
  }
  inTransaktion(() => {
    entferneFreischaltung(id);
  });
  return ladeFaehigkeit(knoten.faehigkeitId);
}

function entferneFreischaltung(knotenId: number): void {
  ausfuehren('DELETE FROM faehigkeit_xp WHERE knoten_id = ?', knotenId);
  ausfuehren('UPDATE skill_knoten SET freigeschaltet_am = NULL, eintrag_id = NULL WHERE id = ?', knotenId);
}

export function sperreSkillsDesEintrags(eintragId: number): void {
  for (const { id } of alle<{ id: number }>('SELECT id FROM skill_knoten WHERE eintrag_id = ?', eintragId)) {
    entferneFreischaltung(id);
  }
}
