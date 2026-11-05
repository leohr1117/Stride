import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Faehigkeit, SkillKnoten } from '../../../../shared/api/index.ts';
import { kontrast } from '../../../../shared/spiel/farben.ts';
import { SkillBaum } from './SkillBaum.tsx';
import { symbolFarbe } from './symbolFarbe.ts';

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

describe('Symbolfarbe', () => {
  it('hebt eine zu blasse Attributfarbe auf mindestens 3:1', () => {
    const hell = symbolFarbe('#f87171', '#ffffff');
    const dunkel = symbolFarbe('#f87171', '#202020');
    expect(hell).not.toBe('#f87171');
    expect(kontrast(hell, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(kontrast(dunkel, '#202020')).toBeGreaterThanOrEqual(3);
    expect(symbolFarbe('#141414', '#ffffff')).toBe('#141414');
  });
});

describe('Skillbaum Farben', () => {
  const baum = faehigkeit('#f87171', [
    knoten({ id: 1, elternId: null, titel: 'Offen', freigeschaltetAm: '2026-01-01', xp: 100 }),
    knoten({ id: 2, elternId: 1, titel: 'Bereit', freigeschaltetAm: null, xp: 150 }),
    knoten({ id: 3, elternId: 2, titel: 'Zu', freigeschaltetAm: null, xp: 225 }),
  ]);

  it('zeigt den Haken nur bei freigeschalteten Knoten und keinen Verlauf', () => {
    const html = renderToStaticMarkup(createElement(SkillBaum, { faehigkeit: baum, onWaehlen: () => undefined }));
    expect(html).not.toContain('gradient');
    expect(html).not.toContain('blur');
    expect(html).not.toContain('#f87171');
    expect(html).toContain('stroke="var(--fortschritt)"');
    expect(html).toContain('stroke="var(--feldrand)"');
    expect(html).toContain('border-color:var(--feldrand)');
    const frei = html.slice(html.indexOf('data-zustand="frei"'), html.indexOf('data-zustand="verfuegbar"'));
    const bereit = html.slice(html.indexOf('data-zustand="verfuegbar"'), html.indexOf('data-zustand="gesperrt"'));
    const zu = html.slice(html.indexOf('data-zustand="gesperrt"'));
    expect(frei).toContain('data-haken');
    expect(frei).toContain('border-solid');
    expect(bereit).not.toContain('data-haken');
    expect(bereit).toContain('border-solid');
    expect(zu).not.toContain('data-haken');
    expect(zu).toContain('border-dashed');
    expect(html).toContain('stroke-dasharray="4 6"');
  });
});

describe('Fähigkeit ohne Verlauf', () => {
  it('enthält weder gradient noch blur', () => {
    const text = readFileSync(new URL('./Faehigkeit.tsx', import.meta.url), 'utf8').toLowerCase();
    expect(text).not.toContain('gradient');
    expect(text).not.toContain('blur');
  });
});
