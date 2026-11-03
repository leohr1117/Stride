import type { Belohnung, Bonus, BonusQuelle, LevelAufstieg, XpAnteilMitName } from '../../shared/api/index.ts';
import type { AttributTyp } from '../../shared/spiel/begriffe.ts';
import type { Multiplikator } from '../../shared/spiel/xp.ts';
import { berechneLevel, LEVEL_KURVEN, type LevelInfo } from '../../shared/spiel/level.ts';
import { ausfuehren, eine } from '../db.ts';
import { ladeAttribute, ladeCharakterLevel } from '../features/attribute/attribute.ts';
import { schalteErfolgeFrei } from '../features/erfolge/erfolge.ts';

export type XpQuelle = 'eintrag' | 'bossangriff' | 'investition' | 'belastung' | 'verfall' | BonusQuelle;

export interface AttributBuchung {
  quelle: XpQuelle;
  attributId: number;
  xp: number;
  eintragId: number | null;
  vorhabenId: number | null;
  ausruestungId?: number;
  visionId?: number;
  aufgabeId?: number | null;
  investitionId?: number | null;
}

export interface ProjektBuchung {
  quelle: XpQuelle;
  projektId: number;
  xp: number;
  eintragId: number | null;
  vorhabenId: number | null;
}

export function bucheAttributXp(buchung: AttributBuchung, zeitpunkt: string): AttributBuchung {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, eintrag_id, vorhaben_id, ausruestung_id, vision_id, aufgabe_id, investition_id, xp, erstellt_am)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    buchung.quelle,
    buchung.attributId,
    buchung.eintragId,
    buchung.vorhabenId,
    buchung.ausruestungId ?? null,
    buchung.visionId ?? null,
    buchung.aufgabeId ?? null,
    buchung.investitionId ?? null,
    buchung.xp,
    zeitpunkt,
  );
  return buchung;
}

export function bucheProjektXp(buchung: ProjektBuchung, zeitpunkt: string): ProjektBuchung {
  ausfuehren(
    `INSERT INTO projekt_xp (quelle, projekt_id, eintrag_id, vorhaben_id, xp, erstellt_am)
     VALUES (?, ?, ?, ?, ?, ?)`,
    buchung.quelle,
    buchung.projektId,
    buchung.eintragId,
    buchung.vorhabenId,
    buchung.xp,
    zeitpunkt,
  );
  return buchung;
}

export function bucheFaehigkeitXp(
  buchung: { quelle: XpQuelle; faehigkeitId: number; xp: number; eintragId: number | null },
  zeitpunkt: string,
): void {
  ausfuehren(
    'INSERT INTO faehigkeit_xp (quelle, faehigkeit_id, eintrag_id, xp, erstellt_am) VALUES (?, ?, ?, ?, ?)',
    buchung.quelle,
    buchung.faehigkeitId,
    buchung.eintragId,
    buchung.xp,
    zeitpunkt,
  );
}

export function ladeFaehigkeitLevel(faehigkeitId: number): LevelInfo {
  const { xp } = eine<{ xp: number }>(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM faehigkeit_xp WHERE faehigkeit_id = ?',
    faehigkeitId,
  ) ?? { xp: 0 };
  return berechneLevel(xp, LEVEL_KURVEN.faehigkeit);
}

export function ladeProjektLevel(projektId: number): LevelInfo {
  const { xp } = eine<{ xp: number }>(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp WHERE projekt_id = ?',
    projektId,
  ) ?? { xp: 0 };
  return berechneLevel(xp, LEVEL_KURVEN.projekt);
}

export function ladeOrganisationLevel(organisationId: number): LevelInfo {
  const { xp } = eine<{ xp: number }>(
    `SELECT COALESCE(SUM(px.xp), 0) AS xp
     FROM projekt_xp px JOIN projekte p ON p.id = px.projekt_id
     WHERE p.organisation_id = ?`,
    organisationId,
  ) ?? { xp: 0 };
  return berechneLevel(xp, LEVEL_KURVEN.organisation);
}

interface BenannterStand {
  name: string;
  farbe: string | null;
  level: number;
}

interface AttributStand extends BenannterStand {
  typ: AttributTyp;
}

export interface LevelStand {
  charakter: number;
  attribute: Map<number, AttributStand>;
  projekt: BenannterStand | null;
  organisation: BenannterStand | null;
  faehigkeit: BenannterStand | null;
}

function ladeFaehigkeitStand(faehigkeitId: number | null): BenannterStand | null {
  if (faehigkeitId === null) {
    return null;
  }
  const zeile = eine<{ name: string; farbe: string }>('SELECT name, farbe FROM faehigkeiten WHERE id = ?', faehigkeitId);
  return zeile ? { name: zeile.name, farbe: zeile.farbe, level: ladeFaehigkeitLevel(faehigkeitId).level } : null;
}

