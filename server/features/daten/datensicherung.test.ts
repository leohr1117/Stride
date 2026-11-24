import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatenExport } from '../../../shared/api/daten.ts';
import { KONFIG } from '../../config.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt, sichereDatenbank } from '../../db.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleFaehigkeit } from '../faehigkeiten/faehigkeiten.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { exportiereDaten, importiereDaten } from './datensicherung.ts';

const basis = path.resolve(import.meta.dirname, '../../..', 'tmp-test', 'datensicherung');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const datenPfad = path.join(ordner, 'app.db');
const urspruenglicherPfad = KONFIG.datenbankPfad;
const offen: string[] = [];
let nummer = 0;
const LEERER_VERWEIS = 999999;
const STEMPEL_13 = '2026-11-10T13-00-00-000Z';

function setzeDatenbankPfad(pfad: string): void {
  (KONFIG as { datenbankPfad: string }).datenbankPfad = pfad;
}

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

beforeEach(() => {
  setzeDatenbankPfad(datenPfad);
});

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
  setzeDatenbankPfad(urspruenglicherPfad);
});

function verweisInsLeere(sicherung: DatenExport, faehigkeitId: number): DatenExport {
  let getroffen = false;
  const eintraege = (sicherung.tabellen.eintraege ?? []).map((zeile) => {
    if (Number(zeile.faehigkeit_id) !== faehigkeitId) {
      return zeile;
    }
    getroffen = true;
    return { ...zeile, faehigkeit_id: LEERER_VERWEIS };
  });
  if (!getroffen) {
    throw new Error('Die Sicherung enthält keinen Eintrag mit Fähigkeit.');
  }
  return { ...sicherung, tabellen: { ...sicherung.tabellen, eintraege } };
}

describe('Datensicherung', () => {
  it('nimmt eine volle Sicherung mit Kindzeilen wieder auf und weist einen leeren Verweis ab', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ funktionen: { faehigkeiten: true } });
      const faehigkeit = erstelleFaehigkeit({ name: 'Handwerk', beschreibung: '', farbe: '#34d399', icon: 'sparkles' });
      const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper');
      if (!koerper) {
        throw new Error('Körper fehlt.');
      }
      const vorlage = erstelleVorlage({
        name: 'Tun',
        icon: 'star',
        gewichte: [{ attributId: koerper.id, gewicht: 1 }],
      });
      erstelleEintrag(
        {
          projektId: null,
          vorlageId: vorlage.id,
          vorhaben: null,
          abschluss: null,
          erkenntnis: '',
          stunden: 1,
          notiz: 'Kindzeile',
          meilenstein: false,
          faehigkeitId: faehigkeit.id,
          datum: null,
        },
        new Date('2026-11-10T12:00:00.000Z'),
      );

      const sicherung = exportiereDaten(new Date('2026-11-10T12:00:00.000Z'));
      const kind = sicherung.tabellen.eintraege?.find((zeile) => zeile.notiz === 'Kindzeile');
      expect(Number(kind?.faehigkeit_id)).toBe(faehigkeit.id);
      expect(sicherung.tabellen.faehigkeiten?.some((zeile) => Number(zeile.id) === faehigkeit.id)).toBe(true);

      ausfuehren('UPDATE eintraege SET notiz = ? WHERE notiz = ?', 'weg', 'Kindzeile');
      expect(eine('SELECT id FROM eintraege WHERE notiz = ?', 'Kindzeile')).toBeUndefined();

      const ergebnis = importiereDaten(sicherung, new Date('2026-11-10T13:00:00.000Z'));
      expect(ergebnis.zeilen).toBeGreaterThan(0);
      expect(ergebnis.sicherung).toBe(`${path.basename(datei, '.db')}-vor-import-${STEMPEL_13}.db`);
      expect(existsSync(path.join(ordner, 'sicherungen', ergebnis.sicherung))).toBe(true);
      const wieder = eine<{ faehigkeitId: number | bigint }>(
        'SELECT faehigkeit_id AS faehigkeitId FROM eintraege WHERE notiz = ?',
        'Kindzeile',
      );
      expect(Number(wieder?.faehigkeitId)).toBe(faehigkeit.id);
      expect(eine('SELECT id FROM eintraege WHERE notiz = ?', 'weg')).toBeUndefined();
      expect(eine<{ id: number }>('SELECT id FROM faehigkeiten WHERE id = ?', faehigkeit.id)?.id).toBe(faehigkeit.id);

      expect(() => importiereDaten(verweisInsLeere(sicherung, faehigkeit.id), new Date('2026-11-10T14:00:00.000Z'))).toThrow(
        /unvollständig/,
      );
      expect(
        Number(
          eine<{ faehigkeitId: number | bigint }>(
            'SELECT faehigkeit_id AS faehigkeitId FROM eintraege WHERE notiz = ?',
            'Kindzeile',
          )?.faehigkeitId,
        ),
      ).toBe(faehigkeit.id);
    });
  });

  it('wählt bei gleichem Zeitpunkt den nächsten freien Namen', () => {
    const zeit = new Date('2026-11-10T13:00:00.000Z');
    mitWelt(welt(), () => {
      const erste = sichereDatenbank('vor-import', zeit);
      const zweite = sichereDatenbank('vor-import', zeit);
      const dritte = sichereDatenbank('vor-import', zeit);
      const basisname = path.basename(erste, '.db');
      expect(path.dirname(erste)).toBe(path.join(ordner, 'sicherungen'));
      expect(basisname.endsWith(STEMPEL_13)).toBe(true);
      expect(basisname.endsWith('-2')).toBe(false);
      expect(path.basename(zweite)).toBe(`${basisname}-2.db`);
      expect(path.basename(dritte)).toBe(`${basisname}-3.db`);
      expect(existsSync(erste)).toBe(true);
      expect(existsSync(zweite)).toBe(true);
      expect(existsSync(dritte)).toBe(true);
    });
  });
});
