import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { erfolgName, erfolgSchluessel } from '../../../shared/spiel/erfolge.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { schalteErfolgeFrei } from './erfolge.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-erfolge-'));
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

function legeEintragAn(): void {
  const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper')?.id;
  if (koerper === undefined) {
    throw new Error('Körper fehlt.');
  }
  const vorlage = erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, meilenstein, erstellt_am) VALUES (?, 1, '', 0, ?)`,
    vorlage,
    new Date().toISOString(),
  );
}

describe('schalteErfolgeFrei', () => {
  it('schreibt den Schlüssel auch bei aus und liefert ihn beim nächsten An nicht noch einmal', () => {
    mitWelt(welt(), () => {
      legeEintragAn();
      aendereEinstellungen({ funktionen: { erfolge: false } });
      const schluessel = erfolgSchluessel('eintraege', 1);
      expect(schalteErfolgeFrei()).toEqual([]);
      expect(
        eine<{ schluessel: string }>('SELECT schluessel FROM erfolge WHERE schluessel = ?', schluessel)?.schluessel,
      ).toBe(schluessel);
      aendereEinstellungen({ funktionen: { erfolge: true } });
      const namen = schalteErfolgeFrei();
      expect(namen).not.toContain(erfolgName(schluessel));
      expect(namen).toEqual([]);
      expect(
        eine<{ schluessel: string }>('SELECT schluessel FROM erfolge WHERE schluessel = ?', schluessel)?.schluessel,
      ).toBe(schluessel);
    });
  });
});
