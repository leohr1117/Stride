import { describe, expect, it } from 'vitest';
import { istUngenutzt, schnellPunkte, type Nutzung } from './ungenutzt.ts';

const LEER: Nutzung = { eintraege: 0, xp: 0, verknuepfungen: 0, historie: false };

describe('istUngenutzt', () => {
  it('ist ungenutzt ohne Einträge, XP, Verknüpfungen und Historie', () => {
    expect(istUngenutzt(LEER)).toBe(true);
  });

  it('zählt einen Eintrag als Nutzung', () => {
    expect(istUngenutzt({ ...LEER, eintraege: 1 })).toBe(false);
  });

  it('zählt XP als Nutzung', () => {
    expect(istUngenutzt({ ...LEER, xp: 1 })).toBe(false);
  });

  it('zählt eine eingehende Verknüpfung als Nutzung', () => {
    expect(istUngenutzt({ ...LEER, verknuepfungen: 1 })).toBe(false);
  });

  it('zählt Historie als Nutzung', () => {
    expect(istUngenutzt({ ...LEER, historie: true })).toBe(false);
  });
});

describe('schnellPunkte', () => {
  it('löscht Unbenutztes statt es zu archivieren', () => {
    expect(schnellPunkte({ ungenutzt: true, archiviert: false, kannArchivieren: true, kannLoeschen: true })).toEqual([
      'loeschen',
    ]);
  });

  it('archiviert Genutztes', () => {
    expect(schnellPunkte({ ungenutzt: false, archiviert: false, kannArchivieren: true, kannLoeschen: false })).toEqual([
      'archivieren',
    ]);
  });

  it('bietet bei genutztem Archiv nur Wiederherstellen', () => {
    expect(schnellPunkte({ ungenutzt: false, archiviert: true, kannArchivieren: true, kannLoeschen: false })).toEqual([
      'wiederherstellen',
    ]);
  });

  it('lässt ungenutztes Archiv löschen und wiederherstellen', () => {
    expect(schnellPunkte({ ungenutzt: true, archiviert: true, kannArchivieren: false, kannLoeschen: true })).toEqual([
      'wiederherstellen',
      'loeschen',
    ]);
  });

  it('bietet nichts, wenn der letzte Wert weder gelöscht noch archiviert werden darf', () => {
    expect(schnellPunkte({ ungenutzt: true, archiviert: false, kannArchivieren: false, kannLoeschen: false })).toEqual([]);
    expect(schnellPunkte({ ungenutzt: false, archiviert: false, kannArchivieren: false, kannLoeschen: false })).toEqual([]);
  });

  it('löscht ein Vorhaben oder einen Skill nur, solange er ungenutzt ist', () => {
    expect(schnellPunkte({ ungenutzt: true, archiviert: false, kannArchivieren: false, kannLoeschen: true })).toEqual([
      'loeschen',
    ]);
    expect(schnellPunkte({ ungenutzt: false, archiviert: false, kannArchivieren: false, kannLoeschen: false })).toEqual([]);
  });
});
