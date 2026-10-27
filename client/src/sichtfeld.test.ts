import { describe, expect, it } from 'vitest';
import { sichtMasse } from './sichtfeld.ts';

describe('sichtMasse', () => {
  it('sieht auf dem Desktop keine Tastatur', () => {
    expect(sichtMasse(900, 0, 900)).toEqual({ oben: 0, hoehe: 900, tastatur: 0 });
  });

  it('rechnet die Tastatur aus der sichtbaren Höhe', () => {
    expect(sichtMasse(844, 0, 500)).toEqual({ oben: 0, hoehe: 500, tastatur: 344 });
  });

  it('zieht den Versatz der sichtbaren Fläche ab', () => {
    expect(sichtMasse(844, 80, 460)).toEqual({ oben: 80, hoehe: 460, tastatur: 304 });
  });

  it('lässt Browser-Leisten aus und wird nicht negativ', () => {
    expect(sichtMasse(844, 0, 780).tastatur).toBe(0);
    expect(sichtMasse(800, 0, 900).tastatur).toBe(0);
  });
});
