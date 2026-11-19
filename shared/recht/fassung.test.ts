import { describe, expect, it } from 'vitest';
import { ZIEL_SPRACHEN } from '../sprache/kern.ts';
import { hatSchluessel, zeige } from '../sprache/index.ts';
import {
  RECHT_FASSUNG,
  RECHT_FASSUNG_BESTAND,
  ZUSTIMMUNG_DIALOG_SATZ,
  ZUSTIMMUNG_DIALOG_TITEL,
  ZUSTIMMUNG_FEHLT,
  ZUSTIMMUNG_KASTEN,
  ZUSTIMMUNG_KNOPF,
  istZustimmungAktuell,
  teileZustimmung,
} from './fassung.ts';

const SAETZE = [ZUSTIMMUNG_KASTEN, ZUSTIMMUNG_DIALOG_SATZ] as const;

describe('recht fassung', () => {
  it('zählt den Bestand ohne Eintrag als aktuelle Fassung und eine andere Fassung als offen', () => {
    expect(RECHT_FASSUNG).toBe(RECHT_FASSUNG_BESTAND);
    expect(istZustimmungAktuell(null)).toBe(true);
    expect(istZustimmungAktuell(RECHT_FASSUNG)).toBe(true);
    expect(istZustimmungAktuell('2000-01-01')).toBe(false);
    expect(istZustimmungAktuell(null, '2026-12-01')).toBe(false);
    expect(istZustimmungAktuell(RECHT_FASSUNG, '2026-12-01')).toBe(false);
    expect(istZustimmungAktuell('2026-12-01', '2026-12-01')).toBe(true);
  });

  it('hält in jeder Sprache beide Titel im Satz, damit die Links sitzen', () => {
    for (const schluessel of [ZUSTIMMUNG_FEHLT, ZUSTIMMUNG_KASTEN, ZUSTIMMUNG_DIALOG_TITEL, ZUSTIMMUNG_DIALOG_SATZ, ZUSTIMMUNG_KNOPF]) {
      expect(hatSchluessel(schluessel)).toBe(true);
    }
    for (const sprache of ['de', ...ZIEL_SPRACHEN] as const) {
      const nutzung = zeige('Nutzungsbedingungen', sprache);
      const datenschutz = zeige('Datenschutzerklärung', sprache);
      for (const schluessel of SAETZE) {
        const satz = zeige(schluessel, sprache);
        const teile = teileZustimmung(satz, nutzung, datenschutz);
        expect(teile.map((teil) => teil.text).join('')).toBe(satz);
        expect(teile.some((teil) => teil.art === 'nutzung' && teil.text === nutzung)).toBe(true);
        expect(teile.some((teil) => teil.art === 'datenschutz' && teil.text === datenschutz)).toBe(true);
      }
    }
  });
});
