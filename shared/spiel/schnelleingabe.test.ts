import { describe, expect, it } from 'vitest';
import { SPRACHEN, type Sprache } from '../sprache/kern.ts';
import { ausTagesSchluessel, lokalesDatum, plusTage } from './datum.ts';
import {
  nameOhneStuecke,
  parseSchnelleingabe,
  VORSCHLAG_MAX,
  type SchnellEingabe,
  type SchnellErgebnis,
  type SchnellZiel,
} from './schnelleingabe.ts';
import { WORTE } from './schnelleingabeWorte.ts';

const HEUTE = '2026-10-23';
const MORGEN = '2026-10-24';
const UEBERMORGEN = '2026-10-25';
const IN_DREI = '2026-10-26';

function parse(name: string, teil: Partial<SchnellEingabe> = {}): SchnellErgebnis {
  const ergebnis = parseSchnelleingabe({ name, heute: HEUTE, sprache: 'de', ...teil });
  for (const stueck of ergebnis.stuecke) {
    expect(name.slice(stueck.von, stueck.bis)).toBe(stueck.text);
  }
  for (const vorschlag of ergebnis.vorschlaege) {
    expect(name.slice(vorschlag.von, vorschlag.bis)).toBe(vorschlag.text);
  }
  return ergebnis;
}

function plus(tage: number): string {
  return lokalesDatum(plusTage(ausTagesSchluessel(HEUTE), tage));
}

describe('relative Tage', () => {
  it('setzt heute, morgen und übermorgen', () => {
    expect(parse('heute').datum).toBe(HEUTE);
    expect(parse('morgen').datum).toBe(MORGEN);
    expect(parse('übermorgen').datum).toBe(UEBERMORGEN);
    expect(parse('uebermorgen').datum).toBe(parse('übermorgen').datum);
    expect(parse('UEBERMORGEN').datum).toBe(UEBERMORGEN);
  });

  it('nimmt in N Tagen für 1 bis 365 und lässt 0 und 366 stehen', () => {
    for (let zahl = 1; zahl <= 365; zahl++) {
      const wort = zahl === 1 ? 'Tag' : 'Tagen';
      expect(parse(`in ${zahl} ${wort}`).datum).toBe(plus(zahl));
    }
    expect(parse('in 1 Tagen').datum).toBe(MORGEN);
    expect(parse('in 0 Tagen').datum).toBeNull();
    expect(parse('in 366 Tagen').datum).toBeNull();
    expect(parse('in 3 Tagen').datum).toBe(IN_DREI);
  });

  it('zählt heute mit, wenn der Wochentag heute ist, und schiebt die Uhrzeit nicht', () => {
    expect(parse('Freitag').datum).toBe(HEUTE);
    expect(parse('Fr').datum).toBe(HEUTE);
    expect(parse('Montag').datum).toBe('2026-10-26');
    expect(parse('Mo').datum).toBe('2026-10-26');
    expect(parse('Dienstag').datum).toBe('2026-10-27');
    expect(parse('Di').datum).toBe('2026-10-27');
    expect(parse('Mittwoch').datum).toBe('2026-10-28');
    expect(parse('Mi').datum).toBe('2026-10-28');
    expect(parse('Donnerstag').datum).toBe('2026-10-29');
    expect(parse('Do').datum).toBe('2026-10-29');
    expect(parse('Samstag').datum).toBe('2026-10-24');
    expect(parse('Sa').datum).toBe('2026-10-24');
    expect(parse('Sonntag').datum).toBe('2026-10-25');
    expect(parse('So').datum).toBe('2026-10-25');

    const freitag = parse('Freitag 18:30');
    expect(freitag.stuecke).toHaveLength(1);
    expect(freitag.stuecke[0]?.text).toBe('Freitag 18:30');
    expect(freitag.datum).toBe(HEUTE);
    expect(freitag.uhrzeit).toBe('18:30');
  });
});

