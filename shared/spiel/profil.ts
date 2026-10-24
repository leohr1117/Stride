import type { AttributKennung, IconName } from './begriffe.ts';

export const PROFILNAME_MAX = 40;
export const PROFILNAME_PLATZHALTER = 'Abenteurer';
export const GEBURTSJAHR_MIN = 1900;

/** Fragen nach der Sprachwahl und den Folien, in dieser Reihenfolge. */
export const PROFIL_SCHRITTE = ['profilname', 'geburtsjahr', 'ziel', 'fokus'] as const;
export type ProfilSchritt = (typeof PROFIL_SCHRITTE)[number];

/** Gesamte Einführung. Die Oberfläche hält sich an diese Reihenfolge. */
export const ONBOARDING_SCHRITTE = ['sprache', 'folien', ...PROFIL_SCHRITTE] as const;

export const ZIELSTREBIGKEITEN = ['traeumer', 'macher', 'bodenstaendig', 'uebung', 'einfach'] as const;
export type Zielstrebigkeit = (typeof ZIELSTREBIGKEITEN)[number];

const ZIELSTREBIGKEIT_ALIAS: Record<string, Zielstrebigkeit> = {
  kleineErfolge: 'bodenstaendig',
};

/** Sichtbare Frage. Die Schlüssel bleiben die Stufen. */
export const ZIEL_FRAGE = 'Was willst du erreichen?';
export const FOKUS_PFLICHT = 'Wähle mindestens einen Fokus.';

export const ZIELSTREBIGKEIT_INFO: Record<Zielstrebigkeit, { titel: string; text: string }> = {
  traeumer: {
    titel: 'Ein Lebensziel',
    text: 'Vision, Projekt und Vorhaben.',
  },
  macher: {
    titel: 'Projekte umsetzen',
    text: 'Projekte und Vorhaben.',
  },
  bodenstaendig: {
    titel: 'Konkrete Ziele',
    text: 'Vorhaben in Projekten.',
  },
  uebung: {
    titel: '(In etwas) besser werden',
    text: 'Tätigkeiten und Fähigkeiten.',
  },
  einfach: {
    titel: 'Dranbleiben',
    text: 'Nur Einträge.',
  },
};

export const FOKUS_IDS = [
  'sport',
  'gesundheit',
  'weisheit',
  'lernen',
  'erfolg',
  'soziales',
  'geld',
  'kreativitaet',
  'mut',
] as const;
export type FokusId = (typeof FOKUS_IDS)[number];

export interface FokusInfo {
  id: FokusId;
  label: string;
  text: string;
  kennungen: readonly AttributKennung[];
}

export const FOKUS_LISTE: readonly FokusInfo[] = [
  { id: 'sport', label: 'Sport', text: 'Training, Körper, Schlaf und Ernährung', kennungen: ['vitalitaet', 'koerper', 'disziplin'] },
  { id: 'gesundheit', label: 'Gesundheit', text: 'Schlaf, Bewegung, innere Ruhe', kennungen: ['vitalitaet', 'geist', 'koerper'] },
  { id: 'weisheit', label: 'Weisheit', text: 'Ruhe, Reflexion, Überblick', kennungen: ['geist', 'intellekt', 'vermaechtnis'] },
  { id: 'lernen', label: 'Lernen', text: 'Wissen, Verstehen, Abschlüsse', kennungen: ['intellekt', 'disziplin', 'qualifikation'] },
  { id: 'erfolg', label: 'Erfolg', text: 'Vorankommen, Wirkung, Anerkennung', kennungen: ['disziplin', 'ansehen', 'einfluss'] },
  { id: 'soziales', label: 'Soziales', text: 'Menschen, Freundschaft, Miteinander', kennungen: ['soziales', 'beziehungen', 'netzwerk'] },
  { id: 'geld', label: 'Geld', text: 'Mittel, Unabhängigkeit, Besitz', kennungen: ['ressourcen', 'freiheit', 'disziplin'] },
  { id: 'kreativitaet', label: 'Kreativität', text: 'Ideen, Gestalten, Erschaffen', kennungen: ['kreativitaet', 'geist', 'motorik'] },
  { id: 'mut', label: 'Mut', text: 'Wagnis, Standfestigkeit, Klarheit', kennungen: ['mut', 'disziplin', 'geist'] },
];

export function geburtsjahrGueltig(jahr: number, heute = new Date()): boolean {
  return Number.isInteger(jahr) && jahr >= GEBURTSJAHR_MIN && jahr <= heute.getFullYear();
}

export function alterInJahren(jahr: number, heute = new Date()): number {
  return heute.getFullYear() - jahr;
}

export function istZielstrebigkeit(wert: unknown): wert is Zielstrebigkeit {
  return typeof wert === 'string' && (ZIELSTREBIGKEITEN as readonly string[]).includes(wert);
}

export function leseZielstrebigkeit(wert: unknown): Zielstrebigkeit | null {
  if (istZielstrebigkeit(wert)) {
    return wert;
  }
  if (typeof wert !== 'string') {
    return null;
  }
  return ZIELSTREBIGKEIT_ALIAS[wert] ?? null;
}

export function normalisiereFokus(wert: unknown): FokusId[] {
  if (!Array.isArray(wert)) {
    return [];
  }
  const gesehen = new Set<FokusId>();
  const ergebnis: FokusId[] = [];
  for (const eintrag of wert) {
    if (typeof eintrag === 'string' && (FOKUS_IDS as readonly string[]).includes(eintrag)) {
      const id = eintrag as FokusId;
      if (!gesehen.has(id)) {
        gesehen.add(id);
        ergebnis.push(id);
      }
    }
  }
  return ergebnis;
}

