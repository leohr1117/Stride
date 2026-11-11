import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { zeitverfallXp } from '../../../shared/spiel/belastung.ts';
import { tageZwischen } from '../../../shared/spiel/kette.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../../shared/spiel/level.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { lokalesDatum } from '../../services/zeit.ts';
import { aendereAttribut } from '../attribute/attribute.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { rechneZeitverfallAb } from './verfall.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-fremdtaetigkeit-'));
const offen: string[] = [];
let nummer = 0;
const ZEIT = new Date(2026, 5, 2, 12, 0, 0);
const SPAETER = new Date(2026, 5, 5, 12, 0, 0);
const ANFANG = 1000;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function summe(id: number): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', id)?.xp ?? 0;
}

describe('Eintrag ohne das Attribut', () => {
  it('lässt die XP stehen und der Zeitverfall zieht danach ab', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { verfallKoennen: true } });
      const koerper = attributId('koerper');
      const soziales = attributId('soziales');
      ausfuehren(
        `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
        soziales,
        ANFANG,
        '2026-01-01T00:00:00.000Z',
      );
      aendereAttribut(soziales, { verfallZeit: 'mittel' }, ZEIT);
      const vorlage = erstelleVorlage({
        name: 'Nur Körper',
        icon: 'star',
        gewichte: [{ attributId: koerper, gewicht: 1 }],
      });
      const ergebnis = erstelleEintrag(
        {
          projektId: null,
          vorlageId: vorlage.id,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: '',
          meilenstein: false,
          faehigkeitId: null,
          datum: null,
        },
        ZEIT,
      );

      expect(summe(soziales)).toBe(ANFANG);
      expect(
        eine<{ anzahl: number }>(
          'SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE eintrag_id = ? AND attribut_id = ?',
          ergebnis.eintrag.id,
          soziales,
        )?.anzahl,
      ).toBe(0);
      expect(
        eine<{ anzahl: number }>(
          `SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'belastung'`,
          ergebnis.eintrag.id,
        )?.anzahl,
      ).toBe(0);
      expect(
        eine<{ xp: number }>(
          `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE eintrag_id = ? AND attribut_id = ? AND quelle = 'eintrag'`,
          ergebnis.eintrag.id,
          koerper,
        )?.xp ?? 0,
      ).toBeGreaterThan(0);

      const bis = eine<{ bis: string | null }>('SELECT verfall_bis AS bis FROM attribute WHERE id = ?', soziales)?.bis ?? '';
      const heute = lokalesDatum(SPAETER);
      const tage = tageZwischen(bis, heute);
      const aktiv =
        eine<{ tage: number }>(
          `SELECT COUNT(DISTINCT date(erstellt_am, 'localtime')) AS tage FROM xp_ereignisse
           WHERE attribut_id = ? AND xp > 0 AND date(erstellt_am, 'localtime') >= ? AND date(erstellt_am, 'localtime') < ?`,
          soziales,
          bis,
          heute,
        )?.tage ?? 0;
      const kosten = berechneLevel(ANFANG, LEVEL_KURVEN.attribut).xpFuerNaechstes;
      const abzug = zeitverfallXp(tage - aktiv, kosten, ANFANG, 'mittel');
      expect(bis).toBe(lokalesDatum(ZEIT));
      expect(tage).toBeGreaterThan(0);
      expect(aktiv).toBe(0);
      expect(abzug).toBeGreaterThan(0);

      rechneZeitverfallAb(SPAETER);

      expect(summe(soziales)).toBe(ANFANG - abzug);
      expect(
        eine<{ xp: number }>(
          `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ? AND quelle = 'verfall'`,
          soziales,
        )?.xp,
      ).toBe(-abzug);
    });
  });
});
