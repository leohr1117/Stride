import { describe, expect, it } from 'vitest';
import { EBENEN } from './ebenen.ts';
import {
  BEREICH_GRUPPEN,
  BEREICH_SCHALTER,
  FUNKTION_BLOECKE,
  FUNKTIONEN,
  funktionenAusSpeicher,
  funktionenFuerStufe,
  istFunktion,
  standardFunktionen,
  verfallFunktion,
} from './funktionen.ts';

describe('BEREICH_SCHALTER', () => {
  it('hat die 17 Schalter in den Fundort-Gruppen ohne Ortstext', () => {
    expect(BEREICH_SCHALTER).toHaveLength(17);
    expect(BEREICH_SCHALTER.map((eintrag) => eintrag.schalter)).toEqual([
      'basis',
      'chronik',
      'rueckblick',
      'statistiken',
      'vorbilder',
      'handbuch',
      'koennen',
      'status',
      'faehigkeiten',
      'ausruestung',
      'visionen',
      'organisationen',
      'projekte',
      'vorhaben',
      'bossAngriffe',
      'verfallKoennen',
      'verfallHaben',
    ]);
    expect(new Set(BEREICH_SCHALTER.map((eintrag) => eintrag.schalter)).size).toBe(17);
    expect(BEREICH_GRUPPEN).toEqual(['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln']);
    expect(BEREICH_SCHALTER.map((eintrag) => eintrag.gruppe)).toEqual([
      'Seiten',
      'Seiten',
      'Seiten',
      'Seiten',
      'Seiten',
      'Seiten',
      'Seiten im Profil',
      'Seiten im Profil',
      'Seiten im Profil',
      'Seiten im Profil',
      'Auf Ziele',
      'Auf Ziele',
      'Auf Ziele',
      'Auf Ziele',
      'Auf Ziele',
      'Regeln',
      'Regeln',
    ]);
    const funktionen = BEREICH_SCHALTER.filter((eintrag) => istFunktion(eintrag.schalter)).map((eintrag) => eintrag.schalter);
    expect(funktionen.slice().sort()).toEqual([...FUNKTIONEN].sort());
    const ebenen = BEREICH_SCHALTER.filter((eintrag) => !istFunktion(eintrag.schalter)).map((eintrag) => eintrag.schalter);
    expect(ebenen).toEqual([...EBENEN]);
  });
});

describe('FUNKTION_BLOECKE', () => {
  it('folgt den Fundort-Gruppen und hat keinen Ortstext', () => {
    const gesehen = FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => eintrag.funktion));
    expect(gesehen.slice().sort()).toEqual([...FUNKTIONEN].sort());
    expect(new Set(gesehen).size).toBe(gesehen.length);
    expect(FUNKTION_BLOECKE.map((block) => block.seite)).toEqual(['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln']);
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Seiten')?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'basis',
      'chronik',
      'rueckblick',
      'statistiken',
      'vorbilder',
      'handbuch',
    ]);
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Seiten im Profil')?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'koennen',
      'status',
      'faehigkeiten',
      'ausruestung',
    ]);
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Auf Ziele')?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'bossAngriffe',
    ]);
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Regeln')?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'verfallKoennen',
      'verfallHaben',
    ]);
    expect(FUNKTION_BLOECKE.every((block) => block.eintraege.every((eintrag) => !('ort' in eintrag)))).toBe(true);
  });
});

describe('standardFunktionen', () => {
  it('lässt für neue Welten nur Handbuch, Können und Haben an', () => {
    const funktionen = standardFunktionen();
    expect(Object.keys(funktionen).sort()).toEqual([...FUNKTIONEN].sort());
    expect(funktionen.handbuch).toBe(true);
    expect(funktionen.koennen).toBe(true);
    expect(funktionen.status).toBe(true);
    expect(funktionen.chronik).toBe(true);
    for (const funktion of FUNKTIONEN) {
      if (funktion === 'handbuch' || funktion === 'koennen' || funktion === 'status' || funktion === 'chronik') {
        continue;
      }
      expect(funktionen[funktion]).toBe(false);
    }
  });
});

describe('funktionenAusSpeicher', () => {
  it('übernimmt den alten Attributverfall für Können und Haben', () => {
    const an = funktionenAusSpeicher({ attributVerfall: true, koennen: true });
    expect(an.verfallKoennen).toBe(true);
    expect(an.verfallHaben).toBe(true);
    expect(an.koennen).toBe(true);

    const aus = funktionenAusSpeicher({ attributVerfall: false });
    expect(aus.verfallKoennen).toBe(false);
    expect(aus.verfallHaben).toBe(false);

    const getrennt = funktionenAusSpeicher({ attributVerfall: true, verfallHaben: false });
    expect(getrennt.verfallKoennen).toBe(true);
    expect(getrennt.verfallHaben).toBe(false);
  });

  it('ignoriert gespeicherte Schalter für Aufgaben und Training', () => {
    const an = funktionenAusSpeicher({ aufgaben: true, training: true, basis: true });
    expect(an.basis).toBe(true);
    expect('aufgaben' in an).toBe(false);
    expect('training' in an).toBe(false);
    expect(Object.keys(an).sort()).toEqual([...FUNKTIONEN].sort());
    const aus = funktionenAusSpeicher({ aufgaben: false, training: false });
    expect('aufgaben' in aus).toBe(false);
    expect('training' in aus).toBe(false);
    expect(aus.handbuch).toBe(true);
    expect(aus.basis).toBe(false);
    expect('aufgaben' in funktionenAusSpeicher(null)).toBe(false);
    expect('training' in funktionenAusSpeicher(null)).toBe(false);
    expect('training' in funktionenAusSpeicher(undefined)).toBe(false);
    expect(funktionenAusSpeicher(null).basis).toBe(false);
    expect(funktionenAusSpeicher({}).handbuch).toBe(true);
  });

  it('lässt neue Welten ohne Verfall', () => {
    expect(funktionenAusSpeicher(null).verfallKoennen).toBe(false);
    expect(funktionenAusSpeicher({}).verfallHaben).toBe(false);
    expect(verfallFunktion('attribut')).toBe('verfallKoennen');
    expect(verfallFunktion('status')).toBe('verfallHaben');
  });
});

describe('funktionenFuerStufe', () => {
  it('schaltet bei uebung Fähigkeiten an und lässt die anderen Stufen unberührt', () => {
    expect(funktionenFuerStufe('uebung')).toEqual({ faehigkeiten: true });
    expect(funktionenFuerStufe('einfach')).toEqual({});
    expect(funktionenFuerStufe('traeumer')).toEqual({});
    expect(funktionenFuerStufe('macher')).toEqual({});
    expect(funktionenFuerStufe('bodenstaendig')).toEqual({});
  });
});
