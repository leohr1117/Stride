import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Fortschrittsbalken } from './Anzeige.tsx';

describe('Fortschrittsbalken', () => {
  it('zeichnet Vergleich und Diagramm als stehende Füllung ohne Ansichtsklasse', () => {
    const leer = renderToStaticMarkup(
      createElement(Fortschrittsbalken, { anteil: 0, farbe: 'var(--akzent)', hoehe: 'h-1.5', bewegt: false }),
    );
    expect(leer).toBe('<div class="h-1.5 overflow-hidden rounded-full bg-flaeche-2"></div>');
    expect(leer).not.toContain('balken');

    const halb = renderToStaticMarkup(
      createElement(Fortschrittsbalken, { anteil: 0.5, farbe: 'var(--diagramm-vorbild)', hoehe: 'h-2', bewegt: false }),
    );
    expect(halb).toBe(
      '<div class="h-2 overflow-hidden rounded-full bg-flaeche-2"><div class="h-full rounded-full" style="width:50%;background-color:var(--diagramm-vorbild)"></div></div>',
    );
    expect(halb).not.toContain('balken-fuellung');

    const zuViel = renderToStaticMarkup(
      createElement(Fortschrittsbalken, { anteil: 4, farbe: 'var(--akzent)', bewegt: false }),
    );
    expect(zuViel).toContain('width:100%');
  });

  it('behält Verlauf und Verlust am bewegten Balken', () => {
    const html = renderToStaticMarkup(
      createElement(Fortschrittsbalken, { anteil: 0.4, verlustBis: 0.8, farbe: 'red', hoehe: 'h-1.5' }),
    );
    expect(html).toContain('class="balken relative w-full overflow-hidden rounded-full bg-flaeche-2 h-1.5"');
    expect(html).toContain('balken-verlust');
    expect(html).toContain('balken-fuellung');
    expect(html).toContain('width:80%');
    expect(html).toContain('width:40%');
  });
});
