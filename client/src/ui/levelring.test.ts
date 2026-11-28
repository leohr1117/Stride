import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LevelRing } from './Anzeige.tsx';

describe('LevelRing', () => {
  it('zeigt Farbverlauf entlang des Bogens und den weissen Lichtpunkt an der Spitze', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 3, anteil: 0.5 }));
    expect(html).toContain('data-levelbogen');
    expect(html).toMatch(/conic-gradient\(from 0deg, color-mix\(in srgb, var\(--haupt\) 67%, transparent\) 0deg, color-mix\(in srgb, var\(--fortschritt-balken\) 59%, var\(--haupt\)\) 180deg/);
    expect(html).toMatch(/data-ringlicht="" [^>]*r="1.25" fill="white" fill-opacity="0.75"/);
    expect(html).toContain('uppercase');
    expect(html).not.toContain('data-levelpille');
    expect(html).not.toContain('data-level-abstieg');
    expect(html).not.toContain('data-level-weg');
    expect(html).not.toContain('Zurück nach oben');
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

  it('legt die Pille auf die Profilkante und lässt den Block darunter weg', () => {
    const html = renderToStaticMarkup(createElement(LevelRing, {
      level: 127,
      anteil: 0.5,
      mitte: createElement('span', null, 'Bild'),
      beschriftung: 'Level 127, 10 von 100 XP',
    }));
    expect(html).toContain('data-levelpille=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Lvl ');
    expect(html).toContain('>127<');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('max-w-full');
    expect(html).toContain('border-grund');
    expect(html).toContain('bg-akzent');
    expect(html).toContain('text-akzent-text');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Level 127, 10 von 100 XP"');
    expect(html).toContain('data-levelbogen');
    expect(html).toContain('levelring-spitze-schein');
    expect(html).toContain('data-ringspitze=""');
    expect(html).toContain('data-ringlicht=""');
    expect(html).toContain('z-20');
    expect(html.indexOf('data-levelpille')).toBeLessThan(html.indexOf('data-ringspitze'));
    expect(html).not.toContain('uppercase');
    expect(html).toContain('h-20');
    expect(html).toContain('md:h-24');
    expect(html).not.toContain('width:');
    const ohneLicht = renderToStaticMarkup(createElement(LevelRing, {
      level: 1,
      anteil: 0,
      mitte: createElement('span', null, 'Bild'),
      beschriftung: 'Level 1, 0 von 100 XP',
    }));
    expect(ohneLicht).toContain('data-levelpille=""');
    expect(ohneLicht).not.toContain('data-ringspitze');
    expect(ohneLicht).not.toContain('uppercase');
  });

  it('wird mit dem Fortschritt kraeftiger', () => {
    const wenig = renderToStaticMarkup(createElement(LevelRing, { level: 1, anteil: 0.1 }));
    expect(wenig).toContain('var(--fortschritt-balken) 26%');
    expect(wenig).toMatch(/fill-opacity="0.59/);
  });
});
