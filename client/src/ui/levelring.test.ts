import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelRing } from './Anzeige.tsx';

describe('LevelRing', () => {
  it('zeigt Farbverlauf entlang des Bogens und den weissen Lichtpunkt an der Spitze', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 3, anteil: 0.5 }));
    expect(html).toContain('data-levelbogen');
    expect(html).toMatch(/conic-gradient\(from 0deg, color-mix\(in srgb, var\(--haupt\) 67%, transparent\) 0deg, color-mix\(in srgb, var\(--fortschritt\) 59%, var\(--haupt\)\) 180deg/);
    expect(html).toMatch(/data-ringlicht="" [^>]*r="1.25" fill="white" fill-opacity="0.75"/);
  });

  it('verkleinert die Schrift im kleinen Ring', () => {
    const klein = renderToStaticMarkup(createElement(LevelRing, { level: 12, anteil: 0.4, groesse: 56 }));
    expect(klein).toContain('width:56px');
    expect(klein).toContain('font-size:6px');
    expect(klein).toContain('font-size:14px');
    expect(klein).toContain('stroke-width="8"');
  });

  it('groesser als 96 skaliert mit', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 12, anteil: 0.4, groesse: 104 }));
    expect(html).toContain('width:104px');
    expect(html).toContain('height:104px');
    expect(html).toContain('font-size:11px');
    expect(html).toContain('font-size:26px');
    expect(html).toContain('stroke-width="8"');
    expect(html).toContain('r="4.05"');
    expect(html).toContain('r="1.25"');
    const weiter = renderToStaticMarkup(createElement(LevelRing, { level: 12, anteil: 0.4, groesse: 120 }));
    expect(weiter).toContain('width:120px');
    expect(weiter).toContain('font-size:13px');
    expect(weiter).toContain('font-size:30px');
  });

  it('wird mit dem Fortschritt kraeftiger', () => {
    const wenig = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0.1 }));
    expect(wenig).toContain('var(--fortschritt) 26%');
    expect(wenig).toMatch(/fill-opacity="0.59/);
  });
});
