import type { Sprache } from '../sprache/kern.ts';
import { isoWochentag } from './aufgabe.ts';
import { ausTagesSchluessel, lokalesDatum, plusTage } from './datum.ts';
import { falte, WORTE, type SprachWorte, type ZeitWorte } from './schnelleingabeWorte.ts';

/**
 * Schnelleingabe im Aufgabennamen. Rein, ohne DOM und ohne Datumsbibliothek.
 * Der Client parst. Der Server speichert den Namen, den der Client schickt.
 * Deutsch gilt immer, dazu die Wörter der aktiven Sprache.
 */

export const VORSCHLAG_MAX = 6;

export const SCHNELL_ZEICHEN = {
  projekt: '#',
  organisation: '+',
  vision: '*',
} as const;

export interface SchnellSpanne {
  von: number;
  bis: number;
}

export interface SchnellZiel {
  id: number;
  name: string;
  archiviert?: boolean;
}

export interface SchnellEbenen {
  projekte: boolean;
  organisationen: boolean;
  visionen: boolean;
}

export type SchnellZielArt = 'projekt' | 'organisation' | 'vision';

export type SchnellStueck =
  | { art: 'termin'; von: number; bis: number; text: string; datum: string | null; uhrzeit: string | null }
  | { art: 'prioritaet'; von: number; bis: number; text: string; prioritaet: 1 | 2 | 3 | 4 }
  | { art: SchnellZielArt; von: number; bis: number; text: string; id: number; name: string };

export interface SchnellTreffer {
  id: number;
  name: string;
}

export interface SchnellVorschlag {
  art: SchnellZielArt;
  zeichen: '#' | '+' | '*';
  von: number;
  bis: number;
  text: string;
  praefix: string;
  treffer: SchnellTreffer[];
}

export interface SchnellErgebnis {
  stuecke: SchnellStueck[];
  vorschlaege: SchnellVorschlag[];
  datum: string | null;
  uhrzeit: string | null;
  prioritaet: 1 | 2 | 3 | 4 | null;
  projektId: number | null;
  organisationId: number | null;
  visionId: number | null;
}

export interface SchnellEingabe {
  name: string;
  heute: string;
  sprache: Sprache;
  projekte?: readonly SchnellZiel[];
  organisationen?: readonly SchnellZiel[];
  visionen?: readonly SchnellZiel[];
  ebenen?: Partial<SchnellEbenen>;
  /** Spannen, die das Kreuz verworfen hat. Sie bleiben Text und werden nicht noch einmal erkannt. */
  entlassen?: readonly SchnellSpanne[];
}

function leeresErgebnis(): SchnellErgebnis {
  return {
    stuecke: [],
    vorschlaege: [],
    datum: null,
    uhrzeit: null,
    prioritaet: null,
    projektId: null,
    organisationId: null,
    visionId: null,
  };
}

const ZEICHEN: Record<'#' | '+' | '*', SchnellZielArt> = {
  '#': 'projekt',
  '+': 'organisation',
  '*': 'vision',
};

type KandidatArt = 'datum' | 'uhrzeit' | 'prioritaet' | SchnellZielArt | 'vorschlag';

interface Kandidat {
  art: KandidatArt;
  von: number;
  bis: number;
  datum?: string;
  uhrzeit?: string;
  prioritaet?: 1 | 2 | 3 | 4;
  id?: number;
  name?: string;
  zeichen?: '#' | '+' | '*';
  praefix?: string;
  treffer?: SchnellTreffer[];
  zielArt?: SchnellZielArt;
}

interface Zahl {
  wert: number;
  bis: number;
  roh: string;
}

/** Entfernt gesetzte Stücke und zieht Leerzeichen zusammen. Entlassene Spannen stehen nicht in der Liste. */
export function nameOhneStuecke(name: string, stuecke: readonly SchnellSpanne[]): string {
  const sortiert = [...stuecke].filter((stueck) => stueck.bis > stueck.von).sort((a, b) => b.von - a.von);
  let text = name;
  for (const stueck of sortiert) {
    const von = Math.max(0, Math.min(stueck.von, text.length));
    const bis = Math.max(von, Math.min(stueck.bis, text.length));
    text = text.slice(0, von) + text.slice(bis);
  }
  return text.replace(/[ \t]+/g, ' ').trim();
}

