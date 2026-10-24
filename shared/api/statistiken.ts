export const ZEITRAEUME = ['3m', '12m', 'gesamt'] as const;
export type Zeitraum = (typeof ZEITRAEUME)[number];

export interface Statistiken {
  kennzahlen: {
    eintraege: number;
    stunden: number;
    aktiveTage: number;
    laengsterStreak: number;
    meilensteine: number;
    bosseBesiegt: number;
  };
  verlaufEinheit: 'woche' | 'monat';
  verlauf: { beginn: string; xp: number }[];
  vorlagen: { id: number; name: string; icon: string; xp: number; stunden: number }[];
  projekte: { id: number; name: string; farbe: string; xp: number }[];
  wochentage: { tag: number; xp: number }[];
}
