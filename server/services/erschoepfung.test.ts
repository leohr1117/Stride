import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { erschoepfungsBild, erschoepfungsFaktor } from '../../shared/spiel/belastung.ts';
import { LEVEL_KURVEN, xpBisLevel } from '../../shared/spiel/level.ts';
import { momentumFuerSerie } from '../../shared/spiel/momentum.ts';
import { basisXp } from '../../shared/spiel/xp.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { aendereAttribut, ladeErschoepfungen } from '../features/attribute/attribute.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { ladeUebersicht } from '../features/uebersicht/uebersicht.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-erschoepfung-'));
const offen: string[] = [];
let nummer = 0;

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

function setzeLevel(id: number, level: number): void {
  const xp = xpBisLevel(level, LEVEL_KURVEN.attribut);
  if (xp <= 0) {
    return;
  }
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
    id,
    xp,
    '2026-01-01T00:00:00.000Z',
  );
}

function eintragXpAuf(eintragId: number, id: number): number {
  return (
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse
       WHERE eintrag_id = ? AND attribut_id = ? AND quelle = 'eintrag'`,
      eintragId,
      id,
    )?.xp ?? 0
  );
}

function gespeicherterFaktor(eintragId: number): number {
  return eine<{ faktor: number }>('SELECT faktor FROM eintraege WHERE id = ?', eintragId)?.faktor ?? 1;
}

function logge(vorlageId: number) {
  return erstelleEintrag(
    {
      projektId: null,
      vorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: 1,
      notiz: '',
      meilenstein: false,
      faehigkeitId: null,
      datum: null,
    },
    new Date(2026, 5, 2, 12, 0, 0),
  );
}

describe('mehrere Erschöpfungen', () => {
  it('multipliziert zwei gezielte Regeln auf dasselbe Attribut', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const geist = attributId('geist');
      const soziales = attributId('soziales');
      setzeLevel(koerper, 20);
      aendereAttribut(geist, { erschoepfung: true, erschoepfungZiel: koerper });
      aendereAttribut(soziales, { erschoepfung: true, erschoepfungZiel: koerper });
      const faktorGeist = erschoepfungsFaktor(1, 20);
      const faktorSoziales = erschoepfungsFaktor(1, 20);
      const vorlageId = erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
      const ergebnis = logge(vorlageId);
      const roh = Math.round(basisXp(1) * gespeicherterFaktor(ergebnis.eintrag.id));
      expect(eintragXpAuf(ergebnis.eintrag.id, koerper)).toBe(Math.round(roh * faktorGeist * faktorSoziales));

      const bild = erschoepfungsBild(ladeErschoepfungen());
      expect(bild.allgemein).toBeNull();
      expect(bild.ursachen).toEqual(expect.arrayContaining([geist, soziales]));
      expect(bild.jeZiel).toEqual([{ zielId: koerper, prozent: Math.round((1 - faktorGeist * faktorSoziales) * 100) }]);
      expect(ladeUebersicht().erschoepfungen).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ attributId: geist, zielId: koerper }),
          expect.objectContaining({ attributId: soziales, zielId: koerper }),
        ]),
      );
    });
  });

  it('multipliziert eine allgemeine und eine gezielte Regel', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      const geist = attributId('geist');
      const soziales = attributId('soziales');
      setzeLevel(koerper, 20);
      aendereAttribut(geist, { erschoepfung: true, erschoepfungZiel: null });
      aendereAttribut(soziales, { erschoepfung: true, erschoepfungZiel: koerper });
      const allgemein = erschoepfungsFaktor(1, 20);
      const gezielt = erschoepfungsFaktor(1, 20);
      const vorlageId = erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
      const ergebnis = logge(vorlageId);
      const faktor = momentumFuerSerie(1) * allgemein;
      expect(gespeicherterFaktor(ergebnis.eintrag.id)).toBeCloseTo(faktor);
      expect(eintragXpAuf(ergebnis.eintrag.id, koerper)).toBe(Math.round(Math.round(basisXp(1) * faktor) * gezielt));

      const bild = erschoepfungsBild(ladeErschoepfungen());
      expect(bild.ursachen).toEqual(expect.arrayContaining([geist, soziales]));
      expect(bild.allgemein).toBe(Math.round((1 - allgemein) * 100));
      expect(bild.jeZiel).toEqual([{ zielId: koerper, prozent: Math.round((1 - gezielt) * 100) }]);
    });
  });
});
