import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const manifestText = readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8');
const manifest = JSON.parse(manifestText) as { background_color: string; theme_color: string };

describe('feste Manifest-Farben', () => {
  it('setzt Dunkel auf #141414 und lässt Hell auf #f7f7f8', () => {
    expect(indexHtml).toContain('<meta name="theme-color" content="#141414" media="(prefers-color-scheme: dark)" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#f7f7f8" media="(prefers-color-scheme: light)" />');
    expect(indexHtml).not.toContain('#0e0e12');
    expect(manifest.background_color).toBe('#141414');
    expect(manifest.theme_color).toBe('#141414');
    expect(manifestText).not.toContain('#0e0e12');
  });
});