describe('Datum und Uhrzeit', () => {
  it('liest die Zahlenformen und rollt ein fehlendes Jahr nur nach vorn', () => {
    expect(parse('20.08').datum).toBe('2027-08-20');
    expect(parse('20.08.2026').datum).toBe('2026-08-20');
    expect(parse('20.8.').datum).toBe('2027-08-20');
    expect(parse('23.10').datum).toBe(HEUTE);
    expect(parse('24.10').datum).toBe('2026-10-24');
    expect(parse('20.8').datum).toBeNull();
    expect(parse('1.5').datum).toBeNull();
    expect(parse('31.02').datum).toBeNull();
    expect(parse('31.02.2026').datum).toBeNull();
    expect(parse('29.02').datum).toBeNull();
    expect(parse('29.02.2026').datum).toBeNull();
    expect(parse('29.02.2028').datum).toBe('2028-02-29');
    expect(parse('32.01').datum).toBeNull();
  });

  it('liest den Monatsnamen, mit Jahr und mit Uhrzeit als ein Stück', () => {
    expect(parse('20. August').datum).toBe('2027-08-20');
    expect(parse('20. August 2026').datum).toBe('2026-08-20');
    expect(parse('20. Maerz').datum).toBe('2027-03-20');
    expect(parse('23. Oktober').datum).toBe(HEUTE);
    const stueck = parse('20. August 20:00');
    expect(stueck.stuecke).toHaveLength(1);
    expect(stueck.stuecke[0]?.text).toBe('20. August 20:00');
    expect(stueck.datum).toBe('2027-08-20');
    expect(stueck.uhrzeit).toBe('20:00');
  });

  it('setzt eine Uhrzeit ohne Datum auf heute, auch als Wort', () => {
    expect(parse('20:00')).toMatchObject({ datum: HEUTE, uhrzeit: '20:00' });
    expect(parse('9 Uhr')).toMatchObject({ datum: HEUTE, uhrzeit: '09:00' });
    expect(parse('9:30 Uhr')).toMatchObject({ datum: HEUTE, uhrzeit: '09:30' });
    expect(parse('18:30').uhrzeit).toBe('18:30');
    expect(parse('24:00').uhrzeit).toBeNull();
    expect(parse('9:60').uhrzeit).toBeNull();
  });

  it('fasst morgen 9 Uhr zu einem Stück zusammen', () => {
    const ergebnis = parse('morgen 9 Uhr');
    expect(ergebnis.stuecke).toHaveLength(1);
    expect(ergebnis.stuecke[0]?.text).toBe('morgen 9 Uhr');
    expect(ergebnis.datum).toBe(MORGEN);
    expect(ergebnis.uhrzeit).toBe('09:00');

    const umgekehrt = parse('9 Uhr morgen');
    expect(umgekehrt.stuecke).toHaveLength(1);
    expect(umgekehrt.datum).toBe(MORGEN);
    expect(umgekehrt.uhrzeit).toBe('09:00');

    const getrennt = parse('morgen p1 9 Uhr');
    expect(getrennt.stuecke).toHaveLength(3);
    expect(getrennt.datum).toBe(MORGEN);
    expect(getrennt.uhrzeit).toBe('09:00');
    expect(getrennt.prioritaet).toBe(1);

    const zweiteZeit = parse('9 Uhr und 18:30');
    expect(zweiteZeit.stuecke.map((stueck) => stueck.text)).toEqual(['9 Uhr']);
    expect(zweiteZeit.uhrzeit).toBe('09:00');
  });
});

describe('Grenzen', () => {
  it('erkennt ein Stück nicht in einem längeren Wort', () => {
    expect(parse('heuteabend').stuecke).toEqual([]);
    expect(parse('heuteabend').datum).toBeNull();
    expect(parse('vorheute').datum).toBeNull();
    expect(parse('p10').prioritaet).toBeNull();
    expect(parse('xp1').prioritaet).toBeNull();
  });

  it('lässt ein zweites Datum als Text stehen', () => {
    const ergebnis = parse('heute und morgen');
    expect(ergebnis.stuecke.map((stueck) => stueck.text)).toEqual(['heute']);
    expect(ergebnis.datum).toBe(HEUTE);
  });

  it('lässt eine entlassene Spanne stehen', () => {
    const name = 'Arzt anrufen morgen';
    const erkannt = parse(name);
    const spanne = erkannt.stuecke[0];
    expect(spanne).toBeDefined();
    const nochmal = parse(name, { entlassen: [{ von: spanne?.von ?? 0, bis: spanne?.bis ?? 0 }] });
    expect(nochmal.stuecke).toEqual([]);
    expect(nochmal.datum).toBeNull();
    expect(nameOhneStuecke(name, nochmal.stuecke)).toBe(name);
  });

  it('setzt p1 auf 1 und lässt eine leere Priorität leer', () => {
    expect(parse('anrufen p1').prioritaet).toBe(1);
    expect(parse('anrufen P4').prioritaet).toBe(4);
    expect(parse('anrufen').prioritaet).toBeNull();
    expect(parse('p5').prioritaet).toBeNull();
  });
});

