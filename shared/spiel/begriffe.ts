export const ATTRIBUT_TYPEN = ['attribut', 'status'] as const;
export type AttributTyp = (typeof ATTRIBUT_TYPEN)[number];

export const ATTRIBUT_TYP_INFO: Record<AttributTyp, { label: string; mehrzahl: string }> = {
  attribut: { label: 'Können', mehrzahl: 'Können' },
  status: { label: 'Haben', mehrzahl: 'Haben' },
};

export const KOENNEN_KENNUNGEN = [
  'koerper',
  'geist',
  'disziplin',
  'intellekt',
  'soziales',
  'kreativitaet',
  'motorik',
  'mut',
  'vitalitaet',
  'fuehrung',
] as const;
export const STATUS_KENNUNGEN = [
  'einfluss',
  'ressourcen',
  'autoritaet',
  'reichweite',
  'ansehen',
  'netzwerk',
  'freiheit',
  'vermaechtnis',
  'beziehungen',
  'qualifikation',
] as const;
export const ATTRIBUT_KENNUNGEN = [...KOENNEN_KENNUNGEN, ...STATUS_KENNUNGEN] as const;
export type KoennenKennung = (typeof KOENNEN_KENNUNGEN)[number];
export type AttributKennung = (typeof ATTRIBUT_KENNUNGEN)[number];

export const VORHABEN_STATUS = ['offen', 'geschafft', 'gescheitert', 'losgelassen'] as const;
export type VorhabenStatus = (typeof VORHABEN_STATUS)[number];

export const VORHABEN_STATUS_LABEL: Record<VorhabenStatus, string> = {
  offen: 'Offen',
  geschafft: 'Geschafft',
  gescheitert: 'Gescheitert',
  losgelassen: 'Losgelassen',
};

export const ABSCHLUESSE = ['geschafft', 'gescheitert'] as const;
export type Abschluss = (typeof ABSCHLUESSE)[number];

export const DAUER_OPTIONEN: { stunden: number; label: string }[] = [
  { stunden: 0.5, label: '30 Min' },
  { stunden: 1, label: '1 Std' },
  { stunden: 2, label: '2 Std' },
  { stunden: 4, label: '4 Std' },
  { stunden: 8, label: 'Ganzer Tag' },
];

export const DREYFUS_STUFEN: { abLevel: number; name: string }[] = [
  { abLevel: 1, name: 'Novize' },
  { abLevel: 10, name: 'Fortgeschrittener Anfänger' },
  { abLevel: 30, name: 'Kompetent' },
  { abLevel: 75, name: 'Gewandt' },
  { abLevel: 150, name: 'Experte' },
  { abLevel: 300, name: 'Meister' },
  { abLevel: 600, name: 'Großmeister' },
];

export function dreyfusStufe(level: number): string {
  let stufe = DREYFUS_STUFEN[0].name;
  for (const eintrag of DREYFUS_STUFEN) {
    if (level >= eintrag.abLevel) {
      stufe = eintrag.name;
    }
  }
  return stufe;
}

export const ICONS = [
  'heart-pulse',
  'leaf',
  'target',
  'brain',
  'users',
  'handshake',
  'coins',
  'crown',
  'megaphone',
  'hammer',
  'book-open',
  'dumbbell',
  'palette',
  'battery-charging',
  'clipboard-list',
  'rocket',
  'sparkles',
  'flame',
  'code',
  'briefcase',
  'mountain',
  'compass',
  'gem',
  'magnet',
  'wrench',
  'lightbulb',
  'guitar',
  'gamepad',
  'camera',
  'bike',
  'chef-hat',
  'sprout',
  'languages',
  'shield',
  'award',
  'network',
  'feather',
  'landmark',
  'hand',
  'flag',
  'heart',
  'graduation-cap',
] as const;
export type IconName = (typeof ICONS)[number];

export const FARBE = {
  rot: '#f87171',
  orange: '#fb923c',
  gelb: '#facc15',
  gruen: '#34d399',
  tuerkis: '#2dd4bf',
  blau: '#60a5fa',
  indigo: '#818cf8',
  violett: '#a78bfa',
  pink: '#f472b6',
  schiefer: '#94a3b8',
} as const;

export const NEUTRAL_FARBE = FARBE.schiefer;

export const FARBEN = [
  FARBE.rot,
  FARBE.orange,
  FARBE.gelb,
  FARBE.gruen,
  FARBE.tuerkis,
  FARBE.blau,
  FARBE.indigo,
  FARBE.violett,
  FARBE.pink,
  FARBE.schiefer,
] as const;

export const GRENZEN = {
  nameMax: 80,
  beschreibungMax: 500,
  notizMax: 2000,
  stundenMin: 0.25,
  stundenMax: 24,
  vorlageGewichtMax: 100,
  vorlageAttributeMax: 6,
  visionLevelMax: 99999,
  preisMax: 100000,
} as const;
