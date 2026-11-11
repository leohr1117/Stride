import type { Vorlage, VorlageAbzug, VorlageDaten, VorlageGewicht } from '../../../shared/api/index.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { istLoeschbar } from '../../services/loeschen.ts';
import { anteileFehler } from '../../validierung.ts';
import { aktiveTypen, ladeWirksameAttribute, pruefeWirksameAttribute } from '../attribute/attribute.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV } from '../ziele/kontext.ts';

interface VorlageZeile {
  id: number;
  name: string;
  icon: string;
  archiviert: number;
  festeAnteile: number;
  projektId: number | null;
  projektName: string | null;
}

export interface AktiveVerteilung {
  gewichte: VorlageGewicht[];
  fest: boolean;
  abzuege: VorlageAbzug[];
}

const VORLAGE_ABFRAGE = `
  SELECT v.id, v.name, v.icon, v.archiviert, v.feste_anteile AS festeAnteile,
         v.projekt_id AS projektId, p.name AS projektName
  FROM vorlagen v
  LEFT JOIN projekte p ON p.id = v.projekt_id
`;

function ladeGewichte(vorlageId?: number): Map<number, VorlageGewicht[]> {
  const zeilen = alle<{ vorlageId: number; attributId: number; gewicht: number }>(
    `SELECT g.vorlage_id AS vorlageId, g.attribut_id AS attributId, g.gewicht
     FROM vorlage_gewichte g
     JOIN attribute a ON a.id = g.attribut_id
     ${vorlageId === undefined ? '' : 'WHERE g.vorlage_id = ?'}
     ORDER BY g.gewicht DESC, a.sortierung`,
    ...(vorlageId === undefined ? [] : [vorlageId]),
  );
  const gewichte = new Map<number, VorlageGewicht[]>();
  for (const { vorlageId: id, ...gewicht } of zeilen) {
    const liste = gewichte.get(id) ?? [];
    liste.push(gewicht);
    gewichte.set(id, liste);
  }
  return gewichte;
}

function ladeAbzuege(vorlageId?: number): Map<number, VorlageAbzug[]> {
  const zeilen = alle<{ vorlageId: number; attributId: number; prozent: number }>(
    `SELECT z.vorlage_id AS vorlageId, z.attribut_id AS attributId, z.prozent
     FROM vorlage_abzuege z
     JOIN attribute a ON a.id = z.attribut_id
     ${vorlageId === undefined ? '' : 'WHERE z.vorlage_id = ?'}
     ORDER BY z.prozent DESC, a.sortierung`,
    ...(vorlageId === undefined ? [] : [vorlageId]),
  );
  const abzuege = new Map<number, VorlageAbzug[]>();
  for (const { vorlageId: id, ...abzug } of zeilen) {
    const liste = abzuege.get(id) ?? [];
    liste.push(abzug);
    abzuege.set(id, liste);
  }
  return abzuege;
}

function zuVorlage(zeile: VorlageZeile, gewichte: Map<number, VorlageGewicht[]>, abzuege: Map<number, VorlageAbzug[]>): Vorlage {
  return {
    id: zeile.id,
    name: zeile.name,
    icon: zeile.icon,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('vorlage', zeile.id),
    projektId: zeile.projektId,
    projektName: zeile.projektName,
    festeAnteile: zeile.festeAnteile === 1,
    gewichte: gewichte.get(zeile.id) ?? [],
    abzuege: abzuege.get(zeile.id) ?? [],
  };
}

export function ladeVorlagen(): Vorlage[] {
  const gewichte = ladeGewichte();
  const abzuege = ladeAbzuege();
  return alle<VorlageZeile>(`${VORLAGE_ABFRAGE} ORDER BY v.archiviert, v.sortierung, v.id`).map((zeile) =>
    zuVorlage(zeile, gewichte, abzuege),
  );
}

