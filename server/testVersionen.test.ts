import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { anzeigeFuer, listeBisVersion, TEST_VERSION, versionAusMeta } from '../e2e/versionsquelle.ts';
import type { Versionseintrag } from '../shared/versionen.ts';
import { registriereAppAdresse } from './appAdresse.ts';
import { fuegeTestVersionEin, testversionEinblendung } from './testVersionen.ts';

function eintrag(version: string): Versionseintrag {
  return { version, seiten: 'Mehr', abschnitte: [{ titel: 'Geändert', punkte: ['Satz'] }] };
}

describe('feste Testfassung', () => {
  it('lässt neuere Einträge weg und lässt die echte Liste unangetastet', () => {
    const liste = [eintrag('4.2.8'), eintrag('4.2.7'), eintrag('4.2.6')];
    expect(listeBisVersion(liste, TEST_VERSION).map((eintrag) => eintrag.version)).toEqual(['4.2.7', '4.2.6']);
    expect(TEST_VERSION).toBe('4.2.7');
    const echt = anzeigeFuer(null, liste, '4.2.8');
    expect(echt.version).toBe('4.2.8');
    expect(echt.liste).toBe(liste);
    expect(anzeigeFuer(TEST_VERSION, liste, '4.2.8').version).toBe(TEST_VERSION);
  });

  it('liest nur eine Versionsnummer aus der Marke', () => {
    expect(versionAusMeta(' 4.2.7 ')).toBe('4.2.7');
    expect(versionAusMeta('4.2')).toBeNull();
    expect(versionAusMeta(null)).toBeNull();
    expect(versionAusMeta('')).toBeNull();
  });

  it('blendet die Fassung nur im Testbetrieb ein', () => {
    expect(testversionEinblendung({})).toBeNull();
    expect(testversionEinblendung({ STRIDE_TEST: '0' })).toBeNull();
    expect(testversionEinblendung({ ASCEND_TEST: '1' })).toBe(TEST_VERSION);
    expect(testversionEinblendung({ STRIDE_TEST: '1' })).toBe(TEST_VERSION);
  });

  it('setzt die Marke einmal vor den Kopf', () => {
    const html = '<html><head><title>Wupo</title></head><body>seite</body></html>';
    const mit = fuegeTestVersionEin(html, TEST_VERSION);
    expect(mit).toContain(`<meta name="stride-test-versionen" content="${TEST_VERSION}">`);
    expect(mit).toContain('seite');
    expect(fuegeTestVersionEin(mit, TEST_VERSION)).toBe(mit);
    expect(fuegeTestVersionEin('<html></html>', TEST_VERSION)).toBe('<html></html>');
  });

  it('liefert die Marke nur an Dokumente im Testbetrieb', async () => {
    const ordner = mkdtempSync(path.join(tmpdir(), 'stride-testversion-'));
    writeFileSync(path.join(ordner, 'index.html'), '<!doctype html><head></head><body>seite</body>');
    const env: NodeJS.ProcessEnv = {};
    const app = Fastify({ logger: false });
    registriereAppAdresse(app, ordner, env);
    app.get('/api/ping', async () => ({ ok: true }));
    app.setNotFoundHandler((_anfrage, antwort) => {
      antwort.status(404).type('text/plain').send('ORIGINAL');
    });
    const ohne = await app.inject({ method: 'GET', url: '/mehr' });
    expect(ohne.statusCode).toBe(404);
    expect(ohne.body).toBe('ORIGINAL');
    env.STRIDE_TEST = '1';
    const seite = await app.inject({ method: 'GET', url: '/mehr/neu' });
    expect(seite.statusCode).toBe(200);
    expect(seite.headers['content-type']).toContain('text/html');
    expect(seite.body).toContain(`content="${TEST_VERSION}"`);
    expect(seite.body).toContain('seite');
    const datei = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(datei.body).toBe('ORIGINAL');
    const api = await app.inject({ method: 'GET', url: '/api/ping' });
    expect(api.json()).toEqual({ ok: true });
    env.STRIDE_APP_URL = 'https://wupo.app';
    const beides = await app.inject({ method: 'GET', url: '/' });
    expect(beides.body).toContain('content="https://wupo.app"');
    expect(beides.body).toContain(`content="${TEST_VERSION}"`);
    delete env.STRIDE_TEST;
    const nurAdresse = await app.inject({ method: 'GET', url: '/' });
    expect(nurAdresse.body).toContain('content="https://wupo.app"');
    expect(nurAdresse.body).not.toContain('stride-test-versionen');
    await app.close();
  });
});
