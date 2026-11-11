import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AehnlichkeitVorsatz, SchaetzungMarke, UnsicherWert, aehnlichkeitName, vorbildLevelSichtbar } from './vorbildTeile.tsx';

describe('Schätzung an Vorbild-Werten', () => {
  it('zeigt die Marke ohne Füllung, Fokus und Bild', () => {
    const html = renderToStaticMarkup(createElement(SchaetzungMarke));
    expect(html).toContain('Schätzung');
    expect(html).toContain('data-schaetzung');
    expect(html).toContain('border');
    expect(html).toContain('border-rand');
    expect(html).toContain('rounded-full');
    expect(html).toContain('px-2');
    expect(html).toContain('text-[12px]');
    expect(html).toContain('leading-4');
    expect(html).toContain('text-leise');
    expect(html).not.toContain('bg-');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<img');
  });

  it('setzt ≈ stumm vor die Ähnlichkeit und nennt sie dem Screenreader', () => {
    const html = renderToStaticMarkup(createElement(AehnlichkeitVorsatz, { wert: '82 %' }));
    expect(html).toContain('aria-hidden="true">≈ </span>');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('etwa 82 %, geschätzt');
    expect(aehnlichkeitName('Alle', '82 %')).toBe('Alle etwa 82 %, geschätzt');
    expect(html).not.toContain('°');
  });

  it('setzt auf Wunsch nur das Zeichen, ohne Screenreader-Text', () => {
    const html = renderToStaticMarkup(createElement(AehnlichkeitVorsatz, { wert: '82 %', stumm: true }));
    expect(html).toBe('<span aria-hidden="true">≈ </span>');
  });

  it('setzt ~ stumm an unsichere Werte und sagt unsicher', () => {
    const level = renderToStaticMarkup(
      createElement(UnsicherWert, { sichtbar: vorbildLevelSichtbar('42', true), wert: vorbildLevelSichtbar('42', false) }),
    );
    const anteil = renderToStaticMarkup(createElement(UnsicherWert, { sichtbar: '~78 %', wert: '78 %' }));
    expect(vorbildLevelSichtbar('42', true)).toBe('Lvl ~42');
    expect(vorbildLevelSichtbar('42', false)).toBe('Lvl 42');
    expect(level).toContain('aria-hidden="true"');
    expect(level).toContain('Lvl ~42');
    expect(level).toContain('Lvl 42, unsicher');
    expect(level).toContain('text-leise');
    expect(anteil).toContain('~78 %');
    expect(anteil).toContain('78 %, unsicher');
    expect(level).not.toContain('°');
    expect(anteil).not.toContain('°');
  });

  it('gibt Liste und Profil kein Personenbild', () => {
    const wurzel = join(import.meta.dirname, '../../../..');
    const dateien = [
      'client/src/features/vorbilder/Vorbilder.tsx',
      'client/src/features/vorbilder/VorbildProfil.tsx',
      'client/src/features/vorbilder/vorbildTeile.tsx',
      'client/src/components/ProfilRadar.tsx',
    ];
    for (const datei of dateien) {
      expect(readFileSync(join(wurzel, datei), 'utf8'), datei).not.toContain('<img');
    }
  });
});
