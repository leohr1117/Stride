import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FARBEN } from '../../../shared/spiel/begriffe.ts';
import type { FokusId, Zielstrebigkeit } from '../../../shared/spiel/profil.ts';
import { VISION } from '../../../shared/spiel/xp.ts';
import { zeige } from '../../../shared/sprache/index.ts';
import { einstellungenAenderungSchema } from '../../validierung.ts';
import { alle, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereEinstellungen, ladeEinstellungen } from './einstellungen.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-onboarding-'));
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

describe('onboarding speichern', () => {
  it('ignoriert alte Start-Felder und erlaubt einen leeren Fokus', () => {
    const ohneJahr = einstellungenAenderungSchema.safeParse({ ...anlage, geburtsjahr: null, fokus: [] });
    expect(ohneJahr.success).toBe(true);
    const alt = einstellungenAenderungSchema.parse({ startVorbild: 1, startBoss: true, fokus: [] });
    expect(alt).not.toHaveProperty('startVorbild');
    expect(alt).not.toHaveProperty('startBoss');
    expect(alt.fokus).toEqual([]);
    expect(
      einstellungenAenderungSchema.safeParse({ startZiel: { art: 'projekt', name: 'Wohnung' } }).success,
    ).toBe(true);
    expect(einstellungenAenderungSchema.safeParse({ startZiel: { art: 'projekt', name: ' ' } }).success).toBe(false);
    expect(einstellungenAenderungSchema.safeParse({ startZiel: { art: 'projekt', name: 'x'.repeat(81) } }).success).toBe(
      false,
    );
  });

  it('legt ohne Jahr und ohne Fokus nichts an und lässt Können an', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({
        charakterName: 'Leo',
        zielstrebigkeit: 'macher',
        fokus: [],
        profilAngelegt: true,
        geburtsjahr: null,
      });
      expect(neu.geburtsjahr).toBeNull();
      expect(neu.fokus).toEqual([]);
      expect(neu.funktionen.koennen).toBe(true);
      expect(neu.funktionen.status).toBe(true);
      expect(neu.funktionen.vorbilder).toBe(false);
      expect(neu.funktionen.bossAngriffe).toBe(false);
      expect(alle('SELECT id FROM vorlagen')).toEqual([]);
      expect(alle('SELECT id FROM projekte')).toEqual([]);
      expect(alle('SELECT id FROM vorhaben')).toEqual([]);
    });
  });

  it('legt je Art genau ein Objekt an und beim zweiten PATCH nichts Zweites', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const vision = aendereEinstellungen({
        ...anlage,
        zielstrebigkeit: 'traeumer',
        startZiel: { art: 'vision', name: 'Marathon' },
      });
      expect(vision.funktionen.vorbilder).toBe(false);
      expect(alle<{ titel: string; farbe: string; level: number }>('SELECT titel, farbe, level FROM visionen')).toEqual([
        { titel: 'Marathon', farbe: FARBEN[6], level: VISION.standardLevel },
      ]);
      aendereEinstellungen({ startZiel: { art: 'vision', name: 'Noch eine' } });
      expect(alle('SELECT id FROM visionen')).toHaveLength(1);
      expect(alle('SELECT id FROM projekte')).toEqual([]);
      expect(alle('SELECT id FROM vorhaben')).toEqual([]);
    });
    mitWelt(welt(), () => {
      aendereEinstellungen({ ...anlage, startZiel: { art: 'projekt', name: 'Wohnung' } });
      expect(alle<{ name: string }>('SELECT name FROM projekte')).toEqual([{ name: 'Wohnung' }]);
      expect(eine<{ name: string }>('SELECT name FROM vorlagen WHERE archiviert = 0 ORDER BY sortierung, id LIMIT 1')?.name).toBe(
        'Training',
      );
      expect(alle('SELECT id FROM vorhaben')).toEqual([]);
      aendereEinstellungen({ startZiel: { art: 'projekt', name: 'Zweites' } });
      expect(alle('SELECT id FROM projekte')).toHaveLength(1);
    });
    mitWelt(welt(), () => {
      const uebung = aendereEinstellungen({
        ...anlage,
        zielstrebigkeit: 'uebung',
        startZiel: { art: 'faehigkeit', name: 'Gitarre' },
      });
      expect(uebung.funktionen.faehigkeiten).toBe(true);
      expect(uebung.ebenen.projekte).toBe(false);
      expect(alle<{ name: string; farbe: string; icon: string }>('SELECT name, farbe, icon FROM faehigkeiten')).toEqual([
        { name: 'Gitarre', farbe: FARBEN[1], icon: 'code' },
      ]);
    });
  });

  it('rollt eine falsche Art zurück und legt kein Projekt ohne Tätigkeit an', () => {
    const datei = welt();
    mitWelt(datei, () => {
      expect(() =>
        aendereEinstellungen({
          ...anlage,
          zielstrebigkeit: 'einfach',
          startZiel: { art: 'vision', name: 'Daneben' },
        }),
      ).toThrow(/Das erste Ziel passt nicht zur Auswahl/);
      expect(ladeEinstellungen().profilAngelegt).toBe(false);
      expect(alle('SELECT id FROM visionen')).toEqual([]);
      expect(() =>
        aendereEinstellungen({
          charakterName: 'Leo',
          zielstrebigkeit: 'macher',
          fokus: [],
          profilAngelegt: true,
          startZiel: { art: 'projekt', name: 'Ohne Tätigkeit' },
        }),
      ).toThrow(/Für ein Projekt braucht es eine Tätigkeit/);
      expect(ladeEinstellungen().profilAngelegt).toBe(false);
      expect(alle('SELECT id FROM projekte')).toEqual([]);
    });
  });

  it('benennt die Start-Tätigkeiten in der Profilsprache', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ ...anlage, sprache: 'fr', startZiel: { art: 'projekt', name: 'Appartement' } });
      const namen = alle<{ name: string }>('SELECT name FROM vorlagen ORDER BY sortierung, id').map((zeile) => zeile.name);
      expect(namen).toContain(zeige('Training', 'fr'));
      expect(namen).not.toContain('Training');
    });
  });
});
