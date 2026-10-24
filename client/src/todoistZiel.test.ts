import { describe, expect, it } from 'vitest';
import { projekteFuerVision, vorschauTeile, zielSchluessel, zielVorschlag, type ZielBlick } from './todoistZiel.ts';

function blick(teil: Partial<ZielBlick> = {}): ZielBlick {
  return {
    projekte: [],
    vorhaben: [],
    visionen: [],
    organisationen: [],
    ...teil,
  };
}

describe('todoistZiel', () => {
  it('nimmt bei gleichem Namen zuerst das Projekt, dann das Vorhaben, dann die Vision', () => {
    const daten = blick({
      projekte: [
        { id: 2, name: 'Lesen', visionId: null, organisationId: null, aktiv: true },
        { id: 1, name: 'Alpha', visionId: null, organisationId: null, aktiv: true },
      ],
      vorhaben: [{ id: 8, titel: 'Lesen', projektId: 1, status: 'offen' }],
      visionen: [{ id: 4, titel: 'Lesen' }],
    });
    expect(zielVorschlag('lesen', daten)).toEqual({ zielArt: 'projekt', zielId: 2, projektId: 2 });
    expect(zielVorschlag('Lesen', blick({ vorhaben: daten.vorhaben, visionen: daten.visionen, projekte: [daten.projekte[1]!] }))).toEqual({
      zielArt: 'vorhaben',
      zielId: 8,
      projektId: 1,
    });
  });

  it('fällt auf das erste Ziel zurück und lässt eine Vision ohne Projekt aus', () => {
    const daten = blick({
      visionen: [
        { id: 1, titel: 'Leer' },
        { id: 2, titel: 'Voll' },
      ],
      projekte: [{ id: 9, name: 'Beta', visionId: 2, organisationId: null, aktiv: true }],
    });
    expect(zielVorschlag('Unbekannt', daten)).toEqual({ zielArt: 'projekt', zielId: 9, projektId: 9 });
    expect(zielVorschlag('Leer', daten)?.zielArt).toBe('projekt');
    expect(zielVorschlag('Voll', daten)).toEqual({ zielArt: 'vision', zielId: 2, projektId: 9 });
    expect(zielVorschlag('Nichts', blick())).toBeNull();
  });

  it('zählt Projekte der Organisation zur Vision und sortiert nach Namen', () => {
    const daten = blick({
      organisationen: [{ id: 3, visionId: 7 }],
      projekte: [
        { id: 2, name: 'Zeta', visionId: null, organisationId: 3, aktiv: true },
        { id: 1, name: 'Alpha', visionId: 7, organisationId: null, aktiv: true },
        { id: 4, name: 'Weg', visionId: 7, organisationId: null, aktiv: false },
      ],
    });
    expect(projekteFuerVision(daten, 7).map((projekt) => projekt.id)).toEqual([1, 2]);
    expect(zielSchluessel('vision', 7)).toBe('vision:7');
    expect(zielSchluessel(null, 7)).toBe('');
  });

  it('fügt nur gesetzte Teile mit einem Punkt zusammen', () => {
    expect(vorschauTeile(['Lauf', null, '  ', '1 Std'])).toBe('Lauf · 1 Std');
    expect(vorschauTeile([null, ''])).toBe('');
  });
});
