import { describe, expect, it } from 'vitest';
import { FUNKTIONEN } from '../../../../shared/spiel/funktionen.ts';

describe('Aufgaben-Client', () => {
  it('führt die Funktion nicht mehr', () => {
    expect(FUNKTIONEN).not.toContain('aufgaben');
  });
});
