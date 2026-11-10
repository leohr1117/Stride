import { z } from 'zod';
import { KONFIG } from '../config.ts';
import { AppFehler, type VerbindungsFehlerArt } from '../fehler.ts';
import type { TodoistDauer } from '../services/todoistRegeln.ts';

const ZEITLIMIT_MS = 15_000;
const PROJEKTE_PRO_SEITE = 200;
const EREIGNISSE_PRO_SEITE = 100;
const MAX_SEITEN = 20;
const ABGELEHNT = [401, 403];
const ZU_VIELE_ANFRAGEN = 429;
const ERLEDIGT = 'completed';
const AUFGABEN_TYPEN = ['item', 'task'];
const MIKROSEKUNDEN = /(\.\d{3})\d+/;
const ABGELEHNT_STATUS = 400;
const GEGENSTELLE_STATUS = 502;
const FENSTER_MS = 89 * 24 * 60 * 60 * 1000;

export class TodoistFehler extends AppFehler {
  constructor(nachricht: string, optionen: { cause?: unknown; status?: number; art: VerbindungsFehlerArt }) {
    super(optionen.status ?? GEGENSTELLE_STATUS, nachricht, optionen.art);
    this.name = 'TodoistFehler';
    this.cause = optionen.cause;
  }
}

const kennung = z.union([z.string(), z.number()]).transform(String);

function seite<T extends z.ZodType>(eintrag: T) {
  return z.object({
    results: z.array(eintrag),
    next_cursor: z.string().nullable().optional(),
  });
}

const nutzerSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const projektSchema = z.object({
  id: kennung,
  name: z.string(),
  is_archived: z.boolean().optional(),
  is_deleted: z.boolean().optional(),
  child_order: z.number().optional(),
});

const labelSchema = z.object({
  id: kennung,
  name: z.string(),
  order: z.number().optional(),
  is_deleted: z.boolean().optional(),
});

const dauerSchema = z.object({
  amount: z.number(),
  unit: z.enum(['minute', 'day']),
});

const deadlineSchema = z.object({
  date: z.string(),
});

