import { describe, expect, it } from 'vitest';
import { ERLAUBTE_PAUSENTAGE, kettenStand } from './kette.ts';
import {
  RUECKKEHR,
  SCHUTZ,
  bruchtag,
  brueckeVerbindet,
  brueckentag,
  rueckkehrFaellig,
  schutzHeuteMoeglich,
  schwelleFuerEintrag,
  type RueckkehrLage,
} from './schutz.ts';

const KETTE = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
const MONTAG = '2026-10-19';
const DIENSTAG = '2026-10-20';
const MITTWOCH = '2026-10-21';
const DONNERSTAG = '2026-10-22';
const FREITAG = '2026-10-23';
const FRIST = '2026-10-29';

function lage(heute: string, ueber: Partial<RueckkehrLage> = {}): RueckkehrLage {
  return {
    aktiveTage: KETTE,
    heute,
    bruecken: [],
    rueckkehrAb: '2026-10-01',
    offen: false,
    schlussAm: null,
    ...ueber,
  };
}

describe('Brückentag', () => {
  it('liegt zwei Tage nach dem letzten Eintrag, der Bruchtag drei', () => {
    expect(ERLAUBTE_PAUSENTAGE).toBe(1);
    expect(brueckentag(MONTAG)).toBe(MITTWOCH);
    expect(bruchtag(MONTAG)).toBe(DONNERSTAG);
    expect(brueckentag('2026-01-30')).toBe('2026-02-01');
    expect(bruchtag('2026-01-30')).toBe('2026-02-02');
    expect(brueckentag('2026-12-30')).toBe('2027-01-01');
    expect(bruchtag('2026-12-30')).toBe('2027-01-02');
  });
});

describe('brueckeVerbindet', () => {
  it('verbindet Abstand 1 und 2 ohne Brücke', () => {
    expect(brueckeVerbindet(MONTAG, DIENSTAG, [])).toBe(true);
    expect(brueckeVerbindet(MONTAG, MITTWOCH, [])).toBe(true);
    expect(brueckeVerbindet(MONTAG, MONTAG, [])).toBe(false);
    expect(brueckeVerbindet(DONNERSTAG, MONTAG, [MITTWOCH])).toBe(false);
  });

  it('verbindet Abstand 3 nur, wenn der Tag von plus 2 eine Brücke ist', () => {
    expect(brueckeVerbindet(MONTAG, DONNERSTAG, [])).toBe(false);
    expect(brueckeVerbindet(MONTAG, DONNERSTAG, [DIENSTAG])).toBe(false);
    expect(brueckeVerbindet(MONTAG, DONNERSTAG, [DONNERSTAG])).toBe(false);
    expect(brueckeVerbindet(MONTAG, DONNERSTAG, [MITTWOCH])).toBe(true);
  });

  it('reicht für Abstand über 3 nicht, auch mit beiden Zwischentagen', () => {
    expect(brueckeVerbindet(MONTAG, FREITAG, [MITTWOCH])).toBe(false);
    expect(brueckeVerbindet(MONTAG, FREITAG, [MITTWOCH, DONNERSTAG])).toBe(false);
  });
});

describe('schutzHeuteMoeglich', () => {
  it('verbraucht am freien Pausentag keinen Schutz und zeigt bei Abstand 2 keinen Knopf', () => {
    expect(schutzHeuteMoeglich(KETTE, DIENSTAG, [], 1)).toBe(false);
    expect(schutzHeuteMoeglich(KETTE, MITTWOCH, [], 1)).toBe(false);
    expect(kettenStand(KETTE, MITTWOCH)).toEqual({ laenge: 5, angeknackst: true });
  });

  it('zeigt den Knopf nur bei Abstand 3, Vorrat 1 und fehlender Brücke, die 0 auf die alte Länge hebt', () => {
    expect(schutzHeuteMoeglich(KETTE, DONNERSTAG, [], 1)).toBe(true);
    expect(kettenStand(KETTE, DONNERSTAG, [])).toEqual({ laenge: 0, angeknackst: false });
    expect(kettenStand(KETTE, DONNERSTAG, [MITTWOCH])).toEqual({ laenge: 5, angeknackst: false });
    expect(schutzHeuteMoeglich(KETTE, DONNERSTAG, [], 0)).toBe(false);
    expect(schutzHeuteMoeglich(KETTE, DONNERSTAG, [], 2)).toBe(false);
    expect(schutzHeuteMoeglich(KETTE, DONNERSTAG, [MITTWOCH], 1)).toBe(false);
    expect(schutzHeuteMoeglich([...KETTE, DONNERSTAG], DONNERSTAG, [], 1)).toBe(false);
    expect(schutzHeuteMoeglich([], DONNERSTAG, [], 1)).toBe(false);
  });

  it('bleibt bei Abstand über 3 aus, auch mit einer Brücke', () => {
    expect(schutzHeuteMoeglich(KETTE, FREITAG, [], 1)).toBe(false);
    expect(schutzHeuteMoeglich(KETTE, FREITAG, [MITTWOCH], 1)).toBe(false);
    expect(kettenStand(KETTE, FREITAG, [MITTWOCH])).toEqual({ laenge: 0, angeknackst: false });
  });
});