export function parseSchnelleingabe(eingabe: SchnellEingabe): SchnellErgebnis {
  const name = eingabe.name;
  if (name.length === 0) {
    return leeresErgebnis();
  }
  const heute = echtesIso(eingabe.heute);
  const sprachen = sprachenFuer(eingabe.sprache);
  const ebenen: SchnellEbenen = {
    projekte: eingabe.ebenen?.projekte ?? true,
    organisationen: eingabe.ebenen?.organisationen ?? true,
    visionen: eingabe.ebenen?.visionen ?? true,
  };
  const katalog = {
    projekt: ebenen.projekte ? aktiveZiele(eingabe.projekte) : [],
    organisation: ebenen.organisationen ? aktiveZiele(eingabe.organisationen) : [],
    vision: ebenen.visionen ? aktiveZiele(eingabe.visionen) : [],
  };
  const kandidaten: Kandidat[] = [];
  for (let index = 0; index < name.length; index++) {
    if (index > 0 && klebt(name[index - 1])) {
      continue;
    }
    sammle(name, index, heute, eingabe.sprache, sprachen, katalog, kandidaten);
  }
  const gewaehlt = waehle(kandidaten, eingabe.entlassen ?? []);
  return ergebnis(name, heute, gewaehlt);
}

function sprachenFuer(sprache: Sprache): SprachWorte[] {
  return sprache === 'de' ? [WORTE.de] : [WORTE.de, WORTE[sprache]];
}

function aktiveZiele(ziele: readonly SchnellZiel[] | undefined): SchnellZiel[] {
  if (!ziele) {
    return [];
  }
  return ziele.filter((ziel) => ziel.archiviert !== true && ziel.name.trim() !== '');
}

function sammle(
  text: string,
  start: number,
  heute: string | null,
  aktiv: Sprache,
  sprachen: readonly SprachWorte[],
  katalog: Record<SchnellZielArt, readonly SchnellZiel[]>,
  ziel: Kandidat[],
): void {
  const prioritaet = suchePrioritaet(text, start);
  if (prioritaet) {
    ziel.push(prioritaet);
  }
  const zuordnung = sucheZiel(text, start, katalog);
  if (zuordnung) {
    ziel.push(zuordnung);
  }
  if (heute !== null) {
    for (const worte of sprachen) {
      sammleWorte(text, start, heute, aktiv, worte, ziel);
    }
  }
  const zahlDatum = sucheZahlDatum(text, start, heute);
  if (zahlDatum) {
    ziel.push(zahlDatum);
  }
  for (const worte of sprachen) {
    const monat = sucheMonat(text, start, heute, worte);
    if (monat) {
      ziel.push(monat);
    }
    if (worte.cjk) {
      const cjk = sucheCjkDatum(text, start, heute, worte);
      if (cjk) {
        ziel.push(cjk);
      }
    }
    for (const uhrzeit of sucheUhrzeiten(text, start, worte.zeit)) {
      ziel.push(uhrzeit);
    }
  }
}

function sammleWorte(text: string, start: number, heute: string, aktiv: Sprache, worte: SprachWorte, ziel: Kandidat[]): void {
  const herkunft = herkunftVon(worte);
  for (const alias of worte.heute) {
    const bis = wortBis(text, start, alias, herkunft, aktiv);
    if (bis !== null) {
      ziel.push(datumKandidat(start, bis, heute));
    }
  }
  for (const alias of worte.morgen) {
    const bis = wortBis(text, start, alias, herkunft, aktiv);
    if (bis !== null) {
      const datum = plusKalendertage(heute, 1);
      if (datum) {
        ziel.push(datumKandidat(start, bis, datum));
      }
    }
  }
  for (const alias of worte.uebermorgen) {
    const bis = wortBis(text, start, alias, herkunft, aktiv);
    if (bis !== null) {
      const datum = plusKalendertage(heute, 2);
      if (datum) {
        ziel.push(datumKandidat(start, bis, datum));
      }
    }
  }
  const relativ = sucheInTagen(text, start, heute, worte);
  if (relativ) {
    ziel.push(relativ);
  }
  worte.wochentage.forEach((aliase, index) => {
    for (const alias of aliase) {
      const bis = wortBis(text, start, alias, herkunft, aktiv);
      if (bis === null) {
        continue;
      }
      const datum = wochentagDatum(heute, index + 1);
      if (datum) {
        ziel.push(datumKandidat(start, bis, datum));
      }
    }
  });
}

