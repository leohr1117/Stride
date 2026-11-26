import { describe, expect, it } from 'vitest';
import {
  effektDarfFedern,
  effektStufe,
  groessterEffekt,
  groesstesFeierZiel,
  wirksameEffektStufe,
} from './effekte.ts';

describe('effekte', () => {
  it('nimmt nur voll, reduziert und aus, sonst voll', () => {
    expect(effektStufe('voll')).toBe('voll');
    expect(effektStufe('reduziert')).toBe('reduziert');
    expect(effektStufe('aus')).toBe('aus');
    expect(effektStufe(undefined)).toBe('voll');
    expect(effektStufe('foo')).toBe('voll');
    expect(effektStufe(true)).toBe('voll');
  });

  it('lässt aus aus und zieht voll bei reduzierter Bewegung auf reduziert', () => {
    expect(wirksameEffektStufe('aus', true)).toBe('aus');
    expect(wirksameEffektStufe('aus', false)).toBe('aus');
    expect(wirksameEffektStufe('voll', true)).toBe('reduziert');
    expect(wirksameEffektStufe('voll', false)).toBe('voll');
    expect(wirksameEffektStufe('reduziert', false)).toBe('reduziert');
    expect(wirksameEffektStufe('reduziert', true)).toBe('reduziert');
  });

  it('federt nur bei voll', () => {
    expect(effektDarfFedern('voll')).toBe(true);
    expect(effektDarfFedern('reduziert')).toBe(false);
    expect(effektDarfFedern('aus')).toBe(false);
  });

  it('behält bei mehreren Effekten nur den größten und bei Gleichstand den ersten', () => {
    const klein = { groesse: 'klein' as const, name: 'xp' };
    const mittel = { groesse: 'mittel' as const, name: 'meilenstein' };
    const gross = { groesse: 'gross' as const, name: 'level' };
    const nochmalGross = { groesse: 'gross' as const, name: 'zweiter' };
    expect(groessterEffekt([])).toBeNull();
    expect(groessterEffekt([klein])).toBe(klein);
    expect(groessterEffekt([klein, mittel, gross])).toBe(gross);
    expect(groessterEffekt([gross, nochmalGross])).toBe(gross);
    expect(groesstesFeierZiel(['klein', 'mittel'], false)).toBe('meldung');
    expect(groesstesFeierZiel(['mittel'], true)).toBe('aufstieg');
    expect(groesstesFeierZiel([], false)).toBeNull();
  });
});
