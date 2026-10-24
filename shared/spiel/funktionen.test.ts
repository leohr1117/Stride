import { describe, expect, it } from 'vitest';
import { FUNKTION_BLOECKE, FUNKTIONEN, funktionenAusSpeicher, funktionenFuerStufe, standardFunktionen, verfallFunktion } from './funktionen.ts';

describe('FUNKTION_BLOECKE', () => {
  it('teilt in Seiten und Abschnitte und gibt nur Abschnitten einen Ort', () => {
    const gesehen = FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => eintrag.funktion));
    expect(gesehen.slice().sort()).toEqual([...FUNKTIONEN].sort());
    expect(new Set(gesehen).size).toBe(gesehen.length);
    expect(FUNKTION_BLOECKE.map((block) => block.seite)).toEqual(['Seiten', 'Abschnitte']);
    const seiten = FUNKTION_BLOECKE.find((block) => block.seite === 'Seiten');
    expect(seiten?.eintraege.map((eintrag) => eintrag.funktion)).toEqual([
      'basis',
      'aufgaben',
      'training',
      'chronik',
      'rueckblick',
      'statistiken',
      'vorbilder',
      'handbuch',
    ]);
    expect(seiten?.eintraege.every((eintrag) => eintrag.ort === undefined)).toBe(true);
    expect(FUNKTION_BLOECKE.find((block) => block.seite === 'Abschnitte')?.eintraege.map((eintrag) => [eintrag.funktion, eintrag.ort])).toEqual([
      ['koennen', 'Auf dem Charakter.'],
      ['status', 'Auf dem Charakter.'],
      ['faehigkeiten', 'Auf dem Charakter.'],
      ['ausruestung', 'Eigene auf dem Charakter. Projekt-Investitionen auf der Projektseite.'],
      ['bossAngriffe', 'Unter Laufend. Anlegen am Vorhaben auf der Projektseite.'],
      ['verfallKoennen', 'Beim Bearbeiten eines Können-Attributs auf dem Charakter.'],
      ['verfallHaben', 'Beim Bearbeiten eines Haben-Attributs auf dem Charakter.'],
    ]);
  });
});

describe('standardFunktionen', () => {
  it('lässt für neue Welten nur Handbuch, Können und Haben an', () => {
    const funktionen = standardFunktionen();
    expect(Object.keys(funktionen).sort()).toEqual([...FUNKTIONEN].sort());
    expect(funktionen.handbuch).toBe(true);
    expect(funktionen.koennen).toBe(true);
    expect(funktionen.status).toBe(true);
    for (const funktion of FUNKTIONEN) {
      if (funktion === 'handbuch' || funktion === 'koennen' || funktion === 'status') {
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

  it('schaltet Aufgaben nur ohne gespeicherte Zeile an', () => {
    expect(standardFunktionen().aufgaben).toBe(false);
    expect(funktionenAusSpeicher(null).aufgaben).toBe(true);
    expect(funktionenAusSpeicher(undefined).aufgaben).toBe(true);
    expect(funktionenAusSpeicher(null).basis).toBe(false);
    expect(funktionenAusSpeicher(null).handbuch).toBe(true);
    expect(funktionenAusSpeicher({}).aufgaben).toBe(false);
    expect(funktionenAusSpeicher({ basis: true }).aufgaben).toBe(false);
    expect(funktionenAusSpeicher({ aufgaben: false }).aufgaben).toBe(false);
    expect(funktionenAusSpeicher({ aufgaben: true }).aufgaben).toBe(true);
  });

  it('lässt Training aus, auch ohne gespeicherte Zeile', () => {
    expect(standardFunktionen().training).toBe(false);
    expect(funktionenAusSpeicher(null).training).toBe(false);
    expect(funktionenAusSpeicher(undefined).training).toBe(false);
    expect(funktionenAusSpeicher(null).aufgaben).toBe(true);
    expect(funktionenAusSpeicher({}).training).toBe(false);
    expect(funktionenAusSpeicher({ basis: true }).training).toBe(false);
    expect(funktionenAusSpeicher({ training: false }).training).toBe(false);
    expect(funktionenAusSpeicher({ training: true }).training).toBe(true);
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
