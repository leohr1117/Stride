import { afterEach, describe, expect, it } from 'vitest';
import { starteTodoistAttrappe, type AttrappenDaten, type TodoistAttrappe } from './todoistAttrappe.ts';
import { ladeErledigungen, ladeLabels, ladeProjekte } from './todoist.ts';

const TOKEN = 'test-token-1234';
const offen: TodoistAttrappe[] = [];

afterEach(async () => {
  delete process.env.TODOIST_API;
  while (offen.length > 0) {
    await offen.pop()?.stop();
  }
});

async function attrappe(daten: AttrappenDaten): Promise<TodoistAttrappe> {
  const server = await starteTodoistAttrappe(daten);
  process.env.TODOIST_API = server.basis;
  offen.push(server);
  return server;
}

describe('Todoist-Attrappe', () => {
  it('lädt Projekte und Labels und schreibt den Token nicht ins Protokoll', async () => {
    const server = await attrappe({
      projekte: [{ id: 'p1', name: 'Posteingang' }],
      labels: [{ id: 'l1', name: 'Lesen' }],
    });
    expect(await ladeProjekte(TOKEN)).toEqual([{ id: 'p1', name: 'Posteingang', sortierung: 0 }]);
    expect(await ladeLabels(TOKEN)).toEqual([{ id: 'l1', name: 'Lesen', sortierung: 0 }]);
    expect(JSON.stringify(server.anfragen)).not.toContain(TOKEN);
    await expect(ladeProjekte('kurz')).rejects.toThrow(/Token/);
  });

  it('übernimmt Dauer und Labels aus dem Ereignis ohne weitere Aufgabenabfrage', async () => {
    const jetzt = new Date();
    const server = await attrappe({
      ereignisse: [
        {
          id: 'e1',
          aufgabeId: 'a1',
          datum: jetzt.toISOString(),
          projektId: 'p1',
          inhalt: 'Mit Dauer',
          labels: ['Lesen'],
          dauer: { amount: 30, unit: 'minute' },
          deadline: null,
        },
      ],
    });
    const liste = await ladeErledigungen(TOKEN, new Date(jetzt.getTime() - 60_000));
    expect(liste).toHaveLength(1);
    expect(liste[0]?.labels).toEqual(['Lesen']);
    expect(liste[0]?.dauer).toEqual({ amount: 30, unit: 'minute' });
    expect(liste[0]?.deadline).toBeNull();
    expect(server.anfragen.some((anfrage) => anfrage.pfad.includes('/tasks/'))).toBe(false);
  });

  it('fragt erledigte Aufgaben gebündelt und danach nur die wiederkehrende', async () => {
    const jetzt = new Date();
    const server = await attrappe({
      aufgaben: [
        {
          id: 'einmal',
          content: 'Einmal',
          projectId: 'p1',
          labels: ['Lesen'],
          duration: { amount: 10, unit: 'minute' },
          deadline: '2026-11-02',
          erledigt: true,
          erledigtAm: jetzt.toISOString(),
        },
        {
          id: 'wieder',
          content: 'Wieder',
          projectId: 'p1',
          labels: ['Sport'],
          duration: { amount: 1, unit: 'day' },
          deadline: '2026-11-03',
          wiederkehrend: true,
          erledigtAm: jetzt.toISOString(),
        },
      ],
      ereignisse: [
        { id: 'e1', aufgabeId: 'einmal', datum: jetzt.toISOString(), projektId: 'p1', inhalt: 'Einmal' },
        { id: 'e2', aufgabeId: 'wieder', datum: jetzt.toISOString(), projektId: 'p1', inhalt: 'Wieder' },
      ],
    });
    const liste = await ladeErledigungen(TOKEN, new Date(jetzt.getTime() - 60_000));
    const einmal = liste.find((eintrag) => eintrag.aufgabeId === 'einmal');
    const wieder = liste.find((eintrag) => eintrag.aufgabeId === 'wieder');
    expect(einmal?.labels).toEqual(['Lesen']);
    expect(einmal?.dauer).toEqual({ amount: 10, unit: 'minute' });
    expect(einmal?.deadline).toBe('2026-11-02');
    expect(wieder?.labels).toEqual(['Sport']);
    expect(wieder?.dauer).toEqual({ amount: 1, unit: 'day' });
    expect(wieder?.deadline).toBe('2026-11-03');
    const pfade = server.anfragen.map((anfrage) => anfrage.pfad);
    expect(pfade.filter((pfad) => pfad.endsWith('/tasks/completed/by_completion_date'))).toHaveLength(1);
    expect(pfade.filter((pfad) => pfad.endsWith('/tasks/wieder'))).toHaveLength(1);
    expect(pfade.some((pfad) => pfad.endsWith('/tasks/einmal'))).toBe(false);
    expect(JSON.stringify(server.anfragen)).not.toContain(TOKEN);
  });
});
