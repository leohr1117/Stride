import { describe, expect, it } from 'vitest';
import { istHexFarbe, kontrast, lesbareFarbe, lesbareSchrift, MINDEST_KONTRAST, schriftAuf } from './farben.ts';

const HELL = ['#f7f7f8', '#ffffff'];
const DUNKEL = ['#0e0e12', '#16161c'];

function bleibtLesbar(farbe: string, hintergruende: readonly string[]): void {
  const lesbar = lesbareFarbe(farbe, hintergruende);
  for (const hintergrund of hintergruende) {
    expect(kontrast(lesbar, hintergrund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  }
  expect(kontrast(lesbar, schriftAuf(lesbar))).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
}

describe('farben', () => {
  it('erkennt nur volle Hex-Farben', () => {
    expect(istHexFarbe('#6d5efc')).toBe(true);
    expect(istHexFarbe('#AABBCC')).toBe(true);
    expect(istHexFarbe('#fff')).toBe(false);
    expect(istHexFarbe('rot')).toBe(false);
  });

  it('hält kräftige Farben auf hellem und dunklem Grund lesbar', () => {
    bleibtLesbar('#6d5efc', HELL);
    bleibtLesbar('#8b7dff', DUNKEL);
    bleibtLesbar('#d99a16', HELL);
    bleibtLesbar('#f5b942', DUNKEL);
  });

  it('schiebt extreme Farben in einen lesbaren Bereich', () => {
    bleibtLesbar('#ffff00', HELL);
    bleibtLesbar('#101820', DUNKEL);
    bleibtLesbar('#ffffff', HELL);
    bleibtLesbar('#000000', DUNKEL);
  });

  it('wählt die Schrift nach dem besseren Kontrast', () => {
    expect(kontrast(lesbareSchrift(['#ffffff']), '#ffffff')).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(lesbareSchrift(['#0e0e12']), '#0e0e12')).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(lesbareSchrift(['#808080']), '#808080')).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  });
});