export function startAttribute(fokus: readonly FokusId[]): { gewaehlt: AttributKennung[]; ergaenzt: AttributKennung[] } {
  const gewaehlt: AttributKennung[] = [];
  const gesehen = new Set<AttributKennung>();
  for (const id of fokus) {
    const info = FOKUS_LISTE.find((eintrag) => eintrag.id === id);
    if (!info) {
      continue;
    }
    for (const kennung of info.kennungen) {
      if (!gesehen.has(kennung)) {
        gesehen.add(kennung);
        gewaehlt.push(kennung);
      }
    }
  }
  return { gewaehlt, ergaenzt: [] };
}

export function startKennungen(fokus: readonly FokusId[]): AttributKennung[] {
  return startAttribute(fokus).gewaehlt;
}

export interface StartTaetigkeit {
  name: string;
  icon: IconName;
  gewichte: readonly { kennung: AttributKennung; gewicht: number }[];
}

function startTaetigkeit(
  name: string,
  icon: IconName,
  gewichte: readonly (readonly [AttributKennung, number])[],
): StartTaetigkeit {
  return { name, icon, gewichte: gewichte.map(([kennung, gewicht]) => ({ kennung, gewicht })) };
}

export const START_TAETIGKEITEN: Record<FokusId, readonly StartTaetigkeit[]> = {
  sport: [
    startTaetigkeit('Training', 'dumbbell', [
      ['koerper', 50],
      ['disziplin', 30],
      ['vitalitaet', 20],
    ]),
    startTaetigkeit('Laufen', 'bike', [
      ['vitalitaet', 50],
      ['koerper', 40],
      ['disziplin', 10],
    ]),
    startTaetigkeit('Dehnen', 'heart-pulse', [
      ['koerper', 50],
      ['vitalitaet', 50],
    ]),
  ],
  gesundheit: [
    startTaetigkeit('Ausgeschlafen', 'battery-charging', [
      ['vitalitaet', 70],
      ['geist', 30],
    ]),
    startTaetigkeit('Bewegt', 'bike', [
      ['koerper', 60],
      ['vitalitaet', 40],
    ]),
  ],
  weisheit: [
    startTaetigkeit('Nachdenken', 'brain', [
      ['geist', 60],
      ['intellekt', 40],
    ]),
    startTaetigkeit('Festhalten', 'feather', [
      ['vermaechtnis', 60],
      ['geist', 40],
    ]),
  ],
  lernen: [
    startTaetigkeit('Lernen', 'graduation-cap', [
      ['intellekt', 60],
      ['disziplin', 30],
      ['qualifikation', 10],
    ]),
    startTaetigkeit('Lesen', 'book-open', [
      ['intellekt', 80],
      ['qualifikation', 20],
    ]),
  ],
  erfolg: [
    startTaetigkeit('Liefern', 'rocket', [
      ['disziplin', 60],
      ['einfluss', 40],
    ]),
    startTaetigkeit('Präsentieren', 'award', [
      ['ansehen', 60],
      ['einfluss', 40],
    ]),
  ],
  soziales: [
    startTaetigkeit('Treffen', 'users', [
      ['soziales', 50],
      ['beziehungen', 50],
    ]),
    startTaetigkeit('Schreiben', 'hand', [
      ['netzwerk', 60],
      ['beziehungen', 40],
    ]),
  ],
  geld: [
    startTaetigkeit('Sparen', 'coins', [
      ['ressourcen', 60],
      ['disziplin', 40],
    ]),
    startTaetigkeit('Anlegen', 'gem', [
      ['freiheit', 60],
      ['ressourcen', 40],
    ]),
    startTaetigkeit('Verdienen', 'briefcase', [
      ['ressourcen', 50],
      ['disziplin', 30],
      ['freiheit', 20],
    ]),
  ],
  kreativitaet: [
    startTaetigkeit('Erschaffen', 'hammer', [
      ['kreativitaet', 60],
      ['motorik', 40],
    ]),
    startTaetigkeit('Brainstormen', 'lightbulb', [
      ['geist', 60],
      ['kreativitaet', 40],
    ]),
  ],
  mut: [
    startTaetigkeit('Trauen', 'shield', [
      ['mut', 70],
      ['geist', 30],
    ]),
    startTaetigkeit('Anfangen', 'flame', [
      ['disziplin', 60],
      ['mut', 40],
    ]),
  ],
};

export function startTaetigkeiten(fokus: readonly FokusId[]): StartTaetigkeit[] {
  const gesehen = new Set<string>();
  const ergebnis: StartTaetigkeit[] = [];
  for (const id of fokus) {
    for (const eintrag of START_TAETIGKEITEN[id] ?? []) {
      if (!gesehen.has(eintrag.name)) {
        gesehen.add(eintrag.name);
        ergebnis.push(eintrag);
      }
    }
  }
  return ergebnis;
}

export function profilFragenOffen(stand: { profilAngelegt: boolean; weltLeer: boolean }): boolean {
  return !stand.profilAngelegt && stand.weltLeer;
}

/** True, wenn die Profilfragen gerade neu aufgehen. Dann kommt die Einführung davor. */
export function einfuehrungZurueck(vorherOffen: boolean, jetztOffen: boolean): boolean {
  return jetztOffen && !vorherOffen;
}
