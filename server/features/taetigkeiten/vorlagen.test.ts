import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereVorlage, erstelleVorlage, ladeVorlagen, ordneVorlagen } from './vorlagen.ts';

const wurzel = path.join(process.cwd(), 'tmp-bau', 'n4-vitest');
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
