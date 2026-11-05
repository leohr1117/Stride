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
    expect(bossListenEinzug()).toBe('68px');
  });

  it('setzt nur D und überlässt Strich und Symbol dem Ring', () => {
    const offen = renderToStaticMarkup(createElement(BossRing, { ring: 0.25, erwacht: false }));
    expect(offen).toContain('data-boss-ring');
    expect(offen).toContain('--ring-d:36px');
    expect(offen).toContain('stroke-dashoffset="75"');
    expect(offen).toContain('boss-ring-spur');
    expect(offen).not.toContain('boss-symbol');
    expect(offen).not.toContain('var(--haupt)');
    expect(offen).not.toMatch(/<circle[^>]*stroke-width/);
    expect(offen).not.toContain('size-5');
    expect(offen).not.toContain('size-9');

    const voll = renderToStaticMarkup(createElement(BossRing, { ring: 1, erwacht: false }));
    expect(voll).not.toContain('stroke-dasharray');
    expect(voll).not.toContain('stroke-dashoffset');
    expect(voll).not.toContain('boss-ring-spur');
    expect(voll).toContain('boss-ring-voll');

    const erwacht = renderToStaticMarkup(createElement(BossRing, { ring: 0.4, erwacht: true }));
    expect(erwacht).not.toContain('stroke-dasharray');
    expect(erwacht).not.toContain('boss-ring-spur');
    expect(erwacht).toContain('boss-symbol');
    expect(erwacht).toContain('text-gefahr');
    expect(erwacht).toContain('boss-platz');

    const css = readFileSync(join(import.meta.dirname, '../darstellung/styles.css'), 'utf8');
    const platzStart = css.indexOf('.boss-platz {');
    const start = css.indexOf('.boss-ring {');
    const ende = css.indexOf('@media (prefers-reduced-motion', start);
    const platz = css.slice(platzStart, start);
    const block = css.slice(start, ende);
    expect(platz).toContain('width: 40px');
    expect(platz).toContain('height: 40px');
    expect(block).toContain('--ring-strich: calc(var(--ring-d) * 0.06)');
    expect(block).toContain('--ring-symbol: calc(var(--ring-d) * 0.5)');
    expect(block).toContain('r: calc((var(--ring-d) - var(--ring-strich)) / 2)');
    expect(block).toContain('display: grid');
    expect(block).toContain('grid-area: 1 / 1');
    expect(block).toContain('translateY(calc(var(--ring-d) * 0.012))');
    expect(block).toContain('stroke-linecap: butt');
    expect(block).not.toContain('position: absolute');
    expect(block).not.toMatch(/\d+px/);

    const standard = readFileSync(join(import.meta.dirname, '../darstellung/stil-standard.css'), 'utf8');
    expect(standard).toContain('svg.lucide:not(.boss-symbol)');
  });
});
