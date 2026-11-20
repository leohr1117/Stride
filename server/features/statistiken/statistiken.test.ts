import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EintragDaten } from '../../../shared/api/index.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { ladeStatistiken } from './statistiken.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-statistik-'));
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

function eintrag(vorlageId: number, stunden: number): EintragDaten {
  return {
    projektId: null,
    vorlageId,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  };
}

describe('Tätigkeiten in der Statistik', () => {
  it('zeigt bei einem Eintrag ohne Projekt die Stunden und die Eintrags-XP', () => {
    mitWelt(welt(), () => {
      const vorlageId = erstelleVorlage({
        name: 'Ohne Projekt',
        icon: 'star',
        gewichte: [
          { attributId: attributId('koerper'), gewicht: 1 },
          { attributId: attributId('geist'), gewicht: 1 },
        ],
      }).id;
      erstelleEintrag(eintrag(vorlageId, 2));

      const zeile = ladeStatistiken('gesamt').vorlagen.find((vorlage) => vorlage.id === vorlageId);
      const gebucht = eine<{ xp: number; anzahl: number }>(
        `SELECT COALESCE(SUM(x.xp), 0) AS xp, COUNT(*) AS anzahl
         FROM xp_ereignisse x
         JOIN eintraege e ON e.id = x.eintrag_id
         WHERE x.quelle = 'eintrag' AND e.vorlage_id = ?`,
        vorlageId,
      );
      const projektXp = eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp')?.xp ?? 0;

      expect(projektXp).toBe(0);
      expect(gebucht?.anzahl).toBeGreaterThan(1);
      expect(zeile?.xp).toBe(gebucht?.xp);
      expect(zeile?.xp).toBeGreaterThan(0);
      expect(zeile?.stunden).toBe(2);
    });
  });

  it('lässt eine Tätigkeit mit Stunden und ohne Eintrags-XP in der Liste', () => {
    mitWelt(welt(), () => {
      const vorlageId = erstelleVorlage({
        name: 'Still',
        icon: 'star',
        gewichte: [{ attributId: attributId('koerper'), gewicht: 1 }],
      }).id;
      ausfuehren(
        `INSERT INTO eintraege (vorlage_id, stunden, notiz, nur_abzug, erstellt_am) VALUES (?, 3, '', 0, ?)`,
        vorlageId,
        new Date().toISOString(),
      );

      const zeile = ladeStatistiken('gesamt').vorlagen.find((vorlage) => vorlage.id === vorlageId);
      expect(zeile).toMatchObject({ xp: 0, stunden: 3, name: 'Still' });
    });
  });
});