describe('Projekt, Organisation und Vision', () => {
  const projekte: SchnellZiel[] = [
    { id: 1, name: 'Geld' },
    { id: 2, name: 'Haus' },
    { id: 3, name: 'Haus und Hof' },
  ];

  it('setzt einen exakten Namen und einen Präfix nicht', () => {
    expect(parse('#Geld', { projekte }).projektId).toBe(1);
    expect(parse('#geld', { projekte }).projektId).toBe(1);
    const praefix = parse('#Ge', { projekte });
    expect(praefix.projektId).toBeNull();
    expect(praefix.stuecke).toEqual([]);
    expect(praefix.vorschlaege[0]?.treffer.map((treffer) => treffer.name)).toEqual(['Geld']);
    expect(parse('#Geldextra', { projekte }).projektId).toBeNull();
    expect(parse('#Geldextra', { projekte }).vorschlaege).toEqual([]);
  });

  it('nimmt den längsten Namen und sortiert Vorschläge so', () => {
    expect(parse('#Haus und Hof', { projekte }).projektId).toBe(3);
    expect(parse('#Haus', { projekte }).projektId).toBe(2);
    const liste = parse('#Hau', { projekte });
    expect(liste.projektId).toBeNull();
    expect(liste.vorschlaege[0]?.treffer.map((treffer) => treffer.name)).toEqual(['Haus und Hof', 'Haus']);
  });

  it('lässt zwei gleiche Namen und Archiv und ausgeschaltete Ebenen aus', () => {
    const doppelt = parse('#Geld', { projekte: [{ id: 1, name: 'Geld' }, { id: 2, name: 'geld' }] });
    expect(doppelt.projektId).toBeNull();
    expect(doppelt.stuecke).toEqual([]);
    expect(doppelt.vorschlaege[0]?.treffer).toHaveLength(2);

    expect(parse('#Alt', { projekte: [{ id: 9, name: 'Alt', archiviert: true }] }).projektId).toBeNull();
    expect(parse('#Alt', { projekte: [{ id: 9, name: 'Alt', archiviert: true }] }).vorschlaege).toEqual([]);
    expect(parse('#Geld', { projekte, ebenen: { projekte: false } }).projektId).toBeNull();
    expect(parse('#Geld', { projekte, ebenen: { projekte: false } }).vorschlaege).toEqual([]);
  });

  it('begrenzt die Vorschläge und kennt Organisation und Vision', () => {
    const viele: SchnellZiel[] = ['A', 'BB', 'CCC', 'DDDD', 'EEEEE', 'FFFFFF', 'GGGGGGG'].map((name, index) => ({
      id: index + 1,
      name,
    }));
    const alle = parse('#', { projekte: viele });
    expect(alle.vorschlaege[0]?.treffer).toHaveLength(VORSCHLAG_MAX);
    expect(alle.vorschlaege[0]?.treffer[0]?.name).toBe('GGGGGGG');
    expect(alle.vorschlaege[0]?.treffer.some((treffer) => treffer.name === 'A')).toBe(false);

    expect(parse('+Kanzlei', { organisationen: [{ id: 7, name: 'Kanzlei' }] }).organisationId).toBe(7);
    expect(parse('*Ruhe', { visionen: [{ id: 8, name: 'Ruhe' }] }).visionId).toBe(8);
  });
});

