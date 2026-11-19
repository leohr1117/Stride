import { expect, test } from './uhr.ts';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

const PAKETE = [
  'react',
  'lucide-react',
  '@fontsource/cinzel',
  '@fontsource/barlow-semi-condensed',
  '@fontsource-variable/exo-2',
  'Roboto',
  'nodemailer',
];

test('Lizenzhinweise verlinken den Quellstand und die Liste', async ({ page }) => {
  await page.goto('/lizenzhinweise');
  await expect(page.getByRole('heading', { level: 1, name: 'Lizenzhinweise' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Liste der Open-Source-Komponenten' })).toHaveAttribute('href', '/lizenzen.txt');
  const quelle = page.getByRole('link', { name: 'Quellcode dieser Version' });
  await expect(quelle).toHaveAttribute('href', /^https:\/\/github\.com\/leohr1117\/Stride\/tree\/[0-9a-f]{40}$/);
  const href = await quelle.getAttribute('href');
  const sha = href?.split('/').pop() ?? '';
  expect(sha).toMatch(/^[0-9a-f]{40}$/);

  const antwort = await page.request.get('/lizenzen.txt');
  expect(antwort.ok()).toBe(true);
  expect(antwort.headers()['content-type'] ?? '').not.toContain('text/html');
  const text = await antwort.text();
  expect(text.trimStart().startsWith('<')).toBe(false);
  for (const name of PAKETE) {
    expect(text).toContain(name);
  }
  expect(text).toContain('Permission is hereby granted');
  expect(text).not.toContain('vitest');
  expect(text).not.toContain('playwright');
  expect(text).not.toContain('typescript');
  expect(text.startsWith(`Open-Source-Komponenten von Stride\nCommit: ${sha}\n`)).toBe(true);
  await ohneSeitlichenUeberlauf(page);
});
