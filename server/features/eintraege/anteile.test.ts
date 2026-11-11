import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { abzugXp } from '../../../shared/spiel/belastung.ts';
import { eintragXp, verteileTaetigkeit } from '../../../shared/spiel/xp.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereAttribut } from '../attribute/attribute.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { erstelleEintrag, loescheEintrag } from './eintraege.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-anteile-'));
const offen: string[] = [];
let nummer = 0;
const ZEIT = new Date(2026, 5, 2, 12, 0, 0);

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

function nameUndFarbe(id: number): { name: string; farbe: string } {
  const zeile = eine<{ name: string; farbe: string | null }>('SELECT name, farbe FROM attribute WHERE id = ?', id);
  if (!zeile) {
    throw new Error('Attribut fehlt.');
  }
  return { name: zeile.name, farbe: zeile.farbe ?? '' };
}

function setzeXp(id: number, xp: number): void {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
    id,
    xp,
    '2026-01-01T00:00:00.000Z',
  );
}

function xpQuelle(eintragId: number, id: number, quelle: string): number {
  return (
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse
       WHERE eintrag_id = ? AND attribut_id = ? AND quelle = ?`,
      eintragId,
      id,
      quelle,
    )?.xp ?? 0
  );
}

function anzahlQuelle(eintragId: number, id: number, quelle: string): number {
  return (
    eine<{ anzahl: number }>(
      `SELECT COUNT(*) AS anzahl FROM xp_ereignisse
       WHERE eintrag_id = ? AND attribut_id = ? AND quelle = ?`,
      eintragId,
      id,
      quelle,
    )?.anzahl ?? 0
  );
}

function summe(id: number): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', id)?.xp ?? 0;
}

function projektXp(eintragId: number): number {
  return (
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp WHERE eintrag_id = ? AND quelle = 'eintrag'`,
      eintragId,
    )?.xp ?? 0
  );
}

describe('feste Anteile beim Eintrag', () => {
  it('bucht 40 Prozent, die volle Projekt-XP und einen gekappten Abzug', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { verfallKoennen: true } });
      const koerper = attributId('koerper');
      const geist = attributId('geist');
      const soziales = attributId('soziales');
      aendereAttribut(geist, { erschoepfung: false, verfallBelastung: 'mittel' });
      aendereAttribut(soziales, { verfallBelastung: 'mittel' });
      setzeXp(geist, 5);
      setzeXp(soziales, 80);

      const vorlage = erstelleVorlage({
        name: 'Fest',
        icon: 'star',
        festeAnteile: true,
        gewichte: [{ attributId: koerper, gewicht: 40 }],
        abzuege: [{ attributId: geist, prozent: 30 }],
      });
      const projekt = erstelleProjekt({
        name: 'Sache',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlage.id,
      });
      const ergebnis = erstelleEintrag(
        {
          projektId: projekt.id,
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
      const voll = eintragXp(1, ergebnis.eintrag.faktor);
      const anteil = verteileTaetigkeit(voll, [{ attributId: koerper, gewicht: 40 }], true);
      const grund = eintragXp(1);
      const abzug = abzugXp(grund, 30, 5);

      expect(abzug).toBeGreaterThan(0);
      expect(abzug).toBeLessThan(abzugXp(grund, 30, Number.POSITIVE_INFINITY));
      expect(xpQuelle(ergebnis.eintrag.id, koerper, 'eintrag')).toBe(anteil[0]?.xp ?? 0);
      expect(projektXp(ergebnis.eintrag.id)).toBe(voll);
      expect(ergebnis.belohnung.projekt?.xp).toBe(voll);
      expect(xpQuelle(ergebnis.eintrag.id, geist, 'abzug')).toBe(-abzug);
      expect(anzahlQuelle(ergebnis.eintrag.id, geist, 'belastung')).toBe(0);
      expect(anzahlQuelle(ergebnis.eintrag.id, soziales, 'belastung')).toBe(1);
      expect(ergebnis.belohnung.abzugBeiNull).toBeUndefined();

      loescheEintrag(ergebnis.eintrag.id);
      expect(
        eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE eintrag_id = ?', ergebnis.eintrag.id)?.anzahl,
      ).toBe(0);
      expect(summe(geist)).toBe(5);
      expect(summe(soziales)).toBe(80);
    });
  });

  it('sagt schon bei 0 und legt keine Nullzeile an', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const geist = attributId('geist');
      const vorlage = erstelleVorlage({
        name: 'Leer',
        icon: 'star',
        festeAnteile: true,
        gewichte: [{ attributId: koerper, gewicht: 40 }],
        abzuege: [{ attributId: geist, prozent: 30 }],
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
      expect(abzugXp(eintragXp(1), 30, Number.POSITIVE_INFINITY)).toBeGreaterThan(0);
      expect(anzahlQuelle(ergebnis.eintrag.id, geist, 'abzug')).toBe(0);
      expect(ergebnis.belohnung.abzugBeiNull).toEqual([nameUndFarbe(geist)]);
    });
  });
});
