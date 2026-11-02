import type { QueryClient } from '@tanstack/react-query';
import { schnellPunkte, type SchnellPunktArt } from '../../shared/spiel/ungenutzt.ts';

export type { SchnellPunktArt };

export const UNDO_MS = 5000;
export const ACHSE_PX = 8;
export const ZEIGE_PX = 88;
export const AUSLOESEN_PX = 132;
export const OFFEN_ANTEIL = 0.6;

export type SchnellArt =
  | 'vision'
  | 'organisation'
  | 'projekt'
  | 'vorlage'
  | 'attribut'
  | 'faehigkeit'
  | 'investition'
  | 'basis'
  | 'knoten'
  | 'vorhaben'
  | 'eintrag'
  | 'kalender'
  | 'todoist'
  | 'trainingsplan'
  | 'uebung'
  | 'konto'
  | 'vorbild';

export interface SchnellZiel {
  art: SchnellArt;
  id: number;
  name: string;
  archiviert?: boolean;
  loeschbar?: boolean;
  gesperrt?: boolean;
  hinweis?: string;
  onWiederherstellen?: () => void;
}

export interface SchnellPunkt {
  art: SchnellPunktArt;
  label: string;
  /** Eigene Aktion. Ohne id läuft Archivieren, Wiederherstellen oder Löschen. */
  id?: string;
  /** Dieser Punkt ist die Wischaktion, auch wenn Löschen in der Liste steht. */
  wisch?: boolean;
  /** Stern nur an der Favoriten-Aktion. Andere Punkte bleiben ohne Symbol. */
  symbol?: 'stern' | 'stern-voll';
}

export interface Bestaetigungstext {
  titel: string;
  text: string;
  knopf: string;
}

export type CacheModus = 'archivieren' | 'wiederherstellen' | 'entfernen';

const LABEL: Record<SchnellPunktArt, string> = {
  archivieren: 'Archivieren',
  wiederherstellen: 'Wiederherstellen',
  loeschen: 'Löschen',
};

const LOESCH_LABEL: Partial<Record<SchnellArt, string>> = {
  kalender: 'Entfernen',
  todoist: 'Trennen',
};

export function punkteFuer(ziel: Pick<SchnellZiel, 'art' | 'archiviert' | 'loeschbar' | 'gesperrt'>): SchnellPunkt[] {
  if (ziel.art === 'vorbild') {
    return [];
  }
  if (ziel.art === 'eintrag' || ziel.art === 'kalender' || ziel.art === 'todoist') {
    return [{ art: 'loeschen', label: LOESCH_LABEL[ziel.art] ?? 'Löschen' }];
  }
  if (ziel.art === 'konto') {
    return ziel.gesperrt ? [] : [{ art: 'loeschen', label: 'Löschen' }];
  }
  if (ziel.art === 'knoten' || ziel.art === 'vorhaben') {
    return ziel.loeschbar ? [{ art: 'loeschen', label: 'Löschen' }] : [];
  }
  const arten = schnellPunkte({
    ungenutzt: Boolean(ziel.loeschbar),
    archiviert: Boolean(ziel.archiviert),
    kannArchivieren: !ziel.gesperrt,
    kannLoeschen: !ziel.gesperrt || Boolean(ziel.archiviert),
  });
  return arten.map((art) => ({ art, label: art === 'loeschen' ? (LOESCH_LABEL[ziel.art] ?? LABEL.loeschen) : LABEL[art] }));
}

export function primaerPunkt(punkte: SchnellPunkt[]): SchnellPunkt | null {
  return punkte.find((punkt) => punkt.art === 'loeschen') ?? punkte.find((punkt) => punkt.art === 'archivieren') ?? punkte[0] ?? null;
}

export function menueTeile(punkte: SchnellPunkt[]): { oben: SchnellPunkt[]; loeschen: SchnellPunkt | null } {
  return {
    oben: punkte.filter((punkt) => punkt.art !== 'loeschen'),
    loeschen: punkte.find((punkt) => punkt.art === 'loeschen') ?? null,
  };
}

const MIT_WARNUNG = new Set<SchnellArt>(['knoten', 'konto', 'kalender', 'todoist']);

/** Einzeln löschen geht sofort, die Meldung bietet Rückgängig. Teilbäume und Zugänge bleiben eine Warnung. */
export function sofortRueckgaengig(art: SchnellArt): boolean {
  return !MIT_WARNUNG.has(art);
}

