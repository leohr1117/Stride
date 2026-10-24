import { ausTagesSchluessel, DATUM_HINWEIS, lokalesDatum, plusTage } from './datum.ts';

export const ALS_NAECHSTES_TAGE = 7;

export const WIEDERHOLUNGEN = ['keine', 'taeglich', 'woechentlich', 'monatlich'] as const;
export type Wiederholung = (typeof WIEDERHOLUNGEN)[number];

/** HH:MM, 00:00 bis 23:59. Dieselbe Grenze wie später in Zod. */
export const UHRZEIT_MUSTER = /^([01]\d|2[0-3]):[0-5]\d$/;

export const UHRZEIT_BRAUCHT_DATUM = 'Die Uhrzeit braucht ein Datum.';
export const UHRZEIT_FORMAT = 'Die Uhrzeit muss im Format HH:MM angegeben werden.';
export const GEGNER_ODER_BOSS_EINMALIG = 'Ein Gegner oder Boss ist einmalig.';
export const GEGNER_SCHLIESST_AUS = 'Ein Gegner schließt Meilenstein und Boss aus.';
export const BOSS_BRAUCHT_MEILENSTEIN = 'Ein Boss braucht einen Meilenstein.';
export const DEADLINE_NUR_GEGNER_ODER_BOSS = 'Eine Deadline gibt es nur bei einem Gegner oder Boss.';
export const DEADLINE_VERGANGEN = 'Die Deadline darf nicht in der Vergangenheit liegen.';
export const WIEDERHOLUNG_BRAUCHT_DATUM = 'Eine Wiederholung braucht ein Datum.';
export const WOCHENTAG_PFLICHT = 'Wähle mindestens einen Wochentag.';
export const WOCHENTAG_FORMAT = 'Ein Wochentag ist eine Zahl von 1 bis 7.';
export const PRIORITAET_FORMAT = 'Die Priorität ist 1 bis 4.';
export const WIEDERHOLUNG_UNBEKANNT = 'Die Wiederholung ist unbekannt.';
export const NAMEN_INFO =
  'Datum, Uhrzeit, p1 bis p4, #Projekt, +Organisation und *Vision kannst du in den Namen schreiben.';

const DATUM_MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface AufgabeFelder {
  faelligAm: string | null;
  faelligUm: string | null;
  wiederholung: Wiederholung;
  wochentage: readonly number[];
  prioritaet: number | null;
  nurHeute: boolean;
  meilenstein: boolean;
  gegner: boolean;
  boss: boolean;
  deadline: string | null;
}

export interface AufgabeTermin {
  faelligAm: string | null;
  faelligUm: string | null;
  wiederholung: Wiederholung;
  wochentage: number[];
  monatstag: number | null;
  prioritaet: number | null;
  nurHeuteAm: string | null;
  meilenstein: boolean;
  gegner: boolean;
  boss: boolean;
  deadline: string | null;
}

export type AufgabeFestlegung = { ok: true; termin: AufgabeTermin } | { ok: false; fehler: string };

export interface SortierAufgabe {
  name: string;
  faelligAm: string | null;
  faelligUm: string | null;
  prioritaet: number | null;
}

export function istWiederholung(wert: string): wert is Wiederholung {
  return (WIEDERHOLUNGEN as readonly string[]).includes(wert);
}

/** ISO-Tag, Montag ist 1 und Sonntag ist 7. Das Datum muss ein echter Kalendertag sein. */
export function isoWochentag(datum: string): number {
  const tag = ausTagesSchluessel(datum).getDay();
  return tag === 0 ? 7 : tag;
}

/**
 * Nächstes Datum strikt nach dem späteren von Vorkommen und heute.
 * `keine` oder ein fehlendes Vorkommen ergibt null. Versäumte Tage bleiben eine Aufgabe.
 * Die Uhrzeit schiebt diese Funktion nicht, sie bleibt beim Aufrufer stehen.
 */
export function naechstesDatum(
  wiederholung: Wiederholung,
  vorkommen: string | null,
  heute: string,
  wochentage: readonly number[] = [],
  monatstag: number | null = null,
): string | null {
  if (wiederholung === 'keine' || vorkommen === null || kalenderTeile(vorkommen) === null || kalenderTeile(heute) === null) {
    return null;
  }
  const anker = vorkommen > heute ? vorkommen : heute;
  if (wiederholung === 'taeglich') {
    return plusEinTag(anker);
  }
  if (wiederholung === 'woechentlich') {
    return naechsterWochentag(anker, wochentage);
  }
  const tag = monatstag ?? kalenderTeile(vorkommen)?.tag ?? null;
  if (tag === null || !istGanzzahl(tag, 1, 31)) {
    return null;
  }
  return naechsterMonatstag(anker, tag);
}

/**
 * Mit Uhrzeit zuerst nach Datum, Uhrzeit und Name.
 * Danach ohne Uhrzeit nach Priorität, Datum und Name. Priorität und Datum ohne Wert stehen hinten.
 */
