import { afterEach, describe, expect, it } from 'vitest';
import type { Sprache } from '../../shared/sprache/kern.ts';
import { setzeAktiveSprache } from '../../shared/sprache/index.ts';
import { zeigeMenge } from '../../shared/sprache/menge.ts';
import { eineNachkommastelle, hoechstensEineStelle, kompakt, levelZahl, prozentText, stunden, zahl, zeitspanne } from './format.ts';

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
    expect(zeitspanne(1)).toBe('1 Tag');
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

describe('levelZahl', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('schneidet den Anteil im Level ab und rundet nicht auf', () => {
    setzeAktiveSprache('de');
    expect(levelZahl(50.091)).toBe('50');
    expect(levelZahl(32.185)).toBe('32');
    expect(levelZahl(32.9)).toBe('32');
    expect(levelZahl(7917)).toBe('7.917');
    setzeAktiveSprache('en');
    expect(levelZahl(50.091)).toBe('50');
    expect(levelZahl(1200.4)).toBe('1,200');
  });
});

describe('Mengenformen', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  const sprachen: Sprache[] = ['de', 'en', 'es', 'fr', 'ru', 'zh', 'ja'];
  const zahlen = [1, 2, 5, 21] as const;

  const zeit: Record<Sprache, readonly string[]> = {
    de: ['1 Tag', '2 Tage', '5 Tage', '21 Tage'],
    en: ['1 day', '2 days', '5 days', '21 days'],
    es: ['1 día', '2 días', '5 días', '21 días'],
    fr: ['1 jour', '2 jours', '5 jours', '21 jours'],
    ru: ['1 день', '2 дня', '5 дней', '21 день'],
    zh: ['1天', '2天', '5天', '21天'],
    ja: ['1日', '2日', '5日', '21日'],
  };

  const haelt: Record<Sprache, readonly string[]> = {
    de: ['Hält den 1 Tag', 'Hält die 2 Tage', 'Hält die 5 Tage', 'Hält die 21 Tage'],
    en: ['Keeps the 1 day', 'Keeps the 2 days', 'Keeps the 5 days', 'Keeps the 21 days'],
    es: ['Mantiene el 1 día', 'Mantiene los 2 días', 'Mantiene los 5 días', 'Mantiene los 21 días'],
    fr: ['Garde le 1 jour', 'Garde les 2 jours', 'Garde les 5 jours', 'Garde les 21 jours'],
    ru: ['Сохраняет 1 день', 'Сохраняет 2 дня', 'Сохраняет 5 дней', 'Сохраняет 21 день'],
    zh: ['保住 1 天', '保住 2 天', '保住 5 天', '保住 21 天'],
    ja: ['1日を守る', '2日を守る', '5日を守る', '21日を守る'],
  };

  const pause: Record<Sprache, readonly string[]> = {
    de: ['1 Tag · Pause aufgebraucht', '2 Tage · Pause aufgebraucht', '5 Tage · Pause aufgebraucht', '21 Tage · Pause aufgebraucht'],
    en: ['1 day · pause used up', '2 days · pause used up', '5 days · pause used up', '21 days · pause used up'],
    es: ['1 día · pausa agotada', '2 días · pausa agotada', '5 días · pausa agotada', '21 días · pausa agotada'],
    fr: ['1 jour · pause épuisée', '2 jours · pause épuisée', '5 jours · pause épuisée', '21 jours · pause épuisée'],
    ru: ['1 день · пауза исчерпана', '2 дня · пауза исчерпана', '5 дней · пауза исчерпана', '21 день · пауза исчерпана'],
    zh: ['1 天 · 休息已用完', '2 天 · 休息已用完', '5 天 · 休息已用完', '21 天 · 休息已用完'],
    ja: ['1日 · 休みを使い切り', '2日 · 休みを使い切り', '5日 · 休みを使い切り', '21日 · 休みを使い切り'],
  };

  it('beugt Zeitspanne, Schutz und Kette für 1, 2, 5 und 21', () => {
    for (const sprache of sprachen) {
      setzeAktiveSprache(sprache);
      zahlen.forEach((n, index) => {
        expect(zeitspanne(n), `${sprache} zeit ${n}`).toBe(zeit[sprache][index]);
        expect(zeigeMenge(sprache, n, 'Hält die {n} Tage', { n }), `${sprache} schutz ${n}`).toBe(haelt[sprache][index]);
        expect(zeigeMenge(sprache, n, '{n} Tage · Pause aufgebraucht', { n }), `${sprache} pause ${n}`).toBe(pause[sprache][index]);
        expect(zeigeMenge(sprache, n, '{tage} Tage', { tage: n }), `${sprache} kette ${n}`).toBe(zeit[sprache][index]);
      });
    }
  });
});

describe('Gewichtsanzeige', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('zeigt in der Liste immer eine Stelle und im Feld die Null nicht', () => {
    setzeAktiveSprache('de');
    expect(eineNachkommastelle(80)).toBe('80,0');
    expect(eineNachkommastelle(176.4)).toBe('176,4');
    expect(hoechstensEineStelle(80)).toBe('80');
    expect(hoechstensEineStelle(176.4)).toBe('176,4');
    setzeAktiveSprache('en');
    expect(eineNachkommastelle(80)).toBe('80.0');
    expect(eineNachkommastelle(176.4)).toBe('176.4');
    expect(hoechstensEineStelle(80)).toBe('80');
    expect(hoechstensEineStelle(176.4)).toBe('176.4');
  });
});