export function bestaetigungFuer(ziel: SchnellZiel): Bestaetigungstext | null {
  if (ziel.art === 'kalender') {
    return { titel: `${ziel.name} entfernen?`, text: 'Bereits übernommene Einträge bleiben.', knopf: 'Entfernen' };
  }
  if (ziel.art === 'todoist') {
    return { titel: 'Todoist trennen?', text: 'Bereits übernommene Einträge bleiben.', knopf: 'Trennen' };
  }
  if (ziel.art === 'konto') {
    return { titel: `${ziel.name} löschen?`, text: 'Die Welt dieses Accounts wird mitgelöscht.', knopf: 'Löschen' };
  }
  if (ziel.art === 'knoten') {
    return {
      titel: `${ziel.name} löschen?`,
      text: ziel.hinweis ?? 'Alle Skills darunter werden ebenfalls gelöscht.',
      knopf: 'Löschen',
    };
  }
  return null;
}

interface Satz {
  id: number;
  archiviert?: boolean;
  elternId?: number | null;
  knoten?: Satz[];
  attribute?: Satz[];
  status?: Satz[];
  visionen?: Satz[];
  organisationen?: Satz[];
  projekte?: Satz[];
  vorhaben?: Satz[];
  bosse?: Satz[];
  projekt?: Satz;
  kalender?: Satz[];
  todoist?: { verbunden?: boolean; nutzer?: string | null; projekte?: unknown[] };
  pages?: { eintraege: { typ: string; eintrag?: { id: number } }[] }[];
}

function istSatz(wert: unknown): wert is Satz {
  return typeof wert === 'object' && wert !== null;
}

function mitArchiv<T extends { archiviert?: boolean }>(eintrag: T, modus: CacheModus): T {
  if (typeof eintrag.archiviert !== 'boolean') {
    return eintrag;
  }
  const archiviert = modus === 'archivieren';
  return eintrag.archiviert === archiviert ? eintrag : { ...eintrag, archiviert };
}

function listeVon(daten: unknown, id: number, modus: CacheModus, nurAktiv = false): unknown {
  if (!Array.isArray(daten)) {
    return daten;
  }
  if (modus === 'entfernen' || (nurAktiv && modus === 'archivieren')) {
    const neu = daten.filter((eintrag) => !(istSatz(eintrag) && eintrag.id === id));
    return neu.length === daten.length ? daten : neu;
  }
  let geaendert = false;
  const neu = daten.map((eintrag) => {
    if (!istSatz(eintrag) || eintrag.id !== id) {
      return eintrag;
    }
    const danach = mitArchiv(eintrag, modus);
    if (danach !== eintrag) {
      geaendert = true;
    }
    return danach;
  });
  return geaendert ? neu : daten;
}

function feld(daten: Satz, name: keyof Satz, id: number, modus: CacheModus, nurAktiv = false): Satz | null {
  const bisher = daten[name];
  const neu = listeVon(bisher, id, modus, nurAktiv);
  if (neu === bisher) {
    return null;
  }
  return { ...daten, [name]: neu };
}

function ohneKnoten(knoten: Satz[], id: number): Satz[] {
  const weg = new Set<number>([id]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const eintrag of knoten) {
      if (eintrag.elternId != null && weg.has(eintrag.elternId) && !weg.has(eintrag.id)) {
        weg.add(eintrag.id);
        gewachsen = true;
      }
    }
  }
  const neu = knoten.filter((eintrag) => !weg.has(eintrag.id));
  return neu.length === knoten.length ? knoten : neu;
}

function faehigkeitOhneKnoten(daten: Satz, id: number): Satz {
  if (!Array.isArray(daten.knoten)) {
    return daten;
  }
  const knoten = ohneKnoten(daten.knoten, id);
  return knoten === daten.knoten ? daten : { ...daten, knoten };
}

const ZIEL_FELD: Partial<Record<SchnellArt, keyof Satz>> = {
  vision: 'visionen',
  organisation: 'organisationen',
  projekt: 'projekte',
  vorhaben: 'vorhaben',
};

