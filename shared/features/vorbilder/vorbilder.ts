import { ATTRIBUT_KENNUNGEN, KOENNEN_KENNUNGEN, type AttributKennung } from '../../spiel/begriffe.ts';
import { bestimmeKlasse } from '../../spiel/klassen.ts';
import { berechneLevel, LEVEL_KURVEN, levelAusXpStetig, xpBisLevel, xpBisLevelStetig, type LevelKurve } from '../../spiel/level.ts';
import { BEISPIEL_SCHLUESSEL, PERSONEN, RICHTUNGEN, type PersonRoh, type Richtung } from './vorbildKatalog.ts';

export { BEISPIEL_SCHLUESSEL, RICHTUNGEN };
export type { Richtung };

export type KennungsLevel = Record<AttributKennung, number>;
export type Bewertung = Record<AttributKennung, number>;
export type Unsicher = Record<AttributKennung, boolean>;

/** Unsichere Schätzwerte zählen in der Ähnlichkeit nur mit diesem Gewicht. */
export const UNSICHER_GEWICHT = 0.5;

export const BEWERTUNG = {
  min: 1,
  normal: 5,
  max: 10,
} as const;

export interface LebensStation {
  alter: number;
  level: number;
  ereignis: string;
}

interface StationsDaten {
  alter: number;
  anteil: number;
  ereignis: string;
}

interface VorbildDaten {
  schluessel: string;
  name: string;
  bekanntFuer: string;
  beschreibung: string;
  geboren: number | null;
  gestorben: number | null;
  richtung: Richtung | null;
  level: number;
  /** Grobe Schätzung, 0 bis 100, für Ähnlichkeit und Radar. */
  schaetzung: Bewertung;
  /** true, wenn der Schätzwert in der Recherche mit ° markiert ist. */
  unsicher: Unsicher;
  bewertung: Bewertung;
  stationen: StationsDaten[];
}

export interface Vorbild extends Omit<VorbildDaten, 'stationen'> {
  verlauf: LebensStation[];
  profil: KennungsLevel;
}

export const ALTERS_MARKEN: { alter: number; label: string }[] = [
  { alter: 18, label: '18' },
  { alter: 25, label: '25' },
  { alter: 40, label: '40' },
  { alter: 67, label: 'Rente' },
  { alter: 80, label: 'Lebenserwartung' },
];

export const DURCHSCHNITT = 'durchschnitt';

const HEUTE = 'Heute';
const LEVEL_UNTERGRENZE = 800;
const LEVEL_OBERGRENZE = 10000;
const SCHAETZUNG_UNTERGRENZE = 40;
const SCHAETZUNG_OBERGRENZE = 100;
const SUCHSCHRITTE = 60;
const HERAUSRAGEND_AB = 7;
const HERAUSRAGEND_EXPONENT = 2;

/** Level aus dem Mittel der Schätzung, zwischen dem Durchschnittsmenschen und der Obergrenze. */
export function levelAusSchaetzung(schaetzung: Bewertung): number {
  let summeWerte = 0;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    summeWerte += schaetzung[kennung];
  }
  const mittel = summeWerte / ATTRIBUT_KENNUNGEN.length;
  const spanne = SCHAETZUNG_OBERGRENZE - SCHAETZUNG_UNTERGRENZE;
  const anteil = Math.min(1, Math.max(0, (mittel - SCHAETZUNG_UNTERGRENZE) / spanne));
  const xpUnten = xpBisLevel(LEVEL_UNTERGRENZE, LEVEL_KURVEN.charakter);
  const xpOben = xpBisLevel(LEVEL_OBERGRENZE, LEVEL_KURVEN.charakter);
  return berechneLevel(xpUnten + anteil * (xpOben - xpUnten), LEVEL_KURVEN.charakter).level;
}

function bewertungAusSchaetzung(schaetzung: Bewertung): Bewertung {
  const bewertung = {} as Bewertung;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    bewertung[kennung] = Math.min(BEWERTUNG.max, Math.max(BEWERTUNG.min, Math.round(schaetzung[kennung] / 10)));
  }
  return bewertung;
}