function herkunftVon(worte: SprachWorte): Sprache {
  const treffer = (Object.keys(WORTE) as Sprache[]).find((sprache) => WORTE[sprache] === worte);
  return treffer ?? 'de';
}

/**
 * Kürzel mit höchstens zwei Buchstaben nur in der aktiven Sprache.
 * Sonst wird englisch „do“ zum Donnerstag und „so“ zum Sonntag.
 */
function wortBis(text: string, start: number, alias: string, herkunft: Sprache, aktiv: Sprache): number | null {
  if (herkunft !== aktiv && falte(alias).length <= 2) {
    return null;
  }
  const bis = passtAb(text, start, alias);
  if (bis === null || klebt(text[bis])) {
    return null;
  }
  return bis;
}

function sucheInTagen(text: string, start: number, heute: string, worte: SprachWorte): Kandidat | null {
  if (worte.zahlZuerst) {
    const zahl = zahlAb(text, start);
    if (zahl === null || zahl.roh.length > 3 || zahl.wert < 1 || zahl.wert > 365) {
      return null;
    }
    const ab = weiss(text, zahl.bis);
    let best: number | null = null;
    for (const suffix of worte.tag) {
      const bis = passtAb(text, ab, suffix);
      if (bis !== null && !klebt(text[bis]) && (best === null || bis > best)) {
        best = bis;
      }
    }
    if (best === null) {
      return null;
    }
    const datum = plusKalendertage(heute, zahl.wert);
    return datum === null ? null : datumKandidat(start, best, datum);
  }
  let best: Kandidat | null = null;
  for (const inWort of worte.in) {
    const nachIn = passtAb(text, start, inWort);
    if (nachIn === null || klebt(text[nachIn])) {
      continue;
    }
    const nachLuecke = weiss(text, nachIn);
    if (nachLuecke === nachIn) {
      continue;
    }
    const zahl = zahlAb(text, nachLuecke);
    if (zahl === null || zahl.roh.length > 3 || zahl.wert < 1 || zahl.wert > 365) {
      continue;
    }
    const nachZahl = weiss(text, zahl.bis);
    if (nachZahl === zahl.bis) {
      continue;
    }
    for (const tagWort of worte.tag) {
      const bis = passtAb(text, nachZahl, tagWort);
      if (bis === null || klebt(text[bis])) {
        continue;
      }
      const datum = plusKalendertage(heute, zahl.wert);
      if (datum !== null && (best === null || bis > best.bis)) {
        best = datumKandidat(start, bis, datum);
      }
    }
  }
  return best;
}

function sucheZahlDatum(text: string, start: number, heute: string | null): Kandidat | null {
  const tag = zahlAb(text, start);
  if (tag === null || tag.roh.length > 2 || text[tag.bis] !== '.') {
    return null;
  }
  const monat = zahlAb(text, tag.bis + 1);
  if (monat === null || monat.roh.length > 2 || monat.wert < 1 || monat.wert > 12 || tag.wert < 1 || tag.wert > 31) {
    return null;
  }
  let bis = monat.bis;
  let jahr: number | null = null;
  if (text[bis] === '.') {
    const danach = zahlAb(text, bis + 1);
    if (danach !== null && danach.roh.length === 4 && !klebt(text[danach.bis])) {
      jahr = danach.wert;
      bis = danach.bis;
    } else if (danach !== null) {
      return null;
    } else {
      bis += 1;
    }
  } else if (monat.roh.length !== 2) {
    return null;
  }
  if (klebt(text[bis])) {
    return null;
  }
  const datum = datumMitJahr(tag.wert, monat.wert, jahr, heute);
  return datum === null ? null : datumKandidat(start, bis, datum);
}

function sucheMonat(text: string, start: number, heute: string | null, worte: SprachWorte): Kandidat | null {
  const tag = zahlAb(text, start);
  if (tag === null || tag.roh.length > 2 || tag.wert < 1 || tag.wert > 31) {
    return null;
  }
  let index = tag.bis;
  if (text[index] === '.') {
    index += 1;
  } else if (!istWeiss(text[index])) {
    return null;
  }
  index = weiss(text, index);
  const ohneFueller = monatAb(text, index, worte);
  const mitFueller = ohneFueller === null ? monatNachFueller(text, index, worte) : null;
  const monat = ohneFueller ?? mitFueller;
  if (monat === null) {
    return null;
  }
  const jahr = jahrNach(text, monat.bis, worte);
  const datum = datumMitJahr(tag.wert, monat.monat, jahr?.jahr ?? null, heute);
  return datum === null ? null : datumKandidat(start, jahr?.bis ?? monat.bis, datum);
}