const ereignisSchema = z.object({
  id: kennung,
  object_type: z.string(),
  object_id: kennung,
  event_type: z.string(),
  event_date: z.string(),
  parent_project_id: kennung.nullable().optional(),
  extra_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

const aufgabeSchema = z.object({
  id: kennung,
  content: z.string().optional(),
  project_id: kennung.nullable().optional(),
  labels: z.array(z.string()).optional(),
  duration: dauerSchema.nullable().optional(),
  deadline: deadlineSchema.nullable().optional(),
});

const erledigtSchema = aufgabeSchema.extend({
  completed_at: z.string().optional(),
});

const erledigtSeite = z.object({
  items: z.array(erledigtSchema),
  next_cursor: z.string().nullable().optional(),
});

const projektSeite = seite(projektSchema);
const labelSeite = seite(labelSchema);
const ereignisSeite = seite(ereignisSchema);
type ProjektSeite = z.infer<typeof projektSeite>;
type LabelSeite = z.infer<typeof labelSeite>;
type EreignisSeite = z.infer<typeof ereignisSeite>;

export interface TodoistProjekt {
  id: string;
  name: string;
  sortierung: number;
}

export interface TodoistLabelQuelle {
  id: string;
  name: string;
  sortierung: number;
}

export interface TodoistErledigung {
  ereignisId: string;
  aufgabeId: string;
  projektId: string | null;
  inhalt: string;
  erledigtAm: Date;
  /** null, solange das Ereignis keine Labels nennt. */
  labels: string[] | null;
  /** undefined, solange unbekannt. null heißt ausdrücklich keine Dauer. */
  dauer: TodoistDauer | null | undefined;
  /** JJJJ-MM-TT. undefined, solange unbekannt. null heißt keine Deadline. */
  deadline: string | null | undefined;
}

interface AufgabeDetail {
  labels: string[] | null;
  dauer: TodoistDauer | null | undefined;
  deadline: string | null | undefined;
}

function apiBasis(): string {
  const basis = process.env.TODOIST_API || KONFIG.todoistApi;
  return basis.endsWith('/') ? basis : `${basis}/`;
}

async function anfrage(
  token: string,
  pfad: string,
  parameter: Record<string, string | number | null>,
  still = false,
): Promise<unknown | null> {
  const adresse = new URL(pfad, apiBasis());
  for (const [name, wert] of Object.entries(parameter)) {
    if (wert !== null) {
      adresse.searchParams.set(name, String(wert));
    }
  }
  let antwort: Response;
  try {
    antwort = await fetch(adresse, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    });
  } catch (fehler) {
    if (still) {
      return null;
    }
    throw new TodoistFehler('Todoist ist gerade nicht erreichbar.', { cause: fehler, art: 'netz' });
  }
  if (ABGELEHNT.includes(antwort.status)) {
    throw new TodoistFehler('Todoist lehnt den Token ab. Prüfe ihn in den Todoist-Einstellungen.', { status: ABGELEHNT_STATUS, art: 'abgelehnt' });
  }
  if (antwort.status === ZU_VIELE_ANFRAGEN) {
    throw new TodoistFehler('Todoist bremst gerade zu viele Anfragen. Der nächste Abgleich versucht es erneut.', { art: 'bremse' });
  }
  if (!antwort.ok) {
    if (still) {
      return null;
    }
    throw new TodoistFehler('Todoist hat die Anfrage abgelehnt. Der nächste Abgleich versucht es erneut.', { art: 'gegenstelle' });
  }
  try {
    return await antwort.json();
  } catch (fehler) {
    if (still) {
      return null;
    }
    throw new TodoistFehler('Todoist hat keine lesbare Antwort geschickt.', { cause: fehler, art: 'gegenstelle' });
  }
}

function lies<T extends z.ZodType>(schema: T, daten: unknown): z.infer<T> {
  const ergebnis = schema.safeParse(daten);
  if (!ergebnis.success) {
    throw new TodoistFehler('Todoist hat in einem unerwarteten Format geantwortet.', { cause: ergebnis.error, art: 'gegenstelle' });
  }
  return ergebnis.data;
}

function alsDatum(wert: string): Date | null {
  const datum = new Date(wert.replace(MIKROSEKUNDEN, '$1'));
  return Number.isNaN(datum.getTime()) ? null : datum;
}

function inhaltVon(daten: Record<string, unknown> | null | undefined): string {
  const inhalt = daten?.content;
  return typeof inhalt === 'string' ? inhalt : '';
}

function labelsVon(daten: Record<string, unknown> | null | undefined): string[] | null {
  if (!daten || !Object.hasOwn(daten, 'labels')) {
    return null;
  }
  const wert = daten.labels;
  if (!Array.isArray(wert) || wert.some((eintrag) => typeof eintrag !== 'string')) {
    return null;
  }
  return wert;
}

function dauerVon(daten: Record<string, unknown> | null | undefined): TodoistDauer | null | undefined {
  if (!daten || !Object.hasOwn(daten, 'duration')) {
    return undefined;
  }
  if (daten.duration === null) {
    return null;
  }
  const geparst = dauerSchema.safeParse(daten.duration);
  return geparst.success ? geparst.data : undefined;
}

function deadlineText(datum: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : undefined;
}

/** Die Todoist-API v1 liefert `deadline` am Task (`{ date, lang }`). Fehlt das Feld, bleibt es unbekannt. */
function deadlineVon(daten: Record<string, unknown> | null | undefined): string | null | undefined {
  if (!daten || !Object.hasOwn(daten, 'deadline')) {
    return undefined;
  }
  if (daten.deadline === null) {
    return null;
  }
  const geparst = deadlineSchema.safeParse(daten.deadline);
  return geparst.success ? deadlineText(geparst.data.date) : undefined;
}

function detailVon(daten: { labels?: string[]; duration?: TodoistDauer | null; deadline?: { date: string } | null }): AufgabeDetail {
  return {
    labels: daten.labels === undefined ? null : daten.labels,
    dauer: daten.duration === undefined ? undefined : daten.duration,
    deadline: daten.deadline === undefined ? undefined : daten.deadline === null ? null : deadlineText(daten.deadline.date),
  };
}

export async function ladeNutzername(token: string): Promise<string> {
  const nutzer = lies(nutzerSchema, await anfrage(token, 'user', {}));
  return nutzer.full_name || nutzer.email || 'Todoist';
}

export async function ladeProjekte(token: string): Promise<TodoistProjekt[]> {
  const projekte: TodoistProjekt[] = [];
  let cursor: string | null = null;
  for (let nummer = 0; nummer < MAX_SEITEN; nummer++) {
    const antwort: ProjektSeite = lies(projektSeite, await anfrage(token, 'projects', { limit: PROJEKTE_PRO_SEITE, cursor }));
    for (const projekt of antwort.results) {
      if (!projekt.is_archived && !projekt.is_deleted) {
        projekte.push({ id: projekt.id, name: projekt.name, sortierung: projekt.child_order ?? projekte.length });
      }
    }
    cursor = antwort.next_cursor ?? null;
    if (cursor === null) {
      break;
    }
  }
  return projekte;
}

export async function ladeLabels(token: string): Promise<TodoistLabelQuelle[]> {
  const labels: TodoistLabelQuelle[] = [];
  let cursor: string | null = null;
  for (let nummer = 0; nummer < MAX_SEITEN; nummer++) {
    const antwort: LabelSeite = lies(labelSeite, await anfrage(token, 'labels', { limit: PROJEKTE_PRO_SEITE, cursor }));
    for (const label of antwort.results) {
      if (!label.is_deleted) {
        labels.push({ id: label.id, name: label.name, sortierung: label.order ?? labels.length });
      }
    }
    cursor = antwort.next_cursor ?? null;
    if (cursor === null) {
      break;
    }
  }
  return labels;
}

async function ladeEreignisse(token: string, seit: Date): Promise<TodoistErledigung[]> {
  const erledigungen: TodoistErledigung[] = [];
  let cursor: string | null = null;
  for (let nummer = 0; nummer < MAX_SEITEN; nummer++) {
    const antwort: EreignisSeite = lies(
      ereignisSeite,
      await anfrage(token, 'activities', { limit: EREIGNISSE_PRO_SEITE, cursor }),
    );
    let alleAelter = antwort.results.length > 0;
    for (const ereignis of antwort.results) {
      const erledigtAm = alsDatum(ereignis.event_date);
      if (erledigtAm === null) {
        continue;
      }
      if (erledigtAm >= seit) {
        alleAelter = false;
      }
      if (ereignis.event_type === ERLEDIGT && AUFGABEN_TYPEN.includes(ereignis.object_type) && erledigtAm >= seit) {
        erledigungen.push({
          ereignisId: ereignis.id,
          aufgabeId: ereignis.object_id,
          projektId: ereignis.parent_project_id ?? null,
          inhalt: inhaltVon(ereignis.extra_data),
          erledigtAm,
          labels: labelsVon(ereignis.extra_data),
          dauer: dauerVon(ereignis.extra_data),
          deadline: deadlineVon(ereignis.extra_data),
        });
      }
    }
    cursor = antwort.next_cursor ?? null;
    if (cursor === null || alleAelter) {
      break;
    }
  }
  return erledigungen;
}

async function ladeErledigteAufgaben(token: string, seit: Date, bis: Date): Promise<Map<string, AufgabeDetail> | null> {
  const karte = new Map<string, AufgabeDetail>();
  let anfang = seit.getTime();
  const ende = bis.getTime();
  while (anfang < ende) {
    const fensterEnde = Math.min(anfang + FENSTER_MS, ende);
    let cursor: string | null = null;
    for (let nummer = 0; nummer < MAX_SEITEN; nummer++) {
      const daten = await anfrage(
        token,
        'tasks/completed/by_completion_date',
        {
          since: new Date(anfang).toISOString(),
          until: new Date(fensterEnde).toISOString(),
          limit: PROJEKTE_PRO_SEITE,
          cursor,
        },
        true,
      );
      const geparst = daten === null ? null : erledigtSeite.safeParse(daten);
      if (!geparst?.success) {
        return karte.size > 0 ? karte : null;
      }
      for (const eintrag of geparst.data.items) {
        karte.set(eintrag.id, detailVon(eintrag));
      }
      cursor = geparst.data.next_cursor ?? null;
      if (cursor === null) {
        break;
      }
    }
    anfang = fensterEnde;
  }
  return karte;
}

async function ladeAufgabe(token: string, id: string): Promise<AufgabeDetail | null> {
  const daten = await anfrage(token, `tasks/${encodeURIComponent(id)}`, {}, true);
  if (daten === null) {
    return null;
  }
  const geparst = aufgabeSchema.safeParse(daten);
  return geparst.success ? detailVon(geparst.data) : null;
}

function uebernimmDetail(erledigung: TodoistErledigung, detail: AufgabeDetail | undefined): void {
  if (!detail) {
    return;
  }
  if (erledigung.labels === null && detail.labels !== null) {
    erledigung.labels = detail.labels;
  }
  if (erledigung.dauer === undefined && detail.dauer !== undefined) {
    erledigung.dauer = detail.dauer;
  }
  if (erledigung.deadline === undefined && detail.deadline !== undefined) {
    erledigung.deadline = detail.deadline;
  }
}

async function ergaenzeDetails(token: string, erledigungen: TodoistErledigung[], seit: Date): Promise<void> {
  const offen = erledigungen.filter(
    (eintrag) => eintrag.labels === null || eintrag.dauer === undefined || eintrag.deadline === undefined,
  );
  if (offen.length === 0) {
    return;
  }
  const spaeteste = offen.reduce((max, eintrag) => Math.max(max, eintrag.erledigtAm.getTime()), seit.getTime());
  const bis = new Date(Math.max(spaeteste, Date.now()) + 60_000);
  const liste = await ladeErledigteAufgaben(token, seit, bis);
  const rest = [];
  for (const eintrag of offen) {
    if (liste) {
      uebernimmDetail(eintrag, liste.get(eintrag.aufgabeId));
    }
    if (eintrag.labels === null || eintrag.dauer === undefined || eintrag.deadline === undefined) {
      rest.push(eintrag);
    }
  }
  for (const eintrag of rest) {
    uebernimmDetail(eintrag, (await ladeAufgabe(token, eintrag.aufgabeId)) ?? undefined);
    if (eintrag.labels === null) {
      eintrag.labels = [];
    }
    if (eintrag.dauer === undefined) {
      eintrag.dauer = null;
    }
    if (eintrag.deadline === undefined) {
      eintrag.deadline = null;
    }
  }
}

export async function ladeErledigungen(token: string, seit: Date): Promise<TodoistErledigung[]> {
  const erledigungen = await ladeEreignisse(token, seit);
  await ergaenzeDetails(token, erledigungen, seit);
  return erledigungen.sort((links, rechts) => links.erledigtAm.getTime() - rechts.erledigtAm.getTime());
}
