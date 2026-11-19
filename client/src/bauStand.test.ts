import { describe, expect, it } from 'vitest';
import { quellcodeAdresse } from './bauStand.ts';

describe('quellcodeAdresse', () => {
  it('hängt 40 Hex an den Baum und sonst nur die Repo-Wurzel', () => {
    const sha = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    expect(sha).toHaveLength(40);
    expect(quellcodeAdresse(sha)).toBe(`https://github.com/leohr1117/Stride/tree/${sha}`);
    expect(quellcodeAdresse('')).toBe('https://github.com/leohr1117/Stride');
    expect(quellcodeAdresse('abc123')).toBe('https://github.com/leohr1117/Stride');
  });
});