function monatNachFueller(text: string, index: number, worte: SprachWorte): { bis: number; monat: number } | null {
  const nachFueller = nimmFueller(text, index, worte.fueller);
  if (nachFueller === null) {
    return null;
  }
  return monatAb(text, nachFueller, worte);
}

function monatAb(text: string, index: number, worte: SprachWorte): { bis: number; monat: number } | null {
  let best: { bis: number; monat: number } | null = null;
  for (let monatIndex = 0; monatIndex < worte.monate.length; monatIndex++) {
    for (const name of worte.monate[monatIndex] ?? []) {
      const bis = passtAb(text, index, name);
      if (bis === null || klebt(text[bis])) {
        continue;
      }
      if (best === null || bis > best.bis) {
        best = { bis, monat: monatIndex + 1 };
      }
    }
  }
  return best;
}

function jahrNach(text: string, index: number, worte: SprachWorte): { jahr: number; bis: number } | null {
  const nachWeiss = weiss(text, index);
  if (nachWeiss === index) {
    return null;
  }
  const direkt = nimmJahr(text, nachWeiss);
  if (direkt) {
    return direkt;
  }
  const nachFueller = nimmFueller(text, nachWeiss, worte.fueller);
  return nachFueller === null ? null : nimmJahr(text, nachFueller);
}

function sucheCjkDatum(text: string, start: number, heute: string | null, worte: SprachWorte): Kandidat | null {
  const cjk = worte.cjk;
  if (cjk === null) {
    return null;
  }
  let index = start;
  let jahr: number | null = null;
  const vielleichtJahr = zahlAb(text, index);
  if (vielleichtJahr !== null && vielleichtJahr.roh.length === 4) {
    const nachJahr = passtAb(text, vielleichtJahr.bis, cjk.jahr);
    if (nachJahr !== null) {
      jahr = vielleichtJahr.wert;
      index = nachJahr;
    }
  }
  const monat = zahlAb(text, index);
  if (monat === null || monat.roh.length > 2) {
    return null;
  }
  const nachMonat = passtAb(text, monat.bis, cjk.monat);
  if (nachMonat === null) {
    return null;
  }
  const tag = zahlAb(text, nachMonat);
  if (tag === null || tag.roh.length > 2) {
    return null;
  }
  let bis: number | null = null;
  for (const suffix of cjk.tag) {
    const ende = passtAb(text, tag.bis, suffix);
    if (ende !== null && !klebt(text[ende]) && (bis === null || ende > bis)) {
      bis = ende;
    }
  }
  if (bis === null) {
    return null;
  }
  const datum = datumMitJahr(tag.wert, monat.wert, jahr, heute);
  return datum === null ? null : datumKandidat(start, bis, datum);
}

function sucheUhrzeiten(text: string, start: number, zeit: ZeitWorte): Kandidat[] {
  const stunde = zahlAb(text, start);
  if (stunde === null || stunde.roh.length > 2) {
    return [];
  }
  const treffer: Kandidat[] = [];
  if (text[stunde.bis] === ':') {
    const minute = zahlAb(text, stunde.bis + 1);
    if (minute !== null && minute.roh.length === 2 && minuteGueltig(stunde.wert, minute.wert)) {
      const nackt = uhrKandidat(start, minute.bis, stunde.wert, minute.wert);
      if (nackt && !klebt(text[minute.bis])) {
        treffer.push(nackt);
      }
      const mitWort = uhrWortNach(text, minute.bis, zeit.uhr);
      if (mitWort !== null) {
        const kandidat = uhrKandidat(start, mitWort, stunde.wert, minute.wert);
        if (kandidat) {
          treffer.push(kandidat);
        }
      }
      const tageszeit = tageszeitNach(text, start, minute.bis, stunde.wert, minute.wert, zeit);
      if (tageszeit) {
        treffer.push(tageszeit);
      }
    }
  }
  const wort = uhrWortNach(text, stunde.bis, zeit.uhr);
  if (wort !== null && stunde.wert >= 0 && stunde.wert <= 23) {
    const kandidat = uhrKandidat(start, wort, stunde.wert, 0);
    if (kandidat) {
      treffer.push(kandidat);
    }
  }
  const kurz = sucheStundeKurz(text, start, stunde, zeit.stundeKurz);
  if (kurz) {
    treffer.push(kurz);
  }
  const kanji = sucheKanjiZeit(text, start, stunde, zeit);
  if (kanji) {
    treffer.push(kanji);
  }
  const amPm = tageszeitNach(text, start, stunde.bis, stunde.wert, 0, zeit);
  if (amPm) {
    treffer.push(amPm);
  }
  return treffer;
}

