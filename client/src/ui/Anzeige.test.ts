import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Fortschrittsbalken } from './Anzeige.tsx';

const DARSTELLUNG = join(dirname(fileURLToPath(import.meta.url)), '../features/darstellung');

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
    expect(html).toContain('balken-verlauf');
    expect(html).toContain('balken-spitze');
    expect(html).toContain('--balken-farbe:red');
    expect(html).not.toContain('box-shadow');
    expect(html).not.toContain('background-image');
    expect(html).toContain('width:80%');
    expect(html).toContain('width:40%');
  });

  it('lässt bei 0 % Spitze und Verlauf weg', () => {
    const html = renderToStaticMarkup(createElement(Fortschrittsbalken, { anteil: 0, farbe: '#c62828' }));
    expect(html).toContain('data-leer');
    expect(html).toContain('balken-fuellung');
    expect(html).not.toContain('balken-spitze');
    expect(html).not.toContain('balken-verlauf');
    expect(html).not.toContain('box-shadow');
  });

  it('setzt den Abschluss nur über die eine Füllung, Hologramm bleibt der alte Verlauf', () => {
    const stil = readFileSync(join(DARSTELLUNG, 'styles.css'), 'utf8');
    expect(stil).toContain('calc(100% - 24px)');
    expect(stil).toContain('white 25%');
    expect(stil).toContain('white 40%');
    expect(stil).toContain('black 18%');
    expect(stil).toContain('0 0 6px');
    expect(stil).toContain('0 0 4px');
    expect(stil).toContain('forced-colors: active');
    const holo = readFileSync(join(DARSTELLUNG, 'stil-holo.css'), 'utf8');
    expect(holo).toContain('background-image: linear-gradient(90deg, transparent 40%, rgba(255, 255, 255, 0.35));');
    expect(holo).toContain('box-shadow: 0 0 10px var(--holo-leuchten);');
    expect(readFileSync(join(DARSTELLUNG, 'stil-jade.css'), 'utf8')).not.toContain('.balken-fuellung');
    expect(readFileSync(join(DARSTELLUNG, 'stil-antik.css'), 'utf8')).not.toContain('.balken-fuellung');
    expect(readFileSync(join(DARSTELLUNG, 'stil-minimal.css'), 'utf8')).not.toContain('.balken-fuellung');
  });
});
