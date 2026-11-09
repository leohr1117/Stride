import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { AppFehler } from './fehler.ts';
import { registriereSicherheitsKoepfe } from './sicherheitsKoepfe.ts';

const WURZEL = mkdtempSync(path.join(tmpdir(), 'stride-koepfe-'));
mkdirSync(path.join(WURZEL, 'assets'));
writeFileSync(path.join(WURZEL, 'index.html'), '<!doctype html><title>Stride</title>');
writeFileSync(path.join(WURZEL, 'assets', 'app.js'), '/* stride-datei */');
writeFileSync(path.join(WURZEL, 'sw.js'), '/* stride-sw */');
writeFileSync(path.join(WURZEL, 'manifest.webmanifest'), '{"name":"Stride"}');

const INHALTSICHERHEIT = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

const ERWARTETE_KOEPFE = {
  'content-security-policy': INHALTSICHERHEIT,
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
} as const;

function erwarteKoepfe(antwort: LightMyRequestResponse): void {
  for (const [name, wert] of Object.entries(ERWARTETE_KOEPFE)) {
    expect(antwort.headers[name]).toBe(wert);
  }
  expect(antwort.headers['strict-transport-security']).toBeUndefined();
  const politik = antwort.headers['content-security-policy'];
  expect(politik).not.toContain('accounts.google.com');
  expect(politik).not.toContain('unsafe-eval');
}

async function baueApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registriereSicherheitsKoepfe(app);
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(
    async (api) => {
      await api.register(rateLimit, {
        global: false,
        max: 1,
        timeWindow: 60_000,
        errorResponseBuilder: () => new AppFehler(429, 'Zu viele Anfragen.'),
      });
      api.addHook('onRequest', api.rateLimit());
      api.get('/ping', async () => ({ ok: true }));
    },
    { prefix: '/api' },
  );
  await app.register(fastifyStatic, { root: WURZEL });
  app.setNotFoundHandler((anfrage, antwort) => {
    return antwort.status(404).send({ fehler: `Unbekannter Pfad: ${anfrage.method} ${anfrage.url}` });
  });
  return app;
}

describe('Sicherheitsköpfe', () => {
  it('setzt die Kopfzeilen auf API, index.html, Datei, Service Worker, Manifest, 404 und 429', async () => {
    const app = await baueApp();
    try {
      const api = await app.inject({ method: 'GET', url: '/api/ping' });
      expect(api.statusCode).toBe(200);
      expect(api.json()).toEqual({ ok: true });
      erwarteKoepfe(api);

      const stopp = await app.inject({ method: 'GET', url: '/api/ping' });
      expect(stopp.statusCode).toBe(429);
      expect(stopp.json()).toEqual({ fehler: 'Zu viele Anfragen.' });
      erwarteKoepfe(stopp);

      const seite = await app.inject({ method: 'GET', url: '/index.html' });
      expect(seite.statusCode).toBe(200);
      expect(seite.body).toContain('<title>Stride</title>');
      erwarteKoepfe(seite);

      const datei = await app.inject({ method: 'GET', url: '/assets/app.js' });
      expect(datei.statusCode).toBe(200);
      expect(datei.body).toContain('stride-datei');
      erwarteKoepfe(datei);

      const arbeiter = await app.inject({ method: 'GET', url: '/sw.js' });
      expect(arbeiter.statusCode).toBe(200);
      expect(arbeiter.body).toContain('stride-sw');
      erwarteKoepfe(arbeiter);

      const manifest = await app.inject({ method: 'GET', url: '/manifest.webmanifest' });
      expect(manifest.statusCode).toBe(200);
      expect(manifest.body).toContain('"name":"Stride"');
      erwarteKoepfe(manifest);

      const fehlt = await app.inject({ method: 'GET', url: '/api/fehlt' });
      expect(fehlt.statusCode).toBe(404);
      expect(fehlt.json()).toEqual({ fehler: 'Unbekannter Pfad: GET /api/fehlt' });
      erwarteKoepfe(fehlt);
    } finally {
      await app.close();
    }
  });
});
