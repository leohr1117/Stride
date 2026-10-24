import { describe, expect, it } from 'vitest';
import { abzugNebenNamen, belastungXp, erschoepfungsBild, erschoepfungsFaktor, istBelastend, zeitverfallXp } from './belastung.ts';

const KOERPER = 1;
const GEIST = 2;

describe('istBelastend', () => {
  it('belastet ein Attribut, wenn die Vorlage es nicht stärkt', () => {
    expect(istBelastend([3, 4], GEIST)).toBe(true);
    expect(istBelastend([KOERPER, 3], GEIST)).toBe(true);
  });

  it('schont ein Attribut, das die Vorlage stärkt', () => {
    expect(istBelastend([GEIST, KOERPER], GEIST)).toBe(false);
  });
});

describe('belastungXp', () => {
  it('kostet je nach Stufe einen Anteil der Eintrags-XP', () => {
    expect(belastungXp(40, 1000, 'mittel')).toBe(4);
    expect(belastungXp(40, 1000, 'stark')).toBe(8);
    expect(belastungXp(40, 1000, 'aus')).toBe(0);
  });

  it('zieht nie mehr ab als vorhanden ist', () => {
    expect(belastungXp(40, 2, 'mittel')).toBe(2);
    expect(belastungXp(40, -5, 'mittel')).toBe(0);
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
