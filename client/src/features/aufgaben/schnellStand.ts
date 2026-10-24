import type { Sprache } from '../../../../shared/sprache/kern.ts';
import {
  nameOhneStuecke,
  parseSchnelleingabe,
  type SchnellErgebnis,
  type SchnellEbenen,
  type SchnellSpanne,
  type SchnellStueck,
  type SchnellTreffer,
  type SchnellVorschlag,
  type SchnellZiel,
} from '../../../../shared/spiel/schnelleingabe.ts';

/**
 * Dialogzustand der Schnelleingabe. Der Parser bleibt in schnelleingabe.ts.
 * `hand` hat der Nutzer im Nebenfeld gesetzt oder geladen. `stueck` kam nur aus dem Namen.
 * Das Kreuz leert ein Feld nur bei `stueck`. Der Nebenweg behält den neuen Wert und entlässt das Stück.
 */

export type SchnellHerkunft = 'hand' | 'stueck';
export type SchnellFeld = 'datum' | 'uhrzeit' | 'prioritaet' | 'projekt' | 'organisation' | 'vision';

const FELDER: readonly SchnellFeld[] = ['datum', 'uhrzeit', 'prioritaet', 'projekt', 'organisation', 'vision'];

export interface SchnellKontext {
  heute: string;
  sprache: Sprache;
  projekte: readonly SchnellZiel[];
  organisationen: readonly SchnellZiel[];
  visionen: readonly SchnellZiel[];
  ebenen: SchnellEbenen;
}

export interface SchnellAnfang {
  name: string;
  faelligAm: string;
  faelligUm: string;
  prioritaet: number | null;
  projektId: number | null;
  organisationId: number | null;
  visionId: number | null;
}

export interface SchnellStand {
  name: string;
  entlassen: SchnellSpanne[];
  faelligAm: string;
  faelligUm: string;
  prioritaet: number | null;
  projektId: number | null;
  organisationId: number | null;
  visionId: number | null;
  herkunft: Record<SchnellFeld, SchnellHerkunft>;
}

