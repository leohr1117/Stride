import { describe, expect, it } from 'vitest';
import { farbAnfang, farbLoslassen, farbUebernehmen, farbZiehen } from './features/darstellung/ansichtFarbe.ts';

const anfang = farbAnfang({ primaer: '#111111', akzent: '#222222', hintergrund: '#333333' });

describe('Farbregler', () => {
  it('merkt sich die letzte Farbe erst beim Loslassen', () => {
    const erste = farbZiehen(anfang, 'primaer', '#aaaaaa');
    const zweite = farbZiehen(erste, 'primaer', '#bbbbbb');
    expect(zweite.gespeichert.primaer).toBe('#111111');
    expect(zweite.anzeige.primaer).toBe('#bbbbbb');
    const los = farbLoslassen(zweite);
    expect(los.gespeichert.primaer).toBe('#bbbbbb');
    expect(los.gezogen).toBe(false);
    expect(farbLoslassen(los)).toBe(los);
  });

  it('lässt eine laufende Ziehung nicht von der gespeicherten Farbe überschreiben', () => {
    const gezogen = farbZiehen(anfang, 'akzent', '#cccccc');
    const gehalten = farbUebernehmen(gezogen, { primaer: '#000000', akzent: '#000000', hintergrund: '#000000' });
    expect(gehalten).toBe(gezogen);
    const frei = farbUebernehmen(anfang, { primaer: '#abcdef', akzent: '#222222', hintergrund: '#333333' });
    expect(frei.anzeige.primaer).toBe('#abcdef');
    expect(frei.gezogen).toBe(false);
  });
});
