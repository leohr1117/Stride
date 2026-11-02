import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FokusId, Zielstrebigkeit } from '../../../shared/spiel/profil.ts';
import { AKTUELLE_VERSION } from '../../../shared/versionen.ts';
import { mitWelt, schliesseWelt } from '../../db.ts';
import { versionHinweisSchema } from '../../validierung.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';
import { leseVersionsstand, merkeVersionsstand, setzeVersionsstandWennLeer } from './versionHinweis.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-version-hinweis-'));
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

const anlage: {
  charakterName: string;
  zielstrebigkeit: Zielstrebigkeit;
  fokus: FokusId[];
  profilAngelegt: boolean;
} = {
  charakterName: 'Leo',
  zielstrebigkeit: 'macher',
  fokus: ['sport'],
  profilAngelegt: true,
};

describe('versionHinweis', () => {
  it('setzt bei der Erstinstallation beide Werte und lässt einen vorhandenen Stand stehen', () => {
    mitWelt(welt(), () => {
      expect(ladeEinstellungen().versionHinweis).toEqual({ benachrichtigt: null, gesehen: null });
      const neu = aendereEinstellungen(anlage);
      expect(neu.versionHinweis).toEqual({ benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION });
    });
    mitWelt(welt(), () => {
      merkeVersionsstand({ gesehen: '1.0.0' });
      setzeVersionsstandWennLeer(AKTUELLE_VERSION);
      expect(leseVersionsstand()).toEqual({ benachrichtigt: AKTUELLE_VERSION, gesehen: '1.0.0' });
    });
  });

  it('merkt nur die geschickten Felder und lehnt eine leere Änderung ab', () => {
    mitWelt(welt(), () => {
      merkeVersionsstand(versionHinweisSchema.parse({ benachrichtigt: '3.33.0' }));
      expect(leseVersionsstand()).toEqual({ benachrichtigt: '3.33.0', gesehen: null });
      merkeVersionsstand(versionHinweisSchema.parse({ gesehen: '3.34.0' }));
      expect(leseVersionsstand()).toEqual({ benachrichtigt: '3.33.0', gesehen: '3.34.0' });
    });
    expect(versionHinweisSchema.safeParse({}).success).toBe(false);
    expect(versionHinweisSchema.safeParse({ benachrichtigt: 'drei' }).success).toBe(false);
  });
});
