import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface AttrappenDauer {
  amount: number;
  unit: 'minute' | 'day';
}

export interface AttrappenAufgabe {
  id: string;
  content: string;
  projectId: string;
  labels: string[];
  duration: AttrappenDauer | null;
  /** JJJJ-MM-TT. null heißt keine Deadline, weglassen heißt das Feld fehlt. */
  deadline?: string | null;
  erledigt?: boolean;
  wiederkehrend?: boolean;
  erledigtAm?: string;
}

export interface AttrappenEreignis {
  id: string;
  aufgabeId: string;
  datum: string;
  projektId: string | null;
  inhalt: string;
  labels?: string[];
  dauer?: AttrappenDauer | null;
  /** JJJJ-MM-TT. null heißt keine Deadline, weglassen heißt das Feld fehlt. */
  deadline?: string | null;
}

export interface AttrappenDaten {
  nutzer?: string;
  projekte?: { id: string; name: string; sortierung?: number }[];
  labels?: { id: string; name: string; sortierung?: number }[];
  aufgaben?: AttrappenAufgabe[];
  ereignisse?: AttrappenEreignis[];
}

export interface AttrappenAnruf {
  methode: string;
  pfad: string;
}

export interface TodoistAttrappe {
  basis: string;
  anfragen: AttrappenAnruf[];
  stop: () => Promise<void>;
}

function sende(antwort: ServerResponse, status: number, koerper: unknown): void {
  antwort.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  antwort.end(JSON.stringify(koerper));
}

function seite<T>(liste: T[], url: URL, schluessel: 'results' | 'items'): Record<string, unknown> {
  const limit = Math.max(1, Number(url.searchParams.get('limit') ?? '50') || 50);
  const start = Math.max(0, Number(url.searchParams.get('cursor') ?? '0') || 0);
  const teil = liste.slice(start, start + limit);
  return {
    [schluessel]: teil,
    next_cursor: start + limit < liste.length ? String(start + limit) : null,
  };
}

function tokenOk(anfrage: IncomingMessage): boolean {
  const kopf = anfrage.headers.authorization ?? '';
  const token = kopf.startsWith('Bearer ') ? kopf.slice('Bearer '.length) : '';
  return token.length >= 8;
}

function deadlineJson(datum: string | null): { date: string; lang: string } | null {
  return datum === null ? null : { date: datum, lang: 'de' };
}

function aufgabeJson(aufgabe: AttrappenAufgabe) {
  return {
    id: aufgabe.id,
    content: aufgabe.content,
    project_id: aufgabe.projectId,
    labels: aufgabe.labels,
    duration: aufgabe.duration,
    completed_at: aufgabe.erledigtAm ?? null,
    ...(aufgabe.deadline !== undefined ? { deadline: deadlineJson(aufgabe.deadline) } : {}),
  };
}

function bearbeite(daten: AttrappenDaten, anfrage: IncomingMessage, antwort: ServerResponse, anfragen: AttrappenAnruf[]): void {
  const url = new URL(anfrage.url ?? '/', 'http://127.0.0.1');
  anfragen.push({ methode: anfrage.method ?? 'GET', pfad: url.pathname });
  if (!tokenOk(anfrage)) {
    sende(antwort, 401, {});
    return;
  }
  if ((anfrage.method ?? 'GET') !== 'GET') {
    sende(antwort, 404, {});
    return;
  }
  const pfad = url.pathname;
  if (pfad.endsWith('/user')) {
    sende(antwort, 200, { full_name: daten.nutzer ?? 'Todoist', email: null });
    return;
  }
  if (pfad.endsWith('/projects')) {
    const liste = (daten.projekte ?? []).map((projekt, index) => ({
      id: projekt.id,
      name: projekt.name,
      is_archived: false,
      is_deleted: false,
      child_order: projekt.sortierung ?? index,
    }));
    sende(antwort, 200, seite(liste, url, 'results'));
    return;
  }
  if (pfad.endsWith('/labels')) {
    const liste = (daten.labels ?? []).map((label, index) => ({
      id: label.id,
      name: label.name,
      order: label.sortierung ?? index,
      is_deleted: false,
    }));
    sende(antwort, 200, seite(liste, url, 'results'));
    return;
  }
  if (pfad.endsWith('/activities')) {
    const liste = [...(daten.ereignisse ?? [])]
      .sort((links, rechts) => rechts.datum.localeCompare(links.datum))
      .map((ereignis) => {
        const extra: Record<string, unknown> = { content: ereignis.inhalt };
        if (ereignis.labels !== undefined) {
          extra.labels = ereignis.labels;
        }
        if (ereignis.dauer !== undefined) {
          extra.duration = ereignis.dauer;
        }
        if (ereignis.deadline !== undefined) {
          extra.deadline = deadlineJson(ereignis.deadline);
        }
        return {
          id: ereignis.id,
          object_type: 'item',
          object_id: ereignis.aufgabeId,
          event_type: 'completed',
          event_date: ereignis.datum,
          parent_project_id: ereignis.projektId,
          extra_data: extra,
        };
      });
    sende(antwort, 200, seite(liste, url, 'results'));
    return;
  }
  if (pfad.endsWith('/tasks/completed/by_completion_date')) {
    const seit = new Date(url.searchParams.get('since') ?? 0).getTime();
    const bis = new Date(url.searchParams.get('until') ?? '9999-12-31T00:00:00.000Z').getTime();
    const liste = (daten.aufgaben ?? []).filter((aufgabe) => {
      if (!aufgabe.erledigt || aufgabe.wiederkehrend) {
        return false;
      }
      const zeit = new Date(aufgabe.erledigtAm ?? 0).getTime();
      return zeit >= seit && zeit < bis;
    });
    sende(antwort, 200, seite(liste.map(aufgabeJson), url, 'items'));
    return;
  }
  const aufgabenPfad = '/tasks/';
  const stelle = pfad.lastIndexOf(aufgabenPfad);
  if (stelle !== -1 && !pfad.includes('/completed/')) {
    const id = decodeURIComponent(pfad.slice(stelle + aufgabenPfad.length));
    const aufgabe = (daten.aufgaben ?? []).find((eintrag) => eintrag.id === id);
    if (!aufgabe || (aufgabe.erledigt && !aufgabe.wiederkehrend)) {
      sende(antwort, 404, {});
      return;
    }
    sende(antwort, 200, aufgabeJson(aufgabe));
    return;
  }
  sende(antwort, 404, {});
}

export function starteTodoistAttrappe(daten: AttrappenDaten): Promise<TodoistAttrappe> {
  const anfragen: AttrappenAnruf[] = [];
  const server = createServer((anfrage, antwort) => {
    bearbeite(daten, anfrage, antwort, anfragen);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const adresse = server.address();
      if (!adresse || typeof adresse === 'string') {
        reject(new Error('Die Todoist-Attrappe hat keinen Port.'));
        return;
      }
      resolve({
        basis: `http://127.0.0.1:${adresse.port}/api/v1/`,
        anfragen,
        stop: () =>
          new Promise((fertig, scheitern) => {
            server.close((fehler) => (fehler ? scheitern(fehler) : fertig()));
          }),
      });
    });
  });
}
