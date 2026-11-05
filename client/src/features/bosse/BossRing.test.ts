import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BOSS_RING_D, BossRing, bossListenEinzug, bossRingDurchmesser } from './BossRing.tsx';

describe('BossRing', () => {
  it('rechnet den Kreis aus der Zeilenhöhe auf eine gerade Zahl', () => {
    expect(bossRingDurchmesser(64)).toBe(36);
    expect(bossRingDurchmesser(72)).toBe(40);
    expect(BOSS_RING_D).toBe(36);
    expect(bossListenEinzug()).toBe('64px');
  });

  it('setzt nur D und überlässt Strich und Symbol dem Ring', () => {
    const html = renderToStaticMarkup(createElement(BossRing, { ring: 0.25, erwacht: true }));
    expect(html).toContain('data-boss-ring');
    expect(html).toContain('--ring-d:36px');
    expect(html).toContain('text-gefahr');
    expect(html).toContain('stroke-dashoffset="75"');
    expect(html).not.toContain('var(--haupt)');
    expect(html).not.toMatch(/<circle[^>]*stroke-width/);
    expect(html).not.toContain('size-5');
    expect(html).not.toContain('size-9');

    const css = readFileSync(join(import.meta.dirname, '../darstellung/styles.css'), 'utf8');
    const start = css.indexOf('.boss-ring {');
    const ende = css.indexOf('@media (prefers-reduced-motion', start);
    const block = css.slice(start, ende);
    expect(block).toContain('--ring-strich: calc(var(--ring-d) * 0.06)');
    expect(block).toContain('--ring-symbol: calc(var(--ring-d) * 0.5)');
    expect(block).toContain('r: calc((var(--ring-d) - var(--ring-strich)) / 2)');
    expect(block).not.toMatch(/\d+px/);
  });
});
