import { describe, expect, it } from 'vitest';
import { taetigkeitPasst, taetigkeitenFuerProjekt, type TaetigkeitZuordnung } from './taetigkeit.ts';

const vorlagen: TaetigkeitZuordnung[] = [
  { id: 1, projektId: null, archiviert: false },
  { id: 2, projektId: 4, archiviert: false },
  { id: 3, projektId: 5, archiviert: false },
  { id: 4, projektId: 4, archiviert: true },
];

describe('taetigkeitPasst', () => {
  it('lässt allgemeine Tätigkeiten überall und gebundene nur im eigenen Projekt', () => {
    expect(taetigkeitPasst(null, null)).toBe(true);
    expect(taetigkeitPasst(null, 4)).toBe(true);
    expect(taetigkeitPasst(4, 4)).toBe(true);
    expect(taetigkeitPasst(4, null)).toBe(false);
    expect(taetigkeitPasst(4, 5)).toBe(false);
  });
});

describe('taetigkeitenFuerProjekt', () => {
  it('zeigt ohne Projekt nur allgemeine Tätigkeiten', () => {
    expect(taetigkeitenFuerProjekt(vorlagen, null).map((vorlage) => vorlage.id)).toEqual([1]);
  });

  it('zeigt im Projekt allgemeine und eigene Tätigkeiten', () => {
    expect(taetigkeitenFuerProjekt(vorlagen, 4).map((vorlage) => vorlage.id)).toEqual([1, 2]);
    expect(taetigkeitenFuerProjekt(vorlagen, 5).map((vorlage) => vorlage.id)).toEqual([1, 3]);
  });

  it('behält eine archivierte Tätigkeit nur, wenn sie schon gewählt ist', () => {
    expect(taetigkeitenFuerProjekt(vorlagen, 4, 4).map((vorlage) => vorlage.id)).toEqual([1, 2, 4]);
    expect(taetigkeitenFuerProjekt(vorlagen, null, 4).map((vorlage) => vorlage.id)).toEqual([1]);
  });
});