function leseSchaetzwert(eintrag: number | string, name: string): { wert: number; unsicher: boolean } {
  const text = String(eintrag);
  const unsicher = text.endsWith('°');
  const wert = Number(text.replace('°', ''));
  if (!Number.isInteger(wert) || wert < 0 || wert > 100) {
    throw new Error(`Schätzwert ungültig: ${name} ${text}`);
  }
  if (unsicher && (wert < 45 || wert > 75)) {
    throw new Error(`Unsicherer Wert außerhalb 45 bis 75: ${name} ${text}`);
  }
  return { wert, unsicher };
}

function schaetzungAusWerten(werte: readonly (number | string)[], name: string): { schaetzung: Bewertung; unsicher: Unsicher } {
  if (werte.length !== ATTRIBUT_KENNUNGEN.length) {
    throw new Error(`Schätzung unvollständig: ${name}`);
  }
  const schaetzung = {} as Bewertung;
  const unsicher = {} as Unsicher;
  for (let index = 0; index < ATTRIBUT_KENNUNGEN.length; index += 1) {
    const gelesen = leseSchaetzwert(werte[index], name);
    schaetzung[ATTRIBUT_KENNUNGEN[index]] = gelesen.wert;
    unsicher[ATTRIBUT_KENNUNGEN[index]] = gelesen.unsicher;
  }
  return { schaetzung, unsicher };
}

function keineUnsicherheit(): Unsicher {
  const unsicher = {} as Unsicher;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    unsicher[kennung] = false;
  }
  return unsicher;
}

function zuDaten(person: PersonRoh): VorbildDaten {
  const { schaetzung, unsicher } = schaetzungAusWerten(person.werte, person.name);
  return {
    schluessel: person.schluessel,
    name: person.name,
    bekanntFuer: person.bekanntFuer,
    beschreibung: person.beschreibung,
    geboren: person.geboren,
    gestorben: person.gestorben,
    richtung: person.richtung,
    level: levelAusSchaetzung(schaetzung),
    schaetzung,
    unsicher,
    bewertung: bewertungAusSchaetzung(schaetzung),
    stationen: person.stationen.map(([alter, anteil, ereignis]) => ({ alter, anteil, ereignis })),
  };
}

function skalierteSchaetzung(bewertung: Bewertung): Bewertung {
  const schaetzung = {} as Bewertung;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    schaetzung[kennung] = bewertung[kennung] * 10;
  }
  return schaetzung;
}

function durchschnittsEintrag(): VorbildDaten {
  const bewertung: Bewertung = {
    koerper: 4, geist: 5, disziplin: 7, intellekt: 5, soziales: 6,
    kreativitaet: 3, motorik: 5, mut: 3, vitalitaet: 5, fuehrung: 3,
    einfluss: 2, ressourcen: 6, autoritaet: 3, reichweite: 1, ansehen: 3,
    netzwerk: 3, freiheit: 3, vermaechtnis: 3, beziehungen: 7, qualifikation: 5,
  };
  return {
    schluessel: DURCHSCHNITT,
    name: 'Durchschnittsmensch',
    bekanntFuer: 'Weltweit, etwa 40 Jahre',
    beschreibung: 'Ein durchschnittlicher Erwachsener weltweit: Ausbildung, Beruf, Familie und Freizeit.',
    geboren: null,
    gestorben: null,
    richtung: null,
    level: 800,
    schaetzung: skalierteSchaetzung(bewertung),
    unsicher: keineUnsicherheit(),
    bewertung,
    stationen: [
      { alter: 18, anteil: 0.022, ereignis: 'Schulabschluss' },
      { alter: 22, anteil: 0.2, ereignis: 'Berufseinstieg' },
      { alter: 30, anteil: 0.556, ereignis: 'Familie und erstes Kind' },
      { alter: 40, anteil: 1, ereignis: 'Mitte des Berufslebens' },
      { alter: 67, anteil: 2.2, ereignis: 'Rente' },
      { alter: 80, anteil: 2.489, ereignis: 'Lebenserwartung' },
    ],
  };
}

