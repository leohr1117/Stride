import { expect, test } from './uhr.ts';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';

test('liefert den Manifest-Link mit der App-Version und die helle Browserleiste', async ({ request }) => {
  const antwort = await request.get('/');
  expect(antwort.ok()).toBe(true);
  const html = await antwort.text();
  expect(html).not.toContain('__STRIDE_VERSION__');
  const links = [...html.matchAll(/<link\b[^>]*\brel="manifest"[^>]*>/g)];
  expect(links).toHaveLength(1);
  expect(links[0]?.[0]).toContain(`href="/manifest.webmanifest?v=${AKTUELLE_VERSION}"`);
  expect(html).toContain('<meta name="theme-color" content="#f2f2f2" media="(prefers-color-scheme: light)" />');
});
