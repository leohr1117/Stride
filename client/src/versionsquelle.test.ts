import { describe, expect, it } from 'vitest';
import { AKTUELLE_VERSION, VERSIONEN } from '../../shared/versionen.ts';
import { versionsAnzeige } from './versionsquelle.ts';

describe('versionsAnzeige', () => {
  it('bleibt ohne Testmarke bei der echten Fassung', () => {
    const anzeige = versionsAnzeige();
    expect(anzeige.version).toBe(AKTUELLE_VERSION);
    expect(anzeige.liste).toBe(VERSIONEN);
  });
});
