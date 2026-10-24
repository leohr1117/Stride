import type { Aufgabe, AufgabeDaten, EintragErgebnis } from '../../../shared/api/index.ts';
import type { AufgabeFelder, AufgabeTermin } from '../../../shared/spiel/aufgabe.ts';
import { bereiteAufgabe, istWiederholung, naechstesDatum, sortiereAufgaben } from '../../../shared/spiel/aufgabe.ts';
import { GRENZEN, NEUTRAL_FARBE } from '../../../shared/spiel/begriffe.ts';
import { datumInZone } from '../../../shared/spiel/datum.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { alle, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { loeschbareMenge, loescheAufgabe as loescheAufgabenZeile } from '../../services/loeschen.ts';
import { pruefeProjektUndVorlage } from '../basis/basis.ts';
import { funktionAktiv, ladeEinstellungen, pruefeEbene, pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { KONTEXT_JOINS } from '../ziele/kontext.ts';

const AUFGABE_ICON = 'clipboard-list' as const;

export type AufgabeAenderung = Partial<AufgabeDaten> & { archiviert?: boolean };

interface Bezug {
  name: string;
  projektId: number | null;
  vorlageId: number | null;
  organisationId: number | null;
  visionId: number | null;
  stunden: number | null;
  archiviert: boolean;
}

interface AufgabeZeile {
  id: number;
  name: string;
  projektId: number | null;
  projektName: string | null;
  farbe: string;
  organisationId: number | null;
  organisationName: string | null;
  visionId: number | null;
  visionTitel: string | null;
  vorlageId: number | null;
  standardVorlageId: number | null;
  vorlageName: string;
  vorlageIcon: string;
  stunden: number | null;
  faelligAm: string | null;
  faelligUm: string | null;
  wiederholung: string;
  wochentage: string | null;
  monatstag: number | null;
  prioritaet: number | null;
  nurHeuteAm: string | null;
  meilenstein: number;
  gegner: number;
  boss: number;
  deadline: string | null;
  erstelltAm: string;
  archiviert: number;
  heuteEintragId: number | null;
}

const AUFGABE_FARBE = `COALESCE(v.farbe, o.farbe, ao.farbe, av.farbe, '${NEUTRAL_FARBE}')`;

const AUFGABE_ABFRAGE = `
  SELECT a.id, a.name,
         a.projekt_id AS projektId, p.name AS projektName, ${AUFGABE_FARBE} AS farbe,
         a.organisation_id AS organisationId, ao.name AS organisationName,
         a.vision_id AS visionId, av.titel AS visionTitel,
         a.vorlage_id AS vorlageId, p.standard_vorlage_id AS standardVorlageId,
         COALESCE(tv.name, '') AS vorlageName, COALESCE(tv.icon, '') AS vorlageIcon,
         a.stunden, a.faellig_am AS faelligAm, a.faellig_um AS faelligUm,
         a.wiederholung, a.wochentage, a.monatstag, a.prioritaet, a.nur_heute_am AS nurHeuteAm,
         a.meilenstein, a.gegner, a.boss, a.deadline, a.erstellt_am AS erstelltAm, a.archiviert,
         CASE
           WHEN a.wiederholung = 'keine' THEN (
             SELECT MAX(r.eintrag_id) FROM aufgaben_erledigt r WHERE r.aufgabe_id = a.id
           )
           ELSE (
             SELECT r.eintrag_id FROM aufgaben_erledigt r
             WHERE r.aufgabe_id = a.id AND r.vorkommen = ?
           )
         END AS heuteEintragId
  FROM aufgaben a
  LEFT JOIN projekte p ON p.id = a.projekt_id
  ${KONTEXT_JOINS}
  LEFT JOIN organisationen ao ON ao.id = a.organisation_id
  LEFT JOIN visionen av ON av.id = a.vision_id
  LEFT JOIN vorlagen tv ON tv.id = COALESCE(a.vorlage_id, p.standard_vorlage_id)
`;

function heuteVon(jetzt: Date): string {
  return datumInZone(jetzt, ladeEinstellungen().zeitzone);
}

function liesWochentage(text: string | null): number[] {
  if (text === null || text === '') {
    return [];
  }
  return text.split(',').map((teil) => Number(teil));
}

function schreibeWochentage(tage: readonly number[]): string | null {
  return tage.length === 0 ? null : tage.join(',');
}

function uebernimm<T>(neu: T | undefined, alt: T): T {
  return neu !== undefined ? neu : alt;
}

function nurHeuteWert(aenderung: AufgabeAenderung, bisher: AufgabeZeile | null, heute: string): boolean {
  if (aenderung.nurHeute !== undefined) {
    return aenderung.nurHeute;
  }
  if (aenderung.faelligAm) {
    return false;
  }
  return bisher?.nurHeuteAm === heute;
}

function nurArchiv(aenderung: AufgabeAenderung): boolean {
  const schluessel = Object.entries(aenderung)
    .filter((eintrag) => eintrag[1] !== undefined)
    .map((eintrag) => eintrag[0]);
  return schluessel.length > 0 && schluessel.every((name) => name === 'archiviert');
}

function zuAufgabe(zeile: AufgabeZeile, loeschbar: ReadonlySet<number>): Aufgabe {
  return {
    id: zeile.id,
    name: zeile.name,
    icon: AUFGABE_ICON,
    projektId: zeile.projektId,
    projektName: zeile.projektName,
    farbe: zeile.farbe,
    organisationId: zeile.organisationId,
    organisationName: zeile.organisationName,
    visionId: zeile.visionId,
    visionTitel: zeile.visionTitel,
    vorlageId: zeile.vorlageId,
    vorlageName: zeile.vorlageName,
    vorlageIcon: zeile.vorlageIcon,
    stunden: zeile.stunden,
    faelligAm: zeile.faelligAm,
    faelligUm: zeile.faelligUm,
    wiederholung: istWiederholung(zeile.wiederholung) ? zeile.wiederholung : 'keine',
    wochentage: liesWochentage(zeile.wochentage),
    monatstag: zeile.monatstag,
    prioritaet: zeile.prioritaet,
    nurHeuteAm: zeile.nurHeuteAm,
    meilenstein: zeile.meilenstein === 1,
    gegner: zeile.gegner === 1,
    boss: zeile.boss === 1,
    deadline: zeile.deadline,
    erstelltAm: zeile.erstelltAm,
    archiviert: zeile.archiviert === 1,
    loeschbar: loeschbar.has(zeile.id),
    heuteEintragId: zeile.heuteEintragId,
  };
}

function ladeZeile(id: number, heute: string): AufgabeZeile {
  const zeile = eine<AufgabeZeile>(`${AUFGABE_ABFRAGE} WHERE a.id = ?`, heute, id);
  if (!zeile) {
    throw nichtGefunden('Die Aufgabe');
  }
  return zeile;
}

function liefere(id: number, heute: string): Aufgabe {
  return zuAufgabe(ladeZeile(id, heute), loeschbareMenge('aufgabe'));
}

function felderAus(aenderung: AufgabeAenderung, bisher: AufgabeZeile | null, heute: string): AufgabeFelder {
  const bisherig = bisher !== null && istWiederholung(bisher.wiederholung) ? bisher.wiederholung : 'keine';
  return {
    faelligAm: uebernimm(aenderung.faelligAm, bisher?.faelligAm ?? null),
    faelligUm: uebernimm(aenderung.faelligUm, bisher?.faelligUm ?? null),
    wiederholung: uebernimm(aenderung.wiederholung, bisherig),
    wochentage: aenderung.wochentage ?? liesWochentage(bisher?.wochentage ?? null),
    prioritaet: uebernimm(aenderung.prioritaet, bisher?.prioritaet ?? null),
    nurHeute: nurHeuteWert(aenderung, bisher, heute),
    meilenstein: aenderung.meilenstein ?? (bisher?.meilenstein === 1),
    gegner: aenderung.gegner ?? (bisher?.gegner === 1),
    boss: aenderung.boss ?? (bisher?.boss === 1),
    deadline: uebernimm(aenderung.deadline, bisher?.deadline ?? null),
  };
}

function bezugAus(aenderung: AufgabeAenderung, bisher: AufgabeZeile | null): Bezug {
  return {
    name: aenderung.name ?? bisher?.name ?? '',
    projektId: uebernimm(aenderung.projektId, bisher?.projektId ?? null),
    vorlageId: uebernimm(aenderung.vorlageId, bisher?.vorlageId ?? null),
    organisationId: uebernimm(aenderung.organisationId, bisher?.organisationId ?? null),
    visionId: uebernimm(aenderung.visionId, bisher?.visionId ?? null),
    stunden: uebernimm(aenderung.stunden, bisher?.stunden ?? null),
    archiviert: aenderung.archiviert ?? (bisher?.archiviert === 1),
  };
}

function pruefeSicht(tabelle: 'visionen' | 'organisationen', id: number, name: string, archiv: string): void {
  const zeile = eine<{ archiviert: number }>(`SELECT archiviert FROM ${tabelle} WHERE id = ?`, id);
  if (!zeile) {
    throw nichtGefunden(name);
  }
  if (zeile.archiviert === 1) {
    throw ungueltig(archiv);
  }
}

function pruefeBezuege(bezug: Bezug): void {
  if (bezug.projektId !== null) {
    pruefeEbene('projekte');
  }
  if (bezug.visionId !== null) {
    pruefeEbene('visionen');
    pruefeSicht('visionen', bezug.visionId, 'Die Vision', 'Die gewählte Vision ist archiviert.');
  }
  if (bezug.organisationId !== null) {
    pruefeEbene('organisationen');
    pruefeSicht('organisationen', bezug.organisationId, 'Die Organisation', 'Die gewählte Organisation ist archiviert.');
  }
  pruefeProjektUndVorlage(bezug.projektId, bezug.vorlageId);
}

function schreibe(id: number | null, bezug: Bezug, termin: AufgabeTermin): number {
  const werte = [
    bezug.name,
    AUFGABE_ICON,
    bezug.projektId,
    bezug.vorlageId,
    bezug.stunden,
    termin.faelligAm,
    termin.wiederholung,
    schreibeWochentage(termin.wochentage),
    termin.monatstag,
    termin.prioritaet,
    termin.nurHeuteAm,
    termin.faelligUm,
    bezug.organisationId,
    bezug.visionId,
    Number(termin.meilenstein),
    Number(termin.gegner),
    Number(termin.boss),
    termin.deadline,
    Number(bezug.archiviert),
  ];
  if (id === null) {
    return ausfuehren(
      `INSERT INTO aufgaben (
         name, icon, projekt_id, vorlage_id, stunden, faellig_am, wiederholung, wochentage, monatstag, prioritaet,
         nur_heute_am, faellig_um, organisation_id, vision_id, meilenstein, gegner, boss, deadline, archiviert
       ) VALUES (${platzhalter(werte.length)})`,
      ...werte,
    ).id;
  }
  ausfuehren(
    `UPDATE aufgaben SET
       name = ?, icon = ?, projekt_id = ?, vorlage_id = ?, stunden = ?, faellig_am = ?, wiederholung = ?, wochentage = ?,
       monatstag = ?, prioritaet = ?, nur_heute_am = ?, faellig_um = ?, organisation_id = ?, vision_id = ?,
       meilenstein = ?, gegner = ?, boss = ?, deadline = ?, archiviert = ?
     WHERE id = ?`,
    ...werte,
    id,
  );
  return id;
}

function speichern(id: number | null, aenderung: AufgabeAenderung, jetzt: Date): Aufgabe {
  pruefeFunktion('aufgaben');
  const heute = heuteVon(jetzt);
  const bisher = id === null ? null : ladeZeile(id, heute);
  if (bisher && nurArchiv(aenderung)) {
    ausfuehren('UPDATE aufgaben SET archiviert = ? WHERE id = ?', Number(aenderung.archiviert), bisher.id);
    return liefere(bisher.id, heute);
  }
  const festlegung = bereiteAufgabe(felderAus(aenderung, bisher, heute), heute, bisher?.deadline ?? null);
  if (!festlegung.ok) {
    throw ungueltig(festlegung.fehler);
  }
  const bezug = bezugAus(aenderung, bisher);
  pruefeBezuege(bezug);
  return liefere(schreibe(id, bezug, festlegung.termin), heute);
}

export function ladeAufgaben(archiv = false, jetzt = new Date()): Aufgabe[] {
  if (!funktionAktiv('aufgaben')) {
    return [];
  }
  const loeschbar = loeschbareMenge('aufgabe');
  const zeilen = alle<AufgabeZeile>(`${AUFGABE_ABFRAGE} WHERE a.archiviert = ?`, heuteVon(jetzt), Number(archiv));
  return sortiereAufgaben(zeilen.map((zeile) => zuAufgabe(zeile, loeschbar)));
}

export function erstelleAufgabe(daten: AufgabeDaten, jetzt = new Date()): Aufgabe {
  return speichern(null, daten, jetzt);
}

export function aendereAufgabe(id: number, aenderung: AufgabeAenderung, jetzt = new Date()): Aufgabe {
  return speichern(id, aenderung, jetzt);
}

export function loescheAufgabe(id: number): void {
  pruefeFunktion('aufgaben');
  loescheAufgabenZeile(id);
}

export function erledigeAufgabe(id: number, jetzt = new Date()): EintragErgebnis {
  pruefeFunktion('aufgaben');
  const einstellungen = ladeEinstellungen();
  const heute = datumInZone(jetzt, einstellungen.zeitzone);
  const zeile = ladeZeile(id, heute);
  if (zeile.archiviert === 1) {
    throw ungueltig('Die Aufgabe ist archiviert.');
  }
  const vorlageId = zeile.vorlageId ?? zeile.standardVorlageId;
  if (vorlageId === null) {
    throw ungueltig('Wähle eine Tätigkeit.');
  }
  const wiederholung = istWiederholung(zeile.wiederholung) ? zeile.wiederholung : 'keine';
  const vorkommen = zeile.faelligAm ?? heute;
  const naechstes =
    wiederholung === 'keine'
      ? null
      : naechstesDatum(wiederholung, vorkommen, heute, liesWochentage(zeile.wochentage), zeile.monatstag);
  const projektAn = istAn('projekte', einstellungen);

  return inTransaktion(() => {
    const schon = eine<{ id: number }>(
      'SELECT id FROM aufgaben_erledigt WHERE aufgabe_id = ? AND vorkommen = ?',
      id,
      vorkommen,
    );
    if (schon) {
      throw ungueltig('Diese Aufgabe ist für den Tag schon erledigt.');
    }
    const ergebnis = erstelleEintrag(
      {
        projektId: projektAn ? zeile.projektId : null,
        vorlageId,
        stunden: zeile.stunden,
        notiz: zeile.name.slice(0, GRENZEN.notizMax),
        vorhaben: null,
        abschluss: null,
        erkenntnis: '',
        faehigkeitId: null,
        meilenstein: zeile.meilenstein === 1 || zeile.boss === 1,
        datum: null,
      },
      jetzt,
      { bossBesiegt: zeile.boss === 1, gegnerBesiegt: zeile.gegner === 1 },
    );
    ausfuehren(
      'INSERT INTO aufgaben_erledigt (aufgabe_id, vorkommen, eintrag_id, erledigt_am) VALUES (?, ?, ?, ?)',
      id,
      vorkommen,
      ergebnis.eintrag.id,
      jetzt.toISOString(),
    );
    if (wiederholung === 'keine') {
      ausfuehren('UPDATE aufgaben SET nur_heute_am = NULL WHERE id = ?', id);
    } else if (naechstes !== null) {
      ausfuehren('UPDATE aufgaben SET faellig_am = ?, nur_heute_am = NULL WHERE id = ?', naechstes, id);
    }
    return ergebnis;
  });
}
