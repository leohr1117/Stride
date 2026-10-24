import { describe, expect, it } from 'vitest';
import { KLASSE, klassenZeichen } from './klassen.ts';

describe('klassenZeichen', () => {
  it('ordnet Neuling, Allrounder und das stärkste Können zu', () => {
    expect(klassenZeichen(KLASSE.startKlasse)).toBe('neuling');
    expect(klassenZeichen(KLASSE.ausgeglichen)).toBe('allrounder');
    expect(klassenZeichen('Kreativer Gelehrter')).toBe('intellekt');
    expect(klassenZeichen('Starker Athlet')).toBe('koerper');
    expect(klassenZeichen('Mutiger Abenteurer')).toBe('mut');
    expect(klassenZeichen('Führender Feldherr')).toBe('fuehrung');
    expect(klassenZeichen('Vitaler Druide')).toBe('vitalitaet');
    expect(klassenZeichen('Geschickter Virtuose')).toBe('motorik');
    expect(klassenZeichen('Charismatischer Diplomat')).toBe('soziales');
    expect(klassenZeichen('Disziplinierter Krieger')).toBe('disziplin');
    expect(klassenZeichen('Besonnener Weiser')).toBe('geist');
    expect(klassenZeichen('Künstler')).toBe('kreativitaet');
  });

  it('fällt bei einer unbekannten Klasse auf Neuling zurück', () => {
    expect(klassenZeichen('')).toBe('neuling');
    expect(klassenZeichen('Unbekannt')).toBe('neuling');
  });
});
