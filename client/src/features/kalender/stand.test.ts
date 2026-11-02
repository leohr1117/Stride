import { describe, expect, it } from 'vitest';
import {
  kalenderAnzeige,
  kalenderOptionen,
  letzterAbgleich,
  passendeVorlage,
  vorlageIdAusWahl,
  zeigeProjektArchiviert,
} from './stand.ts';

const allgemein = { id: 1, name: 'Lesen', projektId: null };
const gebunden = { id: 2, name: 'Code', projektId: 7 };
const fremd = { id: 3, name: 'Haus', projektId: 8 };

describe('kalenderAnzeige', () => {
  it('zeigt die eigene Tätigkeit, sonst den Standard des Projekts', () => {
    expect(
      kalenderAnzeige({ vorlageId: 1, vorlageName: 'Lesen', projektId: null, standardName: null }),
    ).toEqual({ text: 'Lesen', eigene: true });
    expect(
      kalenderAnzeige({ vorlageId: null, vorlageName: null, projektId: 7, standardName: 'Lesen' }),
    ).toEqual({ text: 'Lesen', eigene: false });
    expect(
      kalenderAnzeige({ vorlageId: null, vorlageName: null, projektId: 7, standardName: null }),
    ).toEqual({ text: 'Standard des Projekts', eigene: false });
    expect(
      kalenderAnzeige({ vorlageId: null, vorlageName: null, projektId: null, standardName: null }).text,
    ).toBe('Zählt als');
  });
});

describe('kalenderOptionen', () => {
  it('lässt ohne Projekt nur allgemeine Tätigkeiten zu', () => {
    const optionen = kalenderOptionen([allgemein, gebunden, fremd], null, null);
    expect(optionen.map((option) => option.wert)).toEqual(['gruppe-alle', '1']);
    expect(optionen.some((option) => option.name === 'Standard des Projekts')).toBe(false);
    expect(optionen.some((option) => option.wert === '2')).toBe(false);
  });

  it('zeigt mit Projekt den Standard und die gebundenen Tätigkeiten', () => {
    const optionen = kalenderOptionen([allgemein, gebunden, fremd], 7, 'Arbeit');
    expect(optionen.map((option) => option.wert)).toEqual(['', 'gruppe-alle', '1', 'gruppe-nur', '2']);
    expect(optionen.find((option) => option.wert === 'gruppe-nur')?.name).toBe('Nur für Arbeit');
    expect(optionen.some((option) => option.wert === '3')).toBe(false);
  });
});

describe('passendeVorlage', () => {
  const liste = [allgemein, gebunden];

  it('behält eine allgemeine Tätigkeit ohne Projekt', () => {
    expect(passendeVorlage(liste, 1, null)).toBe(1);
  });

  it('verwirft eine gebundene Tätigkeit ohne ihr Projekt', () => {
    expect(passendeVorlage(liste, 2, null)).toBeNull();
    expect(passendeVorlage(liste, 2, 8)).toBeNull();
    expect(passendeVorlage(liste, 2, 7)).toBe(2);
  });
});

describe('vorlageIdAusWahl', () => {
  it('liest nur eine Tätigkeits-Id', () => {
    expect(vorlageIdAusWahl('')).toBeNull();
    expect(vorlageIdAusWahl('gruppe-alle')).toBeNull();
    expect(vorlageIdAusWahl('4')).toBe(4);
  });
});

describe('zeigeProjektArchiviert', () => {
  it('gilt nur bei gesetzter Projekt-Id, die nicht aktiv ist', () => {
    expect(zeigeProjektArchiviert(null, null)).toBe(false);
    expect(zeigeProjektArchiviert(null, false)).toBe(false);
    expect(zeigeProjektArchiviert(5, true)).toBe(false);
    expect(zeigeProjektArchiviert(5, false)).toBe(true);
    expect(zeigeProjektArchiviert(5, null)).toBe(true);
  });
});

describe('letzterAbgleich', () => {
  it('nimmt den jüngsten Zeitpunkt', () => {
    expect(letzterAbgleich([null, '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'])).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    expect(letzterAbgleich([null])).toBeNull();
  });
});
