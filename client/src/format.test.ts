import { afterEach, describe, expect, it } from 'vitest';
import { setzeAktiveSprache } from '../../shared/sprache/index.ts';
import { kompakt, prozentText, stunden, zahl, zeitspanne } from './format.ts';

describe('kompakt', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('lässt kleine XP stehen und kürzt große', () => {
    expect(kompakt(150)).toBe('150');
    expect(kompakt(999)).toBe('999');
    expect(kompakt(1000)).toBe('1k');
    expect(kompakt(1200)).toBe('1,2k');
    expect(kompakt(12340)).toBe('12,3k');
  });

  it('nutzt englische Zahlen, wenn Englisch aktiv ist', () => {
    setzeAktiveSprache('en');
    expect(zahl(1200)).toBe('1,200');
    expect(kompakt(1200)).toBe('1.2k');
    expect(stunden(1.5)).toBe('1.5 h');
    expect(prozentText(0.12)).toBe('12%');
  });

  it('beugt Zeitspannen und setzt Prozent nach der Sprache', () => {
    setzeAktiveSprache('de');
    expect(prozentText(0.12)).toBe('12 %');
    expect(zeitspanne(1)).toBe('1 Tage');
    setzeAktiveSprache('fr');
    expect(zeitspanne(1)).toBe('1 jour');
    expect(zeitspanne(3)).toBe('3 jours');
    expect(prozentText(0.12)).toBe('12 %');
    setzeAktiveSprache('ru');
    expect(zeitspanne(1)).toBe('1 день');
    expect(zeitspanne(3)).toBe('3 дня');
    expect(zeitspanne(5)).toBe('5 дней');
    setzeAktiveSprache('zh');
    expect(zeitspanne(3)).toBe('3天');
    expect(prozentText(0.12)).toBe('12%');
    setzeAktiveSprache('ja');
    expect(zeitspanne(400)).toBe('13か月');
    expect(prozentText(0.12)).toBe('12%');
  });
});