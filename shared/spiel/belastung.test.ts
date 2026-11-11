import { describe, expect, it } from 'vitest';
import {
  abzugNebenNamen,
  abzugXp,
  erschoepfungsBild,
  erschoepfungsFaktor,
  verfallAlsText,
  verfallAusText,
  zeitverfallXp,
} from './belastung.ts';

describe('abzugXp', () => {
  it('nimmt den Prozentanteil der Grund-XP', () => {
    expect(abzugXp(40, 30, 1000)).toBe(12);
    expect(abzugXp(10, 33, 1000)).toBe(3);
  });

  it('kappt bei 0 und bei der vorhandenen XP', () => {
    expect(abzugXp(40, 30, 0)).toBe(0);
    expect(abzugXp(40, 30, -5)).toBe(0);
    expect(abzugXp(40, 30, 5)).toBe(5);
    expect(abzugXp(0, 30, 100)).toBe(0);
    expect(abzugXp(-8, 30, 100)).toBe(0);
  });
});

describe('verfallAusText', () => {
  it('liest die heutigen Prozentwerte als Stufe und 0 als Aus', () => {
    expect(verfallAlsText('zeit', 'leicht')).toBe('5');
    expect(verfallAlsText('zeit', 'mittel')).toBe('10');
    expect(verfallAlsText('zeit', 'stark')).toBe('25');
    expect(verfallAusText('zeit', '20')).toBeNull();
    expect(verfallAusText('zeit', '25')).toBe('stark');
    expect(verfallAusText('zeit', '0')).toBe('aus');
    expect(verfallAusText('zeit', '')).toBe('aus');
    expect(verfallAusText('zeit', '7')).toBeNull();
  });
});

describe('zeitverfallXp', () => {
  it('kostet pro inaktivem Tag einen Anteil eines Levels', () => {
    expect(zeitverfallXp(3, 100, 10000, 'mittel')).toBe(30);
    expect(zeitverfallXp(3, 100, 10000, 'aus')).toBe(0);
    expect(zeitverfallXp(0, 100, 10000, 'stark')).toBe(0);
  });

  it('zieht nie mehr ab als vorhanden ist', () => {
    expect(zeitverfallXp(50, 100, 120, 'stark')).toBe(120);
  });
});

describe('erschoepfungsFaktor', () => {
  it('ist neutral, solange Geist mindestens die Hälfte des höchsten Könnens hat', () => {
    expect(erschoepfungsFaktor(50, 100)).toBe(1);
    expect(erschoepfungsFaktor(120, 100)).toBe(1);
  });

  it('senkt die XP bei zu geringem Geist um bis zu 15 Prozent', () => {
    expect(erschoepfungsFaktor(25, 100)).toBe(0.93);
    expect(erschoepfungsFaktor(0, 100)).toBe(0.85);
  });

  it('greift erst ab einem gewissen Fortschritt', () => {
    expect(erschoepfungsFaktor(1, 9)).toBe(1);
  });
});

describe('erschoepfungsBild', () => {
  it('fasst mehrere Ursachen zu je einem Abzug zusammen', () => {
    const bild = erschoepfungsBild([
      { quelleId: 1, zielId: null, faktor: 0.9 },
      { quelleId: 2, zielId: null, faktor: 0.8 },
      { quelleId: 3, zielId: 10, faktor: 0.9 },
      { quelleId: 4, zielId: 10, faktor: 0.8 },
      { quelleId: 5, zielId: 11, faktor: 0.5 },
      { quelleId: 6, zielId: null, faktor: 1 },
    ]);
    const allgemein = Math.round((1 - 0.9 * 0.8) * 100);
    const aufZiel = Math.round((1 - 0.9 * 0.8) * 100);
    expect(bild.allgemein).toBe(allgemein);
    expect(bild.jeZiel).toEqual([
      { zielId: 10, prozent: aufZiel },
      { zielId: 11, prozent: 50 },
    ]);
    expect(bild.ursachen).toEqual([1, 2, 3, 4, 5]);
    expect(abzugNebenNamen(bild, 10)).toBe(aufZiel);
    expect(abzugNebenNamen(bild, 11)).toBe(50);
    expect(abzugNebenNamen(bild, 99)).toBeNull();
    expect(abzugNebenNamen(bild, 1)).toBeNull();
  });
});