export function schiebeSpannen(alt: string, neu: string, spannen: readonly SchnellSpanne[]): SchnellSpanne[] {
  if (alt === neu) {
    return spannen.map((spanne) => ({ von: spanne.von, bis: spanne.bis }));
  }
  let prefix = 0;
  const grenze = Math.min(alt.length, neu.length);
  while (prefix < grenze && alt[prefix] === neu[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < alt.length - prefix &&
    suffix < neu.length - prefix &&
    alt[alt.length - 1 - suffix] === neu[neu.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const altVon = prefix;
  const altBis = alt.length - suffix;
  const delta = neu.length - alt.length;
  const ergebnis: SchnellSpanne[] = [];
  for (const spanne of spannen) {
    if (spanne.bis <= spanne.von) {
      continue;
    }
    if (spanne.bis <= altVon) {
      ergebnis.push({ von: spanne.von, bis: spanne.bis });
      continue;
    }
    if (spanne.von >= altBis) {
      const von = spanne.von + delta;
      const bis = spanne.bis + delta;
      if (von >= 0 && bis <= neu.length && bis > von) {
        ergebnis.push({ von, bis });
      }
    }
  }
  return ergebnis;
}

export function ergebnisVon(stand: SchnellStand, kontext: SchnellKontext): SchnellErgebnis {
  return parseSchnelleingabe({
    name: stand.name,
    heute: kontext.heute,
    sprache: kontext.sprache,
    projekte: kontext.projekte,
    organisationen: kontext.organisationen,
    visionen: kontext.visionen,
    ebenen: kontext.ebenen,
    entlassen: stand.entlassen,
  });
}

export function bereinigterName(stand: SchnellStand, kontext: SchnellKontext): string {
  return nameOhneStuecke(stand.name, ergebnisVon(stand, kontext).stuecke);
}

export function vorschlagAmCursor(vorschlaege: readonly SchnellVorschlag[], cursor: number): SchnellVorschlag | null {
  let gewaehlt: SchnellVorschlag | null = null;
  for (const vorschlag of vorschlaege) {
    if (cursor > vorschlag.von && cursor <= vorschlag.bis) {
      gewaehlt = vorschlag;
    }
  }
  return gewaehlt;
}

export function anfangsStand(anfang: SchnellAnfang, kontext: SchnellKontext): SchnellStand {
  return tippe(
    {
      name: anfang.name,
      entlassen: [],
      faelligAm: anfang.faelligAm,
      faelligUm: anfang.faelligUm,
      prioritaet: anfang.prioritaet,
      projektId: anfang.projektId,
      organisationId: anfang.organisationId,
      visionId: anfang.visionId,
      herkunft: handHerkunft(),
    },
    anfang.name,
    kontext,
  );
}

export function tippe(stand: SchnellStand, name: string, kontext: SchnellKontext): SchnellStand {
  const basis = kopie(stand);
  basis.name = name;
  basis.entlassen = schiebeSpannen(stand.name, name, stand.entlassen);
  return wendeParser(basis, ergebnisVon(basis, kontext));
}

export function kreuz(stand: SchnellStand, spanne: SchnellSpanne, kontext: SchnellKontext): SchnellStand {
  const stueck = ergebnisVon(stand, kontext).stuecke.find((eintrag) => eintrag.von === spanne.von && eintrag.bis === spanne.bis);
  const naechster = kopie(stand);
  naechster.entlassen = [...stand.entlassen, { von: spanne.von, bis: spanne.bis }];
  if (!stueck) {
    return naechster;
  }
  const felder = beitrag(stueck);
  for (const feld of FELDER) {
    const wert = felder[feld];
    if (wert === undefined) {
      continue;
    }
    if (naechster.herkunft[feld] === 'stueck' && gleicherWert(naechster, feld, wert)) {
      schreib(naechster, feld, null);
      naechster.herkunft[feld] = 'hand';
    }
  }
  return naechster;
}

export function nebenweg(
  stand: SchnellStand,
  feld: SchnellFeld,
  wert: string | number | null,
  kontext: SchnellKontext,
): SchnellStand {
  if (gleicherWert(stand, feld, wert)) {
    return stand;
  }
  const naechster = kopie(stand);
  const stueck = ergebnisVon(stand, kontext).stuecke.find((eintrag) => beitrag(eintrag)[feld] !== undefined);
  if (stueck) {
    naechster.entlassen = [...naechster.entlassen, { von: stueck.von, bis: stueck.bis }];
    const felder = beitrag(stueck);
    for (const anderes of FELDER) {
      if (anderes === feld) {
        continue;
      }
      if (felder[anderes] !== undefined && naechster.herkunft[anderes] === 'stueck') {
        naechster.herkunft[anderes] = 'hand';
      }
    }
  }
  schreib(naechster, feld, wert);
  naechster.herkunft[feld] = 'hand';
  return naechster;
}

export function nebenwege(
  stand: SchnellStand,
  aenderungen: Partial<Record<SchnellFeld, string | number | null>>,
  kontext: SchnellKontext,
): SchnellStand {
  let naechster = stand;
  for (const feld of FELDER) {
    if (!Object.prototype.hasOwnProperty.call(aenderungen, feld)) {
      continue;
    }
    naechster = nebenweg(naechster, feld, aenderungen[feld] ?? null, kontext);
  }
  return naechster;
}

export function uebernimmVorschlag(
  stand: SchnellStand,
  vorschlag: SchnellVorschlag,
  treffer: SchnellTreffer,
  kontext: SchnellKontext,
): SchnellStand {
  const einsetzen = `${vorschlag.zeichen}${treffer.name}`;
  const name = stand.name.slice(0, vorschlag.von) + einsetzen + stand.name.slice(vorschlag.bis);
  return tippe(stand, name, kontext);
}

function wendeParser(stand: SchnellStand, ergebnis: SchnellErgebnis): SchnellStand {
  const naechster = kopie(stand);
  const werte = ausErgebnis(ergebnis);
  for (const feld of FELDER) {
    const parserWert = werte[feld];
    if (parserWert !== null) {
      if (naechster.herkunft[feld] === 'hand' && gleicherWert(naechster, feld, parserWert)) {
        continue;
      }
      schreib(naechster, feld, parserWert);
      naechster.herkunft[feld] = 'stueck';
      continue;
    }
    if (naechster.herkunft[feld] === 'stueck') {
      schreib(naechster, feld, null);
      naechster.herkunft[feld] = 'hand';
    }
  }
  return naechster;
}

function ausErgebnis(ergebnis: SchnellErgebnis): Record<SchnellFeld, string | number | null> {
  return {
    datum: ergebnis.datum,
    uhrzeit: ergebnis.uhrzeit,
    prioritaet: ergebnis.prioritaet,
    projekt: ergebnis.projektId,
    organisation: ergebnis.organisationId,
    vision: ergebnis.visionId,
  };
}

function beitrag(stueck: SchnellStueck): Partial<Record<SchnellFeld, string | number>> {
  if (stueck.art === 'termin') {
    const felder: Partial<Record<SchnellFeld, string | number>> = {};
    if (stueck.datum !== null) {
      felder.datum = stueck.datum;
    }
    if (stueck.uhrzeit !== null) {
      felder.uhrzeit = stueck.uhrzeit;
    }
    return felder;
  }
  if (stueck.art === 'prioritaet') {
    return { prioritaet: stueck.prioritaet };
  }
  if (stueck.art === 'projekt') {
    return { projekt: stueck.id };
  }
  if (stueck.art === 'organisation') {
    return { organisation: stueck.id };
  }
  return { vision: stueck.id };
}

function gleicherWert(stand: SchnellStand, feld: SchnellFeld, wert: string | number | null): boolean {
  return lies(stand, feld) === wert;
}

function lies(stand: SchnellStand, feld: SchnellFeld): string | number | null {
  if (feld === 'datum') {
    return stand.faelligAm === '' ? null : stand.faelligAm;
  }
  if (feld === 'uhrzeit') {
    return stand.faelligUm === '' ? null : stand.faelligUm;
  }
  if (feld === 'prioritaet') {
    return stand.prioritaet;
  }
  if (feld === 'projekt') {
    return stand.projektId;
  }
  if (feld === 'organisation') {
    return stand.organisationId;
  }
  return stand.visionId;
}

function schreib(stand: SchnellStand, feld: SchnellFeld, wert: string | number | null): void {
  if (feld === 'datum') {
    stand.faelligAm = typeof wert === 'string' ? wert : '';
    return;
  }
  if (feld === 'uhrzeit') {
    stand.faelligUm = typeof wert === 'string' ? wert : '';
    return;
  }
  if (feld === 'prioritaet') {
    stand.prioritaet = typeof wert === 'number' ? wert : null;
    return;
  }
  const id = typeof wert === 'number' ? wert : null;
  if (feld === 'projekt') {
    stand.projektId = id;
    return;
  }
  if (feld === 'organisation') {
    stand.organisationId = id;
    return;
  }
  stand.visionId = id;
}

function kopie(stand: SchnellStand): SchnellStand {
  return {
    ...stand,
    entlassen: stand.entlassen.map((spanne) => ({ von: spanne.von, bis: spanne.bis })),
    herkunft: { ...stand.herkunft },
  };
}

function handHerkunft(): Record<SchnellFeld, SchnellHerkunft> {
  return {
    datum: 'hand',
    uhrzeit: 'hand',
    prioritaet: 'hand',
    projekt: 'hand',
    organisation: 'hand',
    vision: 'hand',
  };
}