describe('Speichern und Mockup', () => {
  it('entfernt die gesetzten Stücke und zieht Leerzeichen zusammen', () => {
    const name = 'Arzt anrufen morgen 9 Uhr p1 #Geld';
    const ergebnis = parse(name, { projekte: [{ id: 4, name: 'Geld' }] });
    expect(ergebnis.stuecke.map((stueck) => stueck.text)).toEqual(['morgen 9 Uhr', 'p1', '#Geld']);
    expect(ergebnis.datum).toBe(MORGEN);
    expect(ergebnis.uhrzeit).toBe('09:00');
    expect(ergebnis.prioritaet).toBe(1);
    expect(ergebnis.projektId).toBe(4);
    expect(nameOhneStuecke(name, ergebnis.stuecke)).toBe('Arzt anrufen');
  });

  it('lässt einen Präfix beim Entfernen im Namen', () => {
    const name = 'Arzt #Ge';
    const ergebnis = parse(name, { projekte: [{ id: 1, name: 'Geld' }] });
    expect(ergebnis.vorschlaege).toHaveLength(1);
    expect(nameOhneStuecke(name, ergebnis.stuecke)).toBe(name);
  });

  it('trifft das Mockup von morgen, wenn heute der 24.10.2026 ist', () => {
    const ergebnis = parse('Arzt anrufen morgen 9 Uhr p1 #Geld', {
      heute: '2026-10-24',
      projekte: [{ id: 4, name: 'Geld' }],
    });
    expect(ergebnis.datum).toBe('2026-10-25');
    expect(ergebnis.uhrzeit).toBe('09:00');
  });
});

