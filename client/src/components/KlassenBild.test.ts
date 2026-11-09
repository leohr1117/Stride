import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KlassenBild } from './KlassenBild.tsx';

const ENTWURF_SHA256 = 'd864f6179839d59f6ab4111856326dc3c8d31294f3c3a7d9c12a3f94796aa5bf';

const KLASSEN = [
  'Athlet',
  'Weiser',
  'Krieger',
  'Gelehrter',
  'Diplomat',
  'Künstler',
  'Virtuose',
  'Abenteurer',
  'Druide',
  'Feldherr',
  'Neuling',
  'Allrounder',
] as const;

function markup(klasse: string, props: { groesse?: string; rahmen?: boolean; profil?: boolean } = {}): string {
  return renderToStaticMarkup(createElement(KlassenBild, { klasse, ...props }));
}

function pfade(html: string): string {
  return [...html.matchAll(/d="([^"]+)"/g)].map((treffer) => treffer[1] ?? '').join('|');
}

describe('KlassenBild', () => {
  it('gibt jeder Klasse ein eigenes Zeichen', () => {
    const zeichen = KLASSEN.map((klasse) => markup(klasse));
    const formen = zeichen.map(pfade);
    expect(formen.every((form) => form.length > 0)).toBe(true);
    expect(new Set(formen).size).toBe(KLASSEN.length);
    for (const html of zeichen) {
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('fill="currentColor"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('<path');
      expect(html).not.toContain('<circle');
    }
    expect(markup('Starker Athlet')).toBe(markup('Athlet'));
    expect(markup('Unbekannt')).toBe(markup('Neuling'));
  });

  it('lässt Rahmen, Profilfläche und Größe unverändert', () => {
    const normal = markup('Athlet');
    expect(normal).toContain('klassenbild');
    expect(normal).toContain('bg-akzent');
    expect(normal).toContain('text-akzent-text');
    expect(normal).toContain('size-8');
    expect(normal).toContain('rounded-full');
    expect(normal).not.toContain('profilbild');

    const profil = markup('Athlet', { profil: true });
    expect(profil).toContain('profilbild');
    expect(profil).toContain('bg-flaeche-2');
    expect(profil).toContain('text-haupt');
    expect(profil).toContain('size-[18px]');
    expect(profil).toContain('data-profilbild');
    expect(profil).not.toContain('bg-akzent');

    const frei = markup('Athlet', { rahmen: false, groesse: 'size-5' });
    expect(frei).toContain('text-akzent');
    expect(frei).toContain('size-5');
    expect(frei).not.toContain('bg-akzent');
    expect(frei).not.toContain('rounded-full');
    expect(frei).not.toContain('profilbild');
  });

  it('übernimmt die zwölf Entwurfspfade unverändert', () => {
    const pfadListe = KLASSEN.map((klasse) => {
      const html = markup(klasse);
      expect(html).toContain('fill-rule="evenodd"');
      const treffer = [...html.matchAll(/ d="([^"]+)"/g)];
      expect(treffer).toHaveLength(1);
      return treffer[0]?.[1] ?? '';
    });
    expect(createHash('sha256').update(pfadListe.join('\n')).digest('hex')).toBe(ENTWURF_SHA256);
  });
});
