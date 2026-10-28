import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ebenenFuerStufe, standardEbenen } from '../../shared/spiel/ebenen.ts';
import { FOKUS_IDS, startKennungen, startTaetigkeiten, START_TAETIGKEITEN } from '../../shared/spiel/profil.ts';
import { ZIEL_SPRACHEN } from '../../shared/sprache/kern.ts';
import { zeige } from '../../shared/sprache/index.ts';
import { mitAnfrageSprache } from '../anfrageSprache.ts';
import { alle, ausfuehren, mitWelt, schliesseWelt } from '../db.ts';
import { ladeAttribute } from '../features/attribute/attribute.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { wendeFokusAn } from './profilStart.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-profil-'));
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

function aktiveKennungen(): string[] {
  return ladeAttribute(false)
    .flatMap((attribut) => (attribut.kennung === null ? [] : [attribut.kennung]))
    .sort();
}

function vorlagenNamen(): string[] {
  return alle<{ name: string }>('SELECT name FROM vorlagen ORDER BY sortierung, id').map((zeile) => zeile.name);
}

function uebungsNamen(): string[] {
  return alle<{ name: string }>('SELECT name FROM uebungen ORDER BY id').map((zeile) => zeile.name);
}

function gewichtPaare(name: string): string[] {
  return alle<{ kennung: string; gewicht: number }>(
    `SELECT a.kennung AS kennung, g.gewicht AS gewicht
     FROM vorlage_gewichte g
     JOIN vorlagen v ON v.id = g.vorlage_id
     JOIN attribute a ON a.id = g.attribut_id
     WHERE v.name = ?
     ORDER BY a.kennung`,
    name,
  ).map((zeile) => `${zeile.kennung}:${zeile.gewicht}`);
}