describe('schwelleFuerEintrag', () => {
  it('vergibt eine gespeicherte 7 bei Länge 8 nicht', () => {
    expect(SCHUTZ.schwelleTage).toBe(7);
    expect(SCHUTZ.vorratMax).toBe(1);
    expect(schwelleFuerEintrag({ laengeVorher: 7, laengeNachher: 8, vorrat: 0, schwelle: 7 })).toEqual({
      schwelle: 7,
      vorrat: 0,
      verdient: false,
    });
  });

  it('vergibt den Schritt von 6 auf 7, wenn der Vorrat leer ist', () => {
    expect(schwelleFuerEintrag({ laengeVorher: 6, laengeNachher: 7, vorrat: 0, schwelle: 0 })).toEqual({
      schwelle: 7,
      vorrat: 1,
      verdient: true,
    });
    expect(schwelleFuerEintrag({ laengeVorher: 6, laengeNachher: 7, vorrat: 0, schwelle: null })).toEqual({
      schwelle: 7,
      vorrat: 1,
      verdient: true,
    });
  });

  it('hebt bei vollem Vorrat nur die Schwelle und holt sie nicht nach', () => {
    expect(schwelleFuerEintrag({ laengeVorher: 6, laengeNachher: 7, vorrat: 1, schwelle: 0 })).toEqual({
      schwelle: 7,
      vorrat: 1,
      verdient: false,
    });
    expect(schwelleFuerEintrag({ laengeVorher: 13, laengeNachher: 14, vorrat: 1, schwelle: 7 })).toEqual({
      schwelle: 14,
      vorrat: 1,
      verdient: false,
    });
    expect(schwelleFuerEintrag({ laengeVorher: 14, laengeNachher: 15, vorrat: 0, schwelle: 14 })).toEqual({
      schwelle: 14,
      vorrat: 0,
      verdient: false,
    });
    expect(schwelleFuerEintrag({ laengeVorher: 6, laengeNachher: 14, vorrat: 0, schwelle: 0 })).toEqual({
      schwelle: 14,
      vorrat: 1,
      verdient: true,
    });
  });

  it('setzt eine fehlende Schwelle auf den Stand vor dem Eintrag und verdient nur die neue Stufe', () => {
    expect(schwelleFuerEintrag({ laengeVorher: 8, laengeNachher: 9, vorrat: 0, schwelle: null })).toEqual({
      schwelle: 7,
      vorrat: 0,
      verdient: false,
    });
    expect(schwelleFuerEintrag({ laengeVorher: 13, laengeNachher: 14, vorrat: 0, schwelle: null })).toEqual({
      schwelle: 14,
      vorrat: 1,
      verdient: true,
    });
  });

  it('senkt die Schwelle nicht und behandelt ungültige Längen als 0', () => {
    expect(schwelleFuerEintrag({ laengeVorher: 10, laengeNachher: 3, vorrat: 1, schwelle: 7 })).toEqual({
      schwelle: 7,
      vorrat: 1,
      verdient: false,
    });
    expect(schwelleFuerEintrag({ laengeVorher: Number.NaN, laengeNachher: 1, vorrat: 0, schwelle: null })).toEqual({
      schwelle: 0,
      vorrat: 0,
      verdient: false,
    });
  });
});

describe('rueckkehrFaellig', () => {
  it('öffnet keine Rückkehr ohne Eintrag und nicht vor dem Bruchtag', () => {
    expect(RUECKKEHR.fristTage).toBe(7);
    expect(RUECKKEHR.abstandTage).toBe(14);
    expect(rueckkehrFaellig(lage(DONNERSTAG, { aktiveTage: [] }))).toEqual({
      faellig: false,
      status: null,
      bruchtag: null,
      fristAm: null,
    });
    expect(rueckkehrFaellig(lage(MITTWOCH)).faellig).toBe(false);
  });

  it('öffnet am Bruchtag ohne Brücke und bleibt am Fristtag offen', () => {
    expect(rueckkehrFaellig(lage(DONNERSTAG))).toEqual({
      faellig: true,
      status: 'offen',
      bruchtag: DONNERSTAG,
      fristAm: FRIST,
    });
    expect(rueckkehrFaellig(lage(FRIST)).status).toBe('offen');
    expect(rueckkehrFaellig(lage('2026-10-30'))).toEqual({
      faellig: true,
      status: 'zu',
      bruchtag: DONNERSTAG,
      fristAm: FRIST,
    });
  });

  it('schreibt bei einer Brücke und bei einem Bruch vor rueckkehr_ab keine Zeile', () => {
    expect(rueckkehrFaellig(lage(DONNERSTAG, { bruecken: [MITTWOCH] })).faellig).toBe(false);
    expect(rueckkehrFaellig(lage('2026-10-30', { bruecken: [MITTWOCH] })).faellig).toBe(false);
    expect(rueckkehrFaellig(lage('2026-10-30', { rueckkehrAb: '2026-10-28' })).faellig).toBe(false);
    expect(rueckkehrFaellig(lage(DONNERSTAG, { bruecken: [DONNERSTAG] })).faellig).toBe(true);
  });

  it('lässt eine offene Rückkehr und einen zu kurzen Abstand zur letzten zu', () => {
    expect(rueckkehrFaellig(lage(DONNERSTAG, { offen: true })).faellig).toBe(false);
    expect(rueckkehrFaellig(lage(DONNERSTAG, { schlussAm: '2026-10-09' })).faellig).toBe(false);
    expect(rueckkehrFaellig(lage(DONNERSTAG, { schlussAm: '2026-10-08' })).faellig).toBe(true);
  });

  it('gilt bei fehlendem rueckkehr_ab erst ab heute', () => {
    expect(rueckkehrFaellig(lage(DONNERSTAG, { rueckkehrAb: null })).faellig).toBe(true);
    expect(
      rueckkehrFaellig(
        lage('2026-10-30', {
          aktiveTage: ['2026-10-05'],
          rueckkehrAb: null,
        }),
      ).faellig,
    ).toBe(false);
  });
});
