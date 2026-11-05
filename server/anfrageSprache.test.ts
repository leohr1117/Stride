import { describe, expect, it } from 'vitest';
import { aktiviereAnfrageSprache, anfrageSprache, mitAnfrageSprache } from './anfrageSprache.ts';

describe('anfrageSprache', () => {
  it('gilt nur innerhalb der Anfrage', () => {
    expect(anfrageSprache()).toBe('en');
    mitAnfrageSprache('it-IT, en;q=0.8', () => {
      expect(anfrageSprache()).toBe('en');
    });
    mitAnfrageSprache('pl', () => {
      expect(anfrageSprache()).toBe('en');
    });
    mitAnfrageSprache('fr-CH, en;q=0.8', () => {
      expect(anfrageSprache()).toBe('fr');
    });
    mitAnfrageSprache('zh-CN', () => {
      expect(anfrageSprache()).toBe('zh');
    });
    mitAnfrageSprache(['de-DE'], () => {
      expect(anfrageSprache()).toBe('de');
    });
    expect(anfrageSprache()).toBe('en');
    aktiviereAnfrageSprache('es-ES, en;q=0.5');
    expect(anfrageSprache()).toBe('es');
    aktiviereAnfrageSprache(undefined);
    expect(anfrageSprache()).toBe('en');
  });
});
