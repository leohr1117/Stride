import { describe, expect, it } from 'vitest';
import { berechneLevel, LEVEL_KURVEN } from '../../../../shared/spiel/level.ts';
import {
  betragProblem,
  bisherigerBetrag,
  levelDanach,
  loeschHinweis,
  verfuegbaresXp,
  zahlungVon,
} from './zahlungAnzeige.ts';

const kurve = LEVEL_KURVEN.attribut;

describe('zahlungAnzeige', () => {
  it('verlangt einen Betrag, sobald ein Attribut zahlt', () => {
    expect(betragProblem(false, '', 10)).toBeNull();
    expect(betragProblem(true, '', 10)).toBe('leer');
    expect(betragProblem(true, '0', 10)).toBeNull();
    expect(betragProblem(true, '10', 10)).toBeNull();
    expect(betragProblem(true, '11', 10)).toBe('zuwenig');
  });

  it('rechnet bereits gezahltes XP zur verfügbaren Menge', () => {
    expect(verfuegbaresXp(40, 0)).toBe(40);
    expect(bisherigerBetrag(3, 25, 3)).toBe(25);
    expect(bisherigerBetrag(3, 25, 4)).toBe(0);
    expect(verfuegbaresXp(40, bisherigerBetrag(3, 25, 3))).toBe(65);
    expect(betragProblem(true, '65', 65)).toBeNull();
    expect(betragProblem(true, '66', 65)).toBe('zuwenig');
  });

  it('meldet ein fallendes Level am Stand nach der Zahlung', () => {
    const xp = 101;
    expect(berechneLevel(xp, kurve).level).toBe(3);
    expect(levelDanach(xp, xp - 1, kurve)).toBe(2);
    expect(levelDanach(xp, xp - 10, kurve)).toBe(2);
    expect(levelDanach(120, 110, kurve)).toBeNull();
    expect(levelDanach(70, 70, kurve)).toBeNull();
    expect(levelDanach(70, 70 + 40 - 40, kurve)).toBeNull();
  });

  it('speichert nichts als Zahlung ohne Attribut oder ohne Betrag', () => {
    expect(zahlungVon(null, '20')).toEqual({ bezahltAttributId: null, betrag: 0 });
    expect(zahlungVon(4, '')).toEqual({ bezahltAttributId: null, betrag: 0 });
    expect(zahlungVon(4, '0')).toEqual({ bezahltAttributId: null, betrag: 0 });
    expect(zahlungVon(4, '20')).toEqual({ bezahltAttributId: 4, betrag: 20 });
  });

  it('sagt beim Löschen, wohin das XP zurückgeht', () => {
    expect(loeschHinweis(0, 'Ressourcen')).toBeNull();
    expect(loeschHinweis(200, 'Ressourcen')).toBe('Die 200 XP gehen zurück an Ressourcen.');
  });
});
