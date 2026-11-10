import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import { istGesundheitsanfrage, registriereGesundheit } from './gesundheit.ts';

async function baueApp() {
  const app = Fastify({ logger: false });
  await app.register(
    async (api) => {
      await registriereGesundheit(api);
    },
    { prefix: '/api' },
  );
  return app;
}

describe('Gesundheit', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  it('antwortet ohne Cookie mit 200 und nur der Version', async () => {
    const app = await baueApp();
    apps.push(app);
    const antwort = await app.inject({ method: 'GET', url: '/api/gesundheit' });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({ version: AKTUELLE_VERSION });
    expect(antwort.headers['set-cookie']).toBeUndefined();
  });

  it('nimmt Cookie und Query nicht in den Körper', async () => {
    const app = await baueApp();
    apps.push(app);
    const mitQuery = await app.inject({
      method: 'GET',
      url: '/api/gesundheit?code=GEHEIM',
      headers: { cookie: 'ascend_sitzung=GEHEIM' },
    });
    const mitSlash = await app.inject({ method: 'GET', url: '/api/gesundheit/' });
    expect(mitQuery.statusCode).toBe(200);
    expect(mitQuery.json()).toEqual({ version: AKTUELLE_VERSION });
    expect(JSON.stringify(mitQuery.json())).not.toContain('GEHEIM');
    expect(mitSlash.statusCode).toBe(200);
    expect(mitSlash.json()).toEqual({ version: AKTUELLE_VERSION });
  });

  it('gilt nur für den genauen GET', async () => {
    expect(istGesundheitsanfrage('GET', '/api/gesundheit')).toBe(true);
    expect(istGesundheitsanfrage('GET', '/api/gesundheit/')).toBe(true);
    expect(istGesundheitsanfrage('get', '/api/gesundheit?x=1')).toBe(true);
    expect(istGesundheitsanfrage('POST', '/api/gesundheit')).toBe(false);
    expect(istGesundheitsanfrage('GET', '/api/gesundheit/extra')).toBe(false);
    const app = await baueApp();
    apps.push(app);
    const post = await app.inject({ method: 'POST', url: '/api/gesundheit' });
    const extra = await app.inject({ method: 'GET', url: '/api/gesundheit/extra' });
    expect(post.statusCode).not.toBe(200);
    expect(extra.statusCode).not.toBe(200);
    expect(post.json()).not.toEqual({ version: AKTUELLE_VERSION });
    expect(extra.json()).not.toEqual({ version: AKTUELLE_VERSION });
  });
});