export function vergleicheAufgaben(a: SortierAufgabe, b: SortierAufgabe): number {
  const zeitA = hatUhrzeit(a.faelligUm);
  const zeitB = hatUhrzeit(b.faelligUm);
  if (zeitA !== zeitB) {
    return zeitA ? -1 : 1;
  }
  if (zeitA) {
    return vergleicheText(a.faelligAm, b.faelligAm) || vergleicheText(a.faelligUm, b.faelligUm) || vergleicheText(a.name, b.name);
  }
  const prioritaet = rang(a.prioritaet) - rang(b.prioritaet);
  return prioritaet || vergleicheText(a.faelligAm, b.faelligAm) || vergleicheText(a.name, b.name);
}

export function sortiereAufgaben<T extends SortierAufgabe>(aufgaben: readonly T[]): T[] {
  return [...aufgaben].sort(vergleicheAufgaben);
}

export interface HeuteSicht {
  archiviert: boolean;
  faelligAm: string | null;
  nurHeuteAm: string | null;
  wiederholung: Wiederholung;
  heuteEintragId: number | null;
}

export function istEinmaligErledigt(aufgabe: HeuteSicht): boolean {
  return aufgabe.wiederholung === 'keine' && aufgabe.heuteEintragId !== null;
}

export function erscheintAufHeute(aufgabe: HeuteSicht, heute: string): boolean {
  if (aufgabe.archiviert) {
    return false;
  }
  if (istEinmaligErledigt(aufgabe)) {
    return aufgabe.faelligAm === heute;
  }
  if (aufgabe.faelligAm !== null && aufgabe.faelligAm <= heute) {
    return true;
  }
  if (aufgabe.nurHeuteAm === heute) {
    return true;
  }
  return aufgabe.heuteEintragId !== null;
}

export function erscheintAlsNaechstes(aufgabe: { faelligAm: string | null }, heute: string): boolean {
  const faellig = aufgabe.faelligAm;
  if (faellig === null || kalenderTeile(faellig) === null || kalenderTeile(heute) === null) {
    return false;
  }
  const bis = lokalesDatum(plusTage(ausTagesSchluessel(heute), ALS_NAECHSTES_TAGE));
  return faellig > heute && faellig <= bis;
}

/**
 * Nur heute leert Datum, Uhrzeit, Wiederholung, Wochentage und Monatstag und gewinnt gegen ein mitgeschicktes Datum.
 * Ein Datum ohne diesen Schalter lässt die Nadel leer. Gegner und Boss werden nicht stillschweigend umgebaut.
 */
export function bereiteAufgabe(felder: AufgabeFelder, heute: string, bisherigeDeadline: string | null = null): AufgabeFestlegung {
  const heuteFehler = datumFehler(heute);
  if (heuteFehler !== null) {
    return { ok: false, fehler: heuteFehler };
  }

  const nurHeute = felder.nurHeute;
  const faelligAm = nurHeute ? null : leer(felder.faelligAm);
  const faelligUm = nurHeute ? null : leer(felder.faelligUm);
  const deadline = leer(felder.deadline);
  const gespeichert = leer(bisherigeDeadline);
  const wiederholung = nurHeute ? 'keine' : felder.wiederholung;
  if (!istWiederholung(wiederholung)) {
    return { ok: false, fehler: WIEDERHOLUNG_UNBEKANNT };
  }

  const prioritaetFehler = pruefePrioritaet(felder.prioritaet);
  if (prioritaetFehler !== null) {
    return { ok: false, fehler: prioritaetFehler };
  }
  const datumFormat = faelligAm === null ? null : datumFehler(faelligAm);
  if (datumFormat !== null) {
    return { ok: false, fehler: datumFormat };
  }
  if (faelligUm !== null && !UHRZEIT_MUSTER.test(faelligUm)) {
    return { ok: false, fehler: UHRZEIT_FORMAT };
  }
  if (faelligUm !== null && faelligAm === null) {
    return { ok: false, fehler: UHRZEIT_BRAUCHT_DATUM };
  }
  if (wiederholung !== 'keine' && faelligAm === null) {
    return { ok: false, fehler: WIEDERHOLUNG_BRAUCHT_DATUM };
  }

  const flagge = flaggenFehler(felder.gegner, felder.boss, felder.meilenstein, wiederholung);
  if (flagge !== null) {
    return { ok: false, fehler: flagge };
  }

  const wochentage = wiederholung === 'woechentlich' ? eindeutigeTage(felder.wochentage) : [];
  if (wiederholung === 'woechentlich') {
    if (felder.wochentage.some((tag) => !istGanzzahl(tag, 1, 7))) {
      return { ok: false, fehler: WOCHENTAG_FORMAT };
    }
    if (wochentage.length === 0) {
      return { ok: false, fehler: WOCHENTAG_PFLICHT };
    }
  }

  const deadlineFehler = pruefeDeadline(deadline, gespeichert, heute, felder.gegner, felder.boss);
  if (deadlineFehler !== null) {
    return { ok: false, fehler: deadlineFehler };
  }

  return {
    ok: true,
    termin: {
      faelligAm,
      faelligUm,
      wiederholung,
      wochentage,
      monatstag: wiederholung === 'monatlich' && faelligAm !== null ? (kalenderTeile(faelligAm)?.tag ?? null) : null,
      prioritaet: felder.prioritaet,
      nurHeuteAm: nurHeute ? heute : null,
      meilenstein: felder.meilenstein,
      gegner: felder.gegner,
      boss: felder.boss,
      deadline,
    },
  };
}

