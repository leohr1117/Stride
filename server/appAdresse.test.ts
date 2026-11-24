import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { leseVapid } from './config.ts';
import { mailAbsender } from './features/kontakt/smtp.ts';
import { aufraeumen, bereit, googleEnv, inhaber, mitRouten } from './features/zugang/googlePruefung.ts';
import { CHANGE_PASSWORD_PFAD, PASSWORT_AENDERN_PFAD } from './features/zugang/passwortAdresse.ts';
import {
  dokumentMitAppAdresse,
  fuegeAppAdresseEin,
  gesetzteAppAdresse,
  istDokumentPfad,
  oauthWeiterleitung,
  registriereAppAdresse,
} from './appAdresse.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDARD = 'https://stride.leohr.de';
const ZIEL = 'https://wupo.app';
const SCHLUESSEL = {
  VAPID_PUBLIC_KEY: 'oeffentlich-test',
  VAPID_PRIVATE_KEY: 'privat-test',
};

describe('App-Adresse am Server', () => {
  it('leitet OAuth für beide Werte um und lässt den Host ohne Variable stehen', () => {
    expect(oauthWeiterleitung('127.0.0.1:3327', false, undefined)).toBe('http://127.0.0.1:3327/api/zugang/google/zurueck');
    expect(oauthWeiterleitung('127.0.0.1:3327', true, '   ')).toBe('https://127.0.0.1:3327/api/zugang/google/zurueck');
    expect(oauthWeiterleitung('127.0.0.1:3327', false, 'http://wupo.app')).toBe('http://127.0.0.1:3327/api/zugang/google/zurueck');
    expect(oauthWeiterleitung('127.0.0.1:3327', false, STANDARD)).toBe(`${STANDARD}/api/zugang/google/zurueck`);
    expect(oauthWeiterleitung('', true, ZIEL)).toBe(`${ZIEL}/api/zugang/google/zurueck`);
    expect(oauthWeiterleitung('schlecht host', false, ZIEL)).toBe(`${ZIEL}/api/zugang/google/zurueck`);
    expect(() => oauthWeiterleitung('', false, undefined)).toThrow('Ungültige Eingabe.');
    expect(() => oauthWeiterleitung('schlecht host', false, undefined)).toThrow('Ungültige Eingabe.');
  });

  it('setzt den VAPID-Betreff nur, wenn die App-Adresse gesetzt und kein Betreff da ist', () => {
    expect(leseVapid(SCHLUESSEL)).toBeNull();
    expect(leseVapid({ ...SCHLUESSEL, STRIDE_APP_URL: STANDARD })).toMatchObject({ betreff: STANDARD });
    expect(leseVapid({ ...SCHLUESSEL, STRIDE_APP_URL: ZIEL })).toMatchObject({ betreff: ZIEL });
    expect(leseVapid({ ...SCHLUESSEL, ASCEND_APP_URL: ZIEL })).toMatchObject({ betreff: ZIEL });
    expect(leseVapid({ ...SCHLUESSEL, STRIDE_APP_URL: STANDARD, ASCEND_APP_URL: ZIEL })).toMatchObject({ betreff: STANDARD });
    expect(leseVapid({ ...SCHLUESSEL, STRIDE_APP_URL: ZIEL, VAPID_SUBJECT: 'mailto:push@example.com' })).toMatchObject({
      betreff: 'mailto:push@example.com',
    });
    expect(leseVapid({ ...SCHLUESSEL, STRIDE_APP_URL: 'http://wupo.app' })).toBeNull();
    expect(leseVapid({ ...SCHLUESSEL, VAPID_SUBJECT: 'http://stride.example/kontakt', STRIDE_APP_URL: ZIEL })).toBeNull();
  });

  it('lässt den Mail-Absender ohne Variable beim Postfach und hängt sonst die Domain an', () => {
    const ohne = {};
    expect(mailAbsender('kontakt@leohr.de', undefined, ohne)).toBe('kontakt@leohr.de');
    expect(mailAbsender('kontakt@leohr.de', '   ', ohne)).toBe('kontakt@leohr.de');
    expect(mailAbsender('kontakt@leohr.de', STANDARD, ohne)).toBe('kontakt@stride.leohr.de');
    expect(mailAbsender('kontakt@leohr.de', ZIEL, ohne)).toBe('kontakt@wupo.app');
    expect(mailAbsender('kein-at', ZIEL, ohne)).toBe('kein-at');
    expect(mailAbsender('a@b@c.de', ZIEL, ohne)).toBe('a@b@c.de');
  });

  it('nimmt eine gültige Absender-Variable und lässt ungültige oder fehlende Angaben bei der bisherigen Logik', () => {
    const postfach = 'kontakt@leohr.de';
    const eigener = 'absender@example.com';
    expect(mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: eigener })).toBe(eigener);
    expect(mailAbsender(postfach, undefined, { ASCEND_SMTP_ABSENDER: eigener })).toBe(eigener);
    expect(
      mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: eigener, ASCEND_SMTP_ABSENDER: 'alt@example.com' }),
    ).toBe(eigener);
    expect(mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: `  ${eigener}  ` })).toBe(eigener);

    expect(mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: 'kein-at' })).toBe('kontakt@wupo.app');
    expect(mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: 'a@b@c.de' })).toBe('kontakt@wupo.app');
    expect(mailAbsender(postfach, undefined, { STRIDE_SMTP_ABSENDER: 'ohne-punkt@host' })).toBe(postfach);
    expect(mailAbsender('kein-at', ZIEL, { STRIDE_SMTP_ABSENDER: 'a@b' })).toBe('kein-at');
    expect(
      mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: 'kein-at', ASCEND_SMTP_ABSENDER: eigener }),
    ).toBe('kontakt@wupo.app');
    expect(mailAbsender(postfach, ZIEL, { STRIDE_SMTP_ABSENDER: '', ASCEND_SMTP_ABSENDER: eigener })).toBe(
      'kontakt@wupo.app',
    );

    expect(mailAbsender(postfach, undefined, {})).toBe(postfach);
    expect(mailAbsender(postfach, '   ', { STRIDE_SMTP_ABSENDER: '   ' })).toBe(postfach);
    expect(mailAbsender(postfach, STANDARD, {})).toBe('kontakt@stride.leohr.de');
    expect(mailAbsender(postfach, ZIEL, {})).toBe('kontakt@wupo.app');
  });

  it('hängt die Adresse nur an Dokumente, wenn sie gesetzt ist', async () => {
    expect(istDokumentPfad('/')).toBe(true);
    expect(istDokumentPfad('/index.html')).toBe(true);
    expect(istDokumentPfad('/datenschutz')).toBe(true);
    expect(istDokumentPfad('/mehr/rechtliches')).toBe(true);
    expect(istDokumentPfad('/api')).toBe(false);
    expect(istDokumentPfad('/api/zugang')).toBe(false);
    expect(istDokumentPfad('/sw.js')).toBe(false);
    expect(istDokumentPfad('/assets/app.js')).toBe(false);
    expect(istDokumentPfad('/manifest.webmanifest')).toBe(false);

    const index = readFileSync(path.join(WURZEL, 'client', 'index.html'), 'utf8');
    expect(index).toContain('</head>');
    expect(index).not.toContain('wupo-app-adresse');
    const mitZiel = fuegeAppAdresseEin(index, ZIEL);
    expect(mitZiel).toContain(`content="${ZIEL}"`);
    expect(fuegeAppAdresseEin(mitZiel, STANDARD)).toBe(mitZiel);
    expect(fuegeAppAdresseEin('<html></html>', ZIEL)).toBe('<html></html>');

    const ordner = mkdtempSync(path.join(tmpdir(), 'stride-app-adresse-'));
    writeFileSync(path.join(ordner, 'index.html'), '<!doctype html><head></head><body>seite</body>');
    const env: NodeJS.ProcessEnv = {};
    expect(gesetzteAppAdresse(env)).toBeNull();
    expect(dokumentMitAppAdresse(ordner, ZIEL)).toContain(`content="${ZIEL}"`);
    const app = Fastify({ logger: false });
    registriereAppAdresse(app, ordner, env);
    app.get('/api/ping', async () => ({ ok: true }));
    app.setNotFoundHandler((_anfrage, antwort) => {
      antwort.status(404).type('text/plain').send('ORIGINAL');
    });
    try {
      const ohne = await app.inject({ method: 'GET', url: '/datenschutz' });
      expect(ohne.statusCode).toBe(404);
      expect(ohne.body).toBe('ORIGINAL');
      env.STRIDE_APP_URL = ZIEL;
      expect(gesetzteAppAdresse(env)).toBe(ZIEL);
      const seite = await app.inject({ method: 'GET', url: '/datenschutz' });
      expect(seite.statusCode).toBe(200);
      expect(seite.headers['content-type']).toContain('text/html');
      expect(seite.body).toContain(`content="${ZIEL}"`);
      expect(seite.body).toContain('seite');
      const start = await app.inject({ method: 'GET', url: '/' });
      expect(start.body).toContain(`content="${ZIEL}"`);
      const datei = await app.inject({ method: 'GET', url: '/assets/app.js' });
      expect(datei.body).toBe('ORIGINAL');
      const api = await app.inject({ method: 'GET', url: '/api/ping' });
      expect(api.statusCode).toBe(200);
      expect(api.json()).toEqual({ ok: true });
      env.STRIDE_APP_URL = STANDARD;
      const standard = await app.inject({ method: 'GET', url: '/nutzungsbedingungen' });
      expect(standard.body).toContain(`content="${STANDARD}"`);
      delete env.STRIDE_APP_URL;
      env.ASCEND_APP_URL = ZIEL;
      expect(gesetzteAppAdresse(env)).toBe(ZIEL);
    } finally {
      await app.close();
    }
  });

  it('leitet die Wechseladresse vor dem Dokument um, auch im Testbetrieb ohne App-Adresse', async () => {
    const ordner = mkdtempSync(path.join(tmpdir(), 'stride-app-adresse-'));
    writeFileSync(path.join(ordner, 'index.html'), '<!doctype html><head></head><body>seite</body>');
    const env: NodeJS.ProcessEnv = { STRIDE_TEST: '1' };
    const app = Fastify({ logger: false });
    registriereAppAdresse(app, ordner, env);
    app.setNotFoundHandler((_anfrage, antwort) => {
      antwort.status(404).type('text/plain').send('ORIGINAL');
    });
    try {
      const umleitung = await app.inject({ method: 'GET', url: CHANGE_PASSWORD_PFAD });
      expect(umleitung.statusCode).toBe(302);
      expect(umleitung.headers.location).toBe(PASSWORT_AENDERN_PFAD);
      expect(umleitung.body).not.toContain('seite');
      const mitFrage = await app.inject({ method: 'GET', url: `${CHANGE_PASSWORD_PFAD}?von=manager` });
      expect(mitFrage.statusCode).toBe(302);
      expect(mitFrage.headers.location).toBe(PASSWORT_AENDERN_PFAD);
      const kopf = await app.inject({ method: 'HEAD', url: CHANGE_PASSWORD_PFAD });
      expect(kopf.statusCode).toBe(302);
      expect(kopf.headers.location).toBe(PASSWORT_AENDERN_PFAD);

      env.STRIDE_APP_URL = ZIEL;
      const mitAdresse = await app.inject({ method: 'GET', url: CHANGE_PASSWORD_PFAD });
      expect(mitAdresse.statusCode).toBe(302);
      expect(mitAdresse.headers.location).toBe(PASSWORT_AENDERN_PFAD);
      expect(mitAdresse.body).not.toContain(ZIEL);

      const dokument = await app.inject({ method: 'GET', url: '/mehr' });
      expect(dokument.statusCode).toBe(200);
      expect(dokument.body).toContain('seite');
      expect(dokument.body).toContain(`content="${ZIEL}"`);

      delete env.STRIDE_TEST;
      delete env.STRIDE_APP_URL;
      const ohne = await app.inject({ method: 'GET', url: CHANGE_PASSWORD_PFAD });
      expect(ohne.statusCode).toBe(302);
      expect(ohne.headers.location).toBe(PASSWORT_AENDERN_PFAD);
      const datei = await app.inject({ method: 'GET', url: '/assets/app.js' });
      expect(datei.statusCode).toBe(404);
      expect(datei.body).toBe('ORIGINAL');
    } finally {
      await app.close();
    }
  });

  it('nutzt die gesetzte Adresse in der echten OAuth-Weiterleitung', async () => {
    const vorherStride = process.env.STRIDE_APP_URL;
    const vorherAscend = process.env.ASCEND_APP_URL;
    bereit();
    googleEnv(true);
    await inhaber();
    try {
      delete process.env.STRIDE_APP_URL;
      delete process.env.ASCEND_APP_URL;
      await mitRouten(async (app) => {
        const ohne = await app.inject({
          method: 'GET',
          url: '/api/zugang/google/start?zweck=anmelden',
          headers: { host: '127.0.0.1:3327' },
        });
        expect(ohne.statusCode).toBe(302);
        expect(new URL(String(ohne.headers.location)).searchParams.get('redirect_uri')).toBe(
          'http://127.0.0.1:3327/api/zugang/google/zurueck',
        );
        process.env.STRIDE_APP_URL = ZIEL;
        const ziel = await app.inject({
          method: 'GET',
          url: '/api/zugang/google/start?zweck=anmelden',
          headers: { host: '127.0.0.1:3327' },
        });
        expect(new URL(String(ziel.headers.location)).searchParams.get('redirect_uri')).toBe(`${ZIEL}/api/zugang/google/zurueck`);
        process.env.STRIDE_APP_URL = STANDARD;
        const standard = await app.inject({
          method: 'GET',
          url: '/api/zugang/google/start?zweck=anmelden',
          headers: { host: '127.0.0.1:3327' },
        });
        expect(new URL(String(standard.headers.location)).searchParams.get('redirect_uri')).toBe(
          `${STANDARD}/api/zugang/google/zurueck`,
        );
      });
    } finally {
      if (vorherStride === undefined) {
        delete process.env.STRIDE_APP_URL;
      } else {
        process.env.STRIDE_APP_URL = vorherStride;
      }
      if (vorherAscend === undefined) {
        delete process.env.ASCEND_APP_URL;
      } else {
        process.env.ASCEND_APP_URL = vorherAscend;
      }
      aufraeumen();
    }
  });

  it('nennt STRIDE_APP_URL in README und .env.example, ohne sie zu setzen', () => {
    const readme = readFileSync(path.join(WURZEL, 'README.md'), 'utf8');
    const beispiel = readFileSync(path.join(WURZEL, '.env.example'), 'utf8');
    const index = readFileSync(path.join(WURZEL, 'server', 'index.ts'), 'utf8');
    expect(readme).toContain('STRIDE_APP_URL');
    expect(readme).toContain('ASCEND_APP_URL');
    expect(readme).toContain(STANDARD);
    expect(readme).not.toContain('wupo.app');
    expect(beispiel).toContain('STRIDE_APP_URL');
    expect(beispiel).toContain('ASCEND_APP_URL');
    expect(beispiel).toContain(STANDARD);
    expect(beispiel).not.toContain('wupo.app');
    expect(beispiel).not.toMatch(/^STRIDE_APP_URL=\S/m);
    expect(beispiel).not.toMatch(/^ASCEND_APP_URL=\S/m);
    expect(index).toContain('registriereAppAdresse(app, KONFIG.clientPfad)');
  });
});
