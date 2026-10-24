import { describe, expect, it } from 'vitest';
import { berechneBaum } from '../features/faehigkeiten/skillbaumLayout.ts';

describe('berechneBaum', () => {
  it('gibt jedem Blatt eine eigene Spalte und zentriert Eltern darüber', () => {
    const layout = berechneBaum([
      { id: 1, elternId: null },
      { id: 2, elternId: 1 },
      { id: 3, elternId: 1 },
      { id: 4, elternId: null },
    ]);
    expect(layout.positionen.get(2)).toEqual({ spalte: 0, ebene: 2 });
    expect(layout.positionen.get(3)).toEqual({ spalte: 1, ebene: 2 });
    expect(layout.positionen.get(1)).toEqual({ spalte: 0.5, ebene: 1 });
    expect(layout.positionen.get(4)).toEqual({ spalte: 2, ebene: 1 });
    expect(layout.wurzel).toEqual({ spalte: 1.25, ebene: 0 });
    expect(layout.spalten).toBe(3);
    expect(layout.ebenen).toBe(3);
  });

  it('hängt Knoten mit fehlendem Elternteil an die Wurzel', () => {
    const layout = berechneBaum([{ id: 7, elternId: 99 }]);
    expect(layout.positionen.get(7)).toEqual({ spalte: 0, ebene: 1 });
    expect(layout.kinder.get(null)).toEqual([7]);
  });
});