export function ladeLevelStand(projektId: number | null, faehigkeitId: number | null = null): LevelStand {
  const attribute = new Map<number, AttributStand>();
  for (const attribut of ladeAttribute(true)) {
    attribute.set(attribut.id, {
      name: attribut.name,
      farbe: attribut.farbe,
      typ: attribut.typ,
      level: attribut.level.level,
    });
  }

  let projekt: BenannterStand | null = null;
  let organisation: BenannterStand | null = null;
  if (projektId !== null) {
    const zeile = eine<{ name: string; organisationId: number | null; organisationName: string | null; farbe: string | null }>(
      `SELECT p.name, p.organisation_id AS organisationId, o.name AS organisationName, o.farbe
       FROM projekte p LEFT JOIN organisationen o ON o.id = p.organisation_id
       WHERE p.id = ?`,
      projektId,
    );
    if (zeile) {
      projekt = { name: zeile.name, farbe: null, level: ladeProjektLevel(projektId).level };
      if (zeile.organisationId !== null && zeile.organisationName !== null) {
        organisation = {
          name: zeile.organisationName,
          farbe: zeile.farbe,
          level: ladeOrganisationLevel(zeile.organisationId).level,
        };
      }
    }
  }

  return {
    charakter: ladeCharakterLevel().level,
    attribute,
    projekt,
    organisation,
    faehigkeit: ladeFaehigkeitStand(faehigkeitId),
  };
}

function vergleiche(
  art: LevelAufstieg['art'],
  vorher: BenannterStand | null,
  nachher: BenannterStand | null,
): LevelAufstieg | null {
  if (!vorher || !nachher || nachher.level <= vorher.level) {
    return null;
  }
  return { art, name: nachher.name, farbe: nachher.farbe, vorher: vorher.level, nachher: nachher.level };
}

export function ermittleAufstiege(vorher: LevelStand, nachher: LevelStand): LevelAufstieg[] {
  const aufstiege: LevelAufstieg[] = [];
  const charakter = vergleiche(
    'charakter',
    { name: 'Charakter', farbe: null, level: vorher.charakter },
    { name: 'Charakter', farbe: null, level: nachher.charakter },
  );
  if (charakter) {
    aufstiege.push(charakter);
  }
  for (const [id, neu] of nachher.attribute) {
    const aufstieg = vergleiche(neu.typ, vorher.attribute.get(id) ?? null, neu);
    if (aufstieg) {
      aufstiege.push(aufstieg);
    }
  }
  for (const aufstieg of [
    vergleiche('projekt', vorher.projekt, nachher.projekt),
    vergleiche('organisation', vorher.organisation, nachher.organisation),
    vergleiche('faehigkeit', vorher.faehigkeit, nachher.faehigkeit),
  ]) {
    if (aufstieg) {
      aufstiege.push(aufstieg);
    }
  }
  return aufstiege;
}

export function fasseAnteileZusammen(
  buchungen: Pick<AttributBuchung, 'attributId' | 'xp'>[],
  stand: LevelStand,
): XpAnteilMitName[] {
  const summen = new Map<number, number>();
  for (const buchung of buchungen) {
    summen.set(buchung.attributId, (summen.get(buchung.attributId) ?? 0) + buchung.xp);
  }

  const anteile: XpAnteilMitName[] = [];
  for (const [attributId, xp] of summen) {
    const attribut = stand.attribute.get(attributId);
    if (attribut) {
      anteile.push({ attributId, typ: attribut.typ, name: attribut.name, farbe: attribut.farbe ?? '', xp });
    }
  }
  return anteile.sort((a, b) => b.xp - a.xp);
}

export function erstelleBelohnung(daten: {
  buchungen: AttributBuchung[];
  boni: Bonus[];
  meilenstein: boolean;
  projekt: { name: string; xp: number } | null;
  faehigkeit?: Belohnung['faehigkeit'];
  boss?: Belohnung['boss'];
  multiplikatoren?: Multiplikator[];
  vorher: LevelStand;
  nachher: LevelStand;
}): Belohnung {
  let xp = 0;
  for (const buchung of daten.buchungen) {
    xp += buchung.xp;
  }
  return {
    xp,
    meilenstein: daten.meilenstein,
    anteile: fasseAnteileZusammen(daten.buchungen, daten.nachher),
    projekt: daten.projekt,
    faehigkeit: daten.faehigkeit ?? null,
    boss: daten.boss ?? null,
    multiplikatoren: daten.multiplikatoren ?? [],
    boni: daten.boni,
    aufstiege: ermittleAufstiege(daten.vorher, daten.nachher),
    erfolge: schalteErfolgeFrei(),
  };
}
