import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { betragVorschlaege } from '../../../shared/spiel/betragVorschlag.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { bucheAttributXp, bucheProjektXp } from '../../services/fortschritt.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { ladeInvestitionsRhythmus } from './rhythmus.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-rhythmus-'));
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

describe('Rhythmus der Investition', () => {
  it('liefert vier Wochen und zählt Eintragswochen', () => {
    mitWelt(welt(), () => {
      const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper')?.id;
      if (koerper === undefined) {
        throw new Error('Körper fehlt.');
      }
      const vorlage = erstelleVorlage({
        name: 'Tun',
        icon: 'star',
        gewichte: [{ attributId: koerper, gewicht: 1 }],
      }).id;
      const projekt = erstelleProjekt({
        name: 'Bau',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlage,
      }).id;
      const jetzt = new Date(2026, 5, 17, 12, 0, 0);
      ausfuehren(
        `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
        vorlage,
        '2026-06-01T10:00:00.000Z',
      );
      ausfuehren(
        `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
        vorlage,
        '2026-06-10T10:00:00.000Z',
      );
      bucheAttributXp(
        { quelle: 'eintrag', attributId: koerper, xp: 240, eintragId: null, vorhabenId: null },
        '2026-06-10T10:00:00.000Z',
      );
      bucheProjektXp(
        { quelle: 'eintrag', projektId: projekt, xp: 520, eintragId: null, vorhabenId: null },
        '2026-06-10T10:00:00.000Z',
      );
      bucheAttributXp(
        { quelle: 'eintrag', attributId: koerper, xp: 9_000, eintragId: null, vorhabenId: null },
        '2099-06-01T00:00:00.000Z',
      );
      const rhythmus = ladeInvestitionsRhythmus(jetzt);
      expect(rhythmus.wochenMitEintraegen).toBeGreaterThanOrEqual(2);
      expect(rhythmus.posten.find((eintrag) => eintrag.art === 'attribut' && eintrag.id === koerper)?.xp).toBe(240);
      expect(rhythmus.posten.find((eintrag) => eintrag.art === 'projekt' && eintrag.id === projekt)?.xp).toBe(520);
      expect(betragVorschlaege(rhythmus.posten, koerper, null, rhythmus.wochenMitEintraegen)).toEqual([50, 250, 800]);
      expect(betragVorschlaege(rhythmus.posten, koerper, { art: 'projekt', id: projekt }, rhythmus.wochenMitEintraegen)[0]).toBe(200);
    });
  });

  it('bleibt ohne Einträge bei den festen Beträgen', () => {
    mitWelt(welt(), () => {
      const rhythmus = ladeInvestitionsRhythmus(new Date(2026, 5, 17, 12, 0, 0));
      expect(rhythmus.wochenMitEintraegen).toBe(0);
      expect(betragVorschlaege(rhythmus.posten, 1, null, rhythmus.wochenMitEintraegen)).toEqual([100, 300, 800]);
    });
  });
});
