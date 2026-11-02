import { passendeZielEbene, type Ebenen } from '../../spiel/ebenen.ts';
import type { Funktionen } from '../../spiel/funktionen.ts';
import type { Zielstrebigkeit } from '../../spiel/profil.ts';

export type StartZielArt = 'visionen' | 'projekte' | 'vorhaben' | 'faehigkeit';

export type WillkommenZeile =
  | { schluessel: 'ersteTaetigkeit'; erledigt: false }
  | { schluessel: 'ziel'; art: Exclude<StartZielArt, 'faehigkeit'>; erledigt: boolean }
  | { schluessel: 'faehigkeit'; erledigt: boolean }
  | { schluessel: 'eintrag'; erledigt: boolean };

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
