import { describe, expect, it } from 'vitest';
import { kettenLaenge, kettenStand, laengsteKette, tageZwischen } from './kette.ts';

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

  it('zählt eine Brücke nicht als Kettentag', () => {
    const tage = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-22'];
    expect(kettenLaenge(tage, '2026-10-22', ['2026-10-21'])).toBe(6);
    expect(laengsteKette(tage, ['2026-10-21'])).toBe(6);
    expect(laengsteKette(tage)).toBe(5);
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

describe('kettenStand mit Brücke', () => {
  const kette = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
  const bruecke = '2026-10-21';

  it('lässt den freien Pausentag und den angeschlagenen Tag unverändert', () => {
    expect(kettenStand(kette, '2026-10-20', [bruecke])).toEqual({ laenge: 5, angeknackst: false });
    expect(kettenStand(kette, '2026-10-21', [bruecke])).toEqual({ laenge: 5, angeknackst: true });
  });

  it('hält am Bruchtag die Länge, ohne den Brückentag mitzuzählen', () => {
    expect(kettenStand(kette, '2026-10-22')).toEqual({ laenge: 0, angeknackst: false });
    expect(kettenStand(kette, '2026-10-22', [bruecke])).toEqual({ laenge: 5, angeknackst: false });
    expect(kettenStand(kette, '2026-10-22', ['2026-10-20'])).toEqual({ laenge: 0, angeknackst: false });
  });

  it('setzt mit dem Eintrag am Bruchtag um eins fort', () => {
    const mitEintrag = [...kette, '2026-10-22'];
    expect(kettenLaenge(mitEintrag, '2026-10-22', [bruecke])).toBe(6);
    expect(kettenStand(mitEintrag, '2026-10-22', [bruecke])).toEqual({ laenge: 6, angeknackst: false });
    expect(kettenLaenge(mitEintrag, '2026-10-22')).toBe(1);
  });

  it('trägt ohne folgenden Eintrag nicht über den nächsten Tag, auch mit zwei Brücken', () => {
    expect(kettenStand(kette, '2026-10-23', [bruecke])).toEqual({ laenge: 0, angeknackst: false });
    expect(kettenStand(kette, '2026-10-23', [bruecke, '2026-10-22'])).toEqual({ laenge: 0, angeknackst: false });
  });

  it('verbindet über die Monatsgrenze nur den Tag letzter plus 2', () => {
    expect(kettenStand(['2026-01-30'], '2026-02-02', ['2026-02-01'])).toEqual({ laenge: 1, angeknackst: false });
    expect(kettenStand(['2026-01-30', '2026-02-02'], '2026-02-02', ['2026-02-01'])).toEqual({
      laenge: 2,
      angeknackst: false,
    });
    expect(kettenStand(['2026-12-30', '2027-01-02'], '2027-01-02', ['2027-01-01'])).toEqual({
      laenge: 2,
      angeknackst: false,
    });
  });
});
