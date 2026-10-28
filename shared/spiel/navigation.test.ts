import { describe, expect, it } from 'vitest';
import { standardEbenen } from './ebenen.ts';
import { standardFunktionen, type Funktionen } from './funktionen.ts';
import { LEISTEN_SEITEN } from './leiste.ts';
import { BLOCK_NAME, SEITEN, seiteZuPfad, type Block } from './navigation.ts';
import { hatSchluessel } from '../sprache/index.ts';
import { pfadAktiv } from './sichtbarkeit.ts';

const VERZEICHNIS = [
  ['/', 'Übersicht', 'haus', 1],
  ['/ziele', 'Ziele', 'kompass', 1],
  ['/laufend', 'Laufend', 'laufend', 1],
  ['/basis', 'Basis', 'schichten', 1],
  ['/mehr/inhalte', 'Tätigkeiten', 'liste', 1],
  ['/chronik', 'Chronik', 'weg', 2],
  ['/rueckblick', 'Rückblick', 'kalender', 2],
  ['/statistiken', 'Statistiken', 'diagramm', 2],
  ['/vorbilder', 'Vorbilder', 'stern', 2],
  ['/charakter', 'Profil', 'person', 3],
  ['/handbuch', 'Handbuch', 'buch', 4],
] as const;

describe('Seitentabelle', () => {
  it('hat für jede Seite Name, Symbol und Block, in der Reihenfolge aus 11.1', () => {
    const verzeichnis = SEITEN.filter((seite) => seite.pfad !== '/mehr');
    expect(verzeichnis.map((seite) => [seite.pfad, seite.name, seite.symbol, seite.block])).toEqual(
      VERZEICHNIS.map((zeile) => [...zeile]),
    );
    expect(new Set(verzeichnis.map((seite) => seite.block))).toEqual(new Set<Block>([1, 2, 3, 4]));
    expect(BLOCK_NAME).toEqual({
      1: 'Planen und Tun',
      2: 'Rückschau',
      3: 'Profil',
      4: 'Nachschlagen',
    });
    const mehr = SEITEN.find((seite) => seite.pfad === '/mehr');
    expect(mehr).toMatchObject({ name: 'Mehr', symbol: 'zahnrad', block: null, toastZiel: '/mehr' });
    expect(new Set(SEITEN.map((seite) => seite.pfad)).size).toBe(SEITEN.length);
    for (const seite of SEITEN) {
      expect(seite.name.trim()).toBe(seite.name);
      expect(seite.symbol.length).toBeGreaterThan(0);
      expect(seite.toastZiel).toBe(seite.pfad);
      expect(seite.profilzeile).toBe(false);
      expect(hatSchluessel(seite.name)).toBe(true);
    }
  });

  it('lässt die Leiste Profil und Tätigkeiten noch aus und übernimmt die Namen', () => {
    const pfade = LEISTEN_SEITEN.map((seite) => seite.pfad);
    expect(pfade).toEqual(SEITEN.map((seite) => seite.pfad).filter((pfad) => pfad !== '/charakter' && pfad !== '/mehr/inhalte'));
    for (const seite of LEISTEN_SEITEN) {
      expect(seite.label).toBe(SEITEN.find((eintrag) => eintrag.pfad === seite.pfad)?.name);
    }
  });

  it('schaltet den Pfad über den Schalter der Tabelle', () => {
    const funktionen: Funktionen = {
      ...standardFunktionen(),
      basis: false,
      chronik: false,
      handbuch: false,
      rueckblick: false,
      statistiken: false,
      vorbilder: false,
    };
    const ebenen = { visionen: false, organisationen: false, projekte: false, vorhaben: false };
    const aus = { funktionen, ebenen };
    for (const seite of SEITEN) {
      if (seite.schalter === null || seite.schalter === 'ziele' || seite.schalter === 'laufend') {
        expect(pfadAktiv(seite.pfad, aus)).toBe(seite.schalter === null);
      } else {
        expect(pfadAktiv(seite.pfad, aus)).toBe(false);
        expect(pfadAktiv(seite.pfad, { funktionen: { ...funktionen, [seite.schalter]: true }, ebenen })).toBe(true);
      }
    }
    expect(pfadAktiv('/ziele', { funktionen, ebenen: { ...ebenen, visionen: true } })).toBe(true);
    expect(pfadAktiv('/laufend', { funktionen, ebenen: { ...standardEbenen(), vorhaben: true } })).toBe(true);
    expect(pfadAktiv('/vorbilder/ada', aus)).toBe(false);
    expect(seiteZuPfad('/vorbilder/ada')?.pfad).toBe('/vorbilder');
    expect(seiteZuPfad('/vorbilder/ada')?.schalter).toBe('vorbilder');
  });
});
