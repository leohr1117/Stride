import { describe, expect, it } from 'vitest';
import { dreyfusStufe } from './begriffe.ts';
import { istWoopVollstaendig } from './vision.ts';
import { LEVEL_KURVEN, xpBisLevel } from './level.ts';
import {
  angriffsTage,
  ausruestungsBonus,
  basisDisziplinBonus,
  BOSS,
  bossBeute,
  bossLevelAusKampfXp,
  bossPhase,
  bossRingAnteil,
  eintragXp,
  gesamtFaktor,
  meilensteinBonus,
  skillXp,
} from './xp.ts';

describe('Boss', () => {
  it('greift jeden Tag nach der Deadline an', () => {
    expect(angriffsTage('2026-10-20', null, '2026-10-20')).toBe(0);
    expect(angriffsTage('2026-10-20', null, '2026-10-21')).toBe(1);
    expect(angriffsTage('2026-10-20', null, '2026-10-25')).toBe(5);
  });

  it('rechnet bereits abgerechnete Tage nicht doppelt', () => {
    expect(angriffsTage('2026-10-20', '2026-10-23', '2026-10-25')).toBe(2);
    expect(angriffsTage('2026-10-20', '2026-10-25', '2026-10-25')).toBe(0);
  });

  it('startet nach einer neuen Deadline wieder von vorn', () => {
    expect(angriffsTage('2026-11-01', '2026-10-25', '2026-10-28')).toBe(0);
    expect(angriffsTage('2026-11-01', '2026-10-25', '2026-11-03')).toBe(2);
  });

  it('verdoppelt den Meilenstein-Bonus als Loot und kombiniert mit Comeback', () => {
    expect(meilensteinBonus(200, false, true)).toBe(130);
    expect(meilensteinBonus(200, true, true)).toBe(195);
  });

  it('gibt Beute nach dem aufgedeckten Level', () => {
    expect(bossBeute(null)).toBe(0);
    expect(bossBeute(1)).toBe(0);
    expect(bossBeute(11)).toBe(Math.round(BOSS.beuteAnteil * xpBisLevel(11, LEVEL_KURVEN.charakter)));
    expect(bossBeute(30)).toBeGreaterThan(bossBeute(11));
  });

  it('liest das Level aus der Kampf-XP wie das Charakter-Level', () => {
    expect(bossLevelAusKampfXp(0)).toBe(1);
    expect(bossLevelAusKampfXp(16)).toBe(1);
    expect(bossLevelAusKampfXp(100)).toBe(2);
    expect(bossLevelAusKampfXp(1000)).toBe(10);
    expect(bossLevelAusKampfXp(xpBisLevel(5, LEVEL_KURVEN.charakter))).toBe(5);
    expect(bossLevelAusKampfXp(xpBisLevel(15, LEVEL_KURVEN.charakter))).toBe(15);
    expect(bossLevelAusKampfXp(xpBisLevel(30, LEVEL_KURVEN.charakter))).toBe(30);
  });

  it('trifft dieselbe Stufe wie die SQL-Migration', () => {
    const sql = (xp: number) => Math.trunc((-99 + Math.sqrt(9801 + 4 * xp)) / 2) + 1;
    for (let xp = 0; xp <= 8000; xp += 1) {
      expect(sql(xp)).toBe(bossLevelAusKampfXp(xp));
    }
  });

  it('entsteht bis einschließlich der Deadline und erwacht am Tag danach', () => {
    expect(bossPhase('2026-11-12', '2026-11-12')).toBe('entsteht');
    expect(bossPhase('2026-11-12', '2026-11-13')).toBe('erwacht');
  });

  it('zeichnet am ersten Tag einen kurzen Bogen und schließt ihn am Deadline-Tag', () => {
    expect(bossRingAnteil('2026-11-01', '2026-11-12', '2026-11-01')).toBeCloseTo(1 / 12);
    expect(bossRingAnteil('2026-11-01', '2026-11-12', '2026-11-06')).toBeGreaterThan(
      bossRingAnteil('2026-11-01', '2026-11-12', '2026-11-01'),
    );
    expect(bossRingAnteil('2026-11-01', '2026-11-12', '2026-11-12')).toBe(1);
    expect(bossRingAnteil('2026-11-01', '2026-11-12', '2026-11-13')).toBe(1);
    expect(bossRingAnteil('2026-11-12', '2026-11-12', '2026-11-12')).toBe(1);
  });
});

describe('basisDisziplinBonus', () => {
  it('gibt die Hälfte der Eintrags-XP zusätzlich als Disziplin', () => {
    expect(basisDisziplinBonus(16)).toBe(8);
    expect(basisDisziplinBonus(25)).toBe(13);
    expect(basisDisziplinBonus(-5)).toBe(0);
  });
});

describe('skillXp', () => {
  it('steigt pro Ebene um 10 Prozent und ist gedeckelt', () => {
    expect(skillXp(0)).toBe(100);
    expect(skillXp(1)).toBe(110);
    expect(skillXp(2)).toBe(121);
    expect(skillXp(4)).toBe(146);
    expect(skillXp(5)).toBe(150);
    expect(skillXp(20)).toBe(150);
  });
});

describe('WOOP', () => {
  it('erkennt vollständiges WOOP', () => {
    expect(istWoopVollstaendig({ ergebnis: 'a', hindernis: 'b', plan: 'c' })).toBe(true);
    expect(istWoopVollstaendig({ ergebnis: 'a', hindernis: ' ', plan: 'c' })).toBe(false);
  });
});

describe('dreyfusStufe', () => {
  it('ordnet Level den Kompetenzstufen zu', () => {
    expect(dreyfusStufe(1)).toBe('Novize');
    expect(dreyfusStufe(10)).toBe('Fortgeschrittener Anfänger');
    expect(dreyfusStufe(74)).toBe('Kompetent');
    expect(dreyfusStufe(75)).toBe('Gewandt');
    expect(dreyfusStufe(200)).toBe('Experte');
    expect(dreyfusStufe(5000)).toBe('Großmeister');
  });
});

describe('Ausrüstung und Multiplikatoren', () => {
  it('erhöht Eintrags-XP um den Bonus', () => {
    expect(eintragXp(1, 1.2)).toBe(30);
    expect(eintragXp(1)).toBe(25);
  });

  it('deckelt den Bonus pro Projekt', () => {
    expect(ausruestungsBonus([])).toBe(0);
    expect(ausruestungsBonus([0.1, 0.2])).toBeCloseTo(0.3);
    expect(ausruestungsBonus([0.3, 0.3])).toBe(0.5);
  });

  it('multipliziert alle Faktoren', () => {
    expect(gesamtFaktor([])).toBe(1);
    expect(gesamtFaktor([{ art: 'ausruestung', faktor: 1.1 }, { art: 'momentum', faktor: 1.1 }])).toBeCloseTo(1.21);
  });
});
