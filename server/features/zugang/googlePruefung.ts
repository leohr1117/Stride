import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { ZodError } from 'zod';
import { AppFehler } from '../../fehler.ts';
import { GOOGLE_COOKIE, GOOGLE_TOKEN } from './google.ts';
import { leereGoogleAblage } from './google.ts';
import { SITZUNG_COOKIE, zugangRouten } from './routen.ts';
import { setzeRegistrierungenZurueck } from '../../anfrageGrenzen.ts';
import { legeBenutzerAn, setzeSperrenZurueck, verwendeZugang } from './zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-google-'));
export const PASSWORT = 'geheimes-passwort';
export const CLIENT = 'test-client.apps.googleusercontent.com';
export const GEHEIM = 'test-geheim';
const originalFetch = globalThis.fetch;
let nummer = 0;
export let aktuell = '';
export let aufrufe = 0;

const ENV = [
  'STRIDE_GOOGLE',
  'ASCEND_GOOGLE',
  'STRIDE_GOOGLE_CLIENT_ID',
  'ASCEND_GOOGLE_CLIENT_ID',
  'STRIDE_GOOGLE_CLIENT_SECRET',
  'ASCEND_GOOGLE_CLIENT_SECRET',
  'STRIDE_REGISTRIERUNG',
  'ASCEND_REGISTRIERUNG',
] as const;

export function googleEnv(an: boolean): void {
  for (const name of ENV) {
    delete process.env[name];
  }
  if (!an) {
    return;
  }
  process.env.STRIDE_GOOGLE = '1';
  process.env.STRIDE_GOOGLE_CLIENT_ID = CLIENT;
  process.env.STRIDE_GOOGLE_CLIENT_SECRET = GEHEIM;
}

export function registrierung(an: boolean): void {
  delete process.env.STRIDE_REGISTRIERUNG;
  delete process.env.ASCEND_REGISTRIERUNG;
  if (an) {
    process.env.STRIDE_REGISTRIERUNG = '1';
  }
}

export function bereit(): void {
  googleEnv(false);
  nummer += 1;
  aktuell = path.join(ordner, `${nummer}.db`);
  verwendeZugang(aktuell);
  setzeSperrenZurueck();
  setzeRegistrierungenZurueck();
  leereGoogleAblage();
  globalThis.fetch = originalFetch;
  aufrufe = 0;
}

export function aufraeumen(): void {
  googleEnv(false);
  globalThis.fetch = originalFetch;
  leereGoogleAblage();
}

export async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof ZodError) {
      return antwort.status(400).send({ fehler: fehler.message });
    }
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(zugangRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

function zeilen(antwort: LightMyRequestResponse): string[] {
  const kopf = antwort.headers['set-cookie'];
  if (!kopf) {
    return [];
  }
  return Array.isArray(kopf) ? kopf : [kopf];
}

export function cookieWert(antwort: LightMyRequestResponse, name: string): string | undefined {
  for (const zeile of zeilen(antwort)) {
    const paar = zeile.split(';')[0] ?? '';
    const trenn = paar.indexOf('=');
    if (paar.slice(0, trenn) === name) {
      return decodeURIComponent(paar.slice(trenn + 1));
    }
  }
  return undefined;
}

export function parameter(ort: string): URLSearchParams {
  return new URL(ort, 'http://localhost').searchParams;
}

export function jwt(payload: Record<string, unknown>): string {
  const teil = (wert: unknown) => Buffer.from(JSON.stringify(wert)).toString('base64url');
  return `${teil({ alg: 'none', typ: 'JWT' })}.${teil(payload)}.x`;
}

export function gut(nonce: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce,
    sub: 'sub-1',
    email: 'neu@example.com',
    ...extra,
  };
}

export function mocke(idToken: string, pruefe?: (body: URLSearchParams) => void): void {
  aufrufe = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (String(url) !== GOOGLE_TOKEN) {
      throw new Error(`unerwarteter Abruf ${String(url)}`);
    }
    aufrufe += 1;
    const body = new URLSearchParams(String(init?.body ?? ''));
    pruefe?.(body);
    return new Response(JSON.stringify({ id_token: idToken }), { status: 200 });
  }) as typeof fetch;
}

export function inhaber(name = 'Ada'): number {
  return legeBenutzerAn({ benutzername: name, passwort: PASSWORT, rolle: 'inhaber', weltdatei: 'app.db' }).id;
}

export async function starte(app: FastifyInstance, zweck = 'anmelden', cookie?: string): Promise<{
  status: number;
  ort: string;
  state: string;
  nonce: string;
  challenge: string;
  cookie?: string;
  roh: string;
}> {
  const antwort = await app.inject({
    method: 'GET',
    url: `/api/zugang/google/start?zweck=${zweck}`,
    headers: cookie ? { cookie } : {},
  });
  const ort = String(antwort.headers.location ?? '');
  const suche = parameter(ort);
  return {
    status: antwort.statusCode,
    ort,
    state: suche.get('state') ?? '',
    nonce: suche.get('nonce') ?? '',
    challenge: suche.get('code_challenge') ?? '',
    cookie: cookieWert(antwort, GOOGLE_COOKIE),
    roh: zeilen(antwort).join('\n'),
  };
}

export async function zurueck(
  app: FastifyInstance,
  start: { state: string; cookie?: string },
  suche: Record<string, string>,
  extra?: string,
): Promise<LightMyRequestResponse> {
  const teile = start.cookie ? [`${GOOGLE_COOKIE}=${start.cookie}`] : [];
  if (extra) {
    teile.push(extra);
  }
  return app.inject({
    method: 'GET',
    url: `/api/zugang/google/zurueck?${new URLSearchParams({ state: start.state, ...suche }).toString()}`,
    headers: teile.length > 0 ? { cookie: teile.join('; ') } : {},
  });
}

export { SITZUNG_COOKIE };
