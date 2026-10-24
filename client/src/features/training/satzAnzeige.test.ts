import { afterEach, describe, expect, it } from 'vitest';
import type { Bestwert } from '../../../../shared/api/training.ts';
import { setzeAktiveSprache } from '../../../../shared/sprache/index.ts';
import { kreisStand, satzText, statusText, zuletztText } from './satzAnzeige.ts';

function bestwert(teil: Partial<Bestwert> & Pick<Bestwert, 'art' | 'wert'>): Bestwert {
  return {
    id: 1,
    wiederholungen: null,
    erreichtAm: '2026-10-21T10:00:00.000Z',
    ...teil,
  };
}

describe('satzAnzeige', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('zeichnet leer, halb und an', () => {
    expect(kreisStand([])).toBe('leer');
    expect(kreisStand([{ erledigt: false }, { erledigt: false }])).toBe('leer');
    expect(kreisStand([{ erledigt: true }, { erledigt: false }])).toBe('halb');
    expect(kreisStand([{ erledigt: true }, { erledigt: true }])).toBe('an');
  });

  it('setzt Gewicht, Wiederholungen und Sekunden in den Satztext', () => {
    expect(satzText({ gewichtG: 40000, wiederholungen: 5, sekunden: null }, 'kraft', 'kg')).toBe('40,0 kg × 5');
    expect(satzText({ gewichtG: 80000, wiederholungen: 5, sekunden: null }, 'kraft', 'lb')).toBe('176,4 lb × 5');
    expect(satzText({ gewichtG: null, wiederholungen: 8, sekunden: null }, 'kraft', 'kg')).toBe('8 Wiederholungen');
    expect(satzText({ gewichtG: null, wiederholungen: null, sekunden: 45 }, 'dauer', 'kg')).toBe('45 s');
    expect(satzText({ gewichtG: 80000, wiederholungen: null, sekunden: null }, 'kraft', 'kg')).toBe('');
  });

  it('nimmt den neuesten Gewichts- oder Dauerwert, nicht die Schätzung', () => {
    const werte = [
      bestwert({ id: 3, art: 'eins', wert: 93333, wiederholungen: 5 }),
      bestwert({ id: 2, art: 'gewicht', wert: 77500, wiederholungen: 5 }),
      bestwert({ id: 1, art: 'gewicht', wert: 80000, wiederholungen: 5 }),
    ];
    expect(zuletztText(werte, 'kraft', 'kg')).toBe('77,5 kg × 5');
    expect(zuletztText(werte, 'kraft', 'lb')).toBe('170,9 lb × 5');
    expect(zuletztText([bestwert({ art: 'dauer', wert: 60 })], 'dauer', 'kg')).toBe('60 s');
    expect(zuletztText([bestwert({ art: 'eins', wert: 80000, wiederholungen: 5 })], 'kraft', 'kg')).toBeNull();
  });

  it('nennt offen, fertig und den Verlauf', () => {
    const start = '2026-10-23T10:00:00.000Z';
    const jetzt = new Date('2026-10-23T10:00:20.000Z');
    const offen = { status: 'offen' as const, begonnenAm: start, beendetAm: null, aenderbar: true };
    expect(statusText(offen, 'kg', jetzt)).toBe('Offen · gerade gestartet');
    expect(statusText(offen, 'lb', jetzt)).toBe('Offen · gerade gestartet · lb');
    const fertig = {
      status: 'fertig' as const,
      begonnenAm: start,
      beendetAm: '2026-10-23T10:45:00.000Z',
      aenderbar: true,
    };
    expect(statusText(fertig, 'kg', jetzt)).toBe('Fertig · 45 Min');
    expect(statusText(fertig, 'lb', jetzt)).toBe('Fertig · 45 Min · lb');
    const verlauf = { ...fertig, aenderbar: false };
    expect(statusText(verlauf, 'kg', new Date('2026-10-24T10:00:00.000Z'))).toMatch(/ · 45 Min · fertig$/);
    setzeAktiveSprache('en');
    expect(statusText(offen, 'kg', jetzt)).toBe('Open · Just started');
  });
});