describe('profil beim start', () => {
  it('erkennt eine frische Welt und merkt sich die Antworten', () => {
    const datei = welt();
    expect(mitWelt(datei, () => ladeEinstellungen().weltLeer)).toBe(true);
    expect(mitWelt(datei, () => ladeEinstellungen().profilAngelegt)).toBe(false);
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({
        charakterName: 'Leo',
        geburtsjahr: 1991,
        zielstrebigkeit: 'traeumer',
        fokus: ['sport'],
        profilAngelegt: true,
      });
      expect(neu).toMatchObject({
        charakterName: 'Leo',
        geburtsjahr: 1991,
        zielstrebigkeit: 'traeumer',
        fokus: ['sport'],
        profilAngelegt: true,
        weltLeer: false,
      });
      expect(vorlagenNamen()).toEqual(['Training', 'Laufen', 'Dehnen']);
      expect(aktiveKennungen()).toEqual([...startKennungen(['sport'])].sort());
      expect(neu.ebenen).toEqual(ebenenFuerStufe('traeumer'));
      expect(neu.funktionen.koennen).toBe(true);
      expect(neu.funktionen.status).toBe(false);
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'intellekt')?.archiviert).toBe(true);
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'koerper')?.archiviert).toBe(false);
    });
  });

  it('lässt eine befüllte Welt und eigene Werte in Ruhe', () => {
    const datei = welt();
    mitWelt(datei, () => {
      ausfuehren(`INSERT INTO visionen (titel, farbe) VALUES ('Traum', '#112233')`);
      ausfuehren(
        `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Eigen', '', '#ffffff', 'star', 80)`,
      );
      expect(ladeEinstellungen().weltLeer).toBe(false);
      aendereEinstellungen({ fokus: ['sport'], profilAngelegt: true });
      expect(ladeEinstellungen().ebenen).toEqual(standardEbenen());
      expect(ladeAttribute(false).some((attribut) => attribut.name === 'Eigen' && !attribut.archiviert)).toBe(true);
    });
  });

  it('blendet beim Fokuswechsel die nicht mehr gewählten Katalog-Werte aus', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ fokus: ['sport'] });
      aendereEinstellungen({ fokus: ['geld'] });
      expect(aktiveKennungen()).toEqual([...startKennungen(['geld'])].sort());
      expect(ladeEinstellungen().funktionen).toMatchObject({ koennen: true, status: true });
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'freiheit')?.archiviert).toBe(false);
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'autoritaet')?.archiviert).toBe(true);
    });
  });

  it('ändert bei einem Namenswechsel keine Attribute und speichert einen leeren Fokus', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ charakterName: 'NurName' });
      expect(ladeAttribute(false)).toHaveLength(10);
      expect(vorlagenNamen()).toEqual([]);
      const neu = aendereEinstellungen({ fokus: [] });
      expect(neu.fokus).toEqual([]);
      expect(neu.funktionen.koennen).toBe(true);
      expect(neu.funktionen.status).toBe(true);
      expect(vorlagenNamen()).toEqual([]);
      expect(ladeAttribute(false)).toHaveLength(10);
      expect(() => wendeFokusAn([])).toThrow(/Fokus/);
    });
  });

  it('ignoriert ungültige gespeicherte Antworten', () => {
    const datei = welt();
    mitWelt(datei, () => {
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('zielstrebigkeit', ?), ('fokus', ?), ('profilAngelegt', ?)`,
        '"nein"',
        '["sport","sport","quatsch"]',
        '"ja"',
      );
      const geladen = ladeEinstellungen();
      expect(geladen.zielstrebigkeit).toBeNull();
      expect(geladen.fokus).toEqual(['sport']);
      expect(geladen.profilAngelegt).toBe(false);
    });
  });

  it('legt passende Tätigkeiten an, doppelt sie nicht und lässt eigene stehen', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({ fokus: ['sport'], profilAngelegt: true, zielstrebigkeit: 'traeumer' });
      const training = startTaetigkeiten(['sport']).find((taetigkeit) => taetigkeit.name === 'Training');
      expect(training).toBeDefined();
      expect(gewichtPaare('Training')).toEqual(
        [...(training?.gewichte ?? [])]
          .map((gewicht) => `${gewicht.kennung}:${gewicht.gewicht}`)
          .sort((links, rechts) => links.localeCompare(rechts)),
      );
      const vorher = vorlagenNamen().length;
      aendereEinstellungen({ fokus: ['sport'] });
      expect(vorlagenNamen()).toHaveLength(vorher);

      ausfuehren(`INSERT INTO vorlagen (name, icon, sortierung) VALUES ('Über Sport lesen', 'book-open', 90)`);
      aendereEinstellungen({ fokus: ['geld'] });
      expect(vorlagenNamen()).toContain('Über Sport lesen');
      expect(vorlagenNamen()).toContain('Training');
      expect(vorlagenNamen()).toContain('Sparen');
      expect(vorlagenNamen().filter((name) => name === 'Training')).toHaveLength(1);
      const sparen = START_TAETIGKEITEN.geld.find((taetigkeit) => taetigkeit.name === 'Sparen');
      expect(gewichtPaare('Sparen')).toEqual(
        [...(sparen?.gewichte ?? [])]
          .map((gewicht) => `${gewicht.kennung}:${gewicht.gewicht}`)
          .sort((links, rechts) => links.localeCompare(rechts)),
      );

      for (const id of FOKUS_IDS) {
        aendereEinstellungen({ fokus: [id] });
      }
      for (const id of FOKUS_IDS) {
        for (const taetigkeit of START_TAETIGKEITEN[id]) {
          expect(vorlagenNamen()).toContain(taetigkeit.name);
        }
      }
      expect(new Set(vorlagenNamen()).size).toBe(vorlagenNamen().length);
    });
  });

  it('speichert Start-Tätigkeiten und neue Katalogwerte in der gewählten Sprache', () => {
    for (const sprache of ZIEL_SPRACHEN) {
      const datei = welt();
      mitWelt(datei, () => {
        ausfuehren(
          `INSERT INTO attribute (typ, name, beschreibung, farbe, icon, sortierung) VALUES ('attribut', 'Eigen', '', '#ffffff', 'star', 80)`,
        );
        aendereEinstellungen({
          charakterName: 'Leo',
          geburtsjahr: 1991,
          zielstrebigkeit: 'traeumer',
          fokus: ['sport'],
          profilAngelegt: true,
          sprache,
        });
        const erwartet = startTaetigkeiten(['sport']).map((taetigkeit) => zeige(taetigkeit.name, sprache));
        expect(vorlagenNamen()).toEqual(erwartet);
        expect(vorlagenNamen()).not.toContain('Laufen');
        expect(uebungsNamen()).toEqual([]);
        expect(ladeAttribute(false).find((attribut) => attribut.kennung === 'vitalitaet')?.name).toBe(zeige('Vitalität', sprache));
        expect(ladeAttribute(false).find((attribut) => attribut.kennung === 'koerper')?.name).toBe(zeige('Körper', sprache));
        expect(ladeAttribute(false).find((attribut) => attribut.name === 'Eigen')?.name).toBe('Eigen');
      });
    }
  });

  it('nutzt die gespeicherte Sprache beim späteren Fokus und benennt Katalogwerte nur einmal um', () => {
    const datei = welt();
    mitWelt(datei, () => {
      aendereEinstellungen({
        sprache: 'en',
        fokus: ['sport'],
        profilAngelegt: true,
        charakterName: 'Leo',
        geburtsjahr: 1991,
        zielstrebigkeit: 'traeumer',
      });
      expect(ladeAttribute(false).find((attribut) => attribut.kennung === 'koerper')?.name).toBe('Body');
      aendereEinstellungen({ fokus: ['geld'] });
      expect(vorlagenNamen()).toContain('Saving');
      expect(vorlagenNamen()).not.toContain('Sparen');
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'koerper')?.name).toBe('Body');
      ausfuehren(`UPDATE attribute SET name = 'Kraft' WHERE kennung = 'koerper'`);
      aendereEinstellungen({ sprache: 'es', fokus: ['lernen'] });
      expect(ladeAttribute(true).find((attribut) => attribut.kennung === 'koerper')?.name).toBe('Kraft');
      expect(vorlagenNamen()).toContain(zeige('Lernen', 'es'));
    });
  });

  it('nimmt die Anfragesprache, wenn keine Nutzersprache gespeichert ist', () => {
    const datei = welt();
    mitAnfrageSprache('fr-FR', () => {
      mitWelt(datei, () => {
        aendereEinstellungen({ fokus: ['sport'], profilAngelegt: true });
        expect(vorlagenNamen()).toContain('Courir');
        expect(vorlagenNamen()).not.toContain('Laufen');
        expect(ladeEinstellungen().sprache).toBeNull();
      });
    });
  });

  it('legt bei Sport keine Übungen an und ignoriert den alten Schalter', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const sport = aendereEinstellungen({ fokus: ['sport', 'lernen'], profilAngelegt: true });
      expect('training' in sport.funktionen).toBe(false);
      expect(uebungsNamen()).toEqual([]);
      ausfuehren(
        `INSERT INTO einstellungen (schluessel, wert) VALUES ('funktionen', ?)
         ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
        JSON.stringify({ training: true, koennen: true, status: true, handbuch: true }),
      );
      expect('training' in ladeEinstellungen().funktionen).toBe(false);
      expect(uebungsNamen()).toEqual([]);
    });
  });

  it('zählt Übungen, Pläne und Einheiten als Inhalt', () => {
    const faelle = [
      `INSERT INTO uebungen (name, art) VALUES ('Kniebeuge', 'kraft')`,
      `INSERT INTO trainingsplaene (name) VALUES ('Ganzkörper')`,
      `INSERT INTO trainingseinheiten (status, begonnen_am) VALUES ('offen', '2026-10-24T10:00:00.000Z')`,
    ];
    for (const sql of faelle) {
      const datei = welt();
      mitWelt(datei, () => {
        expect(ladeEinstellungen().weltLeer).toBe(true);
        ausfuehren(sql);
        expect(ladeEinstellungen().weltLeer).toBe(false);
      });
    }
  });

  it('schaltet bei uebung Fähigkeiten an und lässt sie bei einfach an', () => {
    const datei = welt();
    mitWelt(datei, () => {
      const neu = aendereEinstellungen({
        charakterName: 'Uebung',
        geburtsjahr: 1990,
        zielstrebigkeit: 'uebung',
        fokus: ['weisheit'],
        profilAngelegt: true,
      });
      expect(neu.ebenen).toEqual(ebenenFuerStufe('uebung'));
      expect(neu.funktionen.faehigkeiten).toBe(true);
      const einfach = aendereEinstellungen({ zielstrebigkeit: 'einfach' });
      expect(einfach.funktionen.faehigkeiten).toBe(true);
      expect(einfach.ebenen).toEqual(ebenenFuerStufe('einfach'));
    });
  });
});
