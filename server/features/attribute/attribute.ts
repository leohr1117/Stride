import type { AktivierungsModus, Attribut, AttributDaten } from '../../../shared/api/index.ts';
import { attributVorlage } from '../../../shared/features/attribute/attributKatalog.ts';
import { ATTRIBUT_TYP_INFO, type AttributKennung, type AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { erschoepfungsFaktor, type VerfallStufe } from '../../../shared/spiel/belastung.ts';
import { istTypAktiv, verfallFunktion } from '../../../shared/spiel/funktionen.ts';
import { bestimmeKlasse, type KennungsWert } from '../../../shared/spiel/klassen.ts';
import { berechneLevel, LEVEL_KURVEN, xpBisLevel, type LevelInfo } from '../../../shared/spiel/level.ts';
import { planeUmverteilung, zielXpNachAnteil } from '../../../shared/spiel/umverteilung.ts';
import type { Gewicht } from '../../../shared/spiel/xp.ts';
import { zeige } from '../../../shared/sprache/index.ts';
import { anfrageSprache } from '../../anfrageSprache.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { istLoeschbar } from '../../services/loeschen.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { lokalesDatum } from '../../services/zeit.ts';

interface AttributZeile {
  id: number;
  typ: AttributTyp;
  kennung: AttributKennung | null;
  name: string;
  beschreibung: string;
  farbe: string;
  icon: string;
  archiviert: number;
  verfallBelastung: VerfallStufe;
  verfallZeit: VerfallStufe;
  erschoepfung: number;
  erschoepfungZiel: number | null;
  archivAnteil: number | null;
  xp: number;
  hoechstXp: number;
}

export interface ErschoepfungRegel {
  quelleId: number;
  quelleName: string;
  zielId: number | null;
  zielName: string | null;
  faktor: number;
}

function zuAttribut(zeile: AttributZeile): Attribut {
  return {
    id: zeile.id,
    typ: zeile.typ,
    kennung: zeile.kennung,
    name: zeile.name,
    beschreibung: zeile.beschreibung,
    farbe: zeile.farbe,
    icon: zeile.icon,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('attribut', zeile.id),
    level: berechneLevel(zeile.xp, LEVEL_KURVEN[zeile.typ]),
    hoechstXp: Math.max(0, zeile.xp, zeile.hoechstXp),
    verfallBelastung: zeile.verfallBelastung,
    verfallZeit: zeile.verfallZeit,
    erschoepfung: zeile.erschoepfung === 1,
    erschoepfungZiel: zeile.erschoepfungZiel,
    archivAnteil: zeile.archivAnteil,
  };
}

const ATTRIBUT_ABFRAGE = `
  SELECT a.id, a.typ, a.kennung, a.name, a.beschreibung, a.farbe, a.icon, a.archiviert,
         a.verfall_belastung AS verfallBelastung, a.verfall_zeit AS verfallZeit,
         a.erschoepfung, a.erschoepfung_ziel AS erschoepfungZiel, a.archiv_anteil AS archivAnteil,
         COALESCE(SUM(x.xp), 0) AS xp,
         COALESCE(MAX(spitze.hoechstXp), 0) AS hoechstXp
  FROM attribute a
  LEFT JOIN xp_ereignisse x ON x.attribut_id = a.id
  LEFT JOIN (
    SELECT attribut_id, MAX(stand) AS hoechstXp
    FROM (
      SELECT attribut_id, SUM(xp) OVER (PARTITION BY attribut_id ORDER BY erstellt_am, id) AS stand
      FROM xp_ereignisse
    ) lauf
    GROUP BY attribut_id
  ) spitze ON spitze.attribut_id = a.id
`;

export function aktiveTypen(): AttributTyp[] {
  const funktionen = ladeEinstellungen().funktionen;
  const typen: AttributTyp[] = [];
  for (const typ of ['attribut', 'status'] as const) {
    if (istTypAktiv(funktionen, typ)) {
      typen.push(typ);
    }
  }
  return typen;
}

export function ladeAttribute(mitArchivierten: boolean): Attribut[] {
  const zeilen = alle<AttributZeile>(
    `${ATTRIBUT_ABFRAGE} WHERE ? = 1 OR a.archiviert = 0 GROUP BY a.id ORDER BY a.sortierung, a.id`,
    Number(mitArchivierten),
  );
  return zeilen.map(zuAttribut);
}

export function ladeWirksameAttribute(): Attribut[] {
  const typen = aktiveTypen();
  return ladeAttribute(false).filter((attribut) => typen.includes(attribut.typ));
}

export function pruefeTypAktiv(typ: AttributTyp): void {
  if (!aktiveTypen().includes(typ)) {
    throw ungueltig(`${ATTRIBUT_TYP_INFO[typ].mehrzahl} ist in den Einstellungen ausgeschaltet.`);
  }
}

export function pruefeWirksameAttribute(ids: number[]): void {
  pruefeAktiveAttribute(ids);
  for (const id of new Set(ids)) {
    pruefeTypAktiv(ladeAttribut(id).typ);
  }
}

export function nurWirksameGewichte(gewichte: Gewicht[]): Gewicht[] {
  const wirksam = new Set(ladeWirksameAttribute().map((attribut) => attribut.id));
  return gewichte.filter((gewicht) => wirksam.has(gewicht.attributId));
}

export function ladeAttribut(id: number): Attribut {
  const zeile = eine<AttributZeile>(`${ATTRIBUT_ABFRAGE} WHERE a.id = ? GROUP BY a.id`, id);
  if (!zeile) {
    throw nichtGefunden('Das Attribut');
  }
  return zuAttribut(zeile);
}

export function ladeCharakterLevel(): LevelInfo {
  const { xp } = eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse') ?? { xp: 0 };
  return berechneLevel(xp, LEVEL_KURVEN.charakter);
}

export function ladeKlasse(): string {
  const werte: KennungsWert[] = [];
  for (const attribut of ladeWirksameAttribute()) {
    if (attribut.kennung !== null) {
      werte.push({ kennung: attribut.kennung, level: attribut.level.level });
    }
  }
  return bestimmeKlasse(werte);
}

export function ladeErschoepfungen(): ErschoepfungRegel[] {
  const attribute = ladeWirksameAttribute();
  const regeln: ErschoepfungRegel[] = [];
  for (const quelle of attribute) {
    if (quelle.erschoepfung) {
      let hoechstesAnderes = 0;
      for (const attribut of attribute) {
        if (attribut.id !== quelle.id && attribut.typ === quelle.typ) {
          hoechstesAnderes = Math.max(hoechstesAnderes, attribut.level.level);
        }
      }
      const ziel = attribute.find((attribut) => attribut.id === quelle.erschoepfungZiel) ?? null;
      if (quelle.erschoepfungZiel !== null && ziel === null) {
        continue;
      }
      regeln.push({
        quelleId: quelle.id,
        quelleName: quelle.name,
        zielId: ziel?.id ?? null,
        zielName: ziel?.name ?? null,
        faktor: erschoepfungsFaktor(quelle.level.level, hoechstesAnderes),
      });
    }
  }
  return regeln;
}

export function ladeAttributXp(attributId: number): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', attributId)?.xp ?? 0;
}