const VORBILD_DATEN: VorbildDaten[] = [...PERSONEN.map(zuDaten), durchschnittsEintrag()];

function kurveFuer(kennung: AttributKennung): LevelKurve {
  return (KOENNEN_KENNUNGEN as readonly string[]).includes(kennung) ? LEVEL_KURVEN.attribut : LEVEL_KURVEN.status;
}

function profilXp(faktor: number, bewertung: Bewertung): number {
  let summe = 0;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    summe += xpBisLevelStetig(Math.max(1, faktor * bewertung[kennung]), kurveFuer(kennung));
  }
  return summe;
}

export function profilAusBewertung(level: number, bewertung: Bewertung): KennungsLevel {
  const zielXp = xpBisLevel(level, LEVEL_KURVEN.charakter);
  let unten = 0;
  let oben = level;
  for (let schritt = 0; schritt < SUCHSCHRITTE; schritt++) {
    const mitte = (unten + oben) / 2;
    if (profilXp(mitte, bewertung) < zielXp) {
      unten = mitte;
    } else {
      oben = mitte;
    }
  }
  const profil = {} as KennungsLevel;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    profil[kennung] = Math.max(1, Math.round(unten * bewertung[kennung]));
  }
  return profil;
}

export function levelBeiAnteil(level: number, anteil: number): number {
  return berechneLevel(anteil * xpBisLevel(level, LEVEL_KURVEN.charakter), LEVEL_KURVEN.charakter).level;
}

const TAGE_PRO_JAHR = 365;

/** Gerundete XP pro Tag, mit denen der Durchschnittsmensch sein Level am Reifepunkt erreicht. */
export function durchschnittXpProTag(): number {
  const daten = durchschnittsDaten();
  const reife = daten.stationen.find((station) => station.anteil >= 1);
  if (!reife) {
    throw new Error('Der Durchschnittsmensch hat keinen Reifepunkt.');
  }
  const level = levelBeiAnteil(daten.level, reife.anteil);
  return Math.round(xpBisLevel(level, LEVEL_KURVEN.charakter) / (reife.alter * TAGE_PRO_JAHR));
}

function durchschnittsDaten(): VorbildDaten {
  const daten = VORBILD_DATEN.find((eintrag) => eintrag.schluessel === DURCHSCHNITT);
  if (!daten) {
    throw new Error('Der Durchschnittsmensch fehlt in den Vorbildern.');
  }
  return daten;
}

function anteilImAlter(stationen: StationsDaten[], alter: number): number {
  const erste = stationen[0];
  const letzte = stationen[stationen.length - 1];
  if (alter <= erste.alter) {
    return erste.anteil;
  }
  for (let index = 1; index < stationen.length; index++) {
    const vorher = stationen[index - 1];
    const nachher = stationen[index];
    if (alter <= nachher.alter) {
      const fortschritt = (alter - vorher.alter) / (nachher.alter - vorher.alter);
      return vorher.anteil + fortschritt * (nachher.anteil - vorher.anteil);
    }
  }
  return letzte.anteil;
}

function alterDerPerson(daten: VorbildDaten, jahr: number): number | null {
  if (daten.geboren === null) {
    return null;
  }
  return (daten.gestorben ?? jahr) - daten.geboren;
}

function grundlageXp(daten: VorbildDaten, alter: number): Map<AttributKennung, number> {
  const durchschnitt = durchschnittsDaten();
  const durchschnittsProfil = profilAusBewertung(durchschnitt.level, durchschnitt.bewertung);
  const lebensanteil = anteilImAlter(durchschnitt.stationen, alter);
  const grundlage = new Map<AttributKennung, number>();
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    const kurve = kurveFuer(kennung);
    const durchschnittsXp = xpBisLevelStetig(durchschnittsProfil[kennung], kurve) * lebensanteil;
    const verhaeltnis = daten.bewertung[kennung] / durchschnitt.bewertung[kennung];
    const level = Math.max(1, levelAusXpStetig(durchschnittsXp, kurve) * verhaeltnis);
    grundlage.set(kennung, xpBisLevelStetig(level, kurve));
  }
  return grundlage;
}

