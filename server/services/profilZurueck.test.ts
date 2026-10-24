import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PROFILNAME_PLATZHALTER, profilFragenOffen } from '../../shared/spiel/profil.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { ladeAttribute } from '../features/attribute/attribute.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { setzeProfilZurueck } from './profilZurueck.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-zurueck-'));
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

function anzahl(tabelle: string): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle}`)?.n ?? 0;
}

function checkpoint(datei: string): Buffer {
  mitWelt(datei, () => {
    ausfuehren('PRAGMA wal_checkpoint(TRUNCATE)');
  });
  schliesseWelt(datei);
  return fs.readFileSync(datei);
}

describe('profil zurücksetzen', () => {
  it('leert nur die eigene Welt und lässt eine andere unberührt', () => {
    const eigene = welt();
    const fremde = welt();

    mitWelt(fremde, () => {
      ausfuehren(`INSERT INTO visionen (titel, farbe) VALUES ('Fremd', '#abcdef')`);
      aendereEinstellungen({
        charakterName: 'Fremd',
        geburtsjahr: 1980,
        zielstrebigkeit: 'macher',
        fokus: ['geld'],
        profilAngelegt: true,
      });
    });
    const fremdDatei = checkpoint(fremde);

    mitWelt(eigene, () => {
      const vorlage = ausfuehren(`INSERT INTO vorlagen (name, icon) VALUES ('Eigen', 'star')`).id;
      const vision = ausfuehren(`INSERT INTO visionen (titel, farbe) VALUES ('Traum', '#112233')`).id;
      const projekt = ausfuehren(
        `INSERT INTO projekte (vision_id, standard_vorlage_id, name) VALUES (?, ?, 'Projekt')`,
        vision,
        vorlage,
      ).id;
      ausfuehren(`INSERT INTO vorhaben (projekt_id, titel) VALUES (?, 'Vorhaben')`, projekt);
      ausfuehren(
        `INSERT INTO eintraege (projekt_id, vorlage_id, notiz, erstellt_am) VALUES (?, ?, 'Tag', '2026-10-20T12:00:00')`,
        projekt,
        vorlage,
      );
      ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Eigen', '', '#ffffff', 'star', 80)`,
      );
      aendereEinstellungen({
        charakterName: 'Ich',
        geburtsjahr: 1991,
        zielstrebigkeit: 'traeumer',
        fokus: ['sport'],
        profilAngelegt: true,
      });
      expect(anzahl('eintraege')).toBe(1);
      expect(anzahl('visionen')).toBe(1);
      expect(anzahl('projekte')).toBe(1);
      expect(anzahl('vorhaben')).toBe(1);
      expect(anzahl('vorlagen')).toBe(4);
      expect(eine<{ name: string }>(`SELECT name FROM vorlagen WHERE name = 'Eigen'`)?.name).toBe('Eigen');
      expect(ladeEinstellungen().profilAngelegt).toBe(true);

      const neu = setzeProfilZurueck();
      expect(neu).toMatchObject({
        charakterName: PROFILNAME_PLATZHALTER,
        geburtsjahr: null,
        zielstrebigkeit: null,
        fokus: [],
        profilAngelegt: false,
        weltLeer: true,
      });
      expect(profilFragenOffen(neu)).toBe(true);
      expect(anzahl('eintraege')).toBe(0);
      expect(anzahl('visionen')).toBe(0);
      expect(anzahl('projekte')).toBe(0);
      expect(anzahl('vorhaben')).toBe(0);
      expect(anzahl('vorlagen')).toBe(0);
      expect(ladeAttribute(false).some((attribut) => attribut.name === 'Eigen')).toBe(false);
      expect(ladeAttribute(false)).toHaveLength(10);
    });

    expect(fs.readFileSync(fremde).equals(fremdDatei)).toBe(true);
    expect(
      mitWelt(fremde, () => ({
        name: ladeEinstellungen().charakterName,
        jahr: ladeEinstellungen().geburtsjahr,
        ziel: ladeEinstellungen().zielstrebigkeit,
        fokus: ladeEinstellungen().fokus,
        profil: ladeEinstellungen().profilAngelegt,
        visionen: anzahl('visionen'),
      })),
    ).toEqual({
      name: 'Fremd',
      jahr: 1980,
      ziel: 'macher',
      fokus: ['geld'],
      profil: true,
      visionen: 1,
    });
  });
});
