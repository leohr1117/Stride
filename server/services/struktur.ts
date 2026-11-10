import type {
  Organisation,
  InvestitionsZiel,
  OrganisationDaten,
  Projekt,
  ProjektAenderung,
  ProjektAuswahl,
  ProjektDaten,
  ProjektDetail,
  ProjektMitBelohnung,
  Vision,
  VisionDaten,
  VorhabenKurz,
  Ziele,
} from '../../shared/api/index.ts';
import { kettenStand } from '../../shared/spiel/kette.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../shared/spiel/level.ts';
import { istWoopVollstaendig } from '../../shared/spiel/vision.ts';
import { investitionsBonus, visionBeute } from '../../shared/spiel/xp.ts';
import { sperrtext } from '../../shared/spiel/ebenen.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine } from '../db.ts';
import { nichtGefunden, ungueltig } from '../fehler.ts';
import { istLoeschbar } from './loeschen.ts';
import { ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { KONTEXT_JOINS, KONTEXT_SPALTEN, PROJEKT_AKTIV, zuKontext, type KontextZeile } from '../features/ziele/kontext.ts';
import { ladeVorhabenAlle, ladeVorhabenFuerProjekt } from '../features/ziele/vorhaben.ts';
import { istInvestitionsArt, ladeBoniJeProjekt, normalisiereInvestition } from '../features/investitionen/ausruestung.ts';
import { pruefeAktiveVorlage, pruefeVorlageZumProjekt } from '../features/taetigkeiten/vorlagen.ts';
import { schliesseProjekt } from '../features/ziele/projektAbschluss.ts';
import { leseJetzt, lokalesDatum } from './zeit.ts';

interface VisionZeile {
  id: number;
  titel: string;
  beschreibung: string;
  farbe: string;
  woopErgebnis: string;
  woopHindernis: string;
  woopPlan: string;
  archiviert: number;
  level: number | null;
  erreichtAm: string | null;
  xpGesamt: number;
  meilensteine: number;
}

interface OrganisationZeile {
  id: number;
  name: string;
  beschreibung: string;
  farbe: string;
  visionId: number | null;
  archiviert: number;
  xp: number;
}

interface ProjektZeile extends KontextZeile {
  id: number;
  name: string;
  beschreibung: string;
  visionId: number | null;
  organisationId: number | null;
  standardVorlageId: number;
  abschlussVorlageId: number | null;
  erstelltAm: string;
  archiviert: number;
  aktiv: number;
  xp: number;
  anzahlEintraege: number;
  ersterEintrag: string | null;
  stunden: number;
  offeneVorhaben: number;
  geschafftAm: string | null;
  investition: number;
  investitionZielArt: string | null;
  investitionZielId: number | null;
  investitionRessourcen: number;
  investitionGroesse: number;
  investitionBonus: number;
  letzterEintrag: string | null;
}

const PROJEKTE_DER_VISION = `
  SELECT p.id FROM projekte p
  LEFT JOIN organisationen o ON o.id = p.organisation_id
  WHERE p.vision_id = v.id OR o.vision_id = v.id
`;

const VISION_ABFRAGE = `
  SELECT v.id, v.titel, v.beschreibung, v.farbe, v.archiviert, v.level, v.erreicht_am AS erreichtAm,
         v.woop_ergebnis AS woopErgebnis, v.woop_hindernis AS woopHindernis, v.woop_plan AS woopPlan,
         COALESCE((SELECT SUM(xp) FROM projekt_xp WHERE projekt_id IN (${PROJEKTE_DER_VISION})), 0) AS xpGesamt,
         (SELECT COUNT(*) FROM eintraege WHERE meilenstein = 1 AND projekt_id IN (${PROJEKTE_DER_VISION})) AS meilensteine
  FROM visionen v
`;

const ORGANISATION_ABFRAGE = `
  SELECT o.id, o.name, o.beschreibung, o.farbe, o.vision_id AS visionId, o.archiviert,
         COALESCE((SELECT SUM(px.xp) FROM projekt_xp px JOIN projekte p ON p.id = px.projekt_id
                   WHERE p.organisation_id = o.id), 0) AS xp
  FROM organisationen o
`;

const PROJEKT_ABFRAGE = `
  SELECT p.id, p.name, p.beschreibung, p.vision_id AS visionId, p.organisation_id AS organisationId,
         p.standard_vorlage_id AS standardVorlageId, p.abschluss_vorlage_id AS abschlussVorlageId,
         p.erstellt_am AS erstelltAm,
         p.geschafft_am AS geschafftAm, p.investition,
         p.investition_ziel_art AS investitionZielArt, p.investition_ziel_id AS investitionZielId,
         p.investition_ressourcen AS investitionRessourcen, p.investition_groesse AS investitionGroesse,
         p.investition_bonus AS investitionBonus,
         p.archiviert, (${PROJEKT_AKTIV}) AS aktiv,
         ${KONTEXT_SPALTEN},
         COALESCE(x.xp, 0) AS xp, COALESCE(e.anzahl, 0) AS anzahlEintraege, e.letzter AS letzterEintrag,
         e.erster AS ersterEintrag, COALESCE(e.stunden, 0) AS stunden,
         COALESCE(vh.offen, 0) AS offeneVorhaben
  FROM projekte p
  ${KONTEXT_JOINS}
  LEFT JOIN (SELECT projekt_id, SUM(xp) AS xp FROM projekt_xp GROUP BY projekt_id) x ON x.projekt_id = p.id
  LEFT JOIN (
    SELECT projekt_id, COUNT(*) AS anzahl, MAX(erstellt_am) AS letzter, MIN(erstellt_am) AS erster,
           COALESCE(SUM(stunden), 0) AS stunden
    FROM eintraege GROUP BY projekt_id
  ) e ON e.projekt_id = p.id
  LEFT JOIN (SELECT projekt_id, COUNT(*) AS offen FROM vorhaben WHERE status = 'offen' GROUP BY projekt_id) vh
    ON vh.projekt_id = p.id
`;

function zuVision(zeile: VisionZeile): Vision {
  return {
    id: zeile.id,
    titel: zeile.titel,
    beschreibung: zeile.beschreibung,
    farbe: zeile.farbe,
    woopErgebnis: zeile.woopErgebnis,
    woopHindernis: zeile.woopHindernis,
    woopPlan: zeile.woopPlan,
    woopVollstaendig: istWoopVollstaendig({
      ergebnis: zeile.woopErgebnis,
      hindernis: zeile.woopHindernis,
      plan: zeile.woopPlan,
    }),
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('vision', zeile.id),
    xpGesamt: zeile.xpGesamt,
    meilensteine: zeile.meilensteine,
    level: zeile.level,
    beute: visionBeute(zeile.level),
    erreichtAm: zeile.erreichtAm,
  };
}

function zuOrganisation(zeile: OrganisationZeile): Organisation {
  return {
    id: zeile.id,
    name: zeile.name,
    beschreibung: zeile.beschreibung,
    farbe: zeile.farbe,
    visionId: zeile.visionId,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('organisation', zeile.id),
    ansehen: berechneLevel(zeile.xp, LEVEL_KURVEN.organisation),
  };
}

function ladeAktiveTage(projektId?: number): Map<number, string[]> {
  const zeilen = alle<{ projektId: number; tag: string }>(
    `SELECT projekt_id AS projektId, date(erstellt_am, 'localtime') AS tag
     FROM eintraege
     ${projektId === undefined ? '' : 'WHERE projekt_id = ?'}
     GROUP BY projekt_id, tag`,
    ...(projektId === undefined ? [] : [projektId]),
  );
  const tage = new Map<number, string[]>();
  for (const zeile of zeilen) {
    const liste = tage.get(zeile.projektId) ?? [];
    liste.push(zeile.tag);
    tage.set(zeile.projektId, liste);
  }
  return tage;
}

function zuInvestitionsZiel(art: string | null, id: number | null): InvestitionsZiel | null {
  if (!istInvestitionsArt(art) || id === null) {
    return null;
  }
  return { art, id };
}

function zuProjekt(zeile: ProjektZeile, aktiveTage: Map<number, string[]>, heute: string, boni: Map<number, number>): Projekt {
  const level = berechneLevel(zeile.xp, LEVEL_KURVEN.projekt);
  return {
    id: zeile.id,
    name: zeile.name,
    beschreibung: zeile.beschreibung,
    visionId: zeile.visionId,
    organisationId: zeile.organisationId,
    standardVorlageId: zeile.standardVorlageId,
    abschlussVorlageId: zeile.abschlussVorlageId,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('projekt', zeile.id),
    aktiv: zeile.aktiv === 1,
    kontext: zuKontext(zeile),
    level,
    kette: kettenStand(aktiveTage.get(zeile.id) ?? [], heute),
    anzahlEintraege: zeile.anzahlEintraege,
    offeneVorhaben: zeile.offeneVorhaben,
    ausruestungBonus: boni.get(zeile.id) ?? 0,
    geschafftAm: zeile.geschafftAm,
    investition: zeile.investition === 1,
    investitionZiel: zuInvestitionsZiel(zeile.investitionZielArt, zeile.investitionZielId),
    investitionRessourcen: zeile.investitionRessourcen === 1,
    investitionGroesse: zeile.investitionGroesse,
    investitionBonus: zeile.investitionBonus,
    letzterEintrag: zeile.letzterEintrag,
    abschluss: zeile.geschafftAm
      ? {
          xp: zeile.xp,
          level: level.level,
          von: zeile.ersterEintrag ?? zeile.erstelltAm,
          bis: zeile.geschafftAm,
          eintraege: zeile.anzahlEintraege,
          stunden: zeile.stunden,
        }
      : null,
  };
}

export function ladeProjekte(jetzt = leseJetzt()): Projekt[] {
  const aktiveTage = ladeAktiveTage();
  const heute = lokalesDatum(jetzt);
  const boni = ladeBoniJeProjekt();
  return alle<ProjektZeile>(`${PROJEKT_ABFRAGE} ORDER BY p.name COLLATE NOCASE`).map((zeile) =>
    zuProjekt(zeile, aktiveTage, heute, boni),
  );
}

export function ladeProjekt(id: number, jetzt = leseJetzt()): Projekt {
  const zeile = eine<ProjektZeile>(`${PROJEKT_ABFRAGE} WHERE p.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Das Projekt');
  }
  return zuProjekt(zeile, ladeAktiveTage(id), lokalesDatum(jetzt), ladeBoniJeProjekt());
}

export function ladeProjektDetail(id: number, jetzt = leseJetzt()): ProjektDetail {
  return { projekt: ladeProjekt(id, jetzt), vorhaben: ladeVorhabenFuerProjekt(id, jetzt) };
}

export function ladeZiele(jetzt = leseJetzt()): Ziele {
  return {
    visionen: alle<VisionZeile>(`${VISION_ABFRAGE} ORDER BY v.archiviert, v.id`).map(zuVision),
    organisationen: alle<OrganisationZeile>(`${ORGANISATION_ABFRAGE} ORDER BY o.archiviert, o.name COLLATE NOCASE`).map(
      zuOrganisation,
    ),
    projekte: ladeProjekte(jetzt),
    vorhaben: ladeVorhabenAlle(jetzt),
  };
}

export function ladeVision(id: number): Vision {
  const zeile = eine<VisionZeile>(`${VISION_ABFRAGE} WHERE v.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Vision');
  }
  return zuVision(zeile);
}

function ladeOrganisation(id: number): Organisation {
  const zeile = eine<OrganisationZeile>(`${ORGANISATION_ABFRAGE} WHERE o.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Organisation');
  }
  return zuOrganisation(zeile);
}

function pruefeAktiveVision(id: number): void {
  if (ladeVision(id).archiviert) {
    throw ungueltig('Die gewählte Vision ist archiviert.');
  }
}

function pruefeAktiveOrganisation(id: number): void {
  if (ladeOrganisation(id).archiviert) {
    throw ungueltig('Die gewählte Organisation ist archiviert.');
  }
}

export function erstelleVision(daten: VisionDaten): Vision {
  if (!ladeEinstellungen().ebenen.visionen) {
    throw ungueltig(sperrtext('visionen'));
  }
  const { id } = ausfuehren(
    `INSERT INTO visionen (titel, beschreibung, farbe, woop_ergebnis, woop_hindernis, woop_plan, level)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    daten.titel,
    daten.beschreibung,
    daten.farbe,
    daten.woopErgebnis,
    daten.woopHindernis,
    daten.woopPlan,
    daten.level,
  );
  return ladeVision(id);
}

export function aendereVision(id: number, aenderung: Partial<VisionDaten> & { archiviert?: boolean }): Vision {
  ladeVision(id);
  aktualisiere('visionen', id, {
    titel: aenderung.titel,
    beschreibung: aenderung.beschreibung,
    farbe: aenderung.farbe,
    woop_ergebnis: aenderung.woopErgebnis,
    woop_hindernis: aenderung.woopHindernis,
    woop_plan: aenderung.woopPlan,
    archiviert: alsZahl(aenderung.archiviert),
  });
  if (aenderung.level !== undefined) {
    ausfuehren('UPDATE visionen SET level = ? WHERE id = ?', aenderung.level, id);
  }
  return ladeVision(id);
}

export function erstelleOrganisation(daten: OrganisationDaten): Organisation {
  const ebenen = ladeEinstellungen().ebenen;
  if (!ebenen.organisationen) {
    throw ungueltig(sperrtext('organisationen'));
  }
  if (daten.visionId !== null) {
    if (!ebenen.visionen) {
      throw ungueltig(sperrtext('visionen'));
    }
    pruefeAktiveVision(daten.visionId);
  }
  const { id } = ausfuehren(
    'INSERT INTO organisationen (name, beschreibung, farbe, vision_id) VALUES (?, ?, ?, ?)',
    daten.name,
    daten.beschreibung,
    daten.farbe,
    daten.visionId,
  );
  return ladeOrganisation(id);
}

export function aendereOrganisation(
  id: number,
  aenderung: Partial<OrganisationDaten> & { archiviert?: boolean },
): Organisation {
  ladeOrganisation(id);
  if (aenderung.visionId !== undefined && aenderung.visionId !== null) {
    if (!ladeEinstellungen().ebenen.visionen) {
      throw ungueltig(sperrtext('visionen'));
    }
    pruefeAktiveVision(aenderung.visionId);
  }
  aktualisiere('organisationen', id, {
    name: aenderung.name,
    beschreibung: aenderung.beschreibung,
    farbe: aenderung.farbe,
    archiviert: alsZahl(aenderung.archiviert),
  });
  if (aenderung.visionId !== undefined) {
    ausfuehren('UPDATE organisationen SET vision_id = ? WHERE id = ?', aenderung.visionId, id);
  }
  return ladeOrganisation(id);
}

function pruefeZuordnung(visionId: number | null, organisationId: number | null): void {
  if (visionId !== null && organisationId !== null) {
    throw ungueltig('Ein Projekt gehört entweder zu einer Vision oder zu einer Organisation.');
  }
  const ebenen = ladeEinstellungen().ebenen;
  if (!ebenen.projekte) {
    throw ungueltig(sperrtext('projekte'));
  }
  if (visionId !== null) {
    if (!ebenen.visionen) {
      throw ungueltig(sperrtext('visionen'));
    }
    pruefeAktiveVision(visionId);
  }
  if (organisationId !== null) {
    if (!ebenen.organisationen) {
      throw ungueltig(sperrtext('organisationen'));
    }
    pruefeAktiveOrganisation(organisationId);
  }
}

export function erstelleProjekt(daten: ProjektDaten): Projekt {
  pruefeZuordnung(daten.visionId, daten.organisationId);
  pruefeAktiveVorlage(daten.standardVorlageId);
  pruefeVorlageZumProjekt(daten.standardVorlageId, null);
  const abschlussVorlageId = daten.abschlussVorlageId ?? null;
  if (abschlussVorlageId !== null) {
    pruefeAktiveVorlage(abschlussVorlageId);
    pruefeVorlageZumProjekt(abschlussVorlageId, null);
  }
  const { id } = ausfuehren(
    `INSERT INTO projekte (vision_id, organisation_id, standard_vorlage_id, abschluss_vorlage_id, name, beschreibung)
     VALUES (?, ?, ?, ?, ?, ?)`,
    daten.visionId,
    daten.organisationId,
    daten.standardVorlageId,
    abschlussVorlageId,
    daten.name,
    daten.beschreibung,
  );
  return ladeProjekt(id);
}

export function aendereProjekt(id: number, aenderung: ProjektAenderung, jetzt = leseJetzt()): ProjektMitBelohnung {
  const projekt = ladeProjekt(id);
  const zuordnungGeaendert = aenderung.visionId !== undefined || aenderung.organisationId !== undefined;
  const visionId = aenderung.visionId !== undefined ? aenderung.visionId : projekt.visionId;
  const organisationId = aenderung.organisationId !== undefined ? aenderung.organisationId : projekt.organisationId;
  const zielGeaendert = aenderung.investitionZiel !== undefined || aenderung.investitionRessourcen !== undefined;
  const investition = zielGeaendert
    ? normalisiereInvestition(
        { investitionZiel: projekt.investitionZiel, investitionRessourcen: projekt.investitionRessourcen },
        aenderung,
      )
    : null;

  if (zuordnungGeaendert) {
    pruefeZuordnung(visionId, organisationId);
  }
  if (aenderung.standardVorlageId !== undefined) {
    pruefeAktiveVorlage(aenderung.standardVorlageId);
    pruefeVorlageZumProjekt(aenderung.standardVorlageId, id);
  }
  if (aenderung.abschlussVorlageId !== undefined && aenderung.abschlussVorlageId !== null) {
    if (aenderung.abschlussVorlageId !== projekt.abschlussVorlageId) {
      pruefeAktiveVorlage(aenderung.abschlussVorlageId);
    }
    pruefeVorlageZumProjekt(aenderung.abschlussVorlageId, id);
  }

  aktualisiere('projekte', id, {
    name: aenderung.name,
    beschreibung: aenderung.beschreibung,
    standard_vorlage_id: aenderung.standardVorlageId,
    abschluss_vorlage_id: aenderung.abschlussVorlageId,
    archiviert: alsZahl(aenderung.archiviert),
    investition: alsZahl(aenderung.investition),
    investition_ressourcen: investition ? alsZahl(investition.ressourcen) : undefined,
  });
  if (zuordnungGeaendert) {
    ausfuehren('UPDATE projekte SET vision_id = ?, organisation_id = ? WHERE id = ?', visionId, organisationId, id);
  }
  if (investition && aenderung.investitionZiel !== undefined) {
    ausfuehren(
      'UPDATE projekte SET investition_ziel_art = ?, investition_ziel_id = ? WHERE id = ?',
      investition.ziel?.art ?? null,
      investition.ziel?.id ?? null,
      id,
    );
  }
  if (aenderung.investitionGroesse !== undefined) {
    const groesse = Math.min(3, Math.max(0, Math.round(aenderung.investitionGroesse)));
    ausfuehren(
      'UPDATE projekte SET investition_groesse = ?, investition_bonus = ? WHERE id = ?',
      groesse,
      investitionsBonus(groesse),
      id,
    );
  }
  const belohnung = aenderung.geschafft === true ? schliesseProjekt(id, jetzt) : null;
  if (aenderung.geschafft === false) {
    ausfuehren('UPDATE projekte SET geschafft_am = NULL WHERE id = ?', id);
  }
  return { ...ladeProjekt(id), belohnung };
}

export function ladeProjektauswahl(): ProjektAuswahl[] {
  const projekte = alle<
    KontextZeile & {
      id: number;
      name: string;
      vorlageId: number | null;
      vorhabenVorauswahl: number | null;
      faehigkeitVorauswahl: number | null;
    }
  >(`
    SELECT p.id, p.name, ${KONTEXT_SPALTEN},
           (SELECT e.faehigkeit_id FROM eintraege e JOIN faehigkeiten f ON f.id = e.faehigkeit_id
            WHERE e.projekt_id = p.id AND f.archiviert = 0
              AND e.id = (SELECT MAX(id) FROM eintraege WHERE projekt_id = p.id)
           ) AS faehigkeitVorauswahl,
           COALESCE(
             (SELECT e.vorlage_id FROM eintraege e JOIN vorlagen vl ON vl.id = e.vorlage_id
              WHERE e.projekt_id = p.id AND vl.archiviert = 0
              ORDER BY e.erstellt_am DESC, e.id DESC LIMIT 1),
             (SELECT vl.id FROM vorlagen vl WHERE vl.id = p.standard_vorlage_id AND vl.archiviert = 0),
             (SELECT vl.id FROM vorlagen vl WHERE vl.archiviert = 0 ORDER BY vl.sortierung, vl.id LIMIT 1)
           ) AS vorlageId,
           (SELECT vh.id FROM eintraege e JOIN vorhaben vh ON vh.id = e.vorhaben_id
            WHERE e.projekt_id = p.id AND vh.status = 'offen'
              AND e.id = (SELECT MAX(id) FROM eintraege WHERE projekt_id = p.id)
           ) AS vorhabenVorauswahl,
           (SELECT MAX(erstellt_am) FROM eintraege WHERE projekt_id = p.id) AS letzter
    FROM projekte p
    ${KONTEXT_JOINS}
    WHERE ${PROJEKT_AKTIV}
    ORDER BY letzter IS NULL, letzter DESC, p.name COLLATE NOCASE
  `);

  const offene = alle<Omit<VorhabenKurz, 'boss'> & { projektId: number; boss: number }>(`
    SELECT vh.id, vh.titel, vh.anlauf, vh.boss, vh.projekt_id AS projektId
    FROM vorhaben vh
    LEFT JOIN (SELECT vorhaben_id, MAX(erstellt_am) AS letzter FROM eintraege GROUP BY vorhaben_id) e
      ON e.vorhaben_id = vh.id
    WHERE vh.status = 'offen'
    ORDER BY COALESCE(e.letzter, vh.erstellt_am) DESC
  `);
  const offeneJeProjekt = new Map<number, VorhabenKurz[]>();
  for (const { projektId, boss, ...vorhaben } of offene) {
    const liste = offeneJeProjekt.get(projektId) ?? [];
    liste.push({ ...vorhaben, boss: boss === 1 });
    offeneJeProjekt.set(projektId, liste);
  }

  return projekte.map((zeile) => ({
    id: zeile.id,
    name: zeile.name,
    kontext: zuKontext(zeile),
    vorlageId: zeile.vorlageId,
    vorhabenVorauswahl: zeile.vorhabenVorauswahl,
    faehigkeitVorauswahl: zeile.faehigkeitVorauswahl,
    offeneVorhaben: offeneJeProjekt.get(zeile.id) ?? [],
  }));
}
