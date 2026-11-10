import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { rechneZeitverfallAb } from '../features/verfall/verfall.ts';
import { datumPlus, leseJetzt, lokalesDatum, setzeTestzeit, tagesbeginn, testmodusWarnung, zeitpunktFuerEintrag } from './zeit.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const basis = path.join('tmp-test', 'zeit-vitest');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const offen: string[] = [];
let nummer = 0;

const SPIEL_DATEIEN = [
  'server/features/verfall/verfall.ts',
  'server/features/bosse/bossangriffe.ts',
  'server/features/uebersicht/uebersicht.ts',
  'server/features/hinweise/sammler.ts',
  'server/features/verbindungen/kalender.ts',
  'server/features/investitionen/ausruestung.ts',
  'server/features/verbindungen/abgleich.ts',
  'server/features/attribute/attribute.ts',
  'server/features/aufgaben/aufgaben.ts',
  'server/features/basis/basis.ts',
  'server/features/bewertung/bewertung.ts',
  'server/features/erfolge/erfolge.ts',
  'server/features/faehigkeiten/faehigkeiten.ts',
  'server/features/rueckblick/rueckblick.ts',
  'server/features/statistiken/statistiken.ts',
  'server/features/ziele/visionen.ts',
  'server/features/ziele/vorhaben.ts',
  'server/services/struktur.ts',
  'server/services/profilStart.ts',
  'server/features/verbindungen/todoistAbgleich.ts',
  'server/features/verbindungen/todoist.ts',
  'server/features/training/einheiten.ts',
  'server/features/training/lesen.ts',
  'server/features/training/saetze.ts',
];

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function kuenftigerTesttag(): string {
  return `${new Date().getFullYear() + 1}-06-15`;
}

function mitTesttag(datum: string | null, lauf: () => void): void {
  const vorher = process.env.STRIDE_TEST;
  process.env.STRIDE_TEST = '1';
  try {
    setzeTestzeit(datum);
    lauf();
  } finally {
    setzeTestzeit(null);
    if (vorher === undefined) {
      delete process.env.STRIDE_TEST;
    } else {
      process.env.STRIDE_TEST = vorher;
    }
  }
}

afterEach(() => {
  setzeTestzeit(null);
  for (const datei of offen.splice(0)) {
    schliesseWelt(datei);
  }
});

const JETZT = new Date(2026, 9, 19, 18, 30);

describe('tagesbeginn', () => {
  it('liefert Mitternacht des Tages und rechnet Tage zurück', () => {
    expect(tagesbeginn(JETZT)).toEqual(new Date(2026, 9, 19));
    expect(tagesbeginn(JETZT, 6)).toEqual(new Date(2026, 9, 13));
  });
});

describe('lokalesDatum', () => {
  it('formatiert mit führenden Nullen', () => {
    expect(lokalesDatum(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('datumPlus', () => {
  it('zählt Tage über Monatsgrenzen', () => {
    expect(datumPlus('2026-10-22', 30)).toBe('2026-11-21');
    expect(datumPlus('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('zeitpunktFuerEintrag', () => {
  it('nutzt jetzt ohne Datum oder für heute', () => {
    expect(zeitpunktFuerEintrag(null, JETZT)).toBe(JETZT);
    expect(zeitpunktFuerEintrag('2026-10-19', JETZT)).toBe(JETZT);
  });

  it('legt nachgetragene Tage auf die Mittagszeit', () => {
    expect(zeitpunktFuerEintrag('2026-10-17', JETZT)).toEqual(new Date(2026, 9, 17, 12));
  });

  it('lehnt Zukunft, ungültige Daten und falsche Formate ab', () => {
    expect(() => zeitpunktFuerEintrag('2026-10-20', JETZT)).toThrow('Zukunft');
    expect(() => zeitpunktFuerEintrag('2026-02-31', JETZT)).toThrow('existiert nicht');
    expect(() => zeitpunktFuerEintrag('19.10.2026', JETZT)).toThrow('Format');
  });
});

describe('Spieluhr', () => {
  it('lässt in den Spiel-Dateien keine Uhr ohne Argument zu', () => {
    const verstosse: string[] = [];
    for (const relativ of SPIEL_DATEIEN) {
      const text = readFileSync(path.join(WURZEL, relativ), 'utf8');
      const uhren = text.match(/new Date\(\s*\)/g)?.length ?? 0;
      const jetzt = text.match(/Date\.now\(\s*\)/g)?.length ?? 0;
      if (relativ.endsWith('abgleich.ts')) {
        if (uhren !== 2 || jetzt !== 0) {
          verstosse.push(`${relativ}: ${uhren} mal new Date(), ${jetzt} mal Date.now()`);
        }
        if (!text.includes('stundeInZone(new Date(), gespeichert)') || !text.includes('await pruefeHinweise(new Date(), log)')) {
          verstosse.push(`${relativ}: die zwei Takt-Stellen fehlen`);
        }
      } else if (uhren !== 0 || jetzt !== 0) {
        verstosse.push(`${relativ}: ${uhren} mal new Date(), ${jetzt} mal Date.now()`);
      }
    }
    expect(verstosse).toEqual([]);
  });

  it('warnt nur bei STRIDE_TEST=1', () => {
    expect(testmodusWarnung({ STRIDE_TEST: '1' })).toBe(
      'Testmodus (STRIDE_TEST=1): POST /api/test/heute kann die Spieluhr setzen. Nur für Tests, nie im Betrieb.',
    );
    expect(testmodusWarnung({})).toBeNull();
    expect(testmodusWarnung({ STRIDE_TEST: '0' })).toBeNull();
  });

  it('setzt leseJetzt auf den Mittag des Testtags und sonst auf die echte Uhr', () => {
    const datum = kuenftigerTesttag();
    const [jahr, monat, tag] = datum.split('-').map(Number);
    mitTesttag(datum, () => {
      expect(leseJetzt()).toEqual(new Date(jahr, monat - 1, tag, 12, 0, 0, 0));
    });
    const vor = Date.now();
    const wert = leseJetzt().getTime();
    const nach = Date.now();
    expect(wert).toBeGreaterThanOrEqual(vor);
    expect(wert).toBeLessThanOrEqual(nach);
  });

  it('rechnet den Zeitverfall ohne Argument bis zum Testtag und sonst bis heute', () => {
    const datum = kuenftigerTesttag();
    mitTesttag(datum, () => {
      mitWelt(welt(), () => {
        ausfuehren(`UPDATE attribute SET verfall_zeit = 'leicht', verfall_bis = NULL WHERE kennung = 'koerper'`);
        rechneZeitverfallAb();
        expect(eine<{ bis: string | null }>('SELECT verfall_bis AS bis FROM attribute WHERE kennung = ?', 'koerper')?.bis).toBe(datum);
      });
    });
    mitWelt(welt(), () => {
      ausfuehren(`UPDATE attribute SET verfall_zeit = 'leicht', verfall_bis = NULL WHERE kennung = 'koerper'`);
      const davor = lokalesDatum(new Date());
      rechneZeitverfallAb();
      const danach = lokalesDatum(new Date());
      const bis = eine<{ bis: string | null }>('SELECT verfall_bis AS bis FROM attribute WHERE kennung = ?', 'koerper')?.bis;
      expect(bis === davor || bis === danach).toBe(true);
    });
  });
});
