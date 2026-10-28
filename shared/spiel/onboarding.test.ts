import { describe, expect, it } from 'vitest';
import { FOKUS_IDS, type FokusId } from './profil.ts';
import { START_BOSS_NAME, START_PROJEKT, startBossSichtbar, vorbildVorschlag } from './onboarding.ts';

const ERWARTET: Record<FokusId, { summe: number; schluessel: string; name: string; bekanntFuer: string }> = {
  sport: { summe: 30, schluessel: 'kipchoge', name: 'Eliud Kipchoge', bekanntFuer: 'Marathon' },
  gesundheit: { summe: 30, schluessel: 'djokovic', name: 'Novak Djokovic', bekanntFuer: 'Tennis' },
  weisheit: { summe: 30, schluessel: 'hawking', name: 'Stephen Hawking', bekanntFuer: 'Physik' },
  lernen: { summe: 30, schluessel: 'su', name: 'Lisa Su', bekanntFuer: 'Halbleiter' },
  erfolg: { summe: 30, schluessel: 'buffett', name: 'Warren Buffett', bekanntFuer: 'Investieren' },
  soziales: { summe: 29, schluessel: 'obama', name: 'Barack Obama', bekanntFuer: 'Politik' },
  geld: { summe: 30, schluessel: 'buffett', name: 'Warren Buffett', bekanntFuer: 'Investieren' },
  kreativitaet: { summe: 28, schluessel: 'lee', name: 'Bruce Lee', bekanntFuer: 'Kampfkunst' },
  mut: { summe: 30, schluessel: 'gandhi', name: 'Mahatma Gandhi', bekanntFuer: 'Unabhängigkeit' },
};

describe('onboarding vorschlag', () => {
  it('wählt je Fokus das stärkste Vorbild, bei Gleichstand das frühere', () => {
    for (const fokus of FOKUS_IDS) {
      expect(vorbildVorschlag(fokus)).toEqual(ERWARTET[fokus]);
    }
  });

  it('zeigt den Boss nur, wenn die Stufe Projekte und Vorhaben hat', () => {
    expect(startBossSichtbar('traeumer')).toBe(true);
    expect(startBossSichtbar('macher')).toBe(true);
    expect(startBossSichtbar('bodenstaendig')).toBe(true);
    expect(startBossSichtbar('uebung')).toBe(false);
    expect(startBossSichtbar('einfach')).toBe(false);
  });

  it('nennt Projekt und Bosse fest', () => {
    expect(START_PROJEKT).toBe('Anfang');
    expect(START_BOSS_NAME.sport).toBe('Lauf beginnen');
    expect(START_BOSS_NAME.lernen).toBe('Lernen anfangen');
    expect(Object.keys(START_BOSS_NAME)).toEqual([...FOKUS_IDS]);
  });
});
