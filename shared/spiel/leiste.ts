import { standardEbenen, type Ebenen } from './ebenen.ts';
import type { Funktion, Funktionen } from './funktionen.ts';
import { SEITEN, type Seite } from './navigation.ts';
import { pfadAktiv, type Sichtbarkeit } from './sichtbarkeit.ts';

export const LEISTE_MAX = 4;
export const LEISTE_FEST = '/mehr';

export interface LeistenSeite {
  pfad: string;
  label: string;
  funktion?: Funktion;
}

function funktionAus(schalter: Seite['schalter']): Funktion | undefined {
  if (schalter === null || schalter === 'ziele' || schalter === 'laufend') {
    return undefined;
  }
  return schalter;
}

export const LEISTEN_SEITEN: readonly LeistenSeite[] = SEITEN.map((seite) => {
  const funktion = funktionAus(seite.schalter);
  return funktion
    ? { pfad: seite.pfad, label: seite.name, funktion }
    : { pfad: seite.pfad, label: seite.name };
});

export const LEISTE_STANDARD = ['/', '/ziele', '/chronik', '/mehr'];

export function istFesterPlatz(pfad: string): boolean {
  return pfad === LEISTE_FEST;
}

const PFADE = new Set(LEISTEN_SEITEN.map((seite) => seite.pfad));

export function istLeiste(wert: unknown): wert is string[] {
  return (
    Array.isArray(wert) &&
    wert.every((pfad) => typeof pfad === 'string' && PFADE.has(pfad)) &&
    new Set(wert).size === wert.length
  );
}

export function sichtbareLeiste(
  pfade: readonly string[],
  funktionen: Funktionen,
  ebenen: Ebenen = standardEbenen(),
): string[] {
  const sichtbarkeit: Sichtbarkeit = { funktionen, ebenen };
  return pfade.filter((pfad) => {
    const seite = LEISTEN_SEITEN.find((eintrag) => eintrag.pfad === pfad);
    return seite !== undefined && pfadAktiv(pfad, sichtbarkeit);
  });
}

/** Tauscht einen sichtbaren Platz mit dem nächsten sichtbaren Nachbarn. Versteckte Plätze und Mehr bleiben liegen. */
export function tauschMitSichtbar(
  liste: readonly string[],
  index: number,
  richtung: -1 | 1,
  aktiv: (pfad: string) => boolean,
): string[] {
  const hier = liste[index];
  if (hier === undefined || !aktiv(hier) || istFesterPlatz(hier)) {
    return [...liste];
  }
  let ziel = -1;
  for (let stelle = index + richtung; stelle >= 0 && stelle < liste.length; stelle += richtung) {
    const pfad = liste[stelle];
    if (pfad !== undefined && aktiv(pfad) && !istFesterPlatz(pfad)) {
      ziel = stelle;
      break;
    }
  }
  const dort = liste[ziel];
  if (ziel < 0 || dort === undefined) {
    return [...liste];
  }
  const neu = [...liste];
  neu[index] = dort;
  neu[ziel] = hier;
  return neu;
}

/** Bekannte Leisten-Seiten behalten, auch über vier hinaus. Unbekanntes fällt weg. null, wenn der Wert keine Liste ist. */
export function bereinigteLeiste(wert: unknown): string[] | null {
  if (!Array.isArray(wert)) {
    return null;
  }
  const pfade: string[] = [];
  for (const eintrag of wert) {
    if (typeof eintrag !== 'string' || !PFADE.has(eintrag) || pfade.includes(eintrag)) {
      continue;
    }
    pfade.push(eintrag);
  }
  return pfade;
}

export function leistenMitte(anzahl: number): number {
  return Math.ceil(anzahl / 2);
}

/** Hängt eine Seite vor Mehr an. Versteckte Pfade zählen nicht mit und bleiben in der Liste. */
export function haengePlatzAn(
  liste: readonly string[],
  pfad: string,
  aktiv: (pfad: string) => boolean = () => true,
): string[] {
  if (istFesterPlatz(pfad)) {
    return liste.includes(LEISTE_FEST) ? [...liste] : [...liste, LEISTE_FEST];
  }
  if (liste.includes(pfad) || liste.filter(aktiv).length >= LEISTE_MAX) {
    return [...liste];
  }
  const mehr = liste.indexOf(LEISTE_FEST);
  if (mehr >= 0) {
    return [...liste.slice(0, mehr), pfad, ...liste.slice(mehr)];
  }
  return [...liste, pfad];
}

export function entfernePlatz(liste: readonly string[], index: number): string[] {
  if (index < 0 || index >= liste.length) {
    return [...liste];
  }
  if (istFesterPlatz(liste[index] ?? '')) {
    return [...liste];
  }
  return liste.filter((_, stelle) => stelle !== index);
}
