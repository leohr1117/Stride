import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gelesenerStil, istStil, STANDARD_STIL, STILE, STIL_INFO } from './stile.ts';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('stile', () => {
  it('liest gespeichertes schlicht als Standard', () => {
    expect(STANDARD_STIL).toBe('standard');
    expect(STILE[0]).toBe('standard');
    expect(STILE).not.toContain('schlicht');
    expect(istStil('schlicht')).toBe(false);
    expect(istStil('standard')).toBe(true);
    expect(gelesenerStil('schlicht')).toBe('standard');
    expect(gelesenerStil('minimal')).toBe('minimal');
    expect(gelesenerStil('nein')).toBeUndefined();
    expect(STIL_INFO.standard.label).toBe('Standard');
  });

  it('gibt jeder Ansicht eine eigene Form und keine Bedeutungsfarbe', () => {
    const ordner = join(WURZEL, 'client/src/features/darstellung');
    const standard = readFileSync(join(ordner, 'stil-standard.css'), 'utf8');
    const minimal = readFileSync(join(ordner, 'stil-minimal.css'), 'utf8');
    const jade = readFileSync(join(ordner, 'stil-jade.css'), 'utf8');
    const holo = readFileSync(join(ordner, 'stil-holo.css'), 'utf8');
    const antik = readFileSync(join(ordner, 'stil-antik.css'), 'utf8');
    expect(standard).toContain("[data-stil='standard']");
    expect(standard).toContain('8px');
    expect(standard).toContain('backdrop-filter: none');
    expect(minimal).toContain("[data-stil='minimal']");
    expect(minimal).toContain('9999px');
    expect(minimal).toContain('1rem');
    expect(jade).toContain("[data-stil='jade'] .karte");
    expect(jade).toContain('14px');
    expect(holo).toContain("[data-stil='holo'] .karte");
    expect(holo).toContain('6px');
    expect(holo).toContain('Exo 2');
    expect(antik).toContain("[data-stil='antik'] .karte");
    expect(antik).toContain('2px');
    expect(antik).toContain('Cinzel');
    expect(antik).toContain("[data-kopf] .klassenbild");
    expect(antik).toContain('9999px');
    expect(antik).toContain('box-shadow: none');
    for (const quelle of [minimal, jade, holo, antik]) {
      expect(quelle).not.toMatch(/--(?:fortschritt|streak|erfolg|gefahr|fokus|schalter)/);
    }
  });
});
