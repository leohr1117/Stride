import { describe, expect, it } from 'vitest';
import { FUNKTIONEN } from '../../../../shared/spiel/funktionen.ts';

describe('satzAnzeige', () => {
  it('gehört nicht mehr zur App', () => {
    expect(FUNKTIONEN).not.toContain('training');
  });
});
