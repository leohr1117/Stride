import type { Uebung, UebungDaten } from '../../../shared/api/training.ts';
import {
  ART_GENUTZT,
  UEBUNG_ART_KONFLIKT,
  UEBUNG_SCHON_DA,
  type UebungsArt,
} from '../../../shared/spiel/training.ts';
import { alle, ausfuehren, eine } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { loeschbareMenge, loescheUebung as loescheUebungsZeile } from '../../services/loeschen.ts';
import { pruefeArt, pruefeName } from './vorgabe.ts';

export type UebungAenderung = Partial<UebungDaten> & { archiviert?: boolean };

interface UebungZeile {
  id: number;
  name: string;
  art: string;
  archiviert: number;
}

const UEBUNG_ABFRAGE = 'SELECT id, name, art, archiviert FROM uebungen';

function nurArchiv(aenderung: UebungAenderung): boolean {
  const schluessel = Object.entries(aenderung)
    .filter((eintrag) => eintrag[1] !== undefined)
    .map((eintrag) => eintrag[0]);
  return schluessel.length > 0 && schluessel.every((name) => name === 'archiviert');
}

function zuUebung(zeile: UebungZeile, loeschbar: ReadonlySet<number>): Uebung {
  return {
    id: zeile.id,
    name: zeile.name,
    art: pruefeArt(zeile.art),
    archiviert: zeile.archiviert === 1,
    loeschbar: loeschbar.has(zeile.id),
  };
}

function ladeZeile(id: number): UebungZeile {
  const zeile = eine<UebungZeile>(`${UEBUNG_ABFRAGE} WHERE id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Übung');
  }
  return zeile;
}

export function liefereUebung(id: number): Uebung {
  return zuUebung(ladeZeile(id), loeschbareMenge('uebung'));
}

function gleicheArt(name: string): { id: number; art: string } | undefined {
  return eine<{ id: number; art: string }>('SELECT id, art FROM uebungen WHERE name = ?', name);
}

export function uebungFuerEintrag(name: string, art: UebungsArt): number {
  const sauber = pruefeName(name);
  const vorhanden = gleicheArt(sauber);
  if (!vorhanden) {
    return ausfuehren('INSERT INTO uebungen (name, art) VALUES (?, ?)', sauber, art).id;
  }
  if (vorhanden.art !== art) {
    throw ungueltig(UEBUNG_ART_KONFLIKT);
  }
  return vorhanden.id;
}

export function ladeUebungen(archiv = false): Uebung[] {
  const loeschbar = loeschbareMenge('uebung');
  return alle<UebungZeile>(`${UEBUNG_ABFRAGE} WHERE archiviert = ? ORDER BY name COLLATE NOCASE, id`, Number(archiv)).map(
    (zeile) => zuUebung(zeile, loeschbar),
  );
}

export function erstelleUebung(daten: UebungDaten): Uebung {
  const sauber = pruefeName(daten.name);
  const art = pruefeArt(daten.art);
  const vorhanden = gleicheArt(sauber);
  if (vorhanden) {
    throw ungueltig(vorhanden.art === art ? UEBUNG_SCHON_DA : UEBUNG_ART_KONFLIKT);
  }
  const { id } = ausfuehren('INSERT INTO uebungen (name, art) VALUES (?, ?)', sauber, art);
  return liefereUebung(id);
}

export function aendereUebung(id: number, aenderung: UebungAenderung): Uebung {
  const bisher = ladeZeile(id);
  if (nurArchiv(aenderung)) {
    ausfuehren('UPDATE uebungen SET archiviert = ? WHERE id = ?', Number(aenderung.archiviert), id);
    return liefereUebung(id);
  }
  const name = pruefeName(aenderung.name ?? bisher.name);
  const art = pruefeArt(aenderung.art ?? bisher.art);
  const andere = eine<{ id: number; art: string }>('SELECT id, art FROM uebungen WHERE name = ? AND id <> ?', name, id);
  if (andere) {
    throw ungueltig(andere.art === art ? UEBUNG_SCHON_DA : UEBUNG_ART_KONFLIKT);
  }
  if (art !== bisher.art && !loeschbareMenge('uebung').has(id)) {
    throw ungueltig(ART_GENUTZT);
  }
  ausfuehren(
    'UPDATE uebungen SET name = ?, art = ?, archiviert = ? WHERE id = ?',
    name,
    art,
    Number(aenderung.archiviert ?? bisher.archiviert === 1),
    id,
  );
  return liefereUebung(id);
}

export function loescheUebung(id: number): void {
  loescheUebungsZeile(id);
}