export function wendeQuery(key: readonly unknown[], daten: unknown, art: SchnellArt, id: number, modus: CacheModus): unknown {
  if (!istSatz(daten) && !Array.isArray(daten)) {
    return daten;
  }
  const kopf = key[0];
  if ((kopf === 'charakter' || kopf === 'uebersicht') && art === 'attribut' && istSatz(daten)) {
    const attribute = feld(daten, 'attribute', id, modus, true);
    const basis = attribute ?? daten;
    const status = feld(basis, 'status', id, modus, true);
    return status ?? attribute ?? daten;
  }
  if (kopf === 'attribute' && art === 'attribut') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'ziele' && istSatz(daten)) {
    const name = ZIEL_FELD[art];
    if (!name) {
      return daten;
    }
    return feld(daten, name, id, modus) ?? daten;
  }
  if (kopf === 'vorlagen' && art === 'vorlage') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'investitionen' && art === 'investition') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'basis' && art === 'basis') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'trainingsplaene' && art === 'trainingsplan') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'uebungen' && art === 'uebung') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'faehigkeiten' && art === 'faehigkeit') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'faehigkeiten' && art === 'knoten' && modus === 'entfernen' && Array.isArray(daten)) {
    let geaendert = false;
    const neu = daten.map((eintrag) => {
      if (!istSatz(eintrag)) {
        return eintrag;
      }
      const danach = faehigkeitOhneKnoten(eintrag, id);
      if (danach !== eintrag) {
        geaendert = true;
      }
      return danach;
    });
    return geaendert ? neu : daten;
  }
  if (kopf === 'faehigkeit' && istSatz(daten)) {
    if (art === 'faehigkeit' && daten.id === id) {
      return modus === 'entfernen' ? daten : mitArchiv(daten, modus);
    }
    if (art === 'knoten' && modus === 'entfernen') {
      return faehigkeitOhneKnoten(daten, id);
    }
  }
  if (kopf === 'projekt' && istSatz(daten)) {
    if (art === 'projekt' && istSatz(daten.projekt) && daten.projekt.id === id && modus !== 'entfernen') {
      const projekt = mitArchiv(daten.projekt, modus);
      return projekt === daten.projekt ? daten : { ...daten, projekt };
    }
    if (art === 'vorhaben' && modus === 'entfernen') {
      return feld(daten, 'vorhaben', id, modus) ?? daten;
    }
  }
  if (kopf === 'laufendes' && art === 'vorhaben' && modus === 'entfernen' && istSatz(daten)) {
    const vorhaben = feld(daten, 'vorhaben', id, modus);
    const basis = vorhaben ?? daten;
    const bosse = feld(basis, 'bosse', id, modus);
    return bosse ?? vorhaben ?? daten;
  }
  if (kopf === 'eintraege' && art === 'eintrag' && modus === 'entfernen' && istSatz(daten) && Array.isArray(daten.pages)) {
    let geaendert = false;
    const pages = daten.pages.map((seite) => {
      const eintraege = seite.eintraege.filter((eintrag) => !(eintrag.typ === 'eintrag' && eintrag.eintrag?.id === id));
      if (eintraege.length === seite.eintraege.length) {
        return seite;
      }
      geaendert = true;
      return { ...seite, eintraege };
    });
    return geaendert ? { ...daten, pages } : daten;
  }
  if (kopf === 'verbindungen' && istSatz(daten)) {
    if (art === 'kalender' && modus === 'entfernen') {
      return feld(daten, 'kalender', id, modus) ?? daten;
    }
    if (art === 'todoist' && modus === 'entfernen' && daten.todoist?.verbunden) {
      return {
        ...daten,
        todoist: {
          ...daten.todoist,
          verbunden: false,
          nutzer: null,
          projekte: [],
          labels: [],
          ohneZuordnung: 'keine',
          standardVorlageId: null,
        },
      };
    }
  }
  if (kopf === 'konten' && art === 'konto' && modus === 'entfernen') {
    return listeVon(daten, id, modus);
  }
  if (kopf === 'projektauswahl' && art === 'projekt' && modus === 'entfernen') {
    return listeVon(daten, id, modus);
  }
  return daten;
}

export function fuegeAktivesAttribut(daten: unknown, attribut: { id: number; typ: string }): unknown {
  if (!istSatz(daten)) {
    return daten;
  }
  const name = attribut.typ === 'status' ? 'status' : 'attribute';
  const liste = daten[name];
  if (!Array.isArray(liste) || liste.some((eintrag) => eintrag.id === attribut.id)) {
    return daten;
  }
  return { ...daten, [name]: [...liste, attribut] };
}

export function wendeAlle(client: QueryClient, art: SchnellArt, id: number, modus: CacheModus): void {
  for (const [key, daten] of client.getQueriesData({ predicate: () => true })) {
    const neu = wendeQuery(key, daten, art, id, modus);
    if (neu !== daten) {
      client.setQueryData(key, neu);
    }
  }
  if (art !== 'attribut' || modus !== 'wiederherstellen') {
    return;
  }
  const liste = client.getQueryData<{ id: number; typ: string; archiviert: boolean }[]>(['attribute']);
  const attribut = liste?.find((eintrag) => eintrag.id === id && !eintrag.archiviert);
  if (!attribut) {
    return;
  }
  for (const key of [['charakter'], ['uebersicht']] as const) {
    client.setQueryData(key, (alt) => fuegeAktivesAttribut(alt, attribut));
  }
}
