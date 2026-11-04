import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AbhakKreis } from './AbhakKreis.tsx';

describe('AbhakKreis', () => {
  it('ist offen leer und erledigt gefüllt mit Haken', () => {
    const offen = renderToStaticMarkup(
      createElement(AbhakKreis, { name: 'Dehnen', erledigt: false, laeuft: false, onUmschalten: () => undefined }),
    );
    expect(offen).toContain('role="checkbox"');
    expect(offen).toContain('aria-checked="false"');
    expect(offen).toContain('aria-label="Dehnen abhaken"');
    expect(offen).toContain('data-abhak="offen"');
    expect(offen).not.toContain('<svg');

    const fertig = renderToStaticMarkup(
      createElement(AbhakKreis, { name: 'Dehnen', erledigt: true, laeuft: false, onUmschalten: () => undefined }),
    );
    expect(fertig).toContain('aria-checked="true"');
    expect(fertig).toContain('data-abhak="erledigt"');
    expect(fertig).toContain('bg-erfolg');
    expect(fertig).toContain('<svg');
  });
});
