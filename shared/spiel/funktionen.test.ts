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

const ALT_SCHALTER = [
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
] as const;

const ALT_GRUPPEN = [
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
] as const;

function istGeraeteZeile(schalter: string): boolean {
  return schalter === 'hinweise';
}

function ohneGeraet<T extends { schalter: string }>(eintraege: readonly T[]): T[] {
  return eintraege.filter((eintrag) => !istGeraeteZeile(eintrag.schalter));
}

describe('BEREICH_SCHALTER', () => {
  it('hält die 17 alten Schalter vorn und hängt Erfolge in der letzten Gruppe an', () => {
    const konto = ohneGeraet(BEREICH_SCHALTER);
    const alt = konto.filter((eintrag) => eintrag.schalter !== 'erfolge' && eintrag.schalter !== 'streak');
    expect(alt).toHaveLength(17);
    expect(alt.map((eintrag) => eintrag.schalter)).toEqual([...ALT_SCHALTER]);
    expect(alt.map((eintrag) => eintrag.gruppe)).toEqual([...ALT_GRUPPEN]);
    expect(konto.map((eintrag) => eintrag.schalter)).toEqual([...ALT_SCHALTER, 'streak', 'erfolge']);
    expect(konto.at(-2)).toEqual({
      schalter: 'streak',
      label: 'Streak',
      gruppe: 'Funktionen',
      untertitel: 'Aus pausiert die Kette. Momentum bleibt solange bei 1,0.',
    });
    expect(konto.at(-1)).toEqual({ schalter: 'erfolge', label: 'Erfolge und Titel', gruppe: 'Funktionen' });
    expect(new Set(konto.map((eintrag) => eintrag.schalter)).size).toBe(konto.length);
    expect(BEREICH_GRUPPEN).toEqual(['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln', 'Funktionen']);
    expect(BEREICH_GRUPPEN.at(-1)).toBe('Funktionen');
    expect(FUNKTIONEN).toContain('erfolge');
    expect(FUNKTIONEN).toContain('streak');
    expect(new Set<string>(FUNKTIONEN).has('hinweise')).toBe(false);
    expect(istFunktion('hinweise')).toBe(false);
    expect(BEREICH_SCHALTER.some((eintrag) => istGeraeteZeile(eintrag.schalter))).toBe(false);
    const funktionen = konto.filter((eintrag) => istFunktion(eintrag.schalter)).map((eintrag) => eintrag.schalter);
    expect(funktionen.slice().sort()).toEqual([...FUNKTIONEN].sort());
    const ebenen = BEREICH_SCHALTER.filter((eintrag) => !istFunktion(eintrag.schalter) && !istGeraeteZeile(eintrag.schalter)).map(
      (eintrag) => eintrag.schalter,
    );
    expect(ebenen).toEqual([...EBENEN]);
  });
});

describe('FUNKTION_BLOECKE', () => {
  it('folgt den Fundort-Gruppen und hat keinen Ortstext', () => {
    const gesehen = FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => eintrag.funktion));
    expect(gesehen.slice().sort()).toEqual([...FUNKTIONEN].sort());
    expect(new Set(gesehen).size).toBe(gesehen.length);
    expect(FUNKTION_BLOECKE.map((block) => block.seite)).toEqual(['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln', 'Funktionen']);
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
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Funktionen')?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'streak',
      'erfolge',
    ]);
    expect(FUNKTION_BLOECKE.every((block) => block.eintraege.every((eintrag) => !('ort' in eintrag)))).toBe(true);
  });
});

describe('standardFunktionen', () => {
  it('lässt für neue Welten Handbuch, Können, Haben, Verlauf, Erfolge und Streak an', () => {
    const funktionen = standardFunktionen();
    expect(Object.keys(funktionen).sort()).toEqual([...FUNKTIONEN].sort());
    expect(funktionen.handbuch).toBe(true);
    expect(funktionen.koennen).toBe(true);
    expect(funktionen.status).toBe(true);
    expect(funktionen.chronik).toBe(true);
    expect(funktionen.erfolge).toBe(true);
    expect(funktionen.streak).toBe(true);
    for (const funktion of FUNKTIONEN) {
      if (
        funktion === 'handbuch' ||
        funktion === 'koennen' ||
        funktion === 'status' ||
        funktion === 'chronik' ||
        funktion === 'erfolge' ||
        funktion === 'streak'
      ) {
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
    expect(funktionenAusSpeicher(null).erfolge).toBe(true);
    expect(funktionenAusSpeicher({}).erfolge).toBe(true);
    expect(funktionenAusSpeicher({ basis: true }).erfolge).toBe(true);
    expect(funktionenAusSpeicher({ erfolge: false }).erfolge).toBe(false);
    expect(funktionenAusSpeicher(null).streak).toBe(true);
    expect(funktionenAusSpeicher({}).streak).toBe(true);
    expect(funktionenAusSpeicher({ basis: true }).streak).toBe(true);
    expect(funktionenAusSpeicher({ streak: false }).streak).toBe(false);
    expect('hinweise' in funktionenAusSpeicher({ hinweise: false })).toBe(false);
    expect(standardFunktionen().erfolge).toBe(true);
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
