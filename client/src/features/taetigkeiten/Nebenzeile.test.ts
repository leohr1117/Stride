import { describe, expect, it } from 'vitest';
import { waehleFassung } from './Nebenzeile.tsx';

describe('waehleFassung', () => {
  it('nimmt den vollen Text, wenn er in die Zeile passt', () => {
    expect(waehleFassung(['Stärkt: A · B', 'Stärkt: A · …', 'Stärkt: …'], () => true)).toBe('Stärkt: A · B');
  });

  it('nimmt die längste Fassung, die passt, und die endet mit …', () => {
    const fassungen = ['Stärkt: Alpha · Beta · Gamma', 'Stärkt: Alpha · Beta · …', 'Stärkt: Alpha · …', 'Stärkt: …'];
    const grenze = 'Stärkt: Alpha · Beta · …'.length;
    expect(waehleFassung(fassungen, (text) => text.length <= grenze)).toBe('Stärkt: Alpha · Beta · …');
  });

  it('kürzt auf Zeichen, wenn keine vorbereitete Fassung passt', () => {
    const voll = 'Stärkt: Langaname';
    const ergebnis = waehleFassung([voll], (text) => text.length <= 6);
    expect(ergebnis.endsWith('…')).toBe(true);
    expect(ergebnis.length).toBeLessThanOrEqual(6);
    expect(voll.startsWith(ergebnis.slice(0, -1))).toBe(true);
  });
});
