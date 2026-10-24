export const ERFOLG_KENNZAHLEN = [
  'eintraege',
  'streak',
  'level',
  'meilensteine',
  'bosse',
  'bossLevel',
  'comebacks',
  'basis',
  'skills',
  'ausruestung',
  'stunden',
  'aktiveTage',
  'rueckblicke',
  'visionen',
] as const;
export type ErfolgKennzahl = (typeof ERFOLG_KENNZAHLEN)[number];
export type Kennzahlen = Record<ErfolgKennzahl, number>;

export interface ErfolgStufeDefinition {
  schwelle: number;
  name: string;
}

export interface ErfolgDefinition {
  kennzahl: ErfolgKennzahl;
  label: string;
  stufen: ErfolgStufeDefinition[];
}

export const ERFOLGE: ErfolgDefinition[] = [
  {
    kennzahl: 'level',
    label: 'Charakter-Level',
    stufen: [
      { schwelle: 10, name: 'Erwacht' },
      { schwelle: 50, name: 'Aufsteigend' },
      { schwelle: 100, name: 'Dreistellig' },
      { schwelle: 250, name: 'Erfahren' },
      { schwelle: 500, name: 'Meisterhaft' },
      { schwelle: 1000, name: 'Legende' },
      { schwelle: 2500, name: 'Mythos' },
      { schwelle: 5000, name: 'Ikone' },
      { schwelle: 10000, name: 'Unsterblich' },
    ],
  },
  {
    kennzahl: 'streak',
    label: 'Längster Streak',
    stufen: [
      { schwelle: 7, name: 'Funke' },
      { schwelle: 30, name: 'Flamme' },
      { schwelle: 100, name: 'Unaufhaltsam' },
      { schwelle: 365, name: 'Eiserner Wille' },
      { schwelle: 1000, name: 'Naturgewalt' },
    ],
  },
  {
    kennzahl: 'eintraege',
    label: 'Einträge',
    stufen: [
      { schwelle: 1, name: 'Aufbruch' },
      { schwelle: 100, name: 'Am Ball' },
      { schwelle: 1000, name: 'Tausendfach' },
      { schwelle: 10000, name: 'Lebenswerk' },
    ],
  },
  {
    kennzahl: 'meilensteine',
    label: 'Meilensteine',
    stufen: [
      { schwelle: 1, name: 'Erster Gipfel' },
      { schwelle: 10, name: 'Höhenluft' },
      { schwelle: 50, name: 'Gipfelsammlung' },
      { schwelle: 100, name: 'Hundert Gipfel' },
    ],
  },
  {
    kennzahl: 'bosse',
    label: 'Bosse besiegt',
    stufen: [
      { schwelle: 1, name: 'Bossbezwinger' },
      { schwelle: 10, name: 'Bossjäger' },
      { schwelle: 50, name: 'Schrecken der Bosse' },
    ],
  },
  {
    kennzahl: 'bossLevel',
    label: 'Stärkster Boss',
    stufen: [
      { schwelle: 5, name: 'Über sich hinaus' },
      { schwelle: 15, name: 'Riesentöter' },
      { schwelle: 30, name: 'Titanenfall' },
    ],
  },
  {
    kennzahl: 'comebacks',
    label: 'Comebacks',
    stufen: [
      { schwelle: 1, name: 'Wieder aufgestanden' },
      { schwelle: 5, name: 'Stehaufmensch' },
    ],
  },
  {
    kennzahl: 'basis',
    label: 'Basis-Aufgaben',
    stufen: [
      { schwelle: 10, name: 'Fundament' },
      { schwelle: 100, name: 'Felsenfest' },
      { schwelle: 1000, name: 'Grundpfeiler' },
    ],
  },
  {
    kennzahl: 'skills',
    label: 'Skills',
    stufen: [
      { schwelle: 1, name: 'Lehrling' },
      { schwelle: 25, name: 'Vielseitig' },
      { schwelle: 100, name: 'Meister vieler Künste' },
    ],
  },
  {
    kennzahl: 'ausruestung',
    label: 'Investitionen',
    stufen: [
      { schwelle: 1, name: 'Investiert' },
      { schwelle: 10, name: 'Gut gerüstet' },
    ],
  },
  {
    kennzahl: 'stunden',
    label: 'Stunden',
    stufen: [
      { schwelle: 100, name: 'Hundert Stunden' },
      { schwelle: 1000, name: 'Tausend Stunden' },
      { schwelle: 10000, name: 'Zehntausend Stunden' },
    ],
  },
  {
    kennzahl: 'aktiveTage',
    label: 'Aktive Tage',
    stufen: [
      { schwelle: 100, name: 'Hundert Tage' },
      { schwelle: 365, name: 'Ein Jahr Ascend' },
      { schwelle: 1000, name: 'Tausend Tage' },
    ],
  },
  {
    kennzahl: 'rueckblicke',
    label: 'Wochenrückblicke',
    stufen: [
      { schwelle: 1, name: 'Innehalten' },
      { schwelle: 10, name: 'Reflektiert' },
      { schwelle: 52, name: 'Ein Jahr im Blick' },
    ],
  },
  {
    kennzahl: 'visionen',
    label: 'Visionen erreicht',
    stufen: [
      { schwelle: 1, name: 'Traum erfüllt' },
      { schwelle: 3, name: 'Visionär' },
      { schwelle: 10, name: 'Weltveränderer' },
    ],
  },
];

export function erfolgSchluessel(kennzahl: ErfolgKennzahl, schwelle: number): string {
  return `${kennzahl}-${schwelle}`;
}

export function erreichteErfolge(kennzahlen: Kennzahlen): string[] {
  const erreicht: string[] = [];
  for (const erfolg of ERFOLGE) {
    for (const stufe of erfolg.stufen) {
      if (kennzahlen[erfolg.kennzahl] >= stufe.schwelle) {
        erreicht.push(erfolgSchluessel(erfolg.kennzahl, stufe.schwelle));
      }
    }
  }
  return erreicht;
}

export function kennzahlAusSchluessel(schluessel: string): ErfolgKennzahl | null {
  const trenn = schluessel.lastIndexOf('-');
  if (trenn <= 0) {
    return null;
  }
  const kennzahl = schluessel.slice(0, trenn);
  return ERFOLGE.some((erfolg) => erfolg.kennzahl === kennzahl) ? (kennzahl as ErfolgKennzahl) : null;
}

export function erfolgName(schluessel: string): string | null {
  for (const erfolg of ERFOLGE) {
    for (const stufe of erfolg.stufen) {
      if (erfolgSchluessel(erfolg.kennzahl, stufe.schwelle) === schluessel) {
        return stufe.name;
      }
    }
  }
  return null;
}

export function hoechsteStufe(kennzahl: ErfolgKennzahl, wert: number): string | null {
  const erfolg = ERFOLGE.find((eintrag) => eintrag.kennzahl === kennzahl);
  let name: string | null = null;
  for (const stufe of erfolg?.stufen ?? []) {
    if (wert >= stufe.schwelle) {
      name = stufe.name;
    }
  }
  return name;
}
