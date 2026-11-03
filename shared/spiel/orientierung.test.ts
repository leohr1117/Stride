import { describe, expect, it } from 'vitest';
import { LEVEL_MARKEN, LEVEL_SCHAETZUNG, VISION_BEISPIELE, VISION_STUFEN } from './orientierung.ts';

describe('Stufen zum Schätzen', () => {
  it('nimmt drei Vision-Beispiele und drei Level-Marken', () => {
    expect(VISION_STUFEN.map((beispiel) => beispiel.level)).toEqual([300, 2000, 20000]);
    for (const stufe of VISION_STUFEN) {
      expect(VISION_BEISPIELE).toContainEqual(stufe);
    }
    expect([...LEVEL_SCHAETZUNG]).toEqual([10, 100, 1000]);
    for (const level of LEVEL_SCHAETZUNG) {
      expect(LEVEL_MARKEN).toContain(level);
    }
  });
});
