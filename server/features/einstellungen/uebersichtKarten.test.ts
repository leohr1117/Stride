import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, mitWelt, schliesseWelt } from '../../db.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-uebersicht-karten-'));
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

function setzeRoh(schluessel: string, wert: unknown): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

describe('Übersichtskarten', () => {
  it('speichert die Wahl und lässt den Bereichsschalter stehen', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const vorher = ladeEinstellungen();
      expect(vorher.uebersichtKarten.aktivitaet).toBe(true);
      const aus = aendereEinstellungen({ uebersichtKarten: { aktivitaet: false } });
      expect(aus.uebersichtKarten.aktivitaet).toBe(false);
      expect(aus.uebersichtKarten.identitaet).toBe(true);
      expect(aus.funktionen).toEqual(vorher.funktionen);
      const beide = aendereEinstellungen({ uebersichtKarten: { bosse: false } });
      expect(beide.uebersichtKarten.aktivitaet).toBe(false);
      expect(beide.uebersichtKarten.bosse).toBe(false);
      expect(beide.funktionen.bossAngriffe).toBe(vorher.funktionen.bossAngriffe);
      expect(ladeEinstellungen().uebersichtKarten.bosse).toBe(false);
    });
  });

  it('liest nur echte Karten, fehlende bleiben an', () => {
    const datei = welt();
    mitWelt(datei, () => {
      setzeRoh('uebersichtKarten', { aktivitaet: false, fremd: true, identitaet: 'nein' });
      const roh = ladeEinstellungen();
      expect(roh.uebersichtKarten.aktivitaet).toBe(false);
      expect(roh.uebersichtKarten.identitaet).toBe(true);
      expect(roh.uebersichtKarten).not.toHaveProperty('fremd');
    });
  });

  it('verwirft unbekannte Namen beim Speichern', () => {
    const geparst = einstellungenAenderungSchema.parse({
      uebersichtKarten: { aktivitaet: false, fremd: true, identitaet: 'x' },
    });
    expect(geparst.uebersichtKarten).toEqual({ aktivitaet: false });
  });
});
