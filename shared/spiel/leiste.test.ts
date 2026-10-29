import { describe, expect, it } from 'vitest';
import { ebenenFuerStufe } from './ebenen.ts';
import { standardFunktionen } from './funktionen.ts';
import {
  entfernePlatz,
  haengePlatzAn,
  istFesterPlatz,
  istLeiste,
  LEISTE_FEST,
  LEISTE_MAX,
  LEISTE_STANDARD,
  LEISTEN_SEITEN,
  hatEintragFab,
  sichtbareLeiste,
  tauschMitSichtbar,
  bereinigteLeiste,
} from './leiste.ts';
import { SEITEN } from './navigation.ts';

describe('istLeiste', () => {
  it('nimmt die Standardleiste und eine leere Leiste an', () => {
    expect(LEISTE_STANDARD).toEqual(['/', '/ziele', '/chronik', '/mehr']);
    expect(LEISTE_STANDARD.at(-1)).toBe(LEISTE_FEST);
    expect(istFesterPlatz('/mehr')).toBe(true);
    expect(istLeiste(LEISTE_STANDARD)).toBe(true);
    expect(istLeiste([])).toBe(true);
    const pfade = LEISTEN_SEITEN.map((seite) => seite.pfad);
    expect(pfade).toEqual(SEITEN.map((seite) => seite.pfad));
    expect(pfade).toContain('/charakter');
    expect(pfade).toContain('/mehr/inhalte');
    expect(pfade.at(-1)).toBe('/mehr');
    expect(istLeiste(['/', '/aufgaben'])).toBe(false);
    expect(istLeiste(['/', '/training'])).toBe(false);
  });

  it('lehnt Unbekanntes und Doppeltes ab und behält versteckte Seiten', () => {
    expect(istLeiste(['/unbekannt'])).toBe(false);
    expect(istLeiste(['/', '/'])).toBe(false);
    expect(istLeiste(['/', '/laufend', '/ziele', '/mehr', '/chronik'])).toBe(true);
    expect(istLeiste(['/charakter'])).toBe(true);
    expect(istLeiste(['/', '/charakter'])).toBe(true);
    expect(istLeiste(['/mehr/inhalte'])).toBe(true);
    expect(istLeiste('')).toBe(false);
  });
});

describe('hatEintragFab', () => {
  it('lässt den Plus-Knopf auf Inhaltsseiten und nimmt ihn von Mehr', () => {
    expect(hatEintragFab('/')).toBe(true);
    expect(hatEintragFab('/projekte/4')).toBe(true);
    expect(hatEintragFab('/faehigkeiten/2')).toBe(true);
    expect(hatEintragFab('/mehr')).toBe(false);
    expect(hatEintragFab('/mehr/darstellung')).toBe(false);
    expect(hatEintragFab('/mehr/darstellung/leiste')).toBe(false);
  });
});

describe('leistenPlätze', () => {
  const liste = ['/', '/laufend', '/ziele', '/mehr'];

  it('hängt einen freien Platz vor Mehr an und leert einen Platz', () => {
    expect(haengePlatzAn(['/', '/laufend'], '/ziele')).toEqual(['/', '/laufend', '/ziele']);
    expect(haengePlatzAn(['/', '/mehr'], '/ziele')).toEqual(['/', '/ziele', '/mehr']);
    expect(haengePlatzAn(liste, '/chronik')).toEqual(liste);
    expect(haengePlatzAn(['/'], '/')).toEqual(['/']);
    expect(entfernePlatz(liste, 2)).toEqual(['/', '/laufend', '/mehr']);
    expect(entfernePlatz(liste, 3)).toEqual(liste);
    expect(liste).toHaveLength(LEISTE_MAX);
  });

  it('zählt nur sichtbare Seiten und lässt versteckte liegen', () => {
    const aktiv = (pfad: string) => pfad !== '/laufend' && pfad !== '/ziele';
    expect(haengePlatzAn(liste, '/chronik', aktiv)).toEqual(['/', '/laufend', '/ziele', '/chronik', '/mehr']);
    const vierSichtbar = ['/', '/laufend', '/ziele', '/mehr', '/chronik'];
    const fastAlles = (pfad: string) => pfad !== '/laufend';
    expect(haengePlatzAn(vierSichtbar, '/basis', fastAlles)).toEqual(vierSichtbar);
  });
});