export function aktivesAttribut(kennung: AttributKennung): number | null {
  const typen = aktiveTypen();
  const zeile = eine<{ id: number; typ: AttributTyp }>(
    'SELECT id, typ FROM attribute WHERE kennung = ? AND archiviert = 0',
    kennung,
  );
  return zeile && typen.includes(zeile.typ) ? zeile.id : null;
}

export function ladeBelastendeAttribute(): { id: number; stufe: VerfallStufe }[] {
  const typen = aktiveTypen();
  const funktionen = ladeEinstellungen().funktionen;
  return alle<{ id: number; typ: AttributTyp; stufe: VerfallStufe }>(
    `SELECT id, typ, verfall_belastung AS stufe FROM attribute WHERE archiviert = 0 AND verfall_belastung <> 'aus'`,
  ).filter((attribut) => typen.includes(attribut.typ) && funktionen[verfallFunktion(attribut.typ)]);
}

function zaehleAktive(typ: AttributTyp): number {
  return eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM attribute WHERE typ = ? AND archiviert = 0', typ)
    ?.anzahl ?? 0;
}

function ladeGesamtXp(): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse')?.xp ?? 0;
}

function setzeAttributXp(attributId: number, zielXp: number, jetzt: Date): void {
  const typen = aktiveTypen();
  const staende = ladeAttribute(false)
    .filter((attribut) => attribut.id === attributId || typen.includes(attribut.typ))
    .map((attribut) => ({ attributId: attribut.id, xp: attribut.level.xpGesamt }));
  const zeitpunkt = jetzt.toISOString();
  for (const anteil of planeUmverteilung(attributId, zielXp, staende)) {
    ausfuehren(
      `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
      anteil.attributId,
      anteil.xp,
      zeitpunkt,
    );
  }
}

function zielXpFuer(
  typ: AttributTyp,
  modus: AktivierungsModus,
  level: number | null,
  archivAnteil: number | null,
): number | null {
  if (modus === 'level') {
    if (level === null) {
      throw ungueltig('Gib ein Level an.');
    }
    return xpBisLevel(level, LEVEL_KURVEN[typ]);
  }
  if (modus === 'anteil') {
    if (archivAnteil === null) {
      throw ungueltig('Für dieses Attribut gibt es keinen früheren Anteil.');
    }
    return zielXpNachAnteil(archivAnteil, ladeGesamtXp());
  }
  return null;
}

export function aktiviereAttribut(
  kennung: AttributKennung,
  modus: AktivierungsModus,
  level: number | null,
  jetzt = new Date(),
): Attribut {
  const vorhanden = eine<{ id: number; archiviert: number; archivAnteil: number | null }>(
    'SELECT id, archiviert, archiv_anteil AS archivAnteil FROM attribute WHERE kennung = ?',
    kennung,
  );
  if (vorhanden && vorhanden.archiviert === 0) {
    throw ungueltig('Dieses Attribut ist bereits aktiv.');
  }
  const vorlage = attributVorlage(kennung);
  pruefeTypAktiv(vorlage.typ);
  const zielXp = zielXpFuer(vorlage.typ, modus, level, vorhanden?.archivAnteil ?? null);

  const id = inTransaktion(() => {
    let attributId: number;
    if (vorhanden) {
      ausfuehren('UPDATE attribute SET archiviert = 0, verfall_bis = ? WHERE id = ?', lokalesDatum(jetzt), vorhanden.id);
      attributId = vorhanden.id;
    } else {
      const { naechste } = eine<{ naechste: number }>(
        'SELECT COALESCE(MAX(sortierung), 0) + 1 AS naechste FROM attribute',
      ) ?? { naechste: 1 };
      const sprache = ladeEinstellungen().sprache ?? anfrageSprache();
      attributId = ausfuehren(
        `INSERT INTO attribute (typ, kennung, name, beschreibung, farbe, icon, sortierung, verfall_bis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        vorlage.typ,
        vorlage.kennung,
        zeige(vorlage.name, sprache),
        zeige(vorlage.beschreibung, sprache),
        vorlage.farbe,
        vorlage.icon,
        naechste,
        lokalesDatum(jetzt),
      ).id;
    }
    if (zielXp !== null) {
      setzeAttributXp(attributId, zielXp, jetzt);
    }
    return attributId;
  });
  return ladeAttribut(id);
}