describe('Sprachen', () => {
  it('hat für jede Sprache die Wortgruppen', () => {
    for (const sprache of SPRACHEN) {
      expect(WORTE[sprache].heute.length).toBeGreaterThan(0);
      expect(WORTE[sprache].morgen.length).toBeGreaterThan(0);
      expect(WORTE[sprache].uebermorgen.length).toBeGreaterThan(0);
      expect(WORTE[sprache].wochentage).toHaveLength(7);
      expect(WORTE[sprache].monate).toHaveLength(12);
      if (WORTE[sprache].zahlZuerst) {
        expect(WORTE[sprache].tag.length).toBeGreaterThan(0);
      } else {
        expect(WORTE[sprache].in.length).toBeGreaterThan(0);
        expect(WORTE[sprache].tag.length).toBeGreaterThan(0);
      }
    }
  });

  it('lässt englische Wörter in der deutschen Eingabe stehen und deutsche in jeder Sprache gelten', () => {
    expect(parse('tomorrow').datum).toBeNull();
    expect(parse('do', { sprache: 'en' }).datum).toBeNull();
    expect(parse('so', { sprache: 'en' }).datum).toBeNull();
    expect(parse('heute', { sprache: 'en' }).datum).toBe(HEUTE);
    expect(parse('Freitag', { sprache: 'en' }).datum).toBe(HEUTE);
    expect(parse('9 Uhr', { sprache: 'en' }).uhrzeit).toBe('09:00');
    expect(parse('9 am').uhrzeit).toBeNull();
  });

  const faelle: { sprache: Sprache; name: string; datum: string; uhrzeit?: string }[] = [
    { sprache: 'en', name: 'tomorrow', datum: MORGEN },
    { sprache: 'en', name: 'day after tomorrow', datum: UEBERMORGEN },
    { sprache: 'en', name: 'in 1 day', datum: MORGEN },
    { sprache: 'en', name: 'in 3 days', datum: IN_DREI },
    { sprache: 'en', name: 'Friday', datum: HEUTE },
    { sprache: 'en', name: 'Fri', datum: HEUTE },
    { sprache: 'en', name: '20 August', datum: '2027-08-20' },
    { sprache: 'en', name: 'call 9 am', datum: HEUTE, uhrzeit: '09:00' },
    { sprache: 'en', name: 'call 9 pm', datum: HEUTE, uhrzeit: '21:00' },
    { sprache: 'en', name: 'call 12 am', datum: HEUTE, uhrzeit: '00:00' },
    { sprache: 'en', name: 'call 12 pm', datum: HEUTE, uhrzeit: '12:00' },
    { sprache: 'en', name: 'call 9:30 pm', datum: HEUTE, uhrzeit: '21:30' },
    { sprache: 'es', name: 'mañana', datum: MORGEN },
    { sprache: 'es', name: 'pasado mañana', datum: UEBERMORGEN },
    { sprache: 'es', name: 'en 1 día', datum: MORGEN },
    { sprache: 'es', name: 'en 3 días', datum: IN_DREI },
    { sprache: 'es', name: 'viernes', datum: HEUTE },
    { sprache: 'es', name: 'vie', datum: HEUTE },
    { sprache: 'es', name: '20 de agosto', datum: '2027-08-20' },
    { sprache: 'es', name: '9h', datum: HEUTE, uhrzeit: '09:00' },
    { sprache: 'es', name: '9h30', datum: HEUTE, uhrzeit: '09:30' },
    { sprache: 'fr', name: 'demain', datum: MORGEN },
    { sprache: 'fr', name: "aujourd'hui", datum: HEUTE },
    { sprache: 'fr', name: 'après-demain', datum: UEBERMORGEN },
    { sprache: 'fr', name: 'dans 1 jour', datum: MORGEN },
    { sprache: 'fr', name: 'dans 3 jours', datum: IN_DREI },
    { sprache: 'fr', name: 'vendredi', datum: HEUTE },
    { sprache: 'fr', name: 'ven', datum: HEUTE },
    { sprache: 'fr', name: '20 août', datum: '2027-08-20' },
    { sprache: 'fr', name: '9h30', datum: HEUTE, uhrzeit: '09:30' },
    { sprache: 'ru', name: 'завтра', datum: MORGEN },
    { sprache: 'ru', name: 'послезавтра', datum: UEBERMORGEN },
    { sprache: 'ru', name: 'через 1 день', datum: MORGEN },
    { sprache: 'ru', name: 'через 3 дня', datum: IN_DREI },
    { sprache: 'ru', name: 'через 5 дней', datum: '2026-10-28' },
    { sprache: 'ru', name: 'пятница', datum: HEUTE },
    { sprache: 'ru', name: 'пт', datum: HEUTE },
    { sprache: 'ru', name: '20 августа', datum: '2027-08-20' },
    { sprache: 'zh', name: '明天', datum: MORGEN },
    { sprache: 'zh', name: '后天', datum: UEBERMORGEN },
    { sprache: 'zh', name: '3天后', datum: IN_DREI },
    { sprache: 'zh', name: '1天后', datum: MORGEN },
    { sprache: 'zh', name: '星期五', datum: HEUTE },
    { sprache: 'zh', name: '周五', datum: HEUTE },
    { sprache: 'zh', name: '8月20日', datum: '2027-08-20' },
    { sprache: 'zh', name: '2026年8月20日', datum: '2026-08-20' },
    { sprache: 'zh', name: '9点30分', datum: HEUTE, uhrzeit: '09:30' },
    { sprache: 'ja', name: '明日', datum: MORGEN },
    { sprache: 'ja', name: 'あした', datum: MORGEN },
    { sprache: 'ja', name: '明後日', datum: UEBERMORGEN },
    { sprache: 'ja', name: '3日後', datum: IN_DREI },
    { sprache: 'ja', name: '金曜日', datum: HEUTE },
    { sprache: 'ja', name: '金曜', datum: HEUTE },
    { sprache: 'ja', name: '8月20日', datum: '2027-08-20' },
    { sprache: 'ja', name: '9時30分', datum: HEUTE, uhrzeit: '09:30' },
  ];

  it('liest die Formen der anderen Sprachen', () => {
    for (const fall of faelle) {
      const ergebnis = parse(fall.name, { sprache: fall.sprache });
      expect(ergebnis.datum, `${fall.sprache}: ${fall.name}`).toBe(fall.datum);
      if (fall.uhrzeit) {
        expect(ergebnis.uhrzeit, `${fall.sprache}: ${fall.name}`).toBe(fall.uhrzeit);
      }
    }
  });
});
