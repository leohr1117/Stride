import { describe, expect, it } from 'vitest';
import {
  HINWEIS_REIHENFOLGE,
  waehleHinweis,
  type HinweisAnlass,
  type HinweisArt,
  type HinweisEingabe,
} from './hinweis.ts';

function anlass(art: HinweisArt, name: string, bezugId: number | null = null): HinweisAnlass {
  return { art, name, ziel: '/', bezugId };
}

function eingabe(ueber: Partial<HinweisEingabe> = {}): HinweisEingabe {
  return {
    stunde: 9,
    minute: 0,
    ruheVon: '22:00',
    ruheBis: '08:00',
    schalter: { streak: true, rueckkehr: true, boss: true },
    schonGesendet: false,
    anlaesse: [anlass('boss', 'Lauf beginnen', 3), anlass('streak', '4'), anlass('rueckkehr', '30. Okt.', 7)],
    ...ueber,
  };
}

function fremd(art: string, name: string, bezugId: number): HinweisAnlass {
  return { art, name, ziel: '/aufgaben', bezugId } as unknown as HinweisAnlass;
}

describe('Hinweiswahl', () => {
  it('kennt nur Streak, Rückkehr und Boss, in dieser Reihenfolge', () => {
    expect([...HINWEIS_REIHENFOLGE]).toEqual(['streak', 'rueckkehr', 'boss']);
  });

  it('nimmt Streak vor Rückkehr und Boss, auch wenn Boss vorne steht', () => {
    const stand = eingabe();
    expect(waehleHinweis(stand)).toBe(stand.anlaesse[1]);
    expect(waehleHinweis(stand)?.art).toBe('streak');
  });

  it('nimmt bei zwei Streaks den ersten Treffer derselben Art', () => {
    const spaeter = anlass('streak', '9');
    const frueher = anlass('streak', '4');
    expect(waehleHinweis(eingabe({ anlaesse: [spaeter, frueher] }))).toBe(spaeter);
  });

  it('lässt Fällig und Training aus, auch wenn sie vor den drei Arten stehen und an wären', () => {
    const rueckkehr = anlass('rueckkehr', '30. Okt.', 7);
    const schalter = {
      faellig: true,
      training: true,
      streak: false,
      rueckkehr: true,
      boss: true,
    } as HinweisEingabe['schalter'];
    const ergebnis = waehleHinweis(
      eingabe({
        schalter,
        anlaesse: [fremd('faellig', 'Arzt', 1), fremd('training', 'Beine', 2), anlass('boss', 'Lauf', 3), rueckkehr],
      }),
    );
    expect(ergebnis).toBe(rueckkehr);
  });

  it('filtert ausgeschaltete Schalter und gibt null, wenn keiner an ist', () => {
    const boss = anlass('boss', 'Lauf', 3);
    expect(
      waehleHinweis(
        eingabe({
          schalter: { streak: false, rueckkehr: false, boss: true },
          anlaesse: [anlass('streak', '4'), anlass('rueckkehr', '30. Okt.', 7), boss],
        }),
      ),
    ).toBe(boss);
    expect(
      waehleHinweis(eingabe({ schalter: { streak: false, rueckkehr: false, boss: false } })),
    ).toBeNull();
    expect(waehleHinweis(eingabe({ anlaesse: [] }))).toBeNull();
  });

  it('gibt null, sobald der Tag schon gesendet ist, und lässt die Eingabe stehen', () => {
    const stand = eingabe({ schonGesendet: true });
    const vorher = structuredClone(stand);
    expect(waehleHinweis(stand)).toBeNull();
    expect(stand).toEqual(vorher);
  });

  it('gibt in der Ruhezeit null und markiert den Tag nicht', () => {
    const stand = eingabe({ stunde: 23, minute: 15 });
    const vorher = structuredClone(stand);
    expect(waehleHinweis(stand)).toBeNull();
    expect(stand).toEqual(vorher);
    expect(stand.schonGesendet).toBe(false);
  });

  it('sendet, wenn Von und Bis gleich sind', () => {
    const stand = eingabe({ stunde: 8, minute: 0, ruheVon: '08:00', ruheBis: '08:00' });
    expect(waehleHinweis(stand)?.art).toBe('streak');
    expect(waehleHinweis(eingabe({ stunde: 3, minute: 0, ruheVon: '08:00', ruheBis: '08:00' }))?.art).toBe('streak');
    expect(waehleHinweis(eingabe({ stunde: 22, minute: 0, ruheVon: '22:00', ruheBis: '22:00' }))?.art).toBe('streak');
  });

  it('lässt eine ungültige Uhrzeit nicht als Ruhefenster gelten', () => {
    expect(waehleHinweis(eingabe({ stunde: 3, minute: 0, ruheVon: '25:00', ruheBis: '08:00' }))?.art).toBe('streak');
    expect(waehleHinweis(eingabe({ stunde: 3, minute: 0, ruheVon: '22:00', ruheBis: 'abc' }))?.art).toBe('streak');
  });

  it('zählt den Anfang der Ruhezeit mit und das Ende nicht', () => {
    const fenster = { ruheVon: '09:00', ruheBis: '17:00' };
    expect(waehleHinweis(eingabe({ ...fenster, stunde: 8, minute: 59 }))?.art).toBe('streak');
    expect(waehleHinweis(eingabe({ ...fenster, stunde: 9, minute: 0 }))).toBeNull();
    expect(waehleHinweis(eingabe({ ...fenster, stunde: 16, minute: 59 }))).toBeNull();
    expect(waehleHinweis(eingabe({ ...fenster, stunde: 17, minute: 0 }))?.art).toBe('streak');
  });

  it('deckt das Fenster über Mitternacht, um Bis ist es vorbei', () => {
    const faelle: Array<[number, number, HinweisArt | null]> = [
      [21, 59, 'streak'],
      [22, 0, null],
      [23, 30, null],
      [0, 0, null],
      [7, 59, null],
      [8, 0, 'streak'],
      [12, 0, 'streak'],
    ];
    for (const [stunde, minute, art] of faelle) {
      expect(waehleHinweis(eingabe({ stunde, minute }))?.art ?? null).toBe(art);
    }
  });
});
