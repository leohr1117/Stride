import { lokalesDatum, wochenbeginn } from '../../../../shared/spiel/datum.ts';

/** Dieselbe Montagswoche, die der Rückblick als aktuelle Woche schickt. */
export function wochenSchluessel(jetzt: Date): string {
  return lokalesDatum(wochenbeginn(jetzt));
}

export interface VergleichSpalte {
  seite: 'diese' | 'vor';
  xp: number;
}

/** Links diese Woche, rechts die Vorwoche. Die Werte sind die Summen aus dem Rückblick. */
export function vergleichSpalten(xp: number, xpVorwoche: number): readonly [VergleichSpalte, VergleichSpalte] {
  return [
    { seite: 'diese', xp },
    { seite: 'vor', xp: xpVorwoche },
  ];
}
