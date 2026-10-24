import type { Farbtrio } from '../../../../shared/features/darstellung/paletten.ts';

export interface FarbZustand {
  anzeige: Farbtrio;
  gespeichert: Farbtrio;
  gezogen: boolean;
}

export function farbAnfang(farben: Farbtrio): FarbZustand {
  return { anzeige: farben, gespeichert: farben, gezogen: false };
}

export function farbZiehen(zustand: FarbZustand, feld: keyof Farbtrio, wert: string): FarbZustand {
  return { ...zustand, anzeige: { ...zustand.anzeige, [feld]: wert }, gezogen: true };
}

export function farbLoslassen(zustand: FarbZustand): FarbZustand {
  if (!zustand.gezogen) {
    return zustand;
  }
  return { anzeige: zustand.anzeige, gespeichert: zustand.anzeige, gezogen: false };
}

/** Eine Antwort vom Server darf eine laufende Ziehung nicht überschreiben. */
export function farbUebernehmen(zustand: FarbZustand, farben: Farbtrio): FarbZustand {
  if (zustand.gezogen) {
    return zustand;
  }
  return farbAnfang(farben);
}
