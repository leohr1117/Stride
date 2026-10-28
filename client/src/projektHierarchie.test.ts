import { describe, expect, it } from 'vitest';
import { gliedereProjekte } from './projektHierarchie.ts';

describe('gliedereProjekte', () => {
  const fit = { id: 1, titel: 'Fit und belastbar', farbe: '#34d399' };
  const lauftreff = { id: 2, name: 'Lauftreff', farbe: '#2dd4bf', visionId: 1 };
  const arbeit = { id: 3, name: 'Arbeit', farbe: '#60a5fa', visionId: null };

  it('legt das Projekt der Organisation unter sie, nicht neben die direkten Projekte', () => {
    const baum = gliedereProjekte(
      [
        { id: 10, name: 'Krafttraining', visionId: 1, organisationId: null },
        { id: 11, name: 'Ausdauer', visionId: 1, organisationId: null },
        { id: 12, name: 'Gruppenläufe', visionId: null, organisationId: 2 },
      ],
      [fit],
      [lauftreff],
      { leereOrganisationen: true },
    );
    expect(baum.visionen[0]?.direkte.map((projekt) => projekt.name)).toEqual(['Krafttraining', 'Ausdauer']);
    expect(baum.visionen[0]?.organisationen.map((gruppe) => gruppe.organisation.name)).toEqual(['Lauftreff']);
    expect(baum.visionen[0]?.organisationen[0]?.projekte.map((projekt) => projekt.name)).toEqual(['Gruppenläufe']);
    expect(baum.lose).toEqual([]);
    expect(baum.freieOrganisationen).toEqual([]);
  });

  it('hält eine Organisation ohne Vision aus der Vision heraus', () => {
    const baum = gliedereProjekte(
      [
        { id: 10, name: 'Krafttraining', visionId: 1, organisationId: null },
        { id: 13, name: 'Kundenprojekt', visionId: null, organisationId: 3 },
      ],
      [fit],
      [lauftreff, arbeit],
      { leereOrganisationen: true },
    );
    expect(baum.visionen[0]?.direkte.map((projekt) => projekt.name)).toEqual(['Krafttraining']);
    expect(baum.visionen[0]?.organisationen.map((gruppe) => gruppe.organisation.name)).toEqual(['Lauftreff']);
    expect(baum.visionen[0]?.organisationen[0]?.projekte).toEqual([]);
    expect(baum.freieOrganisationen.map((gruppe) => gruppe.organisation.name)).toEqual(['Arbeit']);
    expect(baum.freieOrganisationen[0]?.projekte.map((projekt) => projekt.name)).toEqual(['Kundenprojekt']);
  });
});
