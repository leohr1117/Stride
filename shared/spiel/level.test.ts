import { describe, expect, it } from 'vitest';
import { berechneLevel, LEVEL_KURVEN, verlustBalken, xpBisLevel, xpFuerAufstieg, type LevelKurve } from './level.ts';

const KURVE: LevelKurve = { basis: 50, zuwachs: 2 };

describe('xpFuerAufstieg', () => {
  it('startet bei der Basis und wächst linear', () => {
    expect(xpFuerAufstieg(1, KURVE)).toBe(50);
    expect(xpFuerAufstieg(2, KURVE)).toBe(52);
    expect(xpFuerAufstieg(11, KURVE)).toBe(70);
  });

  it('steigt mit jedem Level', () => {
    for (let level = 1; level < 50; level++) {
      expect(xpFuerAufstieg(level + 1, KURVE)).toBeGreaterThan(xpFuerAufstieg(level, KURVE));
    }
  });
});

describe('xpBisLevel', () => {
  it('summiert alle Aufstiege bis zum Level', () => {
    expect(xpBisLevel(1, KURVE)).toBe(0);
    expect(xpBisLevel(3, KURVE)).toBe(50 + 52);
    expect(berechneLevel(xpBisLevel(40, KURVE), KURVE).level).toBe(40);
  });
});

describe('berechneLevel', () => {
  it('startet bei Level 1 ohne XP', () => {
    expect(berechneLevel(0, KURVE)).toEqual({
      level: 1,
      xpGesamt: 0,
      xpImLevel: 0,
      xpFuerNaechstes: 50,
      fortschritt: 0,
    });
  });

  it('steigt genau an der Grenze auf', () => {
    expect(berechneLevel(49, KURVE).level).toBe(1);
    expect(berechneLevel(50, KURVE).level).toBe(2);
    expect(berechneLevel(50, KURVE).xpImLevel).toBe(0);
  });

  it('rechnet mehrere Level und den Rest korrekt', () => {
    const info = berechneLevel(xpBisLevel(3, KURVE) + 7, KURVE);
    expect(info.level).toBe(3);
    expect(info.xpImLevel).toBe(7);
    expect(info.xpFuerNaechstes).toBe(xpFuerAufstieg(3, KURVE));
  });

  it('behandelt negative und gebrochene Werte robust', () => {
    expect(berechneLevel(-20, KURVE).level).toBe(1);
    expect(berechneLevel(50.9, KURVE).xpGesamt).toBe(50);
  });

  it('hat kein Maximum, Level über 1000 sind über Jahre erreichbar', () => {
    const zehnJahreSehrAktiv = 400 * 365 * 10;
    const level = berechneLevel(zehnJahreSehrAktiv, LEVEL_KURVEN.charakter).level;
    expect(level).toBeGreaterThan(1000);
    expect(level).toBeLessThan(1300);
    expect(berechneLevel(300 * 70, LEVEL_KURVEN.charakter).level).toBeLessThan(120);
  });
});

describe('verlustBalken', () => {
  it('zeigt keinen Verlust, wenn der höchste Stand der aktuelle ist', () => {
    const balken = verlustBalken(20, 20, KURVE);
    expect(balken.verloreneLevel).toBe(0);
    expect(balken.verlustBis).toBe(balken.stand);
    expect(balken.stand).toBeCloseTo(20 / 50);
  });

  it('zeigt den Verlust im selben Level neben dem Stand', () => {
    const balken = verlustBalken(20, 40, KURVE);
    expect(balken.stand).toBeCloseTo(0.4);
    expect(balken.verlustBis).toBeCloseTo(0.8);
    expect(balken.verloreneLevel).toBe(0);
  });

  it('füllt bei einem verlorenen Level den Balken bis zum Ende', () => {
    const aktuell = xpBisLevel(3, KURVE) + 10;
    const hoechst = xpBisLevel(4, KURVE) + 20;
    const balken = verlustBalken(aktuell, hoechst, KURVE);
    expect(berechneLevel(aktuell, KURVE).level).toBe(3);
    expect(berechneLevel(hoechst, KURVE).level).toBe(4);
    expect(balken.stand).toBeCloseTo(10 / xpFuerAufstieg(3, KURVE));
    expect(balken.verlustBis).toBe(1);
    expect(balken.verloreneLevel).toBe(1);
  });

  it('bleibt bei mehreren verlorenen Leveln im Balken und zählt die Level', () => {
    for (let verloren = 2; verloren <= 8; verloren++) {
      const aktuell = xpBisLevel(2, KURVE) + 5;
      const hoechst = xpBisLevel(2 + verloren, KURVE) + 4;
      const balken = verlustBalken(aktuell, hoechst, KURVE);
      expect(balken.stand).toBeGreaterThanOrEqual(0);
      expect(balken.stand).toBeLessThan(1);
      expect(balken.verlustBis).toBe(1);
      expect(balken.verloreneLevel).toBe(verloren);
    }
  });

  it('behandelt eine Level-Grenze und einen leeren neuen Stand', () => {
    const hoechst = xpBisLevel(5, KURVE);
    const aktuell = xpBisLevel(4, KURVE) + 1;
    const grenze = verlustBalken(aktuell, hoechst, KURVE);
    expect(grenze.verlustBis).toBe(1);
    expect(grenze.verloreneLevel).toBe(1);

    const leer = verlustBalken(0, hoechst, KURVE);
    expect(leer.stand).toBe(0);
    expect(leer.verlustBis).toBe(1);
    expect(leer.verloreneLevel).toBe(berechneLevel(hoechst, KURVE).level - 1);
  });

  it('lässt einen wieder aufgeholten Stand ohne Verlust', () => {
    const balken = verlustBalken(80, 40, KURVE);
    expect(balken.verloreneLevel).toBe(0);
    expect(balken.verlustBis).toBe(balken.stand);
  });
});
