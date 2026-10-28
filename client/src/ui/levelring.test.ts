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

  it('wird mit dem Fortschritt kraeftiger', () => {
    const wenig = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0.1 }));
    expect(wenig).toContain('var(--fortschritt) 26%');
    expect(wenig).toMatch(/fill-opacity="0.59/);
  });
});
