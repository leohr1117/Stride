import { tageZwischen } from './kette.ts';
import { berechneLevel, LEVEL_KURVEN, xpBisLevel } from './level.ts';

export const BASIS_XP = {
  faktor: 25,
  exponent: 0.65,
  stundenOhneAngabe: 0.5,
} as const;

export const MEILENSTEIN = {
  basis: 25,
  anteilVorhabenXp: 0.2,
  comebackFaktor: 1.5,
} as const;

export const MEILENSTEIN_INFO =
  'Ein großes Ereignis: ein Ziel erreicht, ein neuer Rekord oder etwas zum ersten Mal geschafft. Dafür gibt es mehr XP.';

export const BESTAENDIGKEIT = {
  xpProKettentag: 3,
  maxXp: 30,
} as const;

export const WEITERMACHEN = {
  fristTage: 14,
  disziplin: 10,
  geist: 5,
} as const;

export const NEUER_ANLAUF = {
  disziplin: 25,
  geist: 10,
} as const;

export const BOSS = {
  lootFaktor: 2,
  angriffXpProTag: 5,
  beuteAnteil: 0.05,
  /** Bestehende Bosse ohne Datum, und ein neuer Anlauf nach einer vergangenen Deadline. */
  fristOhneDatumTage: 30,
} as const;

export const GEGNER = { belohnungTeiler: 2, angriffTeiler: 2 } as const;

export const GEGNER_INFO = 'Ein Gegner zahlt weniger als ein Boss.';

export const BOSS_BELOHNUNG_INFO = 'Volle Boss-Belohnung.';

export const BOSS_SCHALTER = 'Nur ein Datum. Nach der Deadline geht Disziplin verloren.';

export const BOSS_DATUM_INFO = 'Bis zum Datum entsteht er. Danach greift er an.';

export const BASIS_AUFGABE = {
  disziplinAnteil: 0.5,
} as const;

export const SKILL = {
  basisXp: 100,
  steigerungProEbene: 0.1,
  maxXp: 150,
} as const;

/** Vier Größen von links nach rechts. Index 1 ist der bisherige Satz. */
export const INVESTITION_GROESSEN = [0.05, 0.1, 0.2, 0.3] as const;

export function investitionsBonus(groesse: number): number {
  const index = Math.min(INVESTITION_GROESSEN.length - 1, Math.max(0, Math.round(groesse)));
  return INVESTITION_GROESSEN[index];
}

export const INVESTITION_INFO =
  'Eine Investition kann XP eines Attributs kosten. Eine eigene Investition oder ein geschafftes Projekt gibt dauerhaft mehr XP.';

export const RESSOURCEN_SCHALTER = 'Bonus gilt auch für Ressourcen';

export const RESSOURCEN_INFO = 'Ressourcen werden mit investiert und bekommen denselben Bonus.';

export const AUSRUESTUNG_MAX_BONUS = 0.5;

export function ausruestungsBonus(boni: number[]): number {
  let summe = 0;
  for (const bonus of boni) {
    summe += bonus;
  }
  return Math.min(AUSRUESTUNG_MAX_BONUS, summe);
}

export const MULTIPLIKATOR_ARTEN = ['ausruestung', 'momentum', 'erschoepfung'] as const;
export type MultiplikatorArt = (typeof MULTIPLIKATOR_ARTEN)[number];

export interface Multiplikator {
  art: MultiplikatorArt;
  faktor: number;
  label?: string;
}

export function gesamtFaktor(multiplikatoren: Multiplikator[]): number {
  let faktor = 1;
  for (const eintrag of multiplikatoren) {
    faktor *= eintrag.faktor;
  }
  return faktor;
}

export function basisXp(stunden: number | null): number {
  return Math.round(BASIS_XP.faktor * Math.pow(wirksameStunden(stunden), BASIS_XP.exponent));
}

function wirksameStunden(stunden: number | null): number {
  return stunden === null || stunden <= 0 ? BASIS_XP.stundenOhneAngabe : stunden;
}

export function eintragXp(stunden: number | null, faktor = 1): number {
  return Math.round(basisXp(stunden) * faktor);
}

export function meilensteinBonus(vorhabenXp: number, comeback: boolean, bossBesiegt = false): number {
  const bonus = MEILENSTEIN.basis + MEILENSTEIN.anteilVorhabenXp * Math.max(0, vorhabenXp);
  const faktor = (comeback ? MEILENSTEIN.comebackFaktor : 1) * (bossBesiegt ? BOSS.lootFaktor : 1);
  return Math.round(bonus * faktor);
}

/**
 * Einmalig beim ersten Abschließen, aus der Eintrags-XP des Projekts.
 * Bis 600 XP mehr als Meilenstein und Boss derselben XP, danach flach bis 480.
 */
export const PROJEKT_ABSCHLUSS = { basis: 60, anteil: 0.5, knie: 600, anteilDanach: 0.08, max: 480 } as const;

