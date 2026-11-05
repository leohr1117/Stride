import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Faehigkeit, SkillKnoten } from '../../../../shared/api/index.ts';
import { kontrast } from '../../../../shared/spiel/farben.ts';
import { SkillBaum } from './SkillBaum.tsx';
import { skillToene } from './skillToene.ts';

function knoten(teil: Pick<SkillKnoten, 'id' | 'elternId' | 'titel' | 'freigeschaltetAm' | 'xp'>): SkillKnoten {
  return { beschreibung: '', loeschbar: true, ...teil };
}

function faehigkeit(farbe: string, liste: SkillKnoten[]): Faehigkeit {
  return {
    id: 1,
    name: 'Kraft',
    beschreibung: '',
    farbe,
    icon: 'dumbbell',
    archiviert: false,
    loeschbar: true,
    level: { level: 4, xpGesamt: 400, xpImLevel: 40, xpFuerNaechstes: 100, fortschritt: 0.4 },
    stufe: 'Anfänger',
    anzahlEintraege: 3,
    knoten: liste,
  };
}

describe('Skilltöne', () => {
  it('dunkelt Kraft ab, bis Weiß auf der Füllung 4,5:1 hat', () => {
    const hell = skillToene('#f87171', '#ffffff');
    const dunkel = skillToene('#f87171', '#202020');
    expect(hell.tief).toBe('#ba5555');
    expect(hell.tiefer).toBe('#954444');
    expect(hell.text).toBe('#ba5555');
    expect(kontrast('#ffffff', hell.tief)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast('#ffffff', hell.tiefer)).toBeGreaterThanOrEqual(4.5);
    expect(dunkel.text).toBe('#f87171');
    expect(kontrast(dunkel.text, '#202020')).toBeGreaterThanOrEqual(4.5);
  });

  it('erreicht bei einer zweiten Farbe mindestens 4,5:1 für Weiß', () => {
    for (const farbe of ['#facc15', '#7dd3fc']) {
      const ton = skillToene(farbe, '#ffffff');
      expect(kontrast('#ffffff', ton.tief)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast('#ffffff', ton.tiefer)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(ton.text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Skillbaum Farben', () => {
  const baum = faehigkeit('#f87171', [
    knoten({ id: 1, elternId: null, titel: 'Offen', freigeschaltetAm: '2026-01-01', xp: 100 }),
    knoten({ id: 2, elternId: 1, titel: 'Bereit', freigeschaltetAm: null, xp: 150 }),
    knoten({ id: 3, elternId: 2, titel: 'Zu', freigeschaltetAm: null, xp: 225 }),
  ]);

  it('füllt freigeschaltete Knoten dunkel und zeigt einen weißen Haken', () => {
    const html = renderToStaticMarkup(createElement(SkillBaum, { faehigkeit: baum, onWaehlen: () => undefined }));
    expect(html).toContain('#f87171');
    expect(html).toContain('#ba5555');
    expect(html).toContain('#954444');
    expect(html).toContain('baum-frei');
    expect(html).toContain('baum-puls');
    expect(html).toContain('stroke="#f87171"');
    expect(html).toContain('stroke-dasharray="4 6"');
    const frei = html.slice(html.indexOf('data-zustand="frei"'), html.indexOf('data-zustand="verfuegbar"'));
    const bereit = html.slice(html.indexOf('data-zustand="verfuegbar"'), html.indexOf('data-zustand="gesperrt"'));
    const zu = html.slice(html.indexOf('data-zustand="gesperrt"'));
    expect(frei).toContain('data-haken');
    expect(frei).toContain('#ffffff');
    expect(frei).not.toContain('text-erfolg');
    expect(bereit).not.toContain('data-haken');
    expect(bereit).toContain('baum-puls');
    expect(zu).not.toContain('data-haken');
    expect(zu).toContain('border-dashed');
  });
});

describe('Fähigkeit mit Verlauf', () => {
  it('legt Schein und Verlauf auf die Karten', () => {
    const text = readFileSync(new URL('./Faehigkeit.tsx', import.meta.url), 'utf8').toLowerCase();
    expect(text).toContain('gradient');
    expect(text).toContain('blur');
    expect(text).toContain('glimm-fleck');
  });

  it('lässt ruhendes Glühen bei reduzierter Bewegung und nimmt es mit dem Schalter weg', () => {
    const css = readFileSync(new URL('../darstellung/styles.css', import.meta.url), 'utf8');
    expect(css).not.toContain(`@media (prefers-reduced-motion: reduce) {
  :root {
    --glimm: 0;
  }`);
    expect(css).toContain(`@media (prefers-reduced-motion: reduce) {
  .baum-puls,
  .skill-leuchten {
    animation: none;
  }`);
    expect(css).toContain(":root[data-glimmen='aus'] .baum-puls");
    expect(css).toContain(":root[data-glimmen='aus'] .skill-ring-punkt");
    expect(css).not.toContain(":root[data-glimmen='aus'] .glimm-fleck");
    expect(css).toContain('--ring-d: 76px');
    expect(css).toContain('calc(var(--ring-d) * 0.09)');
  });
});