function uhrWortNach(text: string, index: number, woerter: readonly string[]): number | null {
  const ab = weiss(text, index);
  if (ab === index) {
    return null;
  }
  let best: number | null = null;
  for (const wort of woerter) {
    const bis = passtAb(text, ab, wort);
    if (bis !== null && !klebt(text[bis]) && (best === null || bis > best)) {
      best = bis;
    }
  }
  return best;
}

function sucheStundeKurz(text: string, start: number, stunde: Zahl, woerter: readonly string[]): Kandidat | null {
  if (woerter.length === 0 || stunde.wert < 0 || stunde.wert > 23) {
    return null;
  }
  const ab = weiss(text, stunde.bis);
  let best: Kandidat | null = null;
  for (const wort of woerter) {
    const nach = passtAb(text, ab, wort);
    if (nach === null) {
      continue;
    }
    let bis = nach;
    let minute = 0;
    const nachKurz = weiss(text, nach);
    if ((text[nachKurz] ?? '') >= '0' && (text[nachKurz] ?? '') <= '9') {
      const zahl = zahlAb(text, nachKurz);
      if (zahl === null || zahl.roh.length > 2 || zahl.wert > 59) {
        continue;
      }
      minute = zahl.wert;
      bis = zahl.bis;
    } else if (klebt(text[nach])) {
      continue;
    }
    if (klebt(text[bis])) {
      continue;
    }
    const kandidat = uhrKandidat(start, bis, stunde.wert, minute);
    if (kandidat && (best === null || kandidat.bis > best.bis)) {
      best = kandidat;
    }
  }
  return best;
}

function sucheKanjiZeit(text: string, start: number, stunde: Zahl, zeit: ZeitWorte): Kandidat | null {
  if (zeit.stunde.length === 0 || stunde.wert < 0 || stunde.wert > 23) {
    return null;
  }
  let best: Kandidat | null = null;
  for (const suffix of zeit.stunde) {
    const nach = passtAb(text, stunde.bis, suffix);
    if (nach === null) {
      continue;
    }
    let bis = nach;
    let minute = 0;
    const zahl = zahlAb(text, bis);
    if (zahl !== null && zeit.minute.length > 0) {
      for (const minuteSuffix of zeit.minute) {
        const ende = passtAb(text, zahl.bis, minuteSuffix);
        if (ende !== null && zahl.wert <= 59 && (bis === nach || ende > bis)) {
          minute = zahl.wert;
          bis = ende;
        }
      }
      if (bis === nach && klebt(text[nach])) {
        continue;
      }
    }
    if (klebt(text[bis])) {
      continue;
    }
    const kandidat = uhrKandidat(start, bis, stunde.wert, minute);
    if (kandidat && (best === null || kandidat.bis > best.bis)) {
      best = kandidat;
    }
  }
  return best;
}

function tageszeitNach(
  text: string,
  von: number,
  index: number,
  stunde: number,
  minute: number,
  zeit: ZeitWorte,
): Kandidat | null {
  if (zeit.am.length === 0 && zeit.pm.length === 0) {
    return null;
  }
  const ab = weiss(text, index);
  const am = laengstesWort(text, ab, zeit.am);
  const pm = laengstesWort(text, ab, zeit.pm);
  const vormittag = am !== null && (pm === null || am >= pm);
  const bis = vormittag ? am : pm;
  if (bis === null) {
    return null;
  }
  const stunde24 = stunde24Aus(stunde, vormittag);
  if (stunde24 === null) {
    return null;
  }
  return uhrKandidat(von, bis, stunde24, minute);
}

function laengstesWort(text: string, index: number, woerter: readonly string[]): number | null {
  let best: number | null = null;
  for (const wort of woerter) {
    const bis = passtAb(text, index, wort);
    if (bis !== null && !klebt(text[bis]) && (best === null || bis > best)) {
      best = bis;
    }
  }
  return best;
}

