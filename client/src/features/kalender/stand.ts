import { taetigkeitPasst } from '../../../../shared/spiel/taetigkeit.ts';
import { tx } from '../../text.ts';

export interface KalenderAnzeige {
  text: string;
  eigene: boolean;
}

export interface KalenderOption {
  wert: string;
  name: string;
  ebene?: number;
  waehlbar?: boolean;
}

interface VorlageKurz {
  id: number;
  name: string;
  projektId: number | null;
}

export function kalenderAnzeige(eingabe: {
  vorlageId: number | null;
  vorlageName: string | null;
  projektId: number | null;
  standardName: string | null;
}): KalenderAnzeige {
  if (eingabe.vorlageId !== null) {
    return { text: eingabe.vorlageName ?? tx('Tätigkeit'), eigene: true };
  }
  if (eingabe.projektId !== null && eingabe.standardName) {
    return { text: eingabe.standardName, eigene: false };
  }
  if (eingabe.projektId !== null) {
    return { text: tx('Standard des Projekts'), eigene: false };
  }
  return { text: tx('Zählt als'), eigene: false };
}

/** Ohne Projekt nur allgemeine Tätigkeiten. Mit Projekt zusätzlich die gebundenen und der Projekt-Standard. */
export function kalenderOptionen(
  taetigkeiten: readonly VorlageKurz[],
  projektId: number | null,
  projektName: string | null,
): KalenderOption[] {
  const optionen: KalenderOption[] = [];
  if (projektId !== null) {
    optionen.push({ wert: '', name: tx('Standard des Projekts') });
  }
  const allgemein = taetigkeiten.filter((eintrag) => eintrag.projektId === null);
  if (allgemein.length > 0) {
    optionen.push({ wert: 'gruppe-alle', name: tx('Für alle Projekte'), waehlbar: false });
    for (const vorlage of allgemein) {
      optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
    }
  }
  if (projektId !== null && projektName) {
    const eigen = taetigkeiten.filter((eintrag) => eintrag.projektId === projektId);
    if (eigen.length > 0) {
      optionen.push({ wert: 'gruppe-nur', name: tx('Nur für {name}', { name: projektName }), waehlbar: false });
      for (const vorlage of eigen) {
        optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
      }
    }
  }
  return optionen;
}

export function vorlageIdAusWahl(wert: string): number | null {
  if (wert === '' || wert.startsWith('gruppe-')) {
    return null;
  }
  const id = Number(wert);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Eine gebundene Tätigkeit ohne ihr Projekt fällt weg. */
export function passendeVorlage(
  taetigkeiten: readonly { id: number; projektId: number | null }[],
  vorlageId: number | null,
  projektId: number | null,
): number | null {
  if (vorlageId === null) {
    return null;
  }
  const vorlage = taetigkeiten.find((eintrag) => eintrag.id === vorlageId);
  return vorlage && taetigkeitPasst(vorlage.projektId, projektId) ? vorlageId : null;
}

export function zeigeProjektArchiviert(projektId: number | null, aktiv: boolean | null): boolean {
  return projektId !== null && aktiv !== true;
}

export function letzterAbgleich(zeiten: readonly (string | null)[]): string | null {
  let best: string | null = null;
  for (const zeit of zeiten) {
    if (zeit && (best === null || zeit > best)) {
      best = zeit;
    }
  }
  return best;
}
