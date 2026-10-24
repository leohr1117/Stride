import type { VorhabenStatus } from '../spiel/begriffe.ts';
import type { KettenStand } from '../spiel/kette.ts';
import type { LevelInfo } from '../spiel/level.ts';
import type { Belohnung } from './belohnung.ts';
import type { InvestitionsZiel } from './investitionen.ts';

export interface Vision {
  id: number;
  titel: string;
  beschreibung: string;
  farbe: string;
  woopErgebnis: string;
  woopHindernis: string;
  woopPlan: string;
  woopVollstaendig: boolean;
  archiviert: boolean;
  loeschbar: boolean;
  xpGesamt: number;
  meilensteine: number;
  level: number | null;
  beute: number;
  erreichtAm: string | null;
}

export interface VisionDaten {
  titel: string;
  beschreibung: string;
  farbe: string;
  woopErgebnis: string;
  woopHindernis: string;
  woopPlan: string;
  level: number | null;
}

export interface VisionErgebnis {
  vision: Vision;
  belohnung: Belohnung;
}

export interface Organisation {
  id: number;
  name: string;
  beschreibung: string;
  farbe: string;
  visionId: number | null;
  archiviert: boolean;
  loeschbar: boolean;
  ansehen: LevelInfo;
}

export interface OrganisationDaten {
  name: string;
  beschreibung: string;
  farbe: string;
  visionId: number | null;
}

export interface ProjektKontext {
  art: 'vision' | 'organisation';
  id: number;
  titel: string;
  farbe: string;
}

/** Nur gesetzt, solange das Projekt abgeschlossen ist. */
export interface ProjektAbschluss {
  xp: number;
  level: number;
  von: string;
  bis: string;
  eintraege: number;
  stunden: number;
}

export interface Projekt {
  id: number;
  name: string;
  beschreibung: string;
  visionId: number | null;
  organisationId: number | null;
  standardVorlageId: number;
  abschlussVorlageId: number | null;
  archiviert: boolean;
  loeschbar: boolean;
  aktiv: boolean;
  kontext: ProjektKontext | null;
  level: LevelInfo;
  kette: KettenStand;
  anzahlEintraege: number;
  offeneVorhaben: number;
  ausruestungBonus: number;
  geschafftAm: string | null;
  investition: boolean;
  investitionZiel: InvestitionsZiel | null;
  investitionRessourcen: boolean;
  investitionGroesse: number;
  investitionBonus: number;
  letzterEintrag: string | null;
  abschluss: ProjektAbschluss | null;
}

export interface ProjektDaten {
  name: string;
  beschreibung: string;
  visionId: number | null;
  organisationId: number | null;
  standardVorlageId: number;
  abschlussVorlageId?: number | null;
}

export interface ProjektAenderung {
  name?: string;
  beschreibung?: string;
  visionId?: number | null;
  organisationId?: number | null;
  standardVorlageId?: number;
  abschlussVorlageId?: number | null;
  archiviert?: boolean;
  investition?: boolean;
  investitionZiel?: InvestitionsZiel | null;
  investitionRessourcen?: boolean;
  investitionGroesse?: number;
  geschafft?: boolean;
}

export interface Ziele {
  visionen: Vision[];
  organisationen: Organisation[];
  projekte: Projekt[];
  vorhaben: VorhabenMitProjekt[];
}

export interface BossInfo {
  deadline: string;
  phase: 'entsteht' | 'erwacht';
  /** 0 bis 1, Zeitanteil vom Anlegen bis zur Deadline. */
  ring: number;
  angriffXp: number;
  /** Nur nach dem Sieg. Davor bleibt das Leben verdeckt. */
  level: number | null;
  kampfXp: number | null;
  beute: number;
}

export interface Vorhaben {
  id: number;
  projektId: number | null;
  titel: string;
  status: VorhabenStatus;
  anlauf: number;
  vorgaengerId: number | null;
  hatNachfolger: boolean;
  erkenntnis: string;
  anzahlEintraege: number;
  stunden: number;
  xp: number;
  erstelltAm: string;
  abgeschlossenAm: string | null;
  weitermachenOffen: boolean;
  boss: BossInfo | null;
  loeschbar: boolean;
}

export interface VorhabenAenderung {
  titel?: string;
  boss?: { deadline: string } | null;
}

export interface VorhabenMitProjekt extends Vorhaben {
  projektName: string | null;
  farbe: string;
}

export interface Laufendes {
  bosse: VorhabenMitProjekt[];
  vorhaben: VorhabenMitProjekt[];
}

export interface ProjektDetail {
  projekt: Projekt;
  vorhaben: Vorhaben[];
}

export interface VorhabenKurz {
  id: number;
  titel: string;
  anlauf: number;
  boss: boolean;
}

export interface ProjektAuswahl {
  id: number;
  name: string;
  kontext: ProjektKontext | null;
  vorlageId: number | null;
  vorhabenVorauswahl: number | null;
  faehigkeitVorauswahl: number | null;
  offeneVorhaben: VorhabenKurz[];
}

export interface ProjektMitBelohnung extends Projekt {
  belohnung: Belohnung | null;
}

export interface AnlaufErgebnis {
  vorhaben: Vorhaben;
  belohnung: Belohnung;
}
