import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { eine, mitWelt, schliesseWelt } from '../../db.ts';
import { erstelleProjekt } from '../../services/struktur.ts';
import { vorlageSchema } from '../../validierung.ts';
import { aendereVorlage, erstelleVorlage, ladeVorlage, ladeVorlagen, ordneVorlagen } from './vorlagen.ts';

const wurzel = path.join(process.cwd(), 'tmp-test', 'vorlagen');
mkdirSync(wurzel, { recursive: true });
const ordner = path.join(wurzel, `lauf-${process.pid}`);
mkdirSync(ordner, { recursive: true });
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function schliessen(): void {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
}

afterEach(schliessen);

afterAll(() => {
  schliessen();
  rmSync(ordner, { recursive: true, force: true });
});

function koerperId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (id === undefined) {
    throw new Error('Körper fehlt.');
  }
  return id;
}

function vorlage(name: string): number {
  return erstelleVorlage({
    name,
    icon: 'star',
    gewichte: [{ attributId: koerperId(), gewicht: 1 }],
  }).id;
}

function aktivIds(): number[] {
  return ladeVorlagen()
    .filter((eintrag) => !eintrag.archiviert)
    .map((eintrag) => eintrag.id);
}

describe('aendereVorlage', () => {
  it('bindet eine Tätigkeit an ein Projekt und löst die Bindung wieder', () => {
    mitWelt(welt(), () => {
      const id = vorlage('Gebunden');
      const projekt = erstelleProjekt({
        name: 'Ziel',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: id,
      });
      expect(aendereVorlage(id, { projektId: projekt.id }).projektId).toBe(projekt.id);
      expect(aendereVorlage(id, { projektId: null }).projektId).toBeNull();
      expect(() => aendereVorlage(id, { projektId: 9_999_999 })).toThrow(/Projekt/);
      expect(ladeVorlagen().find((eintrag) => eintrag.id === id)?.projektId).toBeNull();
    });
  });
});

describe('ordneVorlagen', () => {
  it('setzt die Reihenfolge und lässt Archivierte unten', () => {
    mitWelt(welt(), () => {
      const oben = vorlage('Oben');
      const ablage = vorlage('Ablage');
      const vorher = aktivIds();
      const reihe = [oben, ...vorher.filter((id) => id !== oben)];
      expect(ordneVorlagen(reihe).filter((eintrag) => !eintrag.archiviert).map((eintrag) => eintrag.id)).toEqual(reihe);

      aendereVorlage(ablage, { archiviert: true });
      const stand = aktivIds();
      expect(stand[0]).toBe(oben);
      expect(stand).not.toContain(ablage);
      const liste = ladeVorlagen();
      const ersteArchiviert = liste.findIndex((eintrag) => eintrag.archiviert);
      expect(ersteArchiviert).toBeGreaterThan(liste.findIndex((eintrag) => eintrag.id === oben));
      expect(liste.slice(ersteArchiviert).every((eintrag) => eintrag.archiviert)).toBe(true);

      expect(() => ordneVorlagen([])).toThrow(/unvollständig/);
      expect(() => ordneVorlagen(stand.slice(1))).toThrow(/unvollständig/);
      expect(() => ordneVorlagen([...stand, stand[0]])).toThrow(/unvollständig/);
      expect(() => ordneVorlagen([...stand.slice(0, -1), ablage])).toThrow(/unvollständig/);
      expect(() => ordneVorlagen([...stand, 9_999_999])).toThrow(/unvollständig/);
      expect(aktivIds()).toEqual(stand);

      const danach = vorlage('Danach');
      expect(aktivIds()[0]).toBe(oben);
      expect(aktivIds().at(-1)).toBe(danach);
    });
  });
});

function geistId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'geist'`)?.id;
  if (id === undefined) {
    throw new Error('Geist fehlt.');
  }
  return id;
}

function meldungen(daten: unknown): string[] {
  const ergebnis = vorlageSchema.safeParse(daten);
  if (ergebnis.success) {
    return [];
  }
  return ergebnis.error.issues.map((issue) => issue.message);
}

describe('feste Anteile', () => {
  it('weist Summe über 100, ein doppeltes Attribut und Plus mit Abzug ab', () => {
    expect(meldungen({
      name: 'Viel',
      icon: 'rocket',
      festeAnteile: true,
      gewichte: [
        { attributId: 1, gewicht: 60 },
        { attributId: 2, gewicht: 50 },
      ],
    }).some((text) => text.includes('Zusammen höchstens 100'))).toBe(true);
    expect(meldungen({
      name: 'Doppelt',
      icon: 'rocket',
      gewichte: [
        { attributId: 1, gewicht: 10 },
        { attributId: 1, gewicht: 10 },
      ],
    }).some((text) => text.includes('nur einmal'))).toBe(true);
    expect(meldungen({
      name: 'Beides',
      icon: 'rocket',
      festeAnteile: true,
      gewichte: [{ attributId: 1, gewicht: 40 }],
      abzuege: [{ attributId: 1, prozent: 10 }],
    }).some((text) => text.includes('nicht zugleich'))).toBe(true);
  });

  it('speichert Abzug nur mit festen Prozent und lässt alte Tätigkeiten im Verhältnis', () => {
    mitWelt(welt(), () => {
      const koerper = koerperId();
      const geist = geistId();
      expect(() =>
        erstelleVorlage({
          name: 'Nur Abzug',
          icon: 'star',
          festeAnteile: true,
          gewichte: [],
          abzuege: [{ attributId: geist, prozent: 10 }],
        }),
      ).toThrow(/Mindestens ein Attribut mit Plus/);
      expect(() =>
        erstelleVorlage({
          name: 'Beides',
          icon: 'star',
          festeAnteile: true,
          gewichte: [{ attributId: koerper, gewicht: 40 }],
          abzuege: [{ attributId: koerper, prozent: 10 }],
        }),
      ).toThrow(/nicht zugleich/);

      const fest = erstelleVorlage({
        name: 'Fest',
        icon: 'star',
        festeAnteile: true,
        gewichte: [{ attributId: koerper, gewicht: 40 }],
        abzuege: [{ attributId: geist, prozent: 30 }],
      });
      expect(fest.festeAnteile).toBe(true);
      expect(fest.abzuege).toEqual([{ attributId: geist, prozent: 30 }]);
      expect(eine<{ fest: number }>('SELECT feste_anteile AS fest FROM vorlagen WHERE id = ?', fest.id)?.fest).toBe(1);

      const alt = erstelleVorlage({
        name: 'Alt',
        icon: 'star',
        gewichte: [
          { attributId: koerper, gewicht: 80 },
          { attributId: geist, gewicht: 50 },
        ],
      });
      expect(alt.festeAnteile).toBe(false);
      expect(eine<{ fest: number }>('SELECT feste_anteile AS fest FROM vorlagen WHERE id = ?', alt.id)?.fest).toBe(0);
      expect(aendereVorlage(alt.id, { name: 'Alt zwei' }).festeAnteile).toBe(false);
      expect(() => aendereVorlage(alt.id, { festeAnteile: true })).toThrow(/Zusammen höchstens 100/);
      expect(ladeVorlage(alt.id).festeAnteile).toBe(false);
      expect(aendereVorlage(alt.id, {
        festeAnteile: true,
        gewichte: [{ attributId: koerper, gewicht: 40 }],
      }).festeAnteile).toBe(true);
    });
  });
});
