import { DURCHSCHNITT, VORBILDER } from '../features/vorbilder/vorbilder.ts';
import { ebenenFuerStufe } from './ebenen.ts';
import { FOKUS_LISTE, type FokusId, type Zielstrebigkeit } from './profil.ts';

/** Projektname des ersten Bosses. Anzeige und Speicher laufen über die Übersetzung. */
export const START_PROJEKT = 'Anfang';

/** Bossname je erstem Fokus. „Innehalten“ und „Liefern“ sind schon Katalogtexte. */
export const START_BOSS_NAME: Record<FokusId, string> = {
  sport: 'Lauf beginnen',
  gesundheit: 'Schlaf halten',
  weisheit: 'Innehalten',
  lernen: 'Lernen anfangen',
  erfolg: 'Liefern',
  soziales: 'Jemanden treffen',
  geld: 'Überblick',
  kreativitaet: 'Etwas machen',
  mut: 'Etwas wagen',
};

export interface VorbildVorschlag {
  schluessel: string;
  name: string;
  bekanntFuer: string;
  summe: number;
}

/** Stärkstes Vorbild auf den Kennungen des Fokus. Gleichstand: frühere Katalogstelle. */
export function vorbildVorschlag(fokus: FokusId): VorbildVorschlag {
  const info = FOKUS_LISTE.find((eintrag) => eintrag.id === fokus);
  if (!info) {
    throw new Error('Fokus fehlt.');
  }
  let bester: VorbildVorschlag | null = null;
  for (const vorbild of VORBILDER) {
    if (vorbild.schluessel === DURCHSCHNITT) {
      continue;
    }
    let summe = 0;
    for (const kennung of info.kennungen) {
      summe += vorbild.bewertung[kennung];
    }
    if (bester === null || summe > bester.summe) {
      bester = {
        schluessel: vorbild.schluessel,
        name: vorbild.name,
        bekanntFuer: vorbild.bekanntFuer,
        summe,
      };
    }
  }
  if (!bester) {
    throw new Error('Vorbild fehlt.');
  }
  return bester;
}

/** Boss-Karte nur, wenn die Stufe Projekt und Vorhaben einschaltet. */
export function startBossSichtbar(stufe: Zielstrebigkeit): boolean {
  const ebenen = ebenenFuerStufe(stufe);
  return ebenen.projekte && ebenen.vorhaben;
}
