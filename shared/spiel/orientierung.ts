export interface LevelBeispiel {
  titel: string;
  level: number;
}

export const LEVEL_MARKEN = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Drei runde Marken zum Schätzen: klein, mittel, groß. */
export const LEVEL_SCHAETZUNG = [10, 100, 1000] as const;

export const VISION_BEISPIELE: LevelBeispiel[] = [
  { titel: 'Gesund und fit bis ins Alter', level: 300 },
  { titel: 'Eigenes Zuhause', level: 400 },
  { titel: 'Eigenes Café eröffnen', level: 800 },
  { titel: 'Finanziell frei', level: 2000 },
  { titel: 'Firma mit 100 Mitarbeitenden', level: 3000 },
  { titel: 'Weltweit bekannt werden', level: 6000 },
  { titel: 'Menschen auf den Mars bringen', level: 20000 },
];

/** Erstes, mittleres und letztes Beispiel: klein, mittel, groß. */
export const VISION_STUFEN: LevelBeispiel[] = [300, 2000, 20000].flatMap((level) => {
  const beispiel = VISION_BEISPIELE.find((eintrag) => eintrag.level === level);
  return beispiel ? [beispiel] : [];
});