function staerkenGewichte(bewertung: Bewertung): Map<AttributKennung, number> {
  return new Map(
    ATTRIBUT_KENNUNGEN.map((kennung) => [
      kennung,
      Math.max(0, bewertung[kennung] - HERAUSRAGEND_AB) ** HERAUSRAGEND_EXPONENT,
    ]),
  );
}

function summe(werte: Iterable<number>): number {
  let ergebnis = 0;
  for (const wert of werte) {
    ergebnis += wert;
  }
  return ergebnis;
}

function profilFuer(daten: VorbildDaten, jahr: number): KennungsLevel {
  const alter = alterDerPerson(daten, jahr);
  if (alter === null) {
    return profilAusBewertung(daten.level, daten.bewertung);
  }
  const grundlage = grundlageXp(daten, alter);
  const gewichte = staerkenGewichte(daten.bewertung);
  const zielXp = xpBisLevel(daten.level, LEVEL_KURVEN.charakter);
  const summeGrundlage = summe(grundlage.values());
  const summeGewichte = summe(gewichte.values());
  const ueberschuss = zielXp - summeGrundlage;

  const profil = {} as KennungsLevel;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    const basis = grundlage.get(kennung) ?? 0;
    let xp = basis * (zielXp / summeGrundlage);
    if (ueberschuss > 0) {
      const anteil = summeGewichte > 0 ? (gewichte.get(kennung) ?? 0) / summeGewichte : basis / summeGrundlage;
      xp = basis + ueberschuss * anteil;
    }
    profil[kennung] = Math.max(1, Math.round(levelAusXpStetig(xp, kurveFuer(kennung))));
  }
  return profil;
}

function verlaufAus(stationen: StationsDaten[], daten: Omit<VorbildDaten, 'stationen'>, jahr: number): LebensStation[] {
  const verlauf = stationen.map((station) => ({
    alter: station.alter,
    level: station.anteil === 1 ? daten.level : levelBeiAnteil(daten.level, station.anteil),
    ereignis: station.ereignis,
  }));
  if (daten.geboren !== null && daten.gestorben === null) {
    verlauf.push({ alter: jahr - daten.geboren, level: daten.level, ereignis: HEUTE });
  }
  return verlauf;
}

function baueVorbild({ stationen, ...daten }: VorbildDaten, jahr: number): Vorbild {
  return {
    ...daten,
    verlauf: verlaufAus(stationen, daten, jahr),
    profil: profilFuer({ stationen, ...daten }, jahr),
  };
}

export const VORBILDER: Vorbild[] = VORBILD_DATEN.map((daten) => baueVorbild(daten, new Date().getFullYear()));

export function findeVorbild(schluessel: string): Vorbild | undefined {
  return VORBILDER.find((vorbild) => vorbild.schluessel === schluessel);
}

/** Durchschnittsmensch und je Richtung ein bis zwei bekannte Beispiele. */
export function beispielVorbilder(): Vorbild[] {
  const massstab = findeVorbild(DURCHSCHNITT);
  const beispiele = RICHTUNGEN.flatMap((richtung) =>
    BEISPIEL_SCHLUESSEL[richtung].map((schluessel) => {
      const vorbild = findeVorbild(schluessel);
      if (!vorbild || vorbild.richtung !== richtung) {
        throw new Error(`Beispiel fehlt: ${richtung} ${schluessel}`);
      }
      return vorbild;
    }),
  );
  return massstab ? [massstab, ...beispiele] : beispiele;
}