function pruefeErschoepfungsZiel(attributId: number, zielId: number | null | undefined): void {
  if (zielId === undefined || zielId === null) {
    return;
  }
  if (zielId === attributId) {
    throw ungueltig('Die Erschöpfung kann nicht auf das eigene Attribut wirken.');
  }
  pruefeWirksameAttribute([zielId]);
}

export function aendereAttribut(
  id: number,
  aenderung: Partial<AttributDaten> & { archiviert?: boolean },
  jetzt = new Date(),
): Attribut {
  const bisher = ladeAttribut(id);
  const wirdArchiviert = aenderung.archiviert === true && !bisher.archiviert;
  if (aenderung.archiviert === false && bisher.archiviert) {
    pruefeTypAktiv(bisher.typ);
  }
  if (wirdArchiviert && zaehleAktive(bisher.typ) <= 1) {
    throw ungueltig(
      `Der letzte ${ATTRIBUT_TYP_INFO[bisher.typ].label}-Wert bleibt aktiv. Schalte den Bereich in den Einstellungen aus.`,
    );
  }
  pruefeErschoepfungsZiel(id, aenderung.erschoepfungZiel);
  const zeitverfallStartet =
    (aenderung.verfallZeit !== undefined && aenderung.verfallZeit !== 'aus' && bisher.verfallZeit === 'aus') ||
    (aenderung.archiviert === false && bisher.archiviert);
  const gesamtXp = ladeGesamtXp();

  aktualisiere('attribute', id, {
    name: aenderung.name,
    beschreibung: aenderung.beschreibung,
    farbe: aenderung.farbe,
    icon: aenderung.icon,
    verfall_belastung: aenderung.verfallBelastung,
    verfall_zeit: aenderung.verfallZeit,
    verfall_bis: zeitverfallStartet ? lokalesDatum(jetzt) : undefined,
    erschoepfung: alsZahl(aenderung.erschoepfung),
    archiv_anteil: wirdArchiviert && gesamtXp > 0 ? bisher.level.xpGesamt / gesamtXp : undefined,
    archiviert: alsZahl(aenderung.archiviert),
  });
  if (aenderung.erschoepfungZiel !== undefined) {
    ausfuehren('UPDATE attribute SET erschoepfung_ziel = ? WHERE id = ?', aenderung.erschoepfungZiel, id);
  }
  return ladeAttribut(id);
}

export function pruefeAktiveAttribute(ids: number[], typ?: AttributTyp): void {
  const eindeutig = [...new Set(ids)];
  if (eindeutig.length === 0) {
    return;
  }
  const typBedingung = typ === undefined ? '' : 'AND typ = ?';
  const parameter = typ === undefined ? eindeutig : [...eindeutig, typ];
  const { anzahl } = eine<{ anzahl: number }>(
    `SELECT COUNT(*) AS anzahl FROM attribute
     WHERE archiviert = 0 AND id IN (${platzhalter(eindeutig.length)}) ${typBedingung}`,
    ...parameter,
  ) ?? { anzahl: 0 };
  if (anzahl !== eindeutig.length) {
    throw ungueltig(
      typ === 'status'
        ? 'Der gewählte Haben-Wert existiert nicht oder ist archiviert.'
        : 'Mindestens ein gewähltes Attribut existiert nicht oder ist archiviert.',
    );
  }
}
