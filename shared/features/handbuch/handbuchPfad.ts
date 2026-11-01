import { passendeZielEbene, type Ebenen } from '../../spiel/ebenen.ts';
import type { Funktion, Funktionen } from '../../spiel/funktionen.ts';
import { FOKUS_IDS, type FokusId, type Zielstrebigkeit } from '../../spiel/profil.ts';
import { BOSS_SCHALTER } from '../../spiel/xp.ts';

export type StartSchritt = 'ersteTaetigkeit' | 'ziel' | 'faehigkeit' | 'eintrag';
export type StartZielArt = 'visionen' | 'projekte' | 'vorhaben' | 'faehigkeit';

export type WillkommenZeile =
  | { schluessel: 'ersteTaetigkeit'; erledigt: false }
  | { schluessel: 'ziel'; art: Exclude<StartZielArt, 'faehigkeit'>; erledigt: boolean }
  | { schluessel: 'faehigkeit'; erledigt: boolean }
  | { schluessel: 'eintrag'; erledigt: boolean };

/** Die ersten Schritte. Funktionsempfehlungen liefert empfohleneFunktionen. */
export type Empfehlung = { art: 'start'; schritt: StartSchritt };

export interface FunktionsEmpfehlung {
  funktion: Funktion;
  info: string;
}

/**
 * Nur der Fokus, nicht die Stufe. Jede Funktion höchstens einmal in der gemeinsamen Liste.
 * Dieselbe Funktion darf bei mehreren Fokussen liegen. Reihenfolge folgt FOKUS_IDS.
 */
const FOKUS_FUNKTION: Record<FokusId, readonly Funktion[]> = {
  sport: ['faehigkeiten', 'basis', 'statistiken'],
  gesundheit: ['basis'],
  weisheit: ['rueckblick', 'chronik'],
  lernen: ['faehigkeiten', 'rueckblick', 'bossAngriffe'],
  erfolg: ['bossAngriffe', 'statistiken', 'vorbilder'],
  soziales: ['faehigkeiten', 'chronik'],
  geld: ['ausruestung', 'statistiken'],
  kreativitaet: ['faehigkeiten'],
  mut: ['vorbilder', 'chronik'],
};

const EMPFEHLUNG_INFO: Record<Funktion, string> = {
  faehigkeiten: 'Eintrag verbessert die Fähigkeit. Ein Vorhaben ist dafür nicht nötig.',
  basis: 'Tägliche Aufgaben zum Abhaken.',
  chronik: 'Alle Einträge nach Datum.',
  rueckblick: 'Rückblick einmal pro Woche.',
  statistiken: 'XP, Tätigkeiten und Zeitverlauf.',
  vorbilder: 'Level bekannter Personen.',
  ausruestung: 'Eine eigene Investition oder ein geschafftes Projekt gibt mehr XP.',
  bossAngriffe: BOSS_SCHALTER,
  koennen: '',
  status: '',
  handbuch: '',
  verfallKoennen: '',
  verfallHaben: '',
};

export function investitionWegenRessourcen(
  statusAn: boolean,
  attribute: readonly { kennung: string | null; archiviert: boolean }[],
): boolean {
  return statusAn && attribute.some((eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert);
}

export function empfohleneFunktionen(
  fokus: readonly FokusId[],
  quellen: { ressourcen?: boolean } = {},
): FunktionsEmpfehlung[] {
  const gesehen = new Set<Funktion>();
  const ergebnis: FunktionsEmpfehlung[] = [];
  const dazu = (funktion: Funktion) => {
    const info = EMPFEHLUNG_INFO[funktion];
    if (gesehen.has(funktion) || info === '') {
      return;
    }
    gesehen.add(funktion);
    ergebnis.push({ funktion, info });
  };
  const gewaehlt = new Set(fokus);
  for (const id of FOKUS_IDS) {
    if (!gewaehlt.has(id)) {
      continue;
    }
    for (const funktion of FOKUS_FUNKTION[id]) {
      dazu(funktion);
    }
  }
  if (quellen.ressourcen) {
    dazu('ausruestung');
  }
  return ergebnis;
}

export interface PfadStand {
  /** Aktive Tätigkeiten. Eine archivierte zählt nicht, die Seite gesehen zu haben auch nicht. */
  taetigkeiten: number;
  visionen: number;
  projekte: number;
  vorhaben: number;
  faehigkeiten: number;
  eintraege: number;
  stufe: Zielstrebigkeit | null;
  funktionen: Funktionen;
  ebenen: Ebenen;
}

export function startZielArt(ebenen: Ebenen, funktionen: Funktionen): StartZielArt | null {
  return passendeZielEbene(ebenen) ?? (funktionen.faehigkeiten ? 'faehigkeit' : null);
}

export function zielAnzahl(
  stand: Pick<PfadStand, 'visionen' | 'projekte' | 'vorhaben' | 'faehigkeiten' | 'ebenen' | 'funktionen'>,
): number {
  const art = startZielArt(stand.ebenen, stand.funktionen);
  if (art === 'visionen') {
    return stand.visionen;
  }
  if (art === 'projekte') {
    return stand.projekte;
  }
  if (art === 'vorhaben') {
    return stand.vorhaben;
  }
  if (art === 'faehigkeit') {
    return stand.faehigkeiten;
  }
  return 0;
}

/** Zeilen der Willkommenskarte. „Tätigkeiten prüfen“ gibt es nicht. Ohne Tätigkeit kein Eintrag. */
export function willkommensZeilen(stand: PfadStand): WillkommenZeile[] {
  const zeilen: WillkommenZeile[] = [];
  if (stand.taetigkeiten <= 0) {
    zeilen.push({ schluessel: 'ersteTaetigkeit', erledigt: false });
  }
  const art = startZielArt(stand.ebenen, stand.funktionen);
  if (art === 'faehigkeit') {
    zeilen.push({ schluessel: 'faehigkeit', erledigt: stand.faehigkeiten > 0 });
  } else if (art !== null) {
    zeilen.push({ schluessel: 'ziel', art, erledigt: zielAnzahl(stand) > 0 });
  }
  if (stand.taetigkeiten > 0) {
    zeilen.push({ schluessel: 'eintrag', erledigt: stand.eintraege > 0 });
  }
  return zeilen;
}

export function naechsteEmpfehlung(stand: PfadStand): Empfehlung | null {
  const offen = willkommensZeilen(stand).find((zeile) => !zeile.erledigt);
  if (!offen) {
    return null;
  }
  return { art: 'start', schritt: offen.schluessel };
}

export function empfehlungSchluessel(empfehlung: Empfehlung | null): string | null {
  if (!empfehlung) {
    return null;
  }
  return `start:${empfehlung.schritt}`;
}
