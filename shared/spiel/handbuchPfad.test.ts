import { describe, expect, it } from 'vitest';
import { ebenenFuerStufe } from './ebenen.ts';
import { funktionenFuerStufe, standardFunktionen } from './funktionen.ts';
import {
  startZielArt,
  willkommensZeilen,
  type PfadStand,
} from '../features/handbuch/handbuchPfad.ts';

function naechsterSchritt(wert: PfadStand): string | null {
  const offen = willkommensZeilen(wert).find((zeile) => !zeile.erledigt);
  return offen ? `start:${offen.schluessel}` : null;
}

function stand(teil: Partial<PfadStand> = {}): PfadStand {
  const stufe = teil.stufe ?? 'traeumer';
  return {
    taetigkeiten: 0,
    visionen: 0,
    projekte: 0,
    vorhaben: 0,
    faehigkeiten: 0,
    eintraege: 0,
    stufe,
    funktionen: { ...standardFunktionen(), ...funktionenFuerStufe(stufe) },
    ebenen: ebenenFuerStufe(stufe),
    ...teil,
  };
}

describe('offene Willkommenszeile', () => {
  it('führt ohne Tätigkeit zur Tätigkeit, sonst über das Ziel zum Eintrag', () => {
    expect(naechsterSchritt(stand())).toBe('start:ersteTaetigkeit');
    expect(naechsterSchritt(stand({ taetigkeiten: 1 }))).toBe('start:ziel');
    expect(naechsterSchritt(stand({ eintraege: 1 }))).toBe('start:ersteTaetigkeit');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'macher', projekte: 1 }))).toBe('start:eintrag');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'bodenstaendig', visionen: 4, vorhaben: 1 }))).toBe(
      'start:ziel',
    );
    expect(
      naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'bodenstaendig', visionen: 4, projekte: 1, vorhaben: 1 })),
    ).toBe('start:eintrag');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, visionen: 1, eintraege: 1 }))).toBeNull();
    expect(naechsterSchritt(stand({ visionen: 1, eintraege: 1 }))).toBe('start:ersteTaetigkeit');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'uebung' }))).toBe('start:faehigkeit');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'uebung', faehigkeiten: 1 }))).toBe('start:eintrag');
    expect(naechsterSchritt(stand({ taetigkeiten: 1, stufe: 'einfach' }))).toBe('start:eintrag');
    expect(naechsterSchritt(stand({ stufe: 'einfach' }))).toBe('start:ersteTaetigkeit');
  });

  it('nimmt die aktiven Ziel-Stufen, nicht die gespeicherte Stufe', () => {
    expect(
      naechsterSchritt(
        stand({
          taetigkeiten: 1,
          stufe: 'traeumer',
          ebenen: ebenenFuerStufe('bodenstaendig'),
        }),
      ),
    ).toBe('start:ziel');
    expect(
      naechsterSchritt(
        stand({
          taetigkeiten: 1,
          stufe: 'traeumer',
          ebenen: ebenenFuerStufe('einfach'),
        }),
      ),
    ).toBe('start:eintrag');
    expect(
      naechsterSchritt(
        stand({
          taetigkeiten: 1,
          stufe: 'einfach',
          ebenen: ebenenFuerStufe('macher'),
        }),
      ),
    ).toBe('start:ziel');
  });

  it('ist fertig, wenn Tätigkeit, Ziel und Eintrag da sind, auch wenn fast alles aus ist', () => {
    expect(
      naechsterSchritt(
        stand({
          taetigkeiten: 1,
          visionen: 1,
          eintraege: 1,
          ebenen: { visionen: true, organisationen: false, projekte: false, vorhaben: false },
        }),
      ),
    ).toBeNull();
  });
});

describe('willkommensZeilen', () => {
  it('zeigt das angelegte Ziel mit Haken und den Eintrag nur bei einer Tätigkeit', () => {
    expect(willkommensZeilen(stand({ taetigkeiten: 2, stufe: 'macher', projekte: 1 }))).toEqual([
      { schluessel: 'ziel', art: 'projekte', erledigt: true },
      { schluessel: 'eintrag', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ stufe: 'macher' }))).toEqual([
      { schluessel: 'ersteTaetigkeit', erledigt: false },
      { schluessel: 'ziel', art: 'projekte', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ taetigkeiten: 1, stufe: 'einfach' }))).toEqual([
      { schluessel: 'eintrag', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ stufe: 'traeumer' }))).toEqual([
      { schluessel: 'ersteTaetigkeit', erledigt: false },
      { schluessel: 'ziel', art: 'visionen', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ taetigkeiten: 1, stufe: 'uebung', faehigkeiten: 1, eintraege: 1 }))).toEqual([
      { schluessel: 'faehigkeit', erledigt: true },
      { schluessel: 'eintrag', erledigt: true },
    ]);
    expect(
      willkommensZeilen(
        stand({
          taetigkeiten: 1,
          ebenen: { visionen: false, organisationen: false, projekte: false, vorhaben: true },
          funktionen: { ...standardFunktionen(), ...funktionenFuerStufe('bodenstaendig') },
        }),
      ),
    ).toEqual([
      { schluessel: 'ziel', art: 'vorhaben', erledigt: false },
      { schluessel: 'eintrag', erledigt: false },
    ]);
  });
});

describe('startZielArt', () => {
  it('folgt der höchsten aktiven Ziel-Stufe, sonst der Fähigkeit', () => {
    expect(startZielArt(ebenenFuerStufe('traeumer'), standardFunktionen())).toBe('visionen');
    expect(startZielArt(ebenenFuerStufe('macher'), standardFunktionen())).toBe('projekte');
    expect(startZielArt(ebenenFuerStufe('bodenstaendig'), standardFunktionen())).toBe('projekte');
    expect(startZielArt(ebenenFuerStufe('uebung'), { ...standardFunktionen(), faehigkeiten: true })).toBe('faehigkeit');
    expect(startZielArt(ebenenFuerStufe('einfach'), standardFunktionen())).toBeNull();
  });
});
