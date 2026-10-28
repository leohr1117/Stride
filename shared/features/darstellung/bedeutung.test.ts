import { describe, expect, it } from 'vitest';
import { kontrast } from '../../spiel/farben.ts';
import { bedeutungsfarben } from './bedeutung.ts';

const HELL_FLAECHEN = ['#f2f2f2', '#ffffff', '#ebebeb'] as const;
const DUNKEL_FLAECHEN = ['#141414', '#1c1c1c', '#262626'] as const;

describe('bedeutungsfarben', () => {
  it('setzt Blau für Fortschritt und Orange für den Streak, unabhängig vom Akzent', () => {
    const hell = bedeutungsfarben('light');
    const dunkel = bedeutungsfarben('dark');
    expect(hell.fortschritt).toBe('#1d4ed8');
    expect(hell.schalterAn).toBe('#1d4ed8');
    expect(hell.streak).toBe('#b93c0b');
    expect(dunkel.fortschritt).toBe('#60a5fa');
    expect(dunkel.schalterAn).toBe('#60a5fa');
    expect(dunkel.streak).toBe('#fb923c');
    expect(dunkel.streak).not.toBe('#8a8a8a');
    expect(dunkel.fortschritt).not.toBe('#8a8a8a');
    expect(hell.schalterKnopfAn).toBe('#ffffff');
    expect(dunkel.schalterKnopfAn).toBe('#141414');
  });

  it('hält Schalterknopf gegen Bahn und die Textfarben über dem Mindestkontrast', () => {
    const hell = bedeutungsfarben('light');
    const dunkel = bedeutungsfarben('dark');
    expect(kontrast(hell.schalterKnopfAn, hell.schalterAn)).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell.schalterKnopfAus, hell.schalterAus)).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell.schalterAn, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.schalterKnopfAn, dunkel.schalterAn)).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.schalterKnopfAus, dunkel.schalterAus)).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.schalterAn, '#1c1c1c')).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell.fortschritt, '#ebebeb')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.fortschritt, '#262626')).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell.gefahrText, hell.gefahr)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel.gefahrText, dunkel.gefahr)).toBeGreaterThanOrEqual(4.5);
    for (const flaeche of HELL_FLAECHEN) {
      expect(kontrast(hell.streak, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(hell.gefahr, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(hell.erfolg, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(hell.fortschritt, flaeche)).toBeGreaterThanOrEqual(4.5);
    }
    for (const flaeche of DUNKEL_FLAECHEN) {
      expect(kontrast(dunkel.streak, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(dunkel.gefahr, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(dunkel.erfolg, flaeche)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(dunkel.fortschritt, flaeche)).toBeGreaterThanOrEqual(4.5);
    }
    expect(kontrast(hell.fokus, '#f2f2f2')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.fokus, '#141414')).toBeGreaterThanOrEqual(3);
  });
});