function stunde24Aus(stunde: number, vormittag: boolean): number | null {
  if (stunde < 1 || stunde > 12) {
    return null;
  }
  if (stunde === 12) {
    return vormittag ? 0 : 12;
  }
  return vormittag ? stunde : stunde + 12;
}

function suchePrioritaet(text: string, start: number): Kandidat | null {
  if (falte(text[start] ?? '') !== 'p') {
    return null;
  }
  const ziffer = text[start + 1];
  if (ziffer === undefined || ziffer < '1' || ziffer > '4' || klebt(text[start + 2])) {
    return null;
  }
  return { art: 'prioritaet', von: start, bis: start + 2, prioritaet: Number(ziffer) as 1 | 2 | 3 | 4 };
}

function sucheZiel(text: string, start: number, katalog: Record<SchnellZielArt, readonly SchnellZiel[]>): Kandidat | null {
  const zeichen = text[start] as '#' | '+' | '*' | undefined;
  if (zeichen !== '#' && zeichen !== '+' && zeichen !== '*') {
    return null;
  }
  if (start > 0 && !istWeiss(text[start - 1])) {
    return null;
  }
  const art = ZEICHEN[zeichen];
  const ziele = katalog[art];
  const rest = text.slice(start + 1);
  const exakt: { ziel: SchnellZiel; bis: number }[] = [];
  for (const eintrag of ziele) {
    const laenge = passtAb(rest, 0, eintrag.name.trim());
    if (laenge === null || klebt(rest[laenge])) {
      continue;
    }
    exakt.push({ ziel: eintrag, bis: start + 1 + laenge });
  }
  if (exakt.length > 0) {
    const maxBis = Math.max(...exakt.map((eintrag) => eintrag.bis));
    const laengste = exakt.filter((eintrag) => eintrag.bis === maxBis);
    if (laengste.length === 1) {
      const gesetzt = laengste[0];
      if (gesetzt === undefined) {
        return null;
      }
      return {
        art,
        von: start,
        bis: gesetzt.bis,
        id: gesetzt.ziel.id,
        name: gesetzt.ziel.name.trim(),
      };
    }
    return vorschlag(text, start, maxBis, art, zeichen, laengste.map((eintrag) => eintrag.ziel));
  }
  const token = /^\S*/.exec(rest)?.[0] ?? '';
  const praefix = falte(token);
  const treffer = ziele.filter((eintrag) => {
    const name = falte(eintrag.name.trim());
    return praefix.length < name.length && name.startsWith(praefix);
  });
  if (treffer.length === 0) {
    return null;
  }
  return vorschlag(text, start, start + 1 + token.length, art, zeichen, treffer);
}

function vorschlag(
  text: string,
  von: number,
  bis: number,
  art: SchnellZielArt,
  zeichen: '#' | '+' | '*',
  ziele: readonly SchnellZiel[],
): Kandidat {
  const treffer = [...ziele]
    .sort((a, b) => b.name.trim().length - a.name.trim().length || a.name.trim().localeCompare(b.name.trim(), 'de'))
    .slice(0, VORSCHLAG_MAX)
    .map((eintrag) => ({ id: eintrag.id, name: eintrag.name.trim() }));
  return {
    art: 'vorschlag',
    von,
    bis,
    zeichen,
    praefix: text.slice(von + 1, bis),
    treffer,
    zielArt: art,
  };
}

function waehle(kandidaten: readonly Kandidat[], entlassen: readonly SchnellSpanne[]): Kandidat[] {
  const frei = kandidaten.filter((kandidat) => kandidat.bis > kandidat.von && !entlassen.some((spanne) => ueberlappt(kandidat, spanne)));
  frei.sort((a, b) => a.von - b.von || b.bis - b.von - (a.bis - a.von));
  const gewaehlt: Kandidat[] = [];
  const gesehen = new Set<KandidatArt>();
  let cursor = 0;
  for (const kandidat of frei) {
    if (kandidat.von < cursor) {
      continue;
    }
    if (kandidat.art !== 'vorschlag' && gesehen.has(kandidat.art)) {
      continue;
    }
    gewaehlt.push(kandidat);
    if (kandidat.art !== 'vorschlag') {
      gesehen.add(kandidat.art);
    }
    cursor = kandidat.bis;
  }
  return gewaehlt;
}

