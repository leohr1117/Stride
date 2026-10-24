import type { AttributTyp } from './begriffe.ts';
import type { Zielstrebigkeit } from './profil.ts';

export const FUNKTIONEN = [
  'koennen',
  'status',
  'faehigkeiten',
  'ausruestung',
  'basis',
  'aufgaben',
  'chronik',
  'vorbilder',
  'rueckblick',
  'statistiken',
  'handbuch',
  'bossAngriffe',
  'verfallKoennen',
  'verfallHaben',
] as const;
export type Funktion = (typeof FUNKTIONEN)[number];
export type Funktionen = Record<Funktion, boolean>;

export const TYP_FUNKTION: Record<AttributTyp, Funktion> = {
  attribut: 'koennen',
  status: 'status',
};

export interface FunktionsEintrag {
  funktion: Funktion;
  label: string;
  /** Ort im Popup. Nur Abschnitte haben einen, Seiten nicht. */
  ort?: string;
}

export interface FunktionsBlock {
  seite: string;
  eintraege: readonly FunktionsEintrag[];
}

export const FUNKTION_BLOECKE: readonly FunktionsBlock[] = [
  {
    seite: 'Seiten',
    eintraege: [
      { funktion: 'basis', label: 'Basis' },
      { funktion: 'aufgaben', label: 'Aufgaben' },
      { funktion: 'chronik', label: 'Chronik' },
      { funktion: 'rueckblick', label: 'Rückblick' },
      { funktion: 'statistiken', label: 'Statistiken' },
      { funktion: 'vorbilder', label: 'Vorbilder' },
      { funktion: 'handbuch', label: 'Handbuch' },
    ],
  },
  {
    seite: 'Abschnitte',
    eintraege: [
      { funktion: 'koennen', label: 'Können', ort: 'Auf dem Charakter.' },
      { funktion: 'status', label: 'Haben', ort: 'Auf dem Charakter.' },
      { funktion: 'faehigkeiten', label: 'Fähigkeiten', ort: 'Auf dem Charakter.' },
      {
        funktion: 'ausruestung',
        label: 'Investitionen',
        ort: 'Eigene auf dem Charakter. Projekt-Investitionen auf der Projektseite.',
      },
      {
        funktion: 'bossAngriffe',
        label: 'Bosse',
        ort: 'Unter Laufend. Anlegen am Vorhaben auf der Projektseite.',
      },
      {
        funktion: 'verfallKoennen',
        label: 'Verfall Können',
        ort: 'Beim Bearbeiten eines Können-Attributs auf dem Charakter.',
      },
      {
        funktion: 'verfallHaben',
        label: 'Verfall Haben',
        ort: 'Beim Bearbeiten eines Haben-Attributs auf dem Charakter.',
      },
    ],
  },
];

const STANDARD_AN = new Set<Funktion>(['koennen', 'status', 'handbuch']);

export function standardFunktionen(): Funktionen {
  const funktionen = {} as Funktionen;
  for (const funktion of FUNKTIONEN) {
    funktionen[funktion] = STANDARD_AN.has(funktion);
  }
  return funktionen;
}

export function istTypAktiv(funktionen: Funktionen, typ: AttributTyp): boolean {
  return funktionen[TYP_FUNKTION[typ]];
}

export function verfallFunktion(typ: AttributTyp): 'verfallKoennen' | 'verfallHaben' {
  return typ === 'attribut' ? 'verfallKoennen' : 'verfallHaben';
}

/**
 * Liest gespeicherte Schalter. Der alte Schalter Attributverfall gilt für Können und Haben,
 * solange die getrennten Schalter noch nicht gespeichert sind.
 * Keine Zeile (null oder undefined) ist eine neue Welt und schaltet Aufgaben an.
 * Ein gespeichertes Objekt ohne den Schlüssel lässt Aufgaben aus.
 */
export function funktionenAusSpeicher(roh: unknown): Funktionen {
  const funktionen = standardFunktionen();
  if (roh === null || roh === undefined) {
    funktionen.aufgaben = true;
    return funktionen;
  }
  if (typeof roh !== 'object') {
    return funktionen;
  }
  const quelle = roh as Record<string, unknown>;
  for (const funktion of FUNKTIONEN) {
    const wert = quelle[funktion];
    if (typeof wert === 'boolean') {
      funktionen[funktion] = wert;
    }
  }
  const alt = quelle.attributVerfall;
  if (typeof alt === 'boolean') {
    if (typeof quelle.verfallKoennen !== 'boolean') {
      funktionen.verfallKoennen = alt;
    }
    if (typeof quelle.verfallHaben !== 'boolean') {
      funktionen.verfallHaben = alt;
    }
  }
  return funktionen;
}

export function funktionenFuerStufe(stufe: Zielstrebigkeit): Partial<Funktionen> {
  if (stufe === 'uebung') {
    return { faehigkeiten: true };
  }
  return {};
}