export function ladeVorlage(id: number): Vorlage {
  const zeile = eine<VorlageZeile>(`${VORLAGE_ABFRAGE} WHERE v.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Tätigkeit');
  }
  return zuVorlage(zeile, ladeGewichte(id), ladeAbzuege(id));
}

export function ladeAktiveVerteilung(vorlageId: number): AktiveVerteilung {
  const vorlage = ladeVorlage(vorlageId);
  if (vorlage.archiviert) {
    throw ungueltig('Die Tätigkeit ist archiviert.');
  }
  const typen = aktiveTypen();
  const filter = `a.archiviert = 0 AND a.typ IN (${platzhalter(typen.length)})`;
  const gewichte = alle<VorlageGewicht>(
    `SELECT g.attribut_id AS attributId, g.gewicht
     FROM vorlage_gewichte g
     JOIN attribute a ON a.id = g.attribut_id
     WHERE g.vorlage_id = ? AND ${filter}
     ORDER BY a.sortierung`,
    vorlageId,
    ...typen,
  );
  if (gewichte.length === 0) {
    throw ungueltig(`Die Tätigkeit "${vorlage.name}" stärkt kein aktives Attribut. Passe sie unter "Mehr" an.`);
  }
  const abzuege = alle<VorlageAbzug>(
    `SELECT z.attribut_id AS attributId, z.prozent
     FROM vorlage_abzuege z
     JOIN attribute a ON a.id = z.attribut_id
     WHERE z.vorlage_id = ? AND ${filter}
     ORDER BY a.sortierung`,
    vorlageId,
    ...typen,
  );
  return { gewichte, fest: vorlage.festeAnteile, abzuege };
}

export function ladeAktiveGewichte(vorlageId: number): VorlageGewicht[] {
  return ladeAktiveVerteilung(vorlageId).gewichte;
}

export function pruefeAktiveVorlage(id: number): void {
  if (ladeVorlage(id).archiviert) {
    throw ungueltig('Die gewählte Tätigkeit ist archiviert.');
  }
}

export function pruefeVorlageZumProjekt(vorlageId: number, projektId: number | null): void {
  const vorlage = ladeVorlage(vorlageId);
  if (vorlage.projektId !== null && vorlage.projektId !== projektId) {
    throw ungueltig('Die Tätigkeit gehört zu einem anderen Projekt.');
  }
}

function pruefeFesteAnteile(daten: {
  festeAnteile: boolean;
  gewichte: VorlageGewicht[];
  abzuege: VorlageAbzug[];
}): void {
  if (!daten.festeAnteile) {
    return;
  }
  const fehler = anteileFehler(daten);
  if (fehler) {
    throw ungueltig(fehler);
  }
}

function setzeAbzuege(vorlageId: number, abzuege: VorlageAbzug[]): void {
  pruefeWirksameAttribute(abzuege.map((abzug) => abzug.attributId));
  const wirksam = ladeWirksameAttribute().map((attribut) => attribut.id);
  if (wirksam.length > 0) {
    ausfuehren(
      `DELETE FROM vorlage_abzuege WHERE vorlage_id = ? AND attribut_id IN (${platzhalter(wirksam.length)})`,
      vorlageId,
      ...wirksam,
    );
  }
  for (const abzug of abzuege) {
    ausfuehren(
      'INSERT INTO vorlage_abzuege (vorlage_id, attribut_id, prozent) VALUES (?, ?, ?)',
      vorlageId,
      abzug.attributId,
      abzug.prozent,
    );
  }
}

function setzeGewichte(vorlageId: number, gewichte: VorlageGewicht[]): void {
  pruefeWirksameAttribute(gewichte.map((gewicht) => gewicht.attributId));
  const wirksam = ladeWirksameAttribute().map((attribut) => attribut.id);
  if (wirksam.length > 0) {
    ausfuehren(
      `DELETE FROM vorlage_gewichte WHERE vorlage_id = ? AND attribut_id IN (${platzhalter(wirksam.length)})`,
      vorlageId,
      ...wirksam,
    );
  }
  for (const gewicht of gewichte) {
    ausfuehren(
      'INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht) VALUES (?, ?, ?)',
      vorlageId,
      gewicht.attributId,
      gewicht.gewicht,
    );
  }
}

export function erstelleVorlage(daten: VorlageDaten): Vorlage {
  const projektId = daten.projektId ?? null;
  if (projektId !== null) {
    const projekt = eine<{ id: number }>('SELECT id FROM projekte WHERE id = ?', projektId);
    if (!projekt) {
      throw nichtGefunden('Das Projekt');
    }
  }
  pruefeFesteAnteile({
    festeAnteile: daten.festeAnteile === true,
    gewichte: daten.gewichte,
    abzuege: daten.abzuege ?? [],
  });
  const id = inTransaktion(() => {
    const { naechste } = eine<{ naechste: number }>(
      'SELECT COALESCE(MAX(sortierung), 0) + 1 AS naechste FROM vorlagen',
    ) ?? { naechste: 1 };
    const { id: neueId } = ausfuehren(
      'INSERT INTO vorlagen (name, icon, sortierung, projekt_id, feste_anteile) VALUES (?, ?, ?, ?, ?)',
      daten.name,
      daten.icon,
      naechste,
      projektId,
      daten.festeAnteile === true ? 1 : 0,
    );
    setzeGewichte(neueId, daten.gewichte);
    if (daten.abzuege !== undefined) {
      setzeAbzuege(neueId, daten.abzuege);
    }
    return neueId;
  });
  return ladeVorlage(id);
}

export function aendereVorlage(id: number, aenderung: Partial<VorlageDaten> & { archiviert?: boolean }): Vorlage {
  const bisher = ladeVorlage(id);
  const fest = aenderung.festeAnteile ?? bisher.festeAnteile;
  pruefeFesteAnteile({
    festeAnteile: fest,
    gewichte: aenderung.gewichte ?? bisher.gewichte,
    abzuege: aenderung.abzuege ?? bisher.abzuege,
  });
  if (aenderung.archiviert === true) {
    const verwendet = eine<{ name: string }>(
      `SELECT p.name FROM projekte p ${KONTEXT_JOINS} WHERE p.standard_vorlage_id = ? AND ${PROJEKT_AKTIV} LIMIT 1`,
      id,
    );
    if (verwendet) {
      throw ungueltig(`Die Tätigkeit ist Standard im Projekt "${verwendet.name}". Wähle dort zuerst eine andere.`);
    }
    const abschluss = eine<{ name: string }>(
      `SELECT p.name FROM projekte p ${KONTEXT_JOINS} WHERE p.abschluss_vorlage_id = ? AND ${PROJEKT_AKTIV} LIMIT 1`,
      id,
    );
    if (abschluss) {
      throw ungueltig(`Die Tätigkeit ist die Abschlusstätigkeit im Projekt "${abschluss.name}". Wähle dort zuerst eine andere.`);
    }
  }

  if (aenderung.projektId !== undefined && aenderung.projektId !== null) {
    const projekt = eine<{ id: number }>('SELECT id FROM projekte WHERE id = ?', aenderung.projektId);
    if (!projekt) {
      throw nichtGefunden('Das Projekt');
    }
    const fremd = eine<{ name: string; standard: number; abschluss: number }>(
      `SELECT p.name,
              (p.standard_vorlage_id = ?) AS standard,
              (p.abschluss_vorlage_id = ?) AS abschluss
       FROM projekte p ${KONTEXT_JOINS}
       WHERE (p.standard_vorlage_id = ? OR p.abschluss_vorlage_id = ?) AND p.id != ? AND ${PROJEKT_AKTIV}
       LIMIT 1`,
      id,
      id,
      id,
      id,
      aenderung.projektId,
    );
    if (fremd?.standard) {
      throw ungueltig(`Die Tätigkeit ist Standard im Projekt "${fremd.name}". Wähle dort zuerst eine andere.`);
    }
    if (fremd?.abschluss) {
      throw ungueltig(`Die Tätigkeit ist die Abschlusstätigkeit im Projekt "${fremd.name}". Wähle dort zuerst eine andere.`);
    }
  }

  inTransaktion(() => {
    aktualisiere('vorlagen', id, {
      name: aenderung.name,
      icon: aenderung.icon,
      archiviert: alsZahl(aenderung.archiviert),
      projekt_id: aenderung.projektId === undefined ? undefined : aenderung.projektId,
      feste_anteile: alsZahl(aenderung.festeAnteile),
    });
    if (aenderung.gewichte !== undefined) {
      setzeGewichte(id, aenderung.gewichte);
    }
    if (aenderung.abzuege !== undefined) {
      setzeAbzuege(id, aenderung.abzuege);
    }
  });
  return ladeVorlage(id);
}

export function ordneVorlagen(ids: number[]): Vorlage[] {
  const aktiv = alle<{ id: number }>('SELECT id FROM vorlagen WHERE archiviert = 0');
  const menge = new Set(aktiv.map((zeile) => zeile.id));
  if (ids.length !== menge.size || new Set(ids).size !== ids.length || ids.some((id) => !menge.has(id))) {
    throw ungueltig('Die Angaben sind unvollständig.');
  }
  inTransaktion(() => {
    ids.forEach((id, index) => {
      ausfuehren('UPDATE vorlagen SET sortierung = ? WHERE id = ?', index, id);
    });
  });
  return ladeVorlagen();
}
