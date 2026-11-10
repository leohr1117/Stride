import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import { registriereGesundheit } from './gesundheit.ts';
import {
  bereiteLoggerVor,
  loescheAlteLogdateien,
  loggerOptionen,
  oeffneLogStrom,
  schliesseLogStrom,
} from './logDatei.ts';

function merke(): { strom: Writable; text: () => string } {
  let text = '';
  const strom = new Writable({
    write(chunk, _encoding, callback) {
      text += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      callback();
    },
  });
  return { strom, text: () => text };
}

function ordner(): string {
  return mkdtempSync(path.join(tmpdir(), 'stride-log-'));
}

function fehlerStrom(): fs.WriteStream {
  const strom = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
      strom.emit('error', new Error('ENOSPC'));
    },
  });
  return strom as unknown as fs.WriteStream;
}

describe('Logdatei', () => {
  const schliessen: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await schliesseLogStrom();
    while (schliessen.length > 0) {
      await schliessen.pop()?.();
    }
  });

  it('legt ohne Pfad nichts an', () => {
    const wurzel = ordner();
    const stderr = merke();
    const vorher = fs.readdirSync(wurzel);
    const optionen = bereiteLoggerVor('warn', { env: {}, wurzel, stderr: stderr.strom });
    expect(fs.readdirSync(wurzel)).toEqual(vorher);
    expect(stderr.text()).toBe('');
    expect(optionen).not.toHaveProperty('stream');
  });

  it('bevorzugt STRIDE_ vor ASCEND_ und schreibt in die Tagesdatei und auf die Konsole', async () => {
    const wurzel = ordner();
    const stdout = merke();
    const heute = new Date(2026, 10, 10);
    const optionen = bereiteLoggerVor('info', {
      env: { STRIDE_LOG_PFAD: 'von-stride', ASCEND_LOG_PFAD: 'von-ascend' },
      wurzel,
      stdout: stdout.strom,
      jetzt: () => heute,
    });
    const app = Fastify({ logger: optionen });
    schliessen.push(() => app.close());
    app.log.warn('stride-gewinnt');
    await app.close();
    schliessen.pop();
    await schliesseLogStrom();
    const datei = path.join(wurzel, 'von-stride', 'stride-2026-11-10.log');
    expect(fs.readFileSync(datei, 'utf8')).toContain('stride-gewinnt');
    expect(stdout.text()).toContain('stride-gewinnt');
    expect(fs.existsSync(path.join(wurzel, 'von-ascend'))).toBe(false);
  });

  it('nutzt ASCEND_, wenn STRIDE_ fehlt', async () => {
    const wurzel = ordner();
    const stdout = merke();
    const optionen = bereiteLoggerVor('info', {
      env: { ASCEND_LOG_PFAD: 'von-ascend' },
      wurzel,
      stdout: stdout.strom,
      jetzt: () => new Date(2026, 10, 10),
    });
    const app = Fastify({ logger: optionen });
    schliessen.push(() => app.close());
    app.log.warn('ascend-faellt-ein');
    await app.close();
    schliessen.pop();
    await schliesseLogStrom();
    expect(fs.readFileSync(path.join(wurzel, 'von-ascend', 'stride-2026-11-10.log'), 'utf8')).toContain('ascend-faellt-ein');
    expect(stdout.text()).toContain('ascend-faellt-ein');
  });

  it('öffnet beim Datumswechsel die neue Datei', async () => {
    const ziel = ordner();
    const stdout = merke();
    const uhr = { datum: new Date(2026, 10, 10) };
    const strom = oeffneLogStrom({ ordner: ziel, stdout: stdout.strom, jetzt: () => uhr.datum });
    strom.write('erster\n');
    uhr.datum = new Date(2026, 10, 11);
    strom.write('zweiter\n');
    await schliesseLogStrom();
    const erster = fs.readFileSync(path.join(ziel, 'stride-2026-11-10.log'), 'utf8');
    const zweiter = fs.readFileSync(path.join(ziel, 'stride-2026-11-11.log'), 'utf8');
    expect(erster).toContain('erster');
    expect(erster).not.toContain('zweiter');
    expect(zweiter).toContain('zweiter');
    expect(stdout.text()).toContain('erster');
    expect(stdout.text()).toContain('zweiter');
  });

  it('löscht nur Tagesdateien, die älter als 14 Tage sind', () => {
    const ziel = ordner();
    fs.mkdirSync(path.join(ziel, 'unter'));
    fs.writeFileSync(path.join(ziel, 'unter', 'stride-2020-01-01.log'), 'bleib');
    fs.writeFileSync(path.join(ziel, 'app.db'), 'db');
    fs.writeFileSync(path.join(ziel, 'foo.log'), 'foo');
    fs.writeFileSync(path.join(ziel, 'stride-2026-10-26.log'), 'alt');
    fs.writeFileSync(path.join(ziel, 'stride-2026-10-27.log'), 'grenze');
    loescheAlteLogdateien(ziel, new Date(2026, 10, 10));
    expect(fs.existsSync(path.join(ziel, 'stride-2026-10-26.log'))).toBe(false);
    expect(fs.readFileSync(path.join(ziel, 'stride-2026-10-27.log'), 'utf8')).toBe('grenze');
    expect(fs.readFileSync(path.join(ziel, 'app.db'), 'utf8')).toBe('db');
    expect(fs.readFileSync(path.join(ziel, 'foo.log'), 'utf8')).toBe('foo');
    expect(fs.readFileSync(path.join(ziel, 'unter', 'stride-2020-01-01.log'), 'utf8')).toBe('bleib');
  });

  it('warnt bei einem Dateipfad, schreibt nur auf die Konsole und lässt die Datei', async () => {
    const wurzel = ordner();
    const datei = path.join(wurzel, 'app.db');
    fs.writeFileSync(datei, 'UNBERUEHRT');
    const stderr = merke();
    const ohneStrom = bereiteLoggerVor('info', { env: { STRIDE_LOG_PFAD: datei }, wurzel, stderr: stderr.strom });
    expect(ohneStrom).not.toHaveProperty('stream');
    expect(stderr.text()).toBe('Der Log-Pfad zeigt auf eine Datei. Es wird nur auf die Konsole geschrieben.\n');
    const stdout = merke();
    const stderr2 = merke();
    const app = Fastify({
      logger: bereiteLoggerVor('info', {
        env: { STRIDE_LOG_PFAD: datei },
        wurzel,
        stdout: stdout.strom,
        stderr: stderr2.strom,
      }),
    });
    schliessen.push(() => app.close());
    app.log.warn('nur-konsole');
    await app.close();
    schliessen.pop();
    expect(stdout.text()).toContain('nur-konsole');
    expect(fs.readFileSync(datei, 'utf8')).toBe('UNBERUEHRT');
    expect(fs.readdirSync(wurzel)).toEqual(['app.db']);
    expect(stderr2.text().match(/zeigt auf eine Datei/g)).toHaveLength(1);
  });

  it('beendet bei einem Schreibfehler nichts und warnt einmal', async () => {
    const ziel = ordner();
    const stdout = merke();
    const stderr = merke();
    const uhr = { datum: new Date(2026, 10, 10) };
    let fehler = true;
    const strom = oeffneLogStrom({
      ordner: ziel,
      stdout: stdout.strom,
      stderr: stderr.strom,
      jetzt: () => uhr.datum,
      oeffneDatei: (pfad) => (fehler ? fehlerStrom() : fs.createWriteStream(pfad, { flags: 'a' })),
    });
    strom.write('eins\n');
    strom.write('zwei\n');
    expect(stdout.text()).toContain('eins');
    expect(stdout.text()).toContain('zwei');
    expect(stderr.text().match(/nicht schreibbar/g)).toHaveLength(1);
    fehler = false;
    uhr.datum = new Date(2026, 10, 11);
    strom.write('drei\n');
    await schliesseLogStrom();
    expect(stderr.text().match(/nicht schreibbar/g)).toHaveLength(1);
    expect(stdout.text()).toContain('drei');
    expect(fs.readFileSync(path.join(ziel, 'stride-2026-11-11.log'), 'utf8')).toContain('drei');
    expect(fs.existsSync(path.join(ziel, 'stride-2026-11-10.log'))).toBe(false);
  });

  it('schwärzt Geheimnisse und ersetzt Adressen im Fehler', async () => {
    const puff = merke();
    const app = Fastify({ logger: loggerOptionen('info', puff.strom) });
    schliessen.push(() => app.close());
    app.get('/api/zugang/google/zurueck', async () => ({ ok: true }));
    app.log.info({
      passwort: 'GEHEIM',
      password: 'GEHEIM',
      token: 'GEHEIM',
      secret: 'GEHEIM',
      code: 'GEHEIM',
      state: 'GEHEIM',
      email: 'GEHEIM',
      adresse: 'GEHEIM',
      innen: { code: 'GEHEIM', state: 'GEHEIM', email: 'GEHEIM', adresse: 'GEHEIM', cookie: 'GEHEIM' },
    });
    app.log.error(
      { err: new Error('siehe https://geheim.example/x und webcal://geheim.example/k.ics und http://geheim.example/y') },
      'Abgleich',
    );
    const antwort = await app.inject({
      method: 'GET',
      url: '/api/zugang/google/zurueck?code=GEHEIM&state=GEHEIM',
      headers: { cookie: 'ascend_sitzung=GEHEIM', authorization: 'Bearer GEHEIM' },
    });
    expect(antwort.statusCode).toBe(200);
    await app.close();
    schliessen.pop();
    const text = puff.text();
    expect(text).not.toContain('GEHEIM');
    expect(text).not.toContain('geheim.example');
    expect(text).not.toContain('https://');
    expect(text).not.toContain('webcal://');
    expect(text).not.toContain('http://');
    expect(text).toContain('[adresse]');
    expect(text).toContain('[redigiert]');
    expect(text).toContain('/api/zugang/google/zurueck');
    expect(text).not.toContain('code=');
  });

  it('loggt die Gesundheitsroute nicht', async () => {
    const puff = merke();
    const app = Fastify({ logger: loggerOptionen('info', puff.strom) });
    schliessen.push(() => app.close());
    await app.register(async (api) => {
      await registriereGesundheit(api);
    }, { prefix: '/api' });
    const antwort = await app.inject({ method: 'GET', url: '/api/gesundheit' });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({ version: AKTUELLE_VERSION });
    await app.close();
    schliessen.pop();
    expect(puff.text()).not.toContain('gesundheit');
  });
});
