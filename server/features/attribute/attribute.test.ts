import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { attributAenderungSchema } from '../../validierung.ts';
import { aendereAttribut, ladeAttribut } from './attribute.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-attribut-name-'));
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

describe('Attributnamen', () => {
  it('lässt einen mitgeschickten Namen stehen und speichert den Rest', () => {
    mitWelt(welt(), () => {
      const id = attributId('koerper');
      const bisher = ladeAttribut(id);
      const geparst = attributAenderungSchema.parse({ name: 'Umbenannt', beschreibung: 'Notiz' });
      expect(geparst).not.toHaveProperty('name');

      const mitName = { beschreibung: 'Notiz', name: 'Umbenannt' };
      const danach = aendereAttribut(id, mitName);
      expect(danach.name).toBe(bisher.name);
      expect(danach.beschreibung).toBe('Notiz');

      const nurName = attributAenderungSchema.parse({ name: 'Anderer' });
      expect(nurName).toEqual({});
      expect(aendereAttribut(id, nurName).name).toBe(bisher.name);

      ausfuehren(`UPDATE attribute SET name = 'Kraft' WHERE id = ?`, id);
      const eigen = aendereAttribut(id, { beschreibung: 'Bleibt' });
      expect(eigen.name).toBe('Kraft');
      expect(eigen.beschreibung).toBe('Bleibt');
    });
  });
});
