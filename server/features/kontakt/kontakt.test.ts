import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { kontaktErlaubt, registrierungErlaubt, setzeKontakteZurueck, setzeRegistrierungenZurueck } from '../../anfrageGrenzen.ts';
import { AppFehler } from '../../fehler.ts';
import { istOeffentlicherZugang } from '../zugang/routen.ts';
import { kontaktRouten, setzeKontaktVersand } from './routen.ts';
import { antwortAdresse, liesSmtp, sendeBrief, type KontaktBrief } from './smtp.ts';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const NICHT_VERFUEGBAR = 'Das Kontaktformular ist nicht verfügbar.';
const ZU_VIELE = 'Zu viele Versuche. Bitte später erneut versuchen.';
const NICHT_GESENDET = 'Die Nachricht konnte nicht gesendet werden. Bitte versuch es später noch einmal.';
const NAMEN = [
  'STRIDE_TEST',
  'ASCEND_TEST',
  'STRIDE_SMTP_HOST',
  'ASCEND_SMTP_HOST',
  'STRIDE_SMTP_PORT',
  'ASCEND_SMTP_PORT',
  'STRIDE_SMTP_BENUTZER',
  'ASCEND_SMTP_BENUTZER',
  'STRIDE_SMTP_PASSWORT',
  'ASCEND_SMTP_PASSWORT',
  'STRIDE_SMTP_ABSENDER',
  'ASCEND_SMTP_ABSENDER',
  'STRIDE_GOOGLE',
  'ASCEND_GOOGLE',
  'STRIDE_GOOGLE_CLIENT_ID',
  'ASCEND_GOOGLE_CLIENT_ID',
  'STRIDE_GOOGLE_CLIENT_SECRET',
  'ASCEND_GOOGLE_CLIENT_SECRET',
  'STRIDE_REGISTRIERUNG',
  'ASCEND_REGISTRIERUNG',
] as const;
const sicherung = new Map<string, string | undefined>(NAMEN.map((name) => [name, process.env[name]]));

function leeren(): void {
  for (const name of NAMEN) {
    delete process.env[name];
  }
}

function weg(name: string): void {
  expect(Object.prototype.hasOwnProperty.call(process.env, name), name).toBe(false);
}

function setzeSmtp(): void {
  process.env.STRIDE_SMTP_HOST = '127.0.0.1';
  process.env.STRIDE_SMTP_PORT = '9';
  process.env.STRIDE_SMTP_BENUTZER = 'kontakt@leohr.de';
  process.env.STRIDE_SMTP_PASSWORT = 'nur-test';
}

function brief(ueber: Partial<KontaktBrief> = {}): KontaktBrief {
  return {
    name: 'Ada',
    email: 'ada@example.com',
    nachricht: 'Hallo Stride',
    ...ueber,
  };
}

beforeEach(() => {
  leeren();
  setzeKontaktVersand(null);
  setzeKontakteZurueck();
  setzeRegistrierungenZurueck();
});