function flaggenFehler(gegner: boolean, boss: boolean, meilenstein: boolean, wiederholung: Wiederholung): string | null {
  if (gegner && (meilenstein || boss)) {
    return GEGNER_SCHLIESST_AUS;
  }
  if (boss && !meilenstein) {
    return BOSS_BRAUCHT_MEILENSTEIN;
  }
  if ((gegner || boss) && wiederholung !== 'keine') {
    return GEGNER_ODER_BOSS_EINMALIG;
  }
  return null;
}

function pruefeDeadline(
  deadline: string | null,
  bisherige: string | null,
  heute: string,
  gegner: boolean,
  boss: boolean,
): string | null {
  if (deadline === null) {
    return null;
  }
  const format = datumFehler(deadline);
  if (format !== null) {
    return format;
  }
  if (!gegner && !boss) {
    return DEADLINE_NUR_GEGNER_ODER_BOSS;
  }
  if (deadline < heute && deadline !== bisherige) {
    return DEADLINE_VERGANGEN;
  }
  return null;
}

function pruefePrioritaet(prioritaet: number | null): string | null {
  if (prioritaet !== null && !istGanzzahl(prioritaet, 1, 4)) {
    return PRIORITAET_FORMAT;
  }
  return null;
}

function naechsterWochentag(ab: string, wochentage: readonly number[]): string | null {
  const tage = eindeutigeTage(wochentage).filter((tag) => istGanzzahl(tag, 1, 7));
  const ziel = tage.find((tag) => tag > isoWochentag(ab)) ?? tage[0];
  if (ziel === undefined) {
    return null;
  }
  const start = isoWochentag(ab);
  const abstand = ziel > start ? ziel - start : 7 - start + ziel;
  return lokalesDatum(plusTage(ausTagesSchluessel(ab), abstand));
}

function naechsterMonatstag(ab: string, monatstag: number): string | null {
  const teile = kalenderTeile(ab);
  if (teile === null) {
    return null;
  }
  const letzter = new Date(teile.jahr, teile.monat, 0).getDate();
  if (Math.min(monatstag, letzter) > teile.tag) {
    return schreibeDatum(teile.jahr, teile.monat, Math.min(monatstag, letzter));
  }
  const jahr = teile.monat === 12 ? teile.jahr + 1 : teile.jahr;
  const monat = teile.monat === 12 ? 1 : teile.monat + 1;
  return schreibeDatum(jahr, monat, Math.min(monatstag, new Date(jahr, monat, 0).getDate()));
}

function plusEinTag(datum: string): string {
  return lokalesDatum(plusTage(ausTagesSchluessel(datum), 1));
}

function kalenderTeile(datum: string): { jahr: number; monat: number; tag: number } | null {
  const treffer = DATUM_MUSTER.exec(datum);
  if (!treffer) {
    return null;
  }
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  const probe = new Date(jahr, monat - 1, tag);
  if (probe.getFullYear() !== jahr || probe.getMonth() !== monat - 1 || probe.getDate() !== tag) {
    return null;
  }
  return { jahr, monat, tag };
}

function datumFehler(datum: string): string | null {
  if (!DATUM_MUSTER.test(datum)) {
    return DATUM_HINWEIS;
  }
  return kalenderTeile(datum) === null ? `Das Datum ${datum} existiert nicht.` : null;
}

function schreibeDatum(jahr: number, monat: number, tag: number): string {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

function eindeutigeTage(tage: readonly number[]): number[] {
  return [...new Set(tage)].sort((a, b) => a - b);
}

function leer(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  const geschnitten = wert.trim();
  return geschnitten === '' ? null : geschnitten;
}

function hatUhrzeit(uhrzeit: string | null): boolean {
  return uhrzeit !== null && uhrzeit !== '';
}

function rang(prioritaet: number | null): number {
  return prioritaet === null ? Number.POSITIVE_INFINITY : prioritaet;
}

function vergleicheText(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a < b ? -1 : 1;
}

function istGanzzahl(wert: number, min: number, max: number): boolean {
  return Number.isInteger(wert) && wert >= min && wert <= max;
}
