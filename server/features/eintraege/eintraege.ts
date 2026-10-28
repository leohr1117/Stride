import type {
  Belohnung,
  Bonus,
  BonusQuelle,
  ChronikEintrag,
  ChronikSeite,
  Eintrag,
  EintragDaten,
  EintragErgebnis,
  EintragFilter,
  ProtokollArt,
  ProtokollZeile,
  SkillEreignis,
  XpAnteilMitName,
} from '../../../shared/api/index.ts';
import { BONUS_QUELLEN, PROTOKOLL_ARTEN } from '../../../shared/api/index.ts';
import type { Abschluss, AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { belastungXp, istBelastend } from '../../../shared/spiel/belastung.ts';
import { kettenLaenge } from '../../../shared/spiel/kette.ts';
import {
  basisDisziplinBonus,
  bestaendigkeitsBonus,
  bossBeute,
  bossLevelAusKampfXp,
  eintragXp,
  GEGNER,
  gesamtFaktor,
  meilensteinBonus,
  verteileNachGewichten,
  WEITERMACHEN,
  type Gewicht,
  type Multiplikator,
  type XpAnteil,
} from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, inTransaktion, platzhalter, type Parameter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { bonusAufAttribut, bonusAufProjekt } from '../investitionen/ausruestung.ts';
import {
  aktivesAttribut,
  ladeAttributXp,
  ladeBelastendeAttribute,
  ladeErschoepfungen,
  nurWirksameGewichte,
  type ErschoepfungRegel,
} from '../attribute/attribute.ts';
import { ladeEinstellungen, pruefeEbene, pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { pruefeAktiveFaehigkeit, sperreSkillsDesEintrags } from '../faehigkeiten/faehigkeiten.ts';
import {
  bucheAttributXp,
  bucheFaehigkeitXp,
  bucheProjektXp,
  erstelleBelohnung,
  ladeLevelStand,
  type AttributBuchung,
  type XpQuelle,
} from '../../services/fortschritt.ts';
import { KONTEXT_JOINS, KONTEXT_SPALTEN, PROJEKT_AKTIV, zuKontext, type KontextZeile } from '../ziele/kontext.ts';
import { momentumFuerTag } from '../../services/serie.ts';
import { mitBewertung } from '../bewertung/bewertung.ts';
import { verdieneSchutz } from '../kette/kette.ts';
import { erfuelleRueckkehr, haengeRueckkehrUm, pflegeRueckkehr } from '../kette/rueckkehr.ts';
import { ladeVorhaben, legeVorhabenAn } from '../ziele/vorhaben.ts';
import { ladeAktiveGewichte, pruefeVorlageZumProjekt } from '../taetigkeiten/vorlagen.ts';
import { lokalesDatum, tagesbeginn, zeitpunktFuerEintrag } from '../../services/zeit.ts';

interface EintragZeile extends KontextZeile {
  id: number;
  projektId: number | null;
  projektName: string | null;
  vorlageId: number;
  vorlageName: string;
  vorlageIcon: string;
  vorhabenId: number | null;
  vorhabenTitel: string | null;
  vorhabenAnlauf: number | null;
  vorhabenBoss: number | null;
  faehigkeitId: number | null;
  faehigkeitName: string | null;
  faehigkeitFarbe: string | null;
  knotenTitel: string | null;
  bossSchaden: number | null;
  bossLevel: number | null;
  bossKampfXp: number | null;
  ausruestungBonus: number;
  faktor: number;
  basisName: string | null;
  abschluss: Abschluss | null;
  erkenntnis: string;
  stunden: number | null;
  notiz: string;
  herkunft: string | null;
  meilenstein: number;
  erstelltAm: string;
}

interface AnteilZeile {
  eintragId: number;
  quelle: XpQuelle;
  attributId: number;
  typ: AttributTyp;
  name: string;
  farbe: string;
  xp: number;
}

const EINTRAG_ABFRAGE = `
  SELECT e.id, e.projekt_id AS projektId, p.name AS projektName, ${KONTEXT_SPALTEN},
         e.vorlage_id AS vorlageId, vl.name AS vorlageName, vl.icon AS vorlageIcon,
         vh.id AS vorhabenId, vh.titel AS vorhabenTitel, vh.anlauf AS vorhabenAnlauf, vh.boss AS vorhabenBoss,
         f.id AS faehigkeitId, f.name AS faehigkeitName, f.farbe AS faehigkeitFarbe,
         (SELECT titel FROM skill_knoten WHERE eintrag_id = e.id LIMIT 1) AS knotenTitel,
         e.boss_schaden AS bossSchaden, vh.boss_level AS bossLevel,
         (SELECT COALESCE(SUM(boss_schaden), 0) FROM eintraege WHERE vorhaben_id = vh.id) AS bossKampfXp,
         e.ausruestung_bonus AS ausruestungBonus, e.faktor,
         ba.name AS basisName,
         e.abschluss, CASE WHEN e.abschluss = 'gescheitert' THEN vh.erkenntnis ELSE '' END AS erkenntnis,
         e.stunden, e.notiz,
         COALESCE(
           (SELECT 'Todoist' FROM todoist_erledigt t WHERE t.eintrag_id = e.id LIMIT 1),
           (SELECT k.name FROM kalender_termine kt JOIN kalender k ON k.id = kt.kalender_id WHERE kt.eintrag_id = e.id LIMIT 1)
         ) AS herkunft,
         e.meilenstein, e.erstellt_am AS erstelltAm
  FROM eintraege e
  LEFT JOIN projekte p ON p.id = e.projekt_id
  ${KONTEXT_JOINS}
  JOIN vorlagen vl ON vl.id = e.vorlage_id
  LEFT JOIN vorhaben vh ON vh.id = e.vorhaben_id
  LEFT JOIN faehigkeiten f ON f.id = e.faehigkeit_id
  LEFT JOIN basis_aufgaben ba ON ba.id = e.basis_aufgabe_id
`;

const CURSOR_TRENNER = '_';

function istBonusQuelle(quelle: XpQuelle): quelle is BonusQuelle {
  return (BONUS_QUELLEN as readonly string[]).includes(quelle);
}

function ergaenzeAnteile(zeilen: EintragZeile[]): Eintrag[] {
  if (zeilen.length === 0) {
    return [];
  }
  const ids = zeilen.map((zeile) => zeile.id);
  const anteile = alle<AnteilZeile>(
    `SELECT x.eintrag_id AS eintragId, x.quelle, x.attribut_id AS attributId, a.typ, a.name, a.farbe, SUM(x.xp) AS xp
     FROM xp_ereignisse x
     JOIN attribute a ON a.id = x.attribut_id
     WHERE x.eintrag_id IN (${platzhalter(ids.length)})
     GROUP BY x.eintrag_id, x.quelle, x.attribut_id
     ORDER BY a.sortierung`,
    ...ids,
  );

  const anteileJeEintrag = new Map<number, Map<number, XpAnteilMitName>>();
  const boniJeEintrag = new Map<number, Set<BonusQuelle>>();
  const beuteJeEintrag = new Map<number, number>();
  for (const zeile of anteile) {
    const summen = anteileJeEintrag.get(zeile.eintragId) ?? new Map<number, XpAnteilMitName>();
    const bisher = summen.get(zeile.attributId);
    summen.set(zeile.attributId, {
      attributId: zeile.attributId,
      typ: zeile.typ,
      name: zeile.name,
      farbe: zeile.farbe,
      xp: (bisher?.xp ?? 0) + zeile.xp,
    });
    anteileJeEintrag.set(zeile.eintragId, summen);

    if (istBonusQuelle(zeile.quelle)) {
      const boni = boniJeEintrag.get(zeile.eintragId) ?? new Set<BonusQuelle>();
      boni.add(zeile.quelle);
      boniJeEintrag.set(zeile.eintragId, boni);
    }
    if (zeile.quelle === 'beute') {
      beuteJeEintrag.set(zeile.eintragId, (beuteJeEintrag.get(zeile.eintragId) ?? 0) + zeile.xp);
    }
  }

  return zeilen.map((zeile) => {
    const eintragAnteile = [...(anteileJeEintrag.get(zeile.id)?.values() ?? [])].sort((a, b) => b.xp - a.xp);
    let xp = 0;
    for (const anteil of eintragAnteile) {
      xp += anteil.xp;
    }
    const boni = boniJeEintrag.get(zeile.id) ?? new Set<BonusQuelle>();
    if (zeile.knotenTitel !== null) {
      boni.add('knoten');
    }
    return {
      id: zeile.id,
      projektId: zeile.projektId,
      projektName: zeile.projektName,
      kontext: zuKontext(zeile),
      vorlageId: zeile.vorlageId,
      vorlageName: zeile.vorlageName,
      vorlageIcon: zeile.vorlageIcon,
      vorhaben:
        zeile.vorhabenId !== null && zeile.vorhabenTitel !== null
          ? {
              id: zeile.vorhabenId,
              titel: zeile.vorhabenTitel,
              anlauf: zeile.vorhabenAnlauf ?? 1,
              boss: zeile.vorhabenBoss === 1,
            }
          : null,
      faehigkeit:
        zeile.faehigkeitId !== null && zeile.faehigkeitName !== null
          ? { id: zeile.faehigkeitId, name: zeile.faehigkeitName, farbe: zeile.faehigkeitFarbe ?? '' }
          : null,
      knotenTitel: zeile.knotenTitel,
      bossSchaden: zeile.bossSchaden,
      faktor: zeile.faktor,
      basisAufgabe: zeile.basisName,
      abschluss: zeile.abschluss,
      erkenntnis: zeile.erkenntnis,
      stunden: zeile.stunden,
      notiz: zeile.notiz,
      herkunft: zeile.herkunft,
      meilenstein: zeile.meilenstein === 1,
      xp,
      ausruestungBonus: zeile.ausruestungBonus,
      bossSieg:
        zeile.abschluss === 'geschafft' && zeile.vorhabenBoss === 1 && zeile.bossLevel !== null
          ? {
              level: zeile.bossLevel,
              kampfXp: zeile.bossKampfXp ?? 0,
              beute: beuteJeEintrag.get(zeile.id) ?? 0,
            }
          : null,
      anteile: eintragAnteile,
      boni: [...boni],
      erstelltAm: zeile.erstelltAm,
    };
  });
}

export function ladeEintrag(id: number): Eintrag {
  const zeile = eine<EintragZeile>(`${EINTRAG_ABFRAGE} WHERE e.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Der Eintrag');
  }
  return ergaenzeAnteile([zeile])[0];
}

type ChronikTyp = ChronikEintrag['typ'];

interface ChronikPosition {
  zeit: string;
  typ: ChronikTyp;
  id: number;
}

function leseCursor(cursor: string): ChronikPosition {
  const idTrenner = cursor.lastIndexOf(CURSOR_TRENNER);
  const typTrenner = cursor.lastIndexOf(CURSOR_TRENNER, idTrenner - 1);
  const id = Number(cursor.slice(idTrenner + 1));
  const typ = cursor.slice(typTrenner + 1, idTrenner);
  if (typTrenner <= 0 || !Number.isInteger(id) || (typ !== 'eintrag' && typ !== 'skill' && typ !== 'protokoll')) {
    throw ungueltig('Ungültiger Cursor.');
  }
  return { zeit: cursor.slice(0, typTrenner), typ, id };
}

function istProtokollArt(art: string): art is ProtokollArt {
  return (PROTOKOLL_ARTEN as readonly string[]).includes(art);
}

function ladeProtokollZeilen(ids: number[]): Map<number, ProtokollZeile> {
  if (ids.length === 0) {
    return new Map();
  }
  const zeilen = alle<{ id: number; art: string; tag: string }>(
    `SELECT id, art, tag FROM protokoll WHERE id IN (${platzhalter(ids.length)}) AND tag IS NOT NULL`,
    ...ids,
  );
  const ergebnis = new Map<number, ProtokollZeile>();
  for (const zeile of zeilen) {
    if (!istProtokollArt(zeile.art)) {
      continue;
    }
    ergebnis.set(zeile.id, {
      id: zeile.id,
      art: zeile.art,
      tag: zeile.tag,
      erstelltAm: `${zeile.tag}T12:00:00.000Z`,
    });
  }
  return ergebnis;
}

function schreibeCursor(position: ChronikPosition): string {
  return [position.zeit, position.typ, position.id].join(CURSOR_TRENNER);
}

function ladeSkillEreignisse(ids: number[]): Map<number, SkillEreignis> {
  if (ids.length === 0) {
    return new Map();
  }
  const zeilen = alle<SkillEreignis>(
    `SELECT k.id AS knotenId, k.titel, f.id AS faehigkeitId, f.name AS faehigkeitName, f.farbe AS faehigkeitFarbe,
            f.icon AS faehigkeitIcon, COALESCE((SELECT SUM(xp) FROM faehigkeit_xp WHERE knoten_id = k.id), 0) AS xp,
            k.freigeschaltet_am AS erstelltAm
     FROM skill_knoten k JOIN faehigkeiten f ON f.id = k.faehigkeit_id
     WHERE k.id IN (${platzhalter(ids.length)})`,
    ...ids,
  );
  return new Map(zeilen.map((zeile) => [zeile.knotenId, zeile]));
}

export function ladeChronik(filter: EintragFilter, cursor: string | undefined, limit: number): ChronikSeite {
  const eintragBedingungen: string[] = [];
  const eintragParameter: Parameter[] = [];
  const skillBedingungen = ['k.freigeschaltet_am IS NOT NULL', 'k.eintrag_id IS NULL'];
  const skillParameter: Parameter[] = [];

  if (filter.visionId !== undefined) {
    eintragBedingungen.push('(p.vision_id = ? OR o.vision_id = ?)');
    eintragParameter.push(filter.visionId, filter.visionId);
  }
  if (filter.organisationId !== undefined) {
    eintragBedingungen.push('p.organisation_id = ?');
    eintragParameter.push(filter.organisationId);
  }
  if (filter.projektId !== undefined) {
    eintragBedingungen.push('p.id = ?');
    eintragParameter.push(filter.projektId);
  }
  if (filter.vorlageId !== undefined) {
    eintragBedingungen.push('e.vorlage_id = ?');
    eintragParameter.push(filter.vorlageId);
  }
  if (filter.faehigkeitId !== undefined) {
    eintragBedingungen.push('e.faehigkeit_id = ?');
    eintragParameter.push(filter.faehigkeitId);
    skillBedingungen.push('k.faehigkeit_id = ?');
    skillParameter.push(filter.faehigkeitId);
  }
  if (filter.nurMeilensteine) {
    eintragBedingungen.push('e.meilenstein = 1');
  }

  const mitSkills =
    filter.visionId === undefined &&
    filter.organisationId === undefined &&
    filter.projektId === undefined &&
    filter.vorlageId === undefined;
  const mitProtokoll = mitSkills && filter.faehigkeitId === undefined;
  const eintragWhere = eintragBedingungen.length > 0 ? `WHERE ${eintragBedingungen.join(' AND ')}` : '';
  const quellen = [
    `SELECT 'eintrag' AS typ, e.id AS id, e.erstellt_am AS zeit
     FROM eintraege e LEFT JOIN projekte p ON p.id = e.projekt_id ${KONTEXT_JOINS} ${eintragWhere}`,
  ];
  const parameter: Parameter[] = [...eintragParameter];
  if (mitSkills) {
    quellen.push(`SELECT 'skill' AS typ, k.id AS id, k.freigeschaltet_am AS zeit
                  FROM skill_knoten k WHERE ${skillBedingungen.join(' AND ')}`);
    parameter.push(...skillParameter);
  }
  if (mitProtokoll) {
    quellen.push(
      `SELECT 'protokoll' AS typ, id AS id, (tag || 'T12:00:00.000Z') AS zeit
       FROM protokoll
       WHERE tag IS NOT NULL AND art IN (${platzhalter(PROTOKOLL_ARTEN.length)})`,
    );
    parameter.push(...PROTOKOLL_ARTEN);
  }

  let cursorBedingung = '';
  if (cursor !== undefined) {
    const position = leseCursor(cursor);
    cursorBedingung = 'WHERE zeit < ? OR (zeit = ? AND (typ < ? OR (typ = ? AND id < ?)))';
    parameter.push(position.zeit, position.zeit, position.typ, position.typ, position.id);
  }

  const positionen = alle<ChronikPosition>(
    `SELECT typ, id, zeit FROM (${quellen.join(' UNION ALL ')}) ${cursorBedingung}
     ORDER BY zeit DESC, typ DESC, id DESC LIMIT ?`,
    ...parameter,
    limit + 1,
  );

  const hatMehr = positionen.length > limit;
  const seite = hatMehr ? positionen.slice(0, limit) : positionen;
  const eintragIds = seite.filter((position) => position.typ === 'eintrag').map((position) => position.id);
  const eintraege = new Map(
    ergaenzeAnteile(
      eintragIds.length === 0
        ? []
        : alle<EintragZeile>(`${EINTRAG_ABFRAGE} WHERE e.id IN (${platzhalter(eintragIds.length)})`, ...eintragIds),
    ).map((eintrag) => [eintrag.id, eintrag]),
  );
  const skills = ladeSkillEreignisse(seite.filter((position) => position.typ === 'skill').map((position) => position.id));
  const protokolle = ladeProtokollZeilen(seite.filter((position) => position.typ === 'protokoll').map((position) => position.id));

  const ergebnis: ChronikEintrag[] = [];
  for (const position of seite) {
    if (position.typ === 'eintrag') {
      const eintrag = eintraege.get(position.id);
      if (eintrag) {
        ergebnis.push({ typ: 'eintrag', eintrag });
      }
      continue;
    }
    if (position.typ === 'skill') {
      const skill = skills.get(position.id);
      if (skill) {
        ergebnis.push({ typ: 'skill', skill });
      }
      continue;
    }
    const protokoll = protokolle.get(position.id);
    if (protokoll) {
      ergebnis.push({ typ: 'protokoll', protokoll });
    }
  }

  const letzte = seite[seite.length - 1];
  return { eintraege: ergebnis, naechsterCursor: hatMehr && letzte ? schreibeCursor(letzte) : null };
}

interface BossStand {
  titel: string;
}

interface Vorbereitung {
  projekt: { id: number; name: string; visionId: number | null } | null;
  gewichte: Gewicht[];
  bestehendesVorhaben: { id: number; anlauf: number; boss: BossStand | null } | null;
  istMeilenstein: boolean;
  faehigkeit: { id: number; name: string } | null;
}

function ladeProjektFuerEintrag(projektId: number): { id: number; name: string; visionId: number | null } {
  const projekt = eine<{ id: number; name: string; aktiv: number; visionId: number | null }>(
    `SELECT p.id, p.name, (${PROJEKT_AKTIV}) AS aktiv, COALESCE(p.vision_id, o.vision_id) AS visionId
     FROM projekte p ${KONTEXT_JOINS} WHERE p.id = ?`,
    projektId,
  );
  if (!projekt) {
    throw nichtGefunden('Das Projekt');
  }
  if (projekt.aktiv !== 1) {
    throw ungueltig('Das Projekt oder seine Vision bzw. Organisation ist archiviert.');
  }
  return { id: projekt.id, name: projekt.name, visionId: projekt.visionId };
}

function bereiteVor(daten: EintragDaten): Vorbereitung {
  if (daten.vorhaben !== null) {
    pruefeEbene('vorhaben');
  }
  if (daten.faehigkeitId !== null) {
    pruefeFunktion('faehigkeiten');
  }
  if (daten.projektId !== null) {
    pruefeEbene('projekte');
  }
  if (daten.abschluss !== null && daten.vorhaben === null) {
    throw ungueltig('Geschafft oder Gescheitert geht nur mit einem Vorhaben.');
  }

  const einstellungen = ladeEinstellungen();
  const projekteAn = istAn('projekte', einstellungen);
  const bosseAn = istAn('bossAngriffe', einstellungen);
  let projektId = daten.projektId;
  let bestehendesVorhaben: Vorbereitung['bestehendesVorhaben'] = null;
  if (daten.vorhaben?.art === 'bestehend') {
    const vorhaben = ladeVorhaben(daten.vorhaben.id);
    if (vorhaben.status !== 'offen') {
      throw ungueltig('Das Vorhaben ist bereits abgeschlossen.');
    }
    if (projekteAn && projektId === null) {
      projektId = vorhaben.projektId;
    } else if (projekteAn && vorhaben.projektId !== null && vorhaben.projektId !== projektId) {
      throw ungueltig('Das Vorhaben gehört zu einem anderen Projekt.');
    }
    if (!projekteAn) {
      projektId = null;
    }
    bestehendesVorhaben = {
      id: vorhaben.id,
      anlauf: vorhaben.anlauf,
      boss: bosseAn && vorhaben.boss ? { titel: vorhaben.titel } : null,
    };
  }

  const projekt = projektId === null ? null : ladeProjektFuerEintrag(projektId);
  const gewichte = ladeAktiveGewichte(daten.vorlageId);
  pruefeVorlageZumProjekt(daten.vorlageId, projektId);

  const istMeilenstein = daten.abschluss === 'geschafft' || (daten.abschluss === null && daten.meilenstein);
  const faehigkeit =
    daten.faehigkeitId === null
      ? null
      : { id: daten.faehigkeitId, name: pruefeAktiveFaehigkeit(daten.faehigkeitId).name };

  return { projekt, gewichte, bestehendesVorhaben, istMeilenstein, faehigkeit };
}

export function ladeAktiveTageDesProjekts(projektId: number | null, ohneEintragId: number): string[] {
  const filter = projektId === null ? 'projekt_id IS NULL' : 'projekt_id = ?';
  const parameter: Parameter[] = projektId === null ? [] : [projektId];
  return alle<{ tag: string }>(
    `SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege WHERE ${filter} AND id <> ?`,
    ...parameter,
    ohneEintragId,
  ).map((zeile) => zeile.tag);
}

export interface EintragSonder {
  basisAufgabeId?: number;
  bossBesiegt?: boolean;
  gegnerBesiegt?: boolean;
}

function mindereGezielt(anteile: XpAnteil[], regeln: ErschoepfungRegel[]): XpAnteil[] {
  return anteile.map((anteil) => {
    let faktor = 1;
    for (const regel of regeln) {
      if (regel.zielId === anteil.attributId) {
        faktor *= regel.faktor;
      }
    }
    return { attributId: anteil.attributId, xp: Math.round(anteil.xp * faktor) };
  });
}

function ohneEins(multiplikatoren: Multiplikator[]): Multiplikator[] {
  return multiplikatoren.filter((eintrag) => Math.abs(eintrag.faktor - 1) > Number.EPSILON);
}

export function erstelleEintrag(
  daten: EintragDaten,
  jetzt = new Date(),
  sonder: EintragSonder = {},
): EintragErgebnis {
  const { projekt, gewichte, bestehendesVorhaben, istMeilenstein, faehigkeit } = bereiteVor(daten);
  const zeitpunkt = zeitpunktFuerEintrag(daten.datum, jetzt);
  const iso = zeitpunkt.toISOString();
  const tag = lokalesDatum(zeitpunkt);
  const erschoepfungen = ladeErschoepfungen().filter((regel) => regel.faktor < 1);
  const globaleErschoepfung: Multiplikator[] = erschoepfungen
    .filter((regel) => regel.zielId === null)
    .map((regel) => ({ art: 'erschoepfung', faktor: regel.faktor, label: `Erschöpfung: ${regel.quelleName}` }));
  const gezielteErschoepfung = erschoepfungen.filter((regel) => regel.zielId !== null);
  const weitere = ohneEins([{ art: 'momentum', faktor: momentumFuerTag(tag) }, ...globaleErschoepfung]);
  const faktor = gesamtFaktor(weitere);
  const xp = eintragXp(daten.stunden, faktor);
  const projektBonus = projekt ? bonusAufProjekt(projekt.id, projekt.visionId, iso) : 0;
  const boss = bestehendesVorhaben?.boss ?? null;
  const schaden = boss ? xp : null;
  const disziplinId = aktivesAttribut('disziplin');
  const geistId = aktivesAttribut('geist');
  const vorlageAttributIds = gewichte.map((gewicht) => gewicht.attributId);
  const belastete = ladeBelastendeAttribute().filter((attribut) => istBelastend(vorlageAttributIds, attribut.id));
  const vorher = ladeLevelStand(projekt?.id ?? null, faehigkeit?.id ?? null);

  const ergebnis = inTransaktion(() => {
    pflegeRueckkehr(jetzt);
    const vorhabenId =
      daten.vorhaben?.art === 'neu'
        ? legeVorhabenAn(projekt?.id ?? null, daten.vorhaben.titel, zeitpunkt)
        : (bestehendesVorhaben?.id ?? null);

    const { id: eintragId } = ausfuehren(
      `INSERT INTO eintraege (projekt_id, vorlage_id, vorhaben_id, faehigkeit_id, abschluss, stunden, notiz,
                              meilenstein, krit, boss_schaden, ausruestung_bonus, faktor, basis_aufgabe_id, erstellt_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      projekt?.id ?? null,
      daten.vorlageId,
      vorhabenId,
      faehigkeit?.id ?? null,
      daten.abschluss,
      daten.stunden,
      daten.notiz,
      Number(istMeilenstein),
      0,
      schaden,
      projektBonus,
      faktor,
      sonder.basisAufgabeId ?? null,
      iso,
    );

    const buchungen: AttributBuchung[] = [];
    const boni: Bonus[] = [];
    let projektXp = 0;
    let faehigkeitXp = 0;

    const bucheAttribute = (quelle: XpQuelle, anteile: { attributId: number; xp: number }[], bezug: number | null) => {
      let summe = 0;
      for (const anteil of anteile) {
        if (anteil.xp > 0) {
          buchungen.push(
            bucheAttributXp({ quelle, attributId: anteil.attributId, xp: anteil.xp, eintragId, vorhabenId: bezug }, iso),
          );
          summe += anteil.xp;
        }
      }
      return summe;
    };
    const bucheErfahrung = (quelle: XpQuelle, betrag: number) => {
      if (projekt) {
        bucheProjektXp({ quelle, projektId: projekt.id, xp: betrag, eintragId, vorhabenId }, iso);
        projektXp += betrag;
      }
      if (faehigkeit !== null) {
        bucheFaehigkeitXp({ quelle, faehigkeitId: faehigkeit.id, xp: betrag, eintragId }, iso);
        faehigkeitXp += betrag;
      }
    };

    const eintragAnteile = mindereGezielt(verteileNachGewichten(xp, gewichte), gezielteErschoepfung).map((anteil) => ({
      attributId: anteil.attributId,
      xp: Math.round(anteil.xp * (1 + bonusAufAttribut(anteil.attributId, iso))),
    }));
    bucheAttribute('eintrag', eintragAnteile, vorhabenId);
    bucheErfahrung('eintrag', Math.round(xp * (1 + projektBonus)));

    for (const attribut of belastete) {
      const abzug = belastungXp(xp, ladeAttributXp(attribut.id), attribut.stufe);
      if (abzug > 0) {
        buchungen.push(
          bucheAttributXp({ quelle: 'belastung', attributId: attribut.id, xp: -abzug, eintragId, vorhabenId: null }, iso),
        );
      }
    }

    const tageVorher = ladeAktiveTageDesProjekts(projekt?.id ?? null, eintragId);
    if (disziplinId !== null && !tageVorher.includes(tag)) {
      const laenge = kettenLaenge([...tageVorher, tag], tag);
      const kettenBonus = bucheAttribute(
        'bestaendigkeit',
        [{ attributId: disziplinId, xp: bestaendigkeitsBonus(laenge) }],
        null,
      );
      if (kettenBonus > 0) {
        boni.push({ quelle: 'bestaendigkeit', label: `Tageskette: Tag ${laenge}`, xp: kettenBonus });
      }
    }

    if (sonder.basisAufgabeId !== undefined && disziplinId !== null) {
      const basisBonus = bucheAttribute('basis', [{ attributId: disziplinId, xp: basisDisziplinBonus(xp) }], null);
      if (basisBonus > 0) {
        boni.push({ quelle: 'basis', label: 'Basis-Aufgabe', xp: basisBonus });
      }
    }

    const projektFilter = projekt ? 'projekt_id = ?' : 'projekt_id IS NULL';
    const projektParameter: Parameter[] = projekt ? [projekt.id] : [];
    const gescheitert = eine<{ id: number }>(
      `SELECT id FROM vorhaben
       WHERE ${projektFilter} AND status = 'gescheitert' AND weitermachen_eingeloest = 0
         AND abgeschlossen_am >= ? AND abgeschlossen_am < ?
       ORDER BY abgeschlossen_am DESC LIMIT 1`,
      ...projektParameter,
      tagesbeginn(zeitpunkt, WEITERMACHEN.fristTage).toISOString(),
      iso,
    );
    if (gescheitert) {
      const weitermachenAnteile: { attributId: number; xp: number }[] = [];
      if (disziplinId !== null) {
        weitermachenAnteile.push({ attributId: disziplinId, xp: WEITERMACHEN.disziplin });
      }
      if (geistId !== null) {
        weitermachenAnteile.push({ attributId: geistId, xp: WEITERMACHEN.geist });
      }
      const weitermachenBonus = bucheAttribute('weitermachen', weitermachenAnteile, gescheitert.id);
      if (weitermachenBonus > 0) {
        ausfuehren('UPDATE vorhaben SET weitermachen_eingeloest = 1 WHERE id = ?', gescheitert.id);
        boni.push({ quelle: 'weitermachen', label: 'Weitergemacht nach Rückschlag', xp: weitermachenBonus });
      }
    }

    let bossSieg: { level: number; kampfXp: number } | null = null;
    if (daten.abschluss === 'geschafft' && vorhabenId !== null) {
      if (boss !== null) {
        const summe = eine<{ kampfXp: number }>(
          `SELECT COALESCE(SUM(boss_schaden), 0) AS kampfXp FROM eintraege WHERE vorhaben_id = ?`,
          vorhabenId,
        );
        const kampfXp = summe?.kampfXp ?? 0;
        const level = bossLevelAusKampfXp(kampfXp);
        ausfuehren(
          `UPDATE vorhaben SET status = 'geschafft', abgeschlossen_am = ?, boss_level = ? WHERE id = ?`,
          iso,
          level,
          vorhabenId,
        );
        bossSieg = { level, kampfXp };
      } else {
        ausfuehren(`UPDATE vorhaben SET status = 'geschafft', abgeschlossen_am = ? WHERE id = ?`, iso, vorhabenId);
      }
      const bisherigeAnteile = nurWirksameGewichte(
        alle<Gewicht>(
          `SELECT attribut_id AS attributId, SUM(xp) AS gewicht FROM xp_ereignisse
           WHERE quelle = 'eintrag' AND eintrag_id IN (SELECT id FROM eintraege WHERE vorhaben_id = ?)
           GROUP BY attribut_id HAVING SUM(xp) > 0`,
          vorhabenId,
        ),
      );
      const vorhabenAnteile = bisherigeAnteile.length > 0 ? bisherigeAnteile : gewichte;
      const { vorhabenXp } = eine<{ vorhabenXp: number }>(
        `SELECT COALESCE(SUM(
            CASE
              WHEN e.ausruestung_bonus > 0 THEN CAST(ROUND(px.xp / (1.0 + e.ausruestung_bonus)) AS INTEGER)
              ELSE px.xp
            END
          ), 0) AS vorhabenXp
         FROM projekt_xp px
         JOIN eintraege e ON e.id = px.eintrag_id
         WHERE px.quelle = 'eintrag' AND px.vorhaben_id = ?`,
        vorhabenId,
      ) ?? { vorhabenXp: 0 };
      const anlauf = bestehendesVorhaben?.anlauf ?? 1;
      const comeback = anlauf > 1;
      const quelle: BonusQuelle = comeback ? 'comeback' : 'meilenstein';
      const meilenstein = meilensteinBonus(vorhabenXp, comeback, boss !== null);
      bucheAttribute(quelle, verteileNachGewichten(meilenstein, vorhabenAnteile), vorhabenId);
      bucheErfahrung(quelle, meilenstein);
      const label = boss !== null ? 'Boss besiegt' : 'Vorhaben geschafft';
      boni.push({ quelle, label: comeback ? `${label} im ${anlauf}. Anlauf` : label, xp: meilenstein });

      const beute = bossBeute(bossSieg?.level ?? null);
      if (bossSieg !== null && beute > 0) {
        bucheAttribute('beute', verteileNachGewichten(beute, vorhabenAnteile), vorhabenId);
        bucheErfahrung('beute', beute);
        boni.push({ quelle: 'beute', label: `Beute · Level ${bossSieg.level}`, xp: beute });
      }
    } else if (daten.abschluss === 'gescheitert' && vorhabenId !== null) {
      ausfuehren(
        `UPDATE vorhaben SET status = 'gescheitert', erkenntnis = ?, abgeschlossen_am = ? WHERE id = ?`,
        daten.erkenntnis,
        iso,
        vorhabenId,
      );
    } else if (istMeilenstein) {
      const bossBesiegt = sonder.bossBesiegt === true;
      const meilenstein = meilensteinBonus(xp, false, bossBesiegt);
      bucheAttribute('meilenstein', verteileNachGewichten(meilenstein, gewichte), vorhabenId);
      bucheErfahrung('meilenstein', meilenstein);
      boni.push({
        quelle: 'meilenstein',
        label: bossBesiegt ? 'Boss besiegt' : 'Meilenstein erreicht',
        xp: meilenstein,
      });
    } else if (sonder.gegnerBesiegt === true) {
      const gegner = Math.round(meilensteinBonus(xp, false) / GEGNER.belohnungTeiler);
      bucheAttribute('meilenstein', verteileNachGewichten(gegner, gewichte), vorhabenId);
      bucheErfahrung('meilenstein', gegner);
      boni.push({ quelle: 'meilenstein', label: 'Gegner besiegt', xp: gegner });
    }

    verdieneSchutz(tag, eintragId);
    const rueckkehr = erfuelleRueckkehr(eintragId, tag, iso);
    if (rueckkehr.xp > 0) {
      buchungen.push(...rueckkehr.buchungen);
      boni.push({ quelle: 'rueckkehr', label: 'Rückkehr', xp: rueckkehr.xp });
    }

    return { eintragId, buchungen, boni, projektXp, faehigkeitXp, bossSieg };
  });

  const bossBelohnung: Belohnung['boss'] =
    boss !== null && ergebnis.bossSieg !== null
      ? { titel: boss.titel, level: ergebnis.bossSieg.level, kampfXp: ergebnis.bossSieg.kampfXp }
      : null;

  const nachher = ladeLevelStand(projekt?.id ?? null, faehigkeit?.id ?? null);
  return mitBewertung({
    eintrag: ladeEintrag(ergebnis.eintragId),
    belohnung: erstelleBelohnung({
      buchungen: ergebnis.buchungen,
      boni: ergebnis.boni,
      meilenstein: istMeilenstein,
      projekt: projekt ? { name: projekt.name, xp: ergebnis.projektXp } : null,
      faehigkeit: faehigkeit !== null ? { name: faehigkeit.name, xp: ergebnis.faehigkeitXp } : null,
      boss: bossBelohnung,
      multiplikatoren: [
        ...weitere,
        ...(projektBonus > 0 ? [{ art: 'ausruestung' as const, faktor: 1 + projektBonus }] : []),
        ...gezielteErschoepfung.map((regel) => ({
          art: 'erschoepfung' as const,
          faktor: regel.faktor,
          label: `Erschöpfung: ${regel.quelleName} → ${regel.zielName ?? ''}`,
        })),
      ],
      vorher,
      nachher,
    }),
  }, jetzt);
}

export function loescheEintrag(id: number, jetzt = new Date()): void {
  const eintrag = eine<{
    vorhabenId: number | null;
    abschluss: Abschluss | null;
  }>(
    'SELECT vorhaben_id AS vorhabenId, abschluss FROM eintraege WHERE id = ?',
    id,
  );
  if (!eintrag) {
    throw nichtGefunden('Der Eintrag');
  }

  if (eintrag.abschluss !== null && eintrag.vorhabenId !== null) {
    const vorhaben = ladeVorhaben(eintrag.vorhabenId);
    if (vorhaben.hatNachfolger) {
      throw ungueltig(
        'Dieser Eintrag hat ein Vorhaben abgeschlossen, für das schon ein neuer Anlauf läuft. Er kann nicht gelöscht werden.',
      );
    }
  }

  const ruecknahme = eine<{ aufgabeId: number; vorkommen: string; wiederholung: string }>(
    `SELECT r.aufgabe_id AS aufgabeId, r.vorkommen, a.wiederholung
     FROM aufgaben_erledigt r
     JOIN aufgaben a ON a.id = r.aufgabe_id
     WHERE r.eintrag_id = ?`,
    id,
  );

  inTransaktion(() => {
    const gebunden = eine<{ id: number; geoeffnetAm: string; fristAm: string }>(
      `SELECT id, geoeffnet_am AS geoeffnetAm, frist_am AS fristAm FROM rueckkehr WHERE eintrag_id = ?`,
      id,
    );
    sperreSkillsDesEintrags(id);
    if (eintrag.abschluss !== null && eintrag.vorhabenId !== null) {
      ausfuehren(
        `UPDATE vorhaben SET status = 'offen', abgeschlossen_am = NULL, erkenntnis = '', weitermachen_eingeloest = 0
         WHERE id = ? AND status = ?`,
        eintrag.vorhabenId,
        eintrag.abschluss,
      );
    }
    const eingeloest = alle<{ vorhabenId: number }>(
      `SELECT DISTINCT vorhaben_id AS vorhabenId FROM xp_ereignisse
       WHERE eintrag_id = ? AND quelle = 'weitermachen' AND vorhaben_id IS NOT NULL`,
      id,
    );
    for (const { vorhabenId } of eingeloest) {
      ausfuehren('UPDATE vorhaben SET weitermachen_eingeloest = 0 WHERE id = ?', vorhabenId);
    }
    if (ruecknahme && ruecknahme.wiederholung !== 'keine') {
      ausfuehren('UPDATE aufgaben SET faellig_am = ? WHERE id = ?', ruecknahme.vorkommen, ruecknahme.aufgabeId);
    }
    ausfuehren('DELETE FROM eintraege WHERE id = ?', id);
    if (gebunden) {
      haengeRueckkehrUm(gebunden.id, gebunden.geoeffnetAm, gebunden.fristAm, lokalesDatum(jetzt));
    }
  });
}