afterAll(() => {
  setzeKontaktVersand(null);
  setzeKontakteZurueck();
  for (const [name, wert] of sicherung) {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(kontaktRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

describe('Kontaktformular', () => {
  it('ist ohne SMTP-Werte nicht verfügbar und stürzt nicht ab', async () => {
    weg('STRIDE_SMTP_HOST');
    weg('STRIDE_SMTP_PORT');
    weg('STRIDE_SMTP_BENUTZER');
    weg('STRIDE_SMTP_PASSWORT');
    weg('STRIDE_SMTP_ABSENDER');
    weg('ASCEND_SMTP_HOST');
    weg('ASCEND_SMTP_PORT');
    weg('ASCEND_SMTP_BENUTZER');
    weg('ASCEND_SMTP_PASSWORT');
    weg('ASCEND_SMTP_ABSENDER');
    weg('STRIDE_GOOGLE');
    weg('STRIDE_GOOGLE_CLIENT_ID');
    weg('STRIDE_GOOGLE_CLIENT_SECRET');
    weg('STRIDE_REGISTRIERUNG');
    expect(liesSmtp()).toBeNull();
    expect(istOeffentlicherZugang('GET', '/api/kontakt')).toBe(true);
    expect(istOeffentlicherZugang('POST', '/api/kontakt')).toBe(true);
    expect(istOeffentlicherZugang('POST', '/api/kontakt/extra')).toBe(false);
    expect(istOeffentlicherZugang('GET', '/api/kontakt?frage=1')).toBe(true);
    await mitRouten(async (app) => {
      const status = await app.inject({ method: 'GET', url: '/api/kontakt' });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual({ verfuegbar: false });
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/kontakt',
        payload: brief(),
      });
      expect(antwort.statusCode).toBe(503);
      expect(antwort.json()).toEqual({ fehler: NICHT_VERFUEGBAR });
    });
  });

  it('lässt die SMTP-Platzhalter leer', () => {
    const beispiel = readFileSync(join(WURZEL, '.env.example'), 'utf8');
    const readme = readFileSync(join(WURZEL, 'README.md'), 'utf8');
    for (const name of [
      'STRIDE_SMTP_HOST',
      'STRIDE_SMTP_PORT',
      'STRIDE_SMTP_BENUTZER',
      'STRIDE_SMTP_PASSWORT',
      'STRIDE_SMTP_ABSENDER',
    ]) {
      expect(beispiel).toContain(`${name}=`);
      expect(beispiel).not.toMatch(new RegExp(`^${name}=\\S`, 'm'));
      expect(readme).toContain(name);
    }
    expect(readme).toContain('kontakt@leohr.de');
    expect(readme).not.toMatch(/smtp\.zoho/i);
    expect(beispiel).not.toMatch(/smtp\.zoho/i);
  });

  it('nimmt eine gefüllte Falle an, ohne zu senden und ohne zu zählen', async () => {
    let aufrufe = 0;
    setzeKontaktVersand(async () => {
      aufrufe += 1;
    });
    await mitRouten(async (app) => {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/kontakt',
        headers: { 'x-forwarded-for': '203.0.113.9' },
        payload: { ...brief(), website: 'https://spam.example' },
      });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.json()).toEqual({ ok: true });
    });
    expect(aufrufe).toBe(0);
    for (let index = 0; index < 5; index += 1) {
      expect(kontaktErlaubt('203.0.113.9', 5_000)).toBe(true);
    }
    expect(kontaktErlaubt('203.0.113.9', 5_000)).toBe(false);
  });

  it('sendet im Testmodus über den JSON-Transport, Absender ist das Postfach', async () => {
    process.env.STRIDE_TEST = '1';
    setzeSmtp();
    const zugang = liesSmtp();
    expect(zugang?.host).toBe('127.0.0.1');
    const info = (await sendeBrief(
      brief({ name: 'Ada "x"\r\nBcc: y' }),
      zugang ?? { host: '127.0.0.1', port: 9, benutzer: 'kontakt@leohr.de', passwort: 'nur-test' },
    )) as { message?: string };
    const roh = info.message ?? '';
    expect(roh).not.toMatch(/\r|\n/);
    expect(roh).not.toContain('nur-test');
    const daten = JSON.parse(roh) as { from?: unknown; to?: unknown; replyTo?: unknown; subject?: unknown; text?: unknown };
    const text = JSON.stringify({ from: daten.from, to: daten.to, replyTo: daten.replyTo });
    expect(JSON.stringify(daten.from)).toContain('kontakt@leohr.de');
    expect(JSON.stringify(daten.from)).not.toContain('ada@example.com');
    expect(JSON.stringify(daten.to)).toContain('kontakt@leohr.de');
    expect(JSON.stringify(daten.replyTo)).toContain('ada@example.com');
    expect(text).not.toContain('\\r');
    expect(daten.subject).toBe('Kontaktformular');
    expect(String(daten.text)).toContain('Hallo Stride');
    expect(antwortAdresse('Ada "x"\r\nBcc: y', 'ada@example.com')).toBe('"Ada x Bcc: y" <ada@example.com>');
    expect(antwortAdresse('   ', 'ada@example.com')).toBe('ada@example.com');
    await mitRouten(async (app) => {
      const antwort = await app.inject({ method: 'POST', url: '/api/kontakt', payload: brief() });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.json()).toEqual({ ok: true });
      const status = await app.inject({ method: 'GET', url: '/api/kontakt' });
      expect(status.json()).toEqual({ verfuegbar: true });
    });
  });

  it('begrenzt fünf Nachrichten je Stunde und wählt keinen SMTP-Host', async () => {
    setzeSmtp();
    const aufrufe: KontaktBrief[] = [];
    setzeKontaktVersand(async (gesendet) => {
      aufrufe.push(gesendet);
    });
    weg('STRIDE_TEST');
    await mitRouten(async (app) => {
      for (let index = 0; index < 5; index += 1) {
        const antwort = await app.inject({
          method: 'POST',
          url: '/api/kontakt',
          headers: { 'x-forwarded-for': '203.0.113.8' },
          payload: brief(),
        });
        expect(antwort.statusCode).toBe(200);
      }
      const sechste = await app.inject({
        method: 'POST',
        url: '/api/kontakt',
        headers: { 'x-forwarded-for': '203.0.113.8' },
        payload: brief(),
      });
      expect(sechste.statusCode).toBe(429);
      expect(sechste.json()).toEqual({ fehler: ZU_VIELE });
    });
    expect(aufrufe).toHaveLength(5);
    expect(registrierungErlaubt('203.0.113.8')).toBe(true);
  });

  it('lehnt ungültige Angaben ab und gibt den Versandfehler ohne Details zurück', async () => {
    process.env.STRIDE_TEST = '1';
    setzeSmtp();
    let aufrufe = 0;
    setzeKontaktVersand(async () => {
      aufrufe += 1;
      throw Object.assign(new Error('geheimnis-im-text'), { code: 'EAUTH' });
    });
    await mitRouten(async (app) => {
      const leer = await app.inject({
        method: 'POST',
        url: '/api/kontakt',
        payload: { email: 'ada@example.com', nachricht: '   ' },
      });
      expect(leer.statusCode).toBe(400);
      expect(leer.json()).toEqual({ fehler: 'Die Nachricht fehlt.' });
      const falsch = await app.inject({
        method: 'POST',
        url: '/api/kontakt',
        payload: { email: 'keine-adresse', nachricht: 'Hallo' },
      });
      expect(falsch.statusCode).toBe(400);
      expect(falsch.json()).toEqual({ fehler: 'Die E-Mail-Adresse ist ungültig.' });
      const versand = await app.inject({ method: 'POST', url: '/api/kontakt', payload: brief() });
      expect(versand.statusCode).toBe(502);
      expect(versand.json()).toEqual({ fehler: NICHT_GESENDET });
      expect(JSON.stringify(versand.json())).not.toContain('geheimnis');
    });
    expect(aufrufe).toBe(1);
  });
});
