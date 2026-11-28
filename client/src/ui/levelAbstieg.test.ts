import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelStufe } from './levelAbstieg.tsx';

describe('LevelStufe', () => {
  it('bleibt im Ruhestand ohne Weg und ohne Abstiegsmarke', () => {
    const html = renderToStaticMarkup(
      createElement(LevelStufe, { level: 3, className: 'text-leise', children: 'Lvl 3' }),
    );
    expect(html).toContain('text-leise');
    expect(html).toContain('Lvl 3');
    expect(html).not.toContain('data-level-abstieg');
    expect(html).not.toContain('data-level-weg');
    expect(html).not.toContain('Zurück nach oben');
    expect(html).not.toContain('level-zurueck');
  });
});
