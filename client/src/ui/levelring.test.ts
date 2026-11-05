import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelRing } from './Anzeige.tsx';
import { RING_UMFANG, ringAbschluss } from './levelringAbschluss.ts';

function rundHalber(wert: number): number {
  return Math.round(wert * 2) / 2;
}

describe('LevelRing', () => {
  it('setzt am großen Ring nur den Durchmesser, die Innenmaße kommen aus dem Stylesheet', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 58, anteil: 0.4 }));
    expect(html).toContain('data-gross=""');
    expect(html).not.toContain('width:');
    expect(html).not.toContain('stroke-width');
    expect(html).not.toContain('text-[12px]');
    expect(html).not.toContain('text-[20px]');
    expect(html).not.toContain('font-size:');
    expect(html).toContain('levelring-label');
    expect(html).toContain('levelring-zahl');
    expect(html).toContain('stroke="var(--fortschritt)"');
    expect(html).toContain('stroke="var(--flaeche-2)"');
    expect(html).toContain('stroke="var(--balken-spitze)"');
    expect(html).toContain('var(--balken-verlauf-ton)');
    expect(html).toContain('levelring-bogen');
    expect(html).toContain('levelring-verlauf');
    expect(html).toContain('levelring-spitze');
    expect(html).toContain('stroke-linecap="butt"');
    expect(html).toContain('>Level<');
    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('conic-gradient');
    expect(html).not.toContain('feGaussianBlur');
    expect(html).not.toContain('fill="white"');
    expect(html).not.toContain('filter=');
    expect(html).not.toContain('levelring-spitze-schein');

    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../features/darstellung/styles.css'), 'utf8');
    expect(css).toMatch(/\.levelring\[data-gross\] \{\r?\n  --ring-d: 72px;/);
    expect(css).toContain('--ring-d: 72px');
    expect(css).toContain('calc(var(--ring-d) * 0.09)');
    expect(css).toContain('calc(var(--ring-d) * 0.27)');
    expect(css).toContain('calc(var(--ring-d) * 0.14)');
    expect(css).toContain('calc(var(--ring-d) * 0.02)');
    expect(css).toContain('max-width: 359px');
    for (const durchmesser of [72, 76, 88]) {
      expect(rundHalber(durchmesser * 0.09)).toBeCloseTo(durchmesser === 72 ? 6.5 : durchmesser === 76 ? 7 : 8, 5);
      expect(rundHalber(durchmesser * 0.27)).toBeCloseTo(durchmesser === 72 ? 19.5 : durchmesser === 76 ? 20.5 : 24, 5);
      expect(Math.max(10, rundHalber(durchmesser * 0.14))).toBeCloseTo(durchmesser === 72 ? 10 : durchmesser === 76 ? 10.5 : 12.5, 5);
    }
  });

  it('lässt die Schrift im grossen Ring und verkleinert sie im kleinen', () => {
    const gross = renderToStaticMarkup(createElement(LevelRing, { level: 12, anteil: 0.4, groesse: 104 }));
    expect(gross).toContain('text-[10px]');
    expect(gross).toContain('text-2xl');
    expect(gross).not.toContain('font-size:');
    const klein = renderToStaticMarkup(createElement(LevelRing, { level: 12, anteil: 0.4, groesse: 56 }));
    expect(klein).toContain('font-size:6px');
    expect(klein).toContain('font-size:14px');
  });

  it('verlängert den Strich mit dem Fortschritt und lässt 0 leer', () => {
    const laenge = (html: string) => Number(html.match(/stroke-dasharray="([0-9.]+) /)?.[1]);
    const wenig = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0.1 }));
    const viel = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0.8 }));
    const leer = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0 }));
    const voll = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 1 }));
    expect(laenge(wenig)).toBeLessThan(laenge(viel));
    expect(wenig).toContain('levelring-spitze');
    expect(wenig).not.toContain('levelring-verlauf');
    expect(viel).toContain('levelring-verlauf');
    expect(leer).not.toContain('stroke-dasharray');
    expect(leer).not.toContain('var(--fortschritt)');
    expect(leer).not.toContain('levelring-bogen');
    expect(leer).toContain('var(--flaeche-2)');
    expect(voll).toContain('stroke="var(--fortschritt)"');
    expect(voll).toContain('levelring-verlauf');
    expect(voll).not.toMatch(/levelring-strich[^>]*stroke-dasharray/);
    expect(voll).not.toMatch(/levelring-strich[^>]*transform/);
  });

  it('legt Verlauf und Spitze an das Ende und lässt kurze Bögen ohne Verlauf', () => {
    const mittel = ringAbschluss(0.5, 64);
    expect(mittel).not.toBeNull();
    if (!mittel || mittel.verlauf === null || mittel.versatzVerlauf === null) {
      throw new Error('Verlauf fehlt');
    }
    const ende = RING_UMFANG * 0.75 + mittel.bogen;
    expect(-mittel.versatzSpitze + mittel.spitze).toBeCloseTo(ende, 5);
    expect(-mittel.versatzVerlauf + mittel.verlauf).toBeCloseTo(ende, 5);
    expect((mittel.verlauf * 64) / 100).toBeCloseTo(24, 5);
    expect((mittel.spitze * 64) / 100).toBeCloseTo(2, 5);
    const kurz = ringAbschluss(0.1, 64);
    expect(kurz?.verlauf).toBeNull();
    expect(((kurz?.bogen ?? 0) * 64) / 100).toBeLessThan(24);
    expect(((kurz?.spitze ?? 0) * 64) / 100).toBeCloseTo(2, 5);
    const winzig = ringAbschluss(0.005, 64);
    expect(winzig?.spitze).toBeCloseTo(winzig?.bogen ?? -1, 5);
    expect(ringAbschluss(0, 64)).toBeNull();
    expect(ringAbschluss(1, 64)?.anteil).toBe(1);
  });
});
