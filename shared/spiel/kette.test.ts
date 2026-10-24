import { describe, expect, it } from 'vitest';
import { kettenLaenge, kettenStand, tageZwischen } from './kette.ts';

describe('tageZwischen', () => {
  it('zählt Kalendertage auch über Monatsgrenzen', () => {
    expect(tageZwischen('2026-10-19', '2026-10-19')).toBe(0);
    expect(tageZwischen('2026-10-31', '2026-11-01')).toBe(1);
    expect(tageZwischen('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('kettenLaenge', () => {
  it('zählt aufeinanderfolgende Tage', () => {
    expect(kettenLaenge(['2026-10-15', '2026-10-16', '2026-10-17'], '2026-10-17')).toBe(3);
  });

  it('erlaubt einen Pausentag (Never miss twice)', () => {
    expect(kettenLaenge(['2026-10-15', '2026-10-17', '2026-10-18'], '2026-10-18')).toBe(3);
  });

  it('bricht bei zwei Pausentagen', () => {
    expect(kettenLaenge(['2026-10-14', '2026-10-17', '2026-10-18'], '2026-10-18')).toBe(2);
  });

  it('ist 0, wenn der Zieltag nicht aktiv ist', () => {
    expect(kettenLaenge(['2026-10-15'], '2026-10-16')).toBe(0);
  });

  it('ignoriert Doppelungen, Reihenfolge und spätere Tage', () => {
    expect(kettenLaenge(['2026-10-17', '2026-10-16', '2026-10-17', '2026-10-20'], '2026-10-17')).toBe(2);
  });
});

describe('kettenStand', () => {
  const tage = ['2026-10-15', '2026-10-16', '2026-10-17'];

  it('ist intakt, wenn heute oder gestern aktiv war', () => {
    expect(kettenStand(tage, '2026-10-17')).toEqual({ laenge: 3, angeknackst: false });
    expect(kettenStand(tage, '2026-10-18')).toEqual({ laenge: 3, angeknackst: false });
  });

  it('ist angeknackst nach einem verpassten Tag', () => {
    expect(kettenStand(tage, '2026-10-19')).toEqual({ laenge: 3, angeknackst: true });
  });

  it('ist gebrochen nach zwei verpassten Tagen', () => {
    expect(kettenStand(tage, '2026-10-20')).toEqual({ laenge: 0, angeknackst: false });
  });

  it('ist leer ohne aktive Tage', () => {
    expect(kettenStand([], '2026-10-20')).toEqual({ laenge: 0, angeknackst: false });
  });
});
