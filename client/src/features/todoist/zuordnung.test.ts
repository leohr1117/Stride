import { describe, expect, it } from 'vitest';
import type { TodoistLabel } from '../../../../shared/api/index.ts';
import type { ZielBlick } from '../../todoistZiel.ts';
import {
  erbeName,
  labelAnzeige,
  labelDaten,
  labelWirkt,
  mitVorlage,
  projektAnzeige,
  projektDaten,
  projektSchalterAnzeige,
  standAusLabel,
  standardAnzeige,
  standardDaten,
  verschiebe,
  zaehlOptionen,
  zielSetzen,
  type ZuordnungsStand,
} from './zuordnung.ts';

function stand(teil: Partial<ZuordnungsStand> = {}): ZuordnungsStand {
  return {
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId: null,
    stunden: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    notiz: '',
    meilenstein: false,
    ...teil,
  };
}

function blick(): ZielBlick {
  return {
    projekte: [{ id: 2, name: 'Lesen', visionId: null, organisationId: null, aktiv: true }],
    vorhaben: [],
    visionen: [],
    organisationen: [],
  };
}

function label(teil: Partial<TodoistLabel> = {}): TodoistLabel {
  return {
    todoistId: 'l',
    name: 'Lesen',
    aktiv: false,
    rang: 0,
    zielArt: null,
    zielId: null,
    projektId: null,
    vorlageId: 4,
    stunden: 1,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: 'alt',
    notiz: '',
    meilenstein: true,
    ...teil,
  };
}

describe('zuordnung', () => {
  it('speichert Zählt nicht als keine Tätigkeit', () => {
    expect(standardDaten(null)).toEqual({ art: 'keine', vorlageId: null });
    expect(standardDaten(3)).toEqual({ art: 'standard', vorlageId: 3 });
  });

  it('löscht eine stehende Tätigkeit, wenn die Zeile den Standard erbt', () => {
    const vorher = stand({ vorlageId: 4, stunden: 2, notiz: 'bleibt' });
    const danach = mitVorlage(vorher, null);
    expect(danach.vorlageId).toBeNull();
    expect(danach.stunden).toBe(2);
    expect(danach.notiz).toBe('bleibt');
    expect(projektDaten(danach).vorlageId).toBeNull();
  });

  it('zeigt die eigene Tätigkeit farbig und den Standard grau', () => {
    const standard = standardAnzeige('keine', null, null);
    expect(standard).toEqual({ text: 'Zählt nicht', eigene: false });
    expect(projektAnzeige(null, null, standard)).toEqual({ text: 'Zählt nicht', eigene: false });
    expect(projektAnzeige(3, 'Lesen', standard)).toEqual({ text: 'Lesen', eigene: true });
    expect(erbeName(standard)).toBe('Zählt nicht');
    expect(erbeName({ text: 'Lesen', eigene: true })).toBe('Standard · Lesen');
    expect(standardAnzeige('standard', 3, 'Lesen')).toEqual({ text: 'Lesen', eigene: true });
    const geerbt = { text: 'Lesen', eigene: true };
    expect(projektSchalterAnzeige(false, 3, 'Lesen', geerbt)).toEqual({ text: 'Zählt nicht', eigene: false });
    expect(projektSchalterAnzeige(true, null, null, geerbt)).toEqual({ text: 'Lesen', eigene: false });
  });

  it('lässt den Schalter unabhängig von der Tätigkeit', () => {
    const aus = labelDaten(stand({ vorlageId: 3 }), false);
    expect(aus.aktiv).toBe(false);
    expect(aus.vorlageId).toBe(3);
    expect(labelDaten(stand(), false).aktiv).toBe(false);
    expect(labelDaten(stand({ vorlageId: 3 }), true).aktiv).toBe(true);
    expect(labelWirkt(label({ aktiv: false, stunden: 2 }))).toBe(false);
    expect(labelAnzeige(false, 4, 'Lesen')).toEqual({ text: 'Zählt nicht', eigene: false });
    expect(labelAnzeige(true, null, null)).toEqual({ text: 'Wie Projekt', eigene: false });
    expect(standAusLabel(label()).vorlageId).toBe(4);
  });

  it('gruppiert Tätigkeiten und verschiebt nur innerhalb der Liste', () => {
    const optionen = zaehlOptionen('Wie Projekt', [
      { id: 1, name: 'Lesen', projektId: null },
      { id: 2, name: 'Sport', projektId: 9 },
    ], 9, 'Haus', null);
    expect(optionen.map((option) => option.name)).toEqual(['Wie Projekt', 'Für alle Projekte', 'Lesen', 'Nur für Haus', 'Sport']);
    expect(optionen.find((option) => option.name === 'Für alle Projekte')?.waehlbar).toBe(false);
    expect(verschiebe(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(verschiebe(['a', 'b'], 'a', -1)).toBeNull();
    expect(verschiebe(['a', 'b'], 'b', 1)).toBeNull();
  });

  it('behält eine allgemeine Tätigkeit ohne Ziel und verwirft eine gebundene', () => {
    const taetigkeiten = [
      { id: 3, projektId: null },
      { id: 5, projektId: 2 },
    ];
    const allgemein = zielSetzen(stand({ vorlageId: 3, zielArt: 'projekt', zielId: 2, projektId: 2 }), null, taetigkeiten, blick());
    expect(allgemein.vorlageId).toBe(3);
    expect(allgemein.projektId).toBeNull();
    const gebunden = zielSetzen(stand({ vorlageId: 5, zielArt: 'projekt', zielId: 2, projektId: 2 }), null, taetigkeiten, blick());
    expect(gebunden.vorlageId).toBeNull();
  });
});