describe('sichtbareLeiste', () => {
  it('lässt ausgeschaltete Bereiche weg', () => {
    const funktionen = standardFunktionen();
    funktionen.basis = false;
    funktionen.chronik = false;
    expect(sichtbareLeiste(['/', '/basis', '/chronik', '/mehr'], funktionen)).toEqual(['/', '/mehr']);
  });

  it('zeigt im Standard das Handbuch und blendet die übrigen Bereiche aus', () => {
    expect(sichtbareLeiste(['/', '/basis', '/chronik', '/handbuch', '/vorbilder', '/mehr'], standardFunktionen())).toEqual([
      '/',
      '/chronik',
      '/handbuch',
      '/mehr',
    ]);
  });

  it('lässt Ziele nur bei Vision, Projekt oder Vorhaben', () => {
    const funktionen = standardFunktionen();
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('bodenstaendig'))).toEqual([
      '/',
      '/ziele',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('einfach'))).toEqual(['/', '/mehr']);
    expect(sichtbareLeiste(['/', '/laufend', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('einfach'))).toEqual([
      '/',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/laufend', '/mehr'], funktionen, ebenenFuerStufe('bodenstaendig'))).toEqual([
      '/',
      '/laufend',
      '/mehr',
    ]);
    expect(sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, ebenenFuerStufe('uebung'))).toEqual(['/', '/mehr']);
    expect(
      sichtbareLeiste(['/', '/ziele', '/mehr'], funktionen, {
        visionen: false,
        organisationen: true,
        projekte: false,
        vorhaben: false,
      }),
    ).toEqual(['/', '/mehr']);
  });
});

describe('tauschMitSichtbar', () => {
  it('tauscht mit dem nächsten sichtbaren Platz und lässt versteckte Pfade und Mehr liegen', () => {
    const aktiv = (pfad: string) => pfad !== '/ziele';
    expect(tauschMitSichtbar(['/', '/chronik', '/mehr'], 1, -1, aktiv)).toEqual(['/chronik', '/', '/mehr']);
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 0, 1, aktiv)).toEqual(['/', '/ziele', '/mehr']);
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 2, -1, aktiv)).toEqual(['/', '/ziele', '/mehr']);
    expect(tauschMitSichtbar(['/', '/ziele', '/mehr'], 2, 1, aktiv)).toEqual(['/', '/ziele', '/mehr']);
  });
});

describe('bereinigteLeiste', () => {
  it('lässt Unbekanntes weg und behält Profil, Tätigkeiten und den Rest', () => {
    expect(bereinigteLeiste(['/', '/aufgaben', '/mehr'])).toEqual(['/', '/mehr']);
    expect(bereinigteLeiste(['/', '/training', '/mehr'])).toEqual(['/', '/mehr']);
    expect(bereinigteLeiste(['/', '/training/plaene/1', '/ziele'])).toEqual(['/', '/ziele']);
    expect(bereinigteLeiste(['/', '/charakter', '/ziele', '/mehr'])).toEqual(['/', '/charakter', '/ziele', '/mehr']);
    expect(bereinigteLeiste(['/', '/mehr/inhalte', '/mehr'])).toEqual(['/', '/mehr/inhalte', '/mehr']);
    expect(bereinigteLeiste(['/', '/'])).toEqual(['/']);
    expect(bereinigteLeiste([])).toEqual([]);
    expect(bereinigteLeiste('keine liste')).toBeNull();
    expect(bereinigteLeiste(['/', '/laufend', '/ziele', '/chronik', '/mehr'])).toEqual([
      '/',
      '/laufend',
      '/ziele',
      '/chronik',
      '/mehr',
    ]);
  });
});