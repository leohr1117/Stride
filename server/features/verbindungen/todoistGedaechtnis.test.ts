import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eine, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { starteTodoistAttrappe, type AttrappenEreignis, type TodoistAttrappe } from '../../integrationen/todoistAttrappe.ts';
import { erstelleProjekt, erstelleVision } from '../../services/struktur.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { gleicheTodoistAb } from './todoistAbgleich.ts';
import { ordneTodoistProjektZu } from './todoistZuordnung.ts';
import { ladeTodoistStatus, trenneTodoist, verbindeTodoist } from './todoist.ts';

const TOKEN = 'test-token-1234';
const basis = path.join('tmp-bau', 'todoist-gedaechtnis');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const offen: string[] = [];
const server: TodoistAttrappe[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(async () => {
  delete process.env.TODOIST_API;
  while (server.length > 0) {
    await server.pop()?.stop();
  }
  for (const datei of offen.splice(0)) {
    schliesseWelt(datei);
  }
});

function ereignis(id: string, inhalt: string): AttrappenEreignis {
  return {
    id,
    aufgabeId: id,
    datum: new Date().toISOString(),
    projektId: 'p1',
    inhalt,
    labels: [],
    dauer: null,
    deadline: null,
  };
}

function koerperId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'koerper'`)?.id;
  if (id === undefined) {
    throw new Error('Körper fehlt.');
  }
  return id;
}

describe('Todoist behält übernommene Einträge', () => {
  it('trennt ohne die Einträge zu löschen und importiert sie nicht erneut', async () => {
    const jetzt = new Date();
    const attrappe = await starteTodoistAttrappe({
      projekte: [{ id: 'p1', name: 'Post' }],
      ereignisse: [ereignis('e1', 'Besprechung')],
    });
    process.env.TODOIST_API = attrappe.basis;
    server.push(attrappe);

    await mitWeltAsync(welt(), async () => {
      const vorlage = erstelleVorlage({
        name: 'Allgemein',
        icon: 'star',
        gewichte: [{ attributId: koerperId(), gewicht: 1 }],
      });
      const vision = erstelleVision({
        titel: 'Weg',
        beschreibung: '',
        farbe: '#34d399',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      const ziel = erstelleProjekt({
        name: 'Ziel',
        beschreibung: '',
        visionId: vision.id,
        organisationId: null,
        standardVorlageId: vorlage.id,
      });
      const zuordnung = {
        projektId: ziel.id,
        vorlageId: null,
        stunden: null,
        zielArt: 'projekt' as const,
        zielId: ziel.id,
      };

      await verbindeTodoist(TOKEN, jetzt);
      ordneTodoistProjektZu('p1', zuordnung);
      expect((await gleicheTodoistAb(jetzt)).neu).toBe(1);
      expect(ladeTodoistStatus().uebernommen).toBe(1);

      trenneTodoist();
      expect(ladeTodoistStatus().verbunden).toBe(false);
      expect(ladeTodoistStatus().uebernommen).toBe(1);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(1);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM todoist_erledigt WHERE eintrag_id IS NOT NULL')?.wert).toBe(1);

      await verbindeTodoist(TOKEN, jetzt);
      ordneTodoistProjektZu('p1', zuordnung);
      expect((await gleicheTodoistAb(jetzt)).neu).toBe(0);
      expect(eine<{ wert: number }>('SELECT COUNT(*) AS wert FROM eintraege')?.wert).toBe(1);
      expect(ladeTodoistStatus().uebernommen).toBe(1);
    });
  });
});
