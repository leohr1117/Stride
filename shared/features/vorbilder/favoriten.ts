import { DURCHSCHNITT, findeVorbild } from './vorbilder.ts';

export const VORBILD_FAVORITEN = 'vorbildFavoriten';

/** Der Durchschnitt ist der Maßstab, kein Favorit. */
export function istFavoritenSchluessel(schluessel: string): boolean {
  if (schluessel === DURCHSCHNITT) {
    return false;
  }
  return findeVorbild(schluessel) !== undefined;
}

/** Unbekannte und doppelte Schlüssel fallen weg. Die Reihenfolge bleibt. */
export function bereinigeFavoriten(liste: readonly unknown[]): string[] {
  const gesehen = new Set<string>();
  const ergebnis: string[] = [];
  for (const eintrag of liste) {
    if (typeof eintrag !== 'string' || !istFavoritenSchluessel(eintrag) || gesehen.has(eintrag)) {
      continue;
    }
    gesehen.add(eintrag);
    ergebnis.push(eintrag);
  }
  return ergebnis;
}

/** Hängt an, oder setzt an den alten Index. Ein vorhandener Schlüssel bleibt liegen. */
export function favoritDazu(liste: readonly string[], schluessel: string, index?: number): string[] {
  if (!istFavoritenSchluessel(schluessel)) {
    throw new Error('Das Vorbild ist unbekannt.');
  }
  if (liste.includes(schluessel)) {
    return [...liste];
  }
  const neu = [...liste];
  const ziel = index === undefined ? neu.length : Math.max(0, Math.min(Math.trunc(index), neu.length));
  neu.splice(ziel, 0, schluessel);
  return neu;
}

export function favoritWeg(liste: readonly string[], schluessel: string): string[] {
  if (!istFavoritenSchluessel(schluessel)) {
    throw new Error('Das Vorbild ist unbekannt.');
  }
  if (!liste.includes(schluessel)) {
    return [...liste];
  }
  return liste.filter((eintrag) => eintrag !== schluessel);
}
