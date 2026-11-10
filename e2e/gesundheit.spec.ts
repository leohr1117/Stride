import { expect, test } from './uhr.ts';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';

test('Gesundheit nennt ohne Anmeldung nur die Version', async ({ request }) => {
  const antwort = await request.get('/api/gesundheit');
  expect(antwort.status()).toBe(200);
  expect(await antwort.json()).toEqual({ version: AKTUELLE_VERSION });
});