export function klasseAus(profil: KennungsLevel): string {
  return bestimmeKlasse(ATTRIBUT_KENNUNGEN.map((kennung) => ({ kennung, level: profil[kennung] })));
}

export function staerken(profil: KennungsLevel, kennungen: AttributKennung[], anzahl: number): AttributKennung[] {
  return [...kennungen].sort((a, b) => profil[b] - profil[a]).slice(0, anzahl);
}

/**
 * Schätzwert 0–100 als Attribut-Level.
 * Das ist das Profil-Level auf derselben XP-Kurve wie beim Nutzer, nicht der Schätzwert und nicht Schätzwert/100.
 * Die XP-Summe dieser Level ist das Level auf der Karte.
 */
export function levelAusRecherche(vorbild: Vorbild, kennung: AttributKennung): number {
  return vorbild.profil[kennung];
}

/** Wie nah zwei Level liegen. 1 heißt gleich, kleinere Level bleiben klein. */
export function uebereinstimmung(eigen: number, fremd: number): number {
  const links = Number.isFinite(eigen) && eigen > 0 ? eigen : 0;
  const rechts = Number.isFinite(fremd) && fremd > 0 ? fremd : 0;
  const spitze = Math.max(links, rechts);
  if (spitze === 0) {
    return 1;
  }
  return Math.min(links, rechts) / spitze;
}

export interface Vergleichspunkt {
  kennung: AttributKennung;
  du: number;
  vorbild: number;
  anteil: number;
}

/** Nur die übergebenen Kennungen. Archivierte oder ausgeschaltete Werte stehen hier nicht drin. */
export function vergleichspunkte(
  eigene: Partial<KennungsLevel>,
  vorbild: Vorbild,
  kennungen: readonly AttributKennung[],
): Vergleichspunkt[] {
  const punkte: Vergleichspunkt[] = [];
  for (const kennung of kennungen) {
    const du = eigene[kennung];
    if (du === undefined) {
      continue;
    }
    const fremd = levelAusRecherche(vorbild, kennung);
    punkte.push({ kennung, du, vorbild: fremd, anteil: uebereinstimmung(du, fremd) });
  }
  return punkte;
}

export function besteAehnlichkeit(werte: readonly (number | null)[]): number | null {
  let beste: number | null = null;
  for (const wert of werte) {
    if (wert === null) {
      continue;
    }
    if (beste === null || wert > beste) {
      beste = wert;
    }
  }
  return beste;
}

function levelWert(wert: number | undefined): number {
  if (wert === undefined || !Number.isFinite(wert) || wert <= 0) {
    return 0;
  }
  return wert;
}

/**
 * Kosinus der Level-Verteilung.
 * Gleiche Form ergibt 1, auch wenn alle Level kleiner sind. Unsichere Kennungen zählen halb.
 */
export function aehnlichkeit(
  eigene: Partial<KennungsLevel>,
  vorbild: KennungsLevel,
  unsicher?: Partial<Unsicher> | null,
): number | null {
  const gemeinsam = ATTRIBUT_KENNUNGEN.filter((kennung) => eigene[kennung] !== undefined);
  if (gemeinsam.length === 0) {
    return null;
  }
  let produkt = 0;
  let normEigen = 0;
  let normVorbild = 0;
  for (const kennung of gemeinsam) {
    const gewicht = unsicher?.[kennung] ? UNSICHER_GEWICHT : 1;
    const links = levelWert(eigene[kennung]);
    const rechts = levelWert(vorbild[kennung]);
    produkt += gewicht * links * rechts;
    normEigen += gewicht * links * links;
    normVorbild += gewicht * rechts * rechts;
  }
  if (normEigen === 0 && normVorbild === 0) {
    return 1;
  }
  if (normEigen === 0 || normVorbild === 0) {
    return 0;
  }
  const wert = produkt / Math.sqrt(normEigen * normVorbild);
  if (!Number.isFinite(wert) || wert <= 0) {
    return 0;
  }
  if (wert > 1 - 1e-10) {
    return 1;
  }
  return wert;
}
