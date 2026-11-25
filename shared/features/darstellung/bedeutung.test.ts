import { describe, expect, it } from 'vitest';
import { kontrast } from '../../spiel/farben.ts';
import { bedeutungsfarben, hellAbleitungAktiv, HELL_ABLEITUNG } from './bedeutung.ts';

const HELL_FLAECHEN = ['#f2f2f2', '#ffffff', '#ebebeb'] as const;
const DUNKEL_FLAECHEN = ['#141414', '#202020', '#2a2a2a'] as const;

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
    expect(kontrast(dunkel.schalterAn, '#202020')).toBeGreaterThanOrEqual(3);
    expect(kontrast(hell.fortschritt, '#ebebeb')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.fortschritt, '#2a2a2a')).toBeGreaterThanOrEqual(3);
    expect(hell.gefahr).not.toBe('#f87171');
    expect(kontrast(hell.gefahrText, hell.gefahr)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel.gefahrText, dunkel.gefahr)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(hell.gefahr, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel.gefahr, '#141414')).toBeGreaterThanOrEqual(3);
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

  it('nutzt Hell-Ableitungen nur auf Grund und Fläche', () => {
    expect(hellAbleitungAktiv('light', '#f2f2f2', '#ffffff')).toBe(true);
    expect(hellAbleitungAktiv('light', '#F2F2F2', '#FFFFFF')).toBe(true);
    expect(hellAbleitungAktiv('light', '#f2f2f2', '#ebebeb')).toBe(false);
    expect(hellAbleitungAktiv('dark', '#f2f2f2', '#ffffff')).toBe(false);
    expect(HELL_ABLEITUNG.fortschritt).toEqual({ text: '#3a65dd', balken: '#6385e4' });
    expect(HELL_ABLEITUNG.streak).toEqual({ text: '#bd481a', balken: '#cc714d' });
    expect(HELL_ABLEITUNG.gefahr).toEqual({ text: '#ca3737', balken: '#d76666' });
    expect(HELL_ABLEITUNG.erfolg).toEqual({ text: '#377b50', balken: '#5e9573' });
    for (const ton of Object.values(HELL_ABLEITUNG)) {
      expect(kontrast(ton.text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(ton.text, '#f2f2f2')).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(ton.balken, '#ffffff')).toBeGreaterThanOrEqual(3.1);
    }
  });
});
