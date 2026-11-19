import { expect, test } from '@playwright/test';
import { GEERBTE_ZUGANGS_NAMEN, leereGeerbteZugangsVariablen } from '../server/testpfad.ts';
import { TEST_GOOGLE_CLIENT_ID, TEST_GOOGLE_CLIENT_SECRET } from './testdaten.ts';

const ZUSATZ = ['STRIDE_SMTP_ZUSATZ', 'STRIDE_GOOGLE_ZUSATZ'] as const;

test('leert geerbte Schalter im Testprozess und der Server nutzt nur Testdaten', async ({ request }) => {
  const falsche = [...GEERBTE_ZUGANGS_NAMEN, ...ZUSATZ];
  for (const name of falsche) {
    process.env[name] = 'nicht-verwenden';
  }
  try {
    const geleert = leereGeerbteZugangsVariablen();
    for (const name of falsche) {
      expect(geleert).toContain(name);
      expect(process.env[name]).toBeUndefined();
    }
  } finally {
    leereGeerbteZugangsVariablen();
  }

  const start = await request.get('/api/zugang/google/start?zweck=anmelden', { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const ort = start.headers().location ?? '';
  expect(ort.startsWith('https://accounts.google.com/')).toBe(true);
  expect(new URL(ort).searchParams.get('client_id')).toBe(TEST_GOOGLE_CLIENT_ID);
  expect(ort.includes(TEST_GOOGLE_CLIENT_SECRET)).toBe(false);

  const status = await request.get('/api/zugang');
  expect(status.ok()).toBe(true);
  expect(await status.json()).toMatchObject({ modus: 'anmelden', registrierung: true, google: true });
  expect(process.env.STRIDE_SMTP_HOST).toBeUndefined();
  expect(process.env.STRIDE_SMTP_PASSWORT).toBeUndefined();
  expect(process.env.STRIDE_GOOGLE).toBeUndefined();
  expect(process.env.STRIDE_GOOGLE_CLIENT_ID).toBeUndefined();
  expect(process.env.STRIDE_GOOGLE_CLIENT_SECRET).toBeUndefined();
  expect(process.env.STRIDE_REGISTRIERUNG).toBeUndefined();
});
