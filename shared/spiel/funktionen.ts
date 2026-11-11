import type { AttributTyp } from './begriffe.ts';
import { ZIEL_MARKE, type Ebene } from './ebenen.ts';
import type { Zielstrebigkeit } from './profil.ts';

export const FUNKTIONEN = [
  'koennen',
  'status',
  'faehigkeiten',
  'ausruestung',
  'basis',
  'chronik',
  'vorbilder',
  'rueckblick',
  'statistiken',
  'handbuch',
  'bossAngriffe',
  'verfallKoennen',
  'verfallHaben',
  'erfolge',
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
}

export interface FunktionsBlock {
  seite: string;
  eintraege: readonly FunktionsEintrag[];
}

/** Schalter in Bereiche, gruppiert nach Fundort (11.2 a). Funktionen stehen am Ende. */
export const BEREICH_GRUPPEN = ['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln', 'Funktionen'] as const;
export type BereichGruppe = (typeof BEREICH_GRUPPEN)[number];
export type BereichSchalter = Funktion | Ebene;

export interface BereichEintrag {
  schalter: BereichSchalter;
  label: string;
  gruppe: BereichGruppe;
}

const FUNKTION_SATZ = new Set<string>(FUNKTIONEN);

export function istFunktion(wert: string): wert is Funktion {
  return FUNKTION_SATZ.has(wert);
}

const FUNKTION_LABEL: Record<Funktion, string> = {
  basis: 'Basis',
  chronik: 'Verlauf',
  rueckblick: 'Rückblick',
  statistiken: 'Statistik',
  vorbilder: 'Vorbilder',
  handbuch: 'Handbuch',
  koennen: 'Können',
  status: 'Haben',
  faehigkeiten: 'Fähigkeiten',
  ausruestung: 'Investitionen',
  bossAngriffe: 'Bosse',
  verfallKoennen: 'Verfall Können',
  verfallHaben: 'Verfall Haben',
  erfolge: 'Erfolge und Titel',
};

/** Reihenfolge wie 11.2 a. Namen wie in der Seitentabelle bzw. Ziel-Marke. */
export const BEREICH_SCHALTER: readonly BereichEintrag[] = [
  { schalter: 'basis', label: FUNKTION_LABEL.basis, gruppe: 'Seiten' },
  { schalter: 'chronik', label: FUNKTION_LABEL.chronik, gruppe: 'Seiten' },
  { schalter: 'rueckblick', label: FUNKTION_LABEL.rueckblick, gruppe: 'Seiten' },
  { schalter: 'statistiken', label: FUNKTION_LABEL.statistiken, gruppe: 'Seiten' },
  { schalter: 'vorbilder', label: FUNKTION_LABEL.vorbilder, gruppe: 'Seiten' },
  { schalter: 'handbuch', label: FUNKTION_LABEL.handbuch, gruppe: 'Seiten' },
  { schalter: 'koennen', label: FUNKTION_LABEL.koennen, gruppe: 'Seiten im Profil' },
  { schalter: 'status', label: FUNKTION_LABEL.status, gruppe: 'Seiten im Profil' },
  { schalter: 'faehigkeiten', label: FUNKTION_LABEL.faehigkeiten, gruppe: 'Seiten im Profil' },
  { schalter: 'ausruestung', label: FUNKTION_LABEL.ausruestung, gruppe: 'Seiten im Profil' },
  { schalter: 'visionen', label: ZIEL_MARKE.visionen.mehrzahl, gruppe: 'Auf Ziele' },
  { schalter: 'organisationen', label: ZIEL_MARKE.organisationen.mehrzahl, gruppe: 'Auf Ziele' },
  { schalter: 'projekte', label: ZIEL_MARKE.projekte.mehrzahl, gruppe: 'Auf Ziele' },
  { schalter: 'vorhaben', label: ZIEL_MARKE.vorhaben.mehrzahl, gruppe: 'Auf Ziele' },
  { schalter: 'bossAngriffe', label: FUNKTION_LABEL.bossAngriffe, gruppe: 'Auf Ziele' },
  { schalter: 'verfallKoennen', label: FUNKTION_LABEL.verfallKoennen, gruppe: 'Regeln' },
  { schalter: 'verfallHaben', label: FUNKTION_LABEL.verfallHaben, gruppe: 'Regeln' },
  { schalter: 'erfolge', label: FUNKTION_LABEL.erfolge, gruppe: 'Funktionen' },
];

export const FUNKTION_BLOECKE: readonly FunktionsBlock[] = BEREICH_GRUPPEN.map((gruppe) => ({
  seite: gruppe,
  eintraege: BEREICH_SCHALTER.filter((eintrag) => eintrag.gruppe === gruppe && istFunktion(eintrag.schalter)).map(
    (eintrag) => ({ funktion: eintrag.schalter as Funktion, label: eintrag.label }),
  ),
})).filter((block) => block.eintraege.length > 0);

const STANDARD_AN = new Set<Funktion>(['koennen', 'status', 'chronik', 'handbuch', 'erfolge']);

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
 * Die alten Schlüssel aufgaben und training werden ignoriert und schalten nichts ein.
 */
export function funktionenAusSpeicher(roh: unknown): Funktionen {
  const funktionen = standardFunktionen();
  if (roh === null || roh === undefined || typeof roh !== 'object') {
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