export function projektAbschlussBonus(projektXp: number): number {
  const xp = Math.max(0, projektXp);
  const voll = Math.min(xp, PROJEKT_ABSCHLUSS.knie);
  const rest = xp - voll;
  const roh = PROJEKT_ABSCHLUSS.basis + PROJEKT_ABSCHLUSS.anteil * voll + PROJEKT_ABSCHLUSS.anteilDanach * rest;
  return Math.min(PROJEKT_ABSCHLUSS.max, Math.round(roh));
}

export function bossBeute(bossLevel: number | null): number {
  if (bossLevel === null || bossLevel < 1) {
    return 0;
  }
  return Math.round(BOSS.beuteAnteil * xpBisLevel(bossLevel, LEVEL_KURVEN.charakter));
}

/** Charakter-Level der Kampf-XP. Level 1, solange die Summe unter 100 liegt. */
export function bossLevelAusKampfXp(kampfXp: number): number {
  return berechneLevel(Math.max(0, kampfXp), LEVEL_KURVEN.charakter).level;
}

export type BossPhase = 'entsteht' | 'erwacht';

/** Der Deadline-Tag gehört noch zur Entstehungsphase. Erwacht ist der Tag danach. */
export function bossPhase(deadline: string, heute: string): BossPhase {
  return heute > deadline ? 'erwacht' : 'entsteht';
}

/**
 * Zeitanteil vom Anlegen bis zur Deadline.
 * Am ersten Tag ein kurzer Bogen, am Deadline-Tag geschlossen.
 */
export function bossRingAnteil(start: string, deadline: string, heute: string): number {
  if (heute >= deadline || start >= deadline) {
    return 1;
  }
  const gesamt = tageZwischen(start, deadline);
  const vergangen = Math.max(0, Math.min(gesamt, tageZwischen(start, heute)));
  return (vergangen + 1) / (gesamt + 1);
}

export function basisDisziplinBonus(eintragXp: number): number {
  return Math.round(Math.max(0, eintragXp) * BASIS_AUFGABE.disziplinAnteil);
}

export function angriffsTage(deadline: string, bereitsAngegriffenBis: string | null, heute: string): number {
  const abgerechnetBis = bereitsAngegriffenBis !== null && bereitsAngegriffenBis > deadline ? bereitsAngegriffenBis : deadline;
  return Math.max(0, tageZwischen(abgerechnetBis, heute));
}

export function skillXp(tiefe: number): number {
  const xp = SKILL.basisXp * Math.pow(1 + SKILL.steigerungProEbene, Math.max(0, tiefe));
  return Math.min(SKILL.maxXp, Math.round(xp));
}

export function bestaendigkeitsBonus(kettenLaenge: number): number {
  if (kettenLaenge <= 1) {
    return 0;
  }
  return Math.min(BESTAENDIGKEIT.maxXp, BESTAENDIGKEIT.xpProKettentag * (kettenLaenge - 1));
}

export interface Gewicht {
  attributId: number;
  gewicht: number;
}

export interface XpAnteil {
  attributId: number;
  xp: number;
}

export function verteileNachGewichten(xp: number, gewichte: Gewicht[]): XpAnteil[] {
  const gueltig = gewichte.filter((eintrag) => eintrag.gewicht > 0);
  let summe = 0;
  for (const eintrag of gueltig) {
    summe += eintrag.gewicht;
  }
  if (summe === 0 || xp === 0) {
    return [];
  }

  const roh = gueltig.map((eintrag) => {
    const exakt = (xp * eintrag.gewicht) / summe;
    return { attributId: eintrag.attributId, xp: Math.floor(exakt), rest: exakt - Math.floor(exakt) };
  });

  let verteilt = 0;
  for (const anteil of roh) {
    verteilt += anteil.xp;
  }
  const nachRest = [...roh].sort((a, b) => b.rest - a.rest);
  for (let index = 0; index < xp - verteilt; index++) {
    nachRest[index % nachRest.length].xp++;
  }

  return roh.filter((anteil) => anteil.xp > 0).map(({ attributId, xp: anteilXp }) => ({ attributId, xp: anteilXp }));
}

/** Feste Prozent: nur die Summe der aktiven Gewichte, höchstens 100, geht an Attribute. Sonst das heutige Verhältnis. */
export function verteileTaetigkeit(xp: number, gewichte: Gewicht[], fest: boolean): XpAnteil[] {
  if (!fest) {
    return verteileNachGewichten(xp, gewichte);
  }
  let summe = 0;
  for (const eintrag of gewichte) {
    if (eintrag.gewicht > 0) {
      summe += eintrag.gewicht;
    }
  }
  const gesamt = Math.round((xp * Math.min(100, summe)) / 100);
  return verteileNachGewichten(gesamt, gewichte);
}

export const RUECKBLICK = {
  geistXp: 50,
  bonusWochenZurueck: 1,
} as const;

export const VISION = {
  minLevel: 100,
  empfohlenAb: 1000,
  standardLevel: 1000,
  beuteAnteil: 0.1,
} as const;

export function visionBeute(visionLevel: number | null): number {
  if (visionLevel === null || visionLevel < 1) {
    return 0;
  }
  return Math.round(VISION.beuteAnteil * xpBisLevel(visionLevel, LEVEL_KURVEN.charakter));
}
