export interface LevelBeispiel {
  titel: string;
  level: number;
}

export const LEVEL_MARKEN = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export const VISION_BEISPIELE: LevelBeispiel[] = [
  { titel: 'Gesund und fit bis ins Alter', level: 300 },
  { titel: 'Eigenes Zuhause', level: 400 },
  { titel: 'Eigenes Café eröffnen', level: 800 },
  { titel: 'Finanziell frei', level: 2000 },
  { titel: 'Firma mit 100 Mitarbeitenden', level: 3000 },
  { titel: 'Weltweit bekannt werden', level: 6000 },
  { titel: 'Menschen auf den Mars bringen', level: 20000 },
];
