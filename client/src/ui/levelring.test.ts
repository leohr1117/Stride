import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelRing } from './Anzeige.tsx';

describe('LevelRing', () => {
  it('zeichnet den Ring auf Heute mit 64 px und 6 px Strich in einer Farbe', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 58, anteil: 0.4 }));
    expect(html).toContain('width:64px');
    expect(html).toContain('height:64px');
    expect(html).toContain('stroke-width="9.375"');
    expect(html).toContain('stroke="var(--fortschritt)"');
    expect(html).toContain('stroke="var(--flaeche-2)"');
    expect(html).toContain('stroke-linecap="butt"');
    expect(html).toContain('text-[12px]');
    expect(html).toContain('text-[20px]');
    expect(html).toContain('font-semibold');
    expect(html).toContain('leading-[24px]');
    expect(html).toContain('>Level<');
    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('conic-gradient');
    expect(html).not.toContain('feGaussianBlur');
    expect(html).not.toContain('fill="white"');
    expect(html).not.toContain('filter=');
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
    expect(leer).not.toContain('stroke-dasharray');
    expect(leer).not.toContain('var(--fortschritt)');
    expect(leer).toContain('var(--flaeche-2)');
    expect(voll).toContain('stroke="var(--fortschritt)"');
    expect(voll).not.toContain('stroke-dasharray');
    expect(voll).not.toContain('rotate');
  });
});