function ergebnis(name: string, heute: string | null, gewaehlt: readonly Kandidat[]): SchnellErgebnis {
  const verbunden = verbindeTermin(name, gewaehlt);
  let datum: string | null = null;
  let uhrzeit: string | null = null;
  let datumImText = false;
  let prioritaet: 1 | 2 | 3 | 4 | null = null;
  let projektId: number | null = null;
  let organisationId: number | null = null;
  let visionId: number | null = null;
  const stuecke: SchnellStueck[] = [];
  const vorschlaege: SchnellVorschlag[] = [];
  for (const kandidat of verbunden) {
    if (kandidat.art === 'vorschlag' && kandidat.zeichen && kandidat.treffer && kandidat.zielArt) {
      vorschlaege.push({
        art: kandidat.zielArt,
        zeichen: kandidat.zeichen,
        von: kandidat.von,
        bis: kandidat.bis,
        text: name.slice(kandidat.von, kandidat.bis),
        praefix: kandidat.praefix ?? '',
        treffer: kandidat.treffer,
      });
      continue;
    }
    if (kandidat.art === 'datum' && kandidat.datum) {
      datum = kandidat.datum;
      datumImText = true;
      if (kandidat.uhrzeit) {
        uhrzeit = kandidat.uhrzeit;
      }
      stuecke.push(terminStueck(name, kandidat));
      continue;
    }
    if (kandidat.art === 'uhrzeit' && kandidat.uhrzeit) {
      uhrzeit = kandidat.uhrzeit;
      stuecke.push(terminStueck(name, kandidat));
      continue;
    }
    if (kandidat.art === 'prioritaet' && kandidat.prioritaet) {
      prioritaet = kandidat.prioritaet;
      stuecke.push({
        art: 'prioritaet',
        von: kandidat.von,
        bis: kandidat.bis,
        text: name.slice(kandidat.von, kandidat.bis),
        prioritaet: kandidat.prioritaet,
      });
      continue;
    }
    if ((kandidat.art === 'projekt' || kandidat.art === 'organisation' || kandidat.art === 'vision') && kandidat.id !== undefined && kandidat.name) {
      if (kandidat.art === 'projekt') {
        projektId = kandidat.id;
      } else if (kandidat.art === 'organisation') {
        organisationId = kandidat.id;
      } else {
        visionId = kandidat.id;
      }
      stuecke.push({
        art: kandidat.art,
        von: kandidat.von,
        bis: kandidat.bis,
        text: name.slice(kandidat.von, kandidat.bis),
        id: kandidat.id,
        name: kandidat.name,
      });
    }
  }
  if (uhrzeit && !datumImText && heute !== null) {
    datum = heute;
    for (const stueck of stuecke) {
      if (stueck.art === 'termin' && stueck.uhrzeit && stueck.datum === null) {
        stueck.datum = heute;
      }
    }
  }
  return { stuecke, vorschlaege, datum, uhrzeit, prioritaet, projektId, organisationId, visionId };
}

function verbindeTermin(name: string, gewaehlt: readonly Kandidat[]): Kandidat[] {
  const ergebnisListe: Kandidat[] = [];
  for (const kandidat of gewaehlt) {
    const letzter = ergebnisListe[ergebnisListe.length - 1];
    if (
      letzter &&
      nurWeiss(name, letzter.bis, kandidat.von) &&
      ((letzter.art === 'datum' && kandidat.art === 'uhrzeit') || (letzter.art === 'uhrzeit' && kandidat.art === 'datum'))
    ) {
      ergebnisListe[ergebnisListe.length - 1] = {
        art: 'datum',
        von: letzter.von,
        bis: kandidat.bis,
        datum: letzter.datum ?? kandidat.datum,
        uhrzeit: letzter.uhrzeit ?? kandidat.uhrzeit,
      };
      continue;
    }
    ergebnisListe.push(kandidat);
  }
  return ergebnisListe;
}

function terminStueck(name: string, kandidat: Kandidat): SchnellStueck {
  return {
    art: 'termin',
    von: kandidat.von,
    bis: kandidat.bis,
    text: name.slice(kandidat.von, kandidat.bis),
    datum: kandidat.datum ?? null,
    uhrzeit: kandidat.uhrzeit ?? null,
  };
}

function datumKandidat(von: number, bis: number, datum: string): Kandidat {
  return { art: 'datum', von, bis, datum };
}

function uhrKandidat(von: number, bis: number, stunde: number, minute: number): Kandidat | null {
  if (!minuteGueltig(stunde, minute)) {
    return null;
  }
  return { art: 'uhrzeit', von, bis, uhrzeit: formatZeit(stunde, minute) };
}

