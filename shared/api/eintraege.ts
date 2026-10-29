import type { Abschluss } from '../spiel/begriffe.ts';
import type { Belohnung, BonusQuelle, XpAnteilMitName } from './belohnung.ts';
import type { ProjektKontext, VorhabenKurz } from './ziele.ts';

export interface Eintrag {
  id: number;
  projektId: number | null;
  projektName: string | null;
  kontext: ProjektKontext | null;
  vorlageId: number;
  vorlageName: string;
  vorlageIcon: string;
  vorhaben: VorhabenKurz | null;
  faehigkeit: { id: number; name: string; farbe: string } | null;
  knotenTitel: string | null;
  bossSchaden: number | null;
  faktor: number;
  basisAufgabe: string | null;
  abschluss: Abschluss | null;
  erkenntnis: string;
  stunden: number | null;
  notiz: string;
  herkunft: string | null;
  meilenstein: boolean;
  xp: number;
  /** Bonus auf die Projekt-XP, 0 wenn keiner wirkt. */
  ausruestungBonus: number;
  /** Nur der Eintrag, der den Boss besiegt hat. */
  bossSieg: { level: number; kampfXp: number; beute: number } | null;
  anteile: XpAnteilMitName[];
  boni: BonusQuelle[];
  erstelltAm: string;
}

export type VorhabenWahl = { art: 'bestehend'; id: number } | { art: 'neu'; titel: string } | null;

export interface EintragDaten {
  projektId: number | null;
  vorlageId: number;
  vorhaben: VorhabenWahl;
  abschluss: Abschluss | null;
  erkenntnis: string;
  stunden: number | null;
  notiz: string;
  meilenstein: boolean;
  faehigkeitId: number | null;
  datum: string | null;
}

export interface EintragErgebnis {
  eintrag: Eintrag;
  belohnung: Belohnung;
  /** Nur nach einem echten Erfolg, und nur solange die Frage fällig ist. Sonst fehlt das Feld. */
  bewertungFaellig?: true;
  /** Nur nach einem echten Erfolg, und nur wenn `bewertungFaellig` in dieser Antwort fehlt. */
  angebotFaellig?: true;
}

export interface SkillEreignis {
  knotenId: number;
  titel: string;
  faehigkeitId: number;
  faehigkeitName: string;
  faehigkeitFarbe: string;
  faehigkeitIcon: string;
  xp: number;
  erstelltAm: string;
}

/** Arten, die die Chronik zeigt. `push_*` bleibt unsichtbar, bis Phase 4 sie anzeigt. */
export const PROTOKOLL_ARTEN = [
  'schutz_verdient',
  'schutz_eingesetzt',
  'rueckkehr_offen',
  'rueckkehr_geschafft',
  'rueckkehr_zu',
] as const;

export type ProtokollArt = (typeof PROTOKOLL_ARTEN)[number];

export interface ProtokollZeile {
  id: number;
  art: ProtokollArt;
  /** Kalendertag der Zeile, JJJJ-MM-TT. */
  tag: string;
  erstelltAm: string;
}

export type ChronikEintrag =
  | { typ: 'eintrag'; eintrag: Eintrag }
  | { typ: 'skill'; skill: SkillEreignis }
  | { typ: 'protokoll'; protokoll: ProtokollZeile };

export interface ChronikSeite {
  eintraege: ChronikEintrag[];
  naechsterCursor: string | null;
}

export interface EintragFilter {
  visionId?: number;
  organisationId?: number;
  visionIds?: number[];
  organisationIds?: number[];
  projektId?: number;
  vorlageId?: number;
  faehigkeitId?: number;
  nurMeilensteine?: boolean;
}
