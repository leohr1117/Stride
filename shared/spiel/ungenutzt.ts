export interface Nutzung {
  eintraege: number;
  xp: number;
  verknuepfungen: number;
  historie: boolean;
}

export type SchnellPunktArt = 'archivieren' | 'loeschen' | 'wiederherstellen';

export interface SchnellEntscheidung {
  ungenutzt: boolean;
  archiviert: boolean;
  kannArchivieren: boolean;
  kannLoeschen: boolean;
}

export function istUngenutzt(nutzung: Nutzung): boolean {
  return nutzung.eintraege === 0 && nutzung.xp === 0 && nutzung.verknuepfungen === 0 && !nutzung.historie;
}

export function schnellPunkte(entscheidung: SchnellEntscheidung): SchnellPunktArt[] {
  const punkte: SchnellPunktArt[] = [];
  if (entscheidung.archiviert) {
    punkte.push('wiederherstellen');
  }
  if (entscheidung.ungenutzt && entscheidung.kannLoeschen) {
    punkte.push('loeschen');
  } else if (!entscheidung.archiviert && entscheidung.kannArchivieren) {
    punkte.push('archivieren');
  }
  return punkte;
}