function minuteGueltig(stunde: number, minute: number): boolean {
  return stunde >= 0 && stunde <= 23 && minute >= 0 && minute <= 59;
}

function formatZeit(stunde: number, minute: number): string {
  return `${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function nimmFueller(text: string, index: number, fueller: readonly string[]): number | null {
  let best: number | null = null;
  for (const wort of fueller) {
    const bis = passtAb(text, index, wort);
    if (bis === null || klebt(text[bis])) {
      continue;
    }
    const nach = weiss(text, bis);
    if (nach === bis) {
      continue;
    }
    if (best === null || nach > best) {
      best = nach;
    }
  }
  return best;
}

function nimmJahr(text: string, index: number): { jahr: number; bis: number } | null {
  const zahl = zahlAb(text, index);
  if (zahl === null || zahl.roh.length !== 4 || klebt(text[zahl.bis]) || zahl.wert < 1) {
    return null;
  }
  return { jahr: zahl.wert, bis: zahl.bis };
}

function datumMitJahr(tag: number, monat: number, jahr: number | null, heute: string | null): string | null {
  if (jahr !== null) {
    return echtesDatum(jahr, monat, tag);
  }
  if (heute === null) {
    return null;
  }
  const teile = teileVon(heute);
  if (teile === null) {
    return null;
  }
  const dieses = echtesDatum(teile.jahr, monat, tag);
  if (dieses !== null && dieses >= heute) {
    return dieses;
  }
  return echtesDatum(teile.jahr + 1, monat, tag);
}

function wochentagDatum(heute: string, isoZiel: number): string | null {
  if (echtesIso(heute) === null) {
    return null;
  }
  const abstand = (isoZiel - isoWochentag(heute) + 7) % 7;
  return plusKalendertage(heute, abstand);
}

function plusKalendertage(datum: string, tage: number): string | null {
  if (echtesIso(datum) === null) {
    return null;
  }
  return lokalesDatum(plusTage(ausTagesSchluessel(datum), tage));
}

function echtesIso(datum: string): string | null {
  const teile = teileVon(datum);
  if (teile === null) {
    return null;
  }
  const probe = echtesDatum(teile.jahr, teile.monat, teile.tag);
  return probe === datum ? probe : null;
}

function teileVon(datum: string): { jahr: number; monat: number; tag: number } | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!treffer) {
    return null;
  }
  return { jahr: Number(treffer[1]), monat: Number(treffer[2]), tag: Number(treffer[3]) };
}

function echtesDatum(jahr: number, monat: number, tag: number): string | null {
  if (!Number.isInteger(jahr) || monat < 1 || monat > 12 || tag < 1 || tag > 31) {
    return null;
  }
  const probe = new Date(jahr, monat - 1, tag);
  if (probe.getFullYear() !== jahr || probe.getMonth() !== monat - 1 || probe.getDate() !== tag) {
    return null;
  }
  return lokalesDatum(probe);
}

function passtAb(text: string, start: number, vorlage: string): number | null {
  const ziel = falte(vorlage);
  if (ziel.length === 0) {
    return null;
  }
  let gebaut = '';
  let index = start;
  while (index < text.length && gebaut.length < ziel.length) {
    const stueck = falte(text[index] ?? '');
    index += 1;
    if (stueck === '') {
      continue;
    }
    gebaut += stueck;
    if (!ziel.startsWith(gebaut)) {
      return null;
    }
  }
  return gebaut === ziel ? index : null;
}

function zahlAb(text: string, start: number): Zahl | null {
  let index = start;
  while (index < text.length && text[index]! >= '0' && text[index]! <= '9') {
    index += 1;
  }
  if (index === start) {
    return null;
  }
  const roh = text.slice(start, index);
  return { wert: Number(roh), bis: index, roh };
}

function weiss(text: string, index: number): number {
  let cursor = index;
  while (istWeiss(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function nurWeiss(text: string, von: number, bis: number): boolean {
  return bis >= von && text.slice(von, bis).length > 0 && weiss(text, von) >= bis;
}

function ueberlappt(a: SchnellSpanne, b: SchnellSpanne): boolean {
  return a.von < b.bis && b.von < a.bis;
}

function klebt(char: string | undefined): boolean {
  return char !== undefined && /[\p{Script=Latin}\p{Script=Cyrillic}\p{N}]/u.test(char);
}

function istWeiss(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\u00a0';
}
