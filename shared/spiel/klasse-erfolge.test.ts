import { describe, expect, it } from 'vitest';
import { erfolgName, erfolgSchluessel, ERFOLG_KENNZAHLEN, erreichteErfolge, type Kennzahlen } from './erfolge.ts';
import { laengsteKette } from './kette.ts';
import { bestimmeKlasse } from './klassen.ts';
import { LEVEL_KURVEN, xpBisLevel } from './level.ts';
import { aehnlichkeit, klasseAus, VORBILDER } from '../features/vorbilder/vorbilder.ts';
import { visionBeute } from './xp.ts';

function kennzahlen(werte: Partial<Kennzahlen>): Kennzahlen {
  const alle = {} as Kennzahlen;
  for (const kennzahl of ERFOLG_KENNZAHLEN) {
    alle[kennzahl] = werte[kennzahl] ?? 0;
  }
  return alle;
}

describe('bestimmeKlasse', () => {
  it('nimmt das stärkste Können als Archetyp und das zweite als Beiname', () => {
    expect(
      bestimmeKlasse([
        { kennung: 'disziplin', level: 80 },
        { kennung: 'intellekt', level: 50 },
        { kennung: 'koerper', level: 30 },
        { kennung: 'ressourcen', level: 200 },
      ]),
    ).toBe('Kluger Krieger');
    expect(
      bestimmeKlasse([
        { kennung: 'motorik', level: 700 },
        { kennung: 'mut', level: 680 },
        { kennung: 'geist', level: 100 },
      ]),
    ).toBe('Mutiger Virtuose');
  });

  it('ist am Anfang Neuling und bei ausgeglichenem Profil Allrounder', () => {
    expect(bestimmeKlasse([{ kennung: 'geist', level: 5 }, { kennung: 'koerper', level: 3 }])).toBe('Neuling');
    expect(
      bestimmeKlasse([
        { kennung: 'koerper', level: 40 },
        { kennung: 'geist', level: 38 },
        { kennung: 'disziplin', level: 40 },
        { kennung: 'intellekt', level: 35 },
        { kennung: 'soziales', level: 31 },
      ]),
    ).toBe('Allrounder');
  });
});

describe('Erfolge', () => {
  it('schaltet alle erreichten Stufen frei', () => {
    const erreicht = erreichteErfolge(kennzahlen({ streak: 42, eintraege: 1 }));
    expect(erreicht).toContain(erfolgSchluessel('streak', 7));
    expect(erreicht).toContain(erfolgSchluessel('streak', 30));
    expect(erreicht).not.toContain(erfolgSchluessel('streak', 100));
    expect(erreicht).toContain(erfolgSchluessel('eintraege', 1));
  });

  it('findet den Namen zum Schlüssel', () => {
    expect(erfolgName(erfolgSchluessel('bosse', 1))).toBe('Bossbezwinger');
    expect(erfolgName('gibt-es-nicht')).toBeNull();
  });
});

describe('laengsteKette', () => {
  it('findet die längste Kette mit einem erlaubten Pausentag', () => {
    expect(laengsteKette([])).toBe(0);
    expect(laengsteKette(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-10', '2026-10-11'])).toBe(3);
  });
});

describe('Vorbilder', () => {
  const musk = VORBILDER.find((vorbild) => vorbild.schluessel === 'musk');

  it('leiten die Klasse aus der Schätzung ab', () => {
    expect(musk && klasseAus(musk.schaetzung)).toBe('Disziplinierter Abenteurer');
    expect(musk && musk.level).toBeLessThan(10000);
  });

  it('vergleicht die Form und bleibt bei gleicher Form eins', () => {
    if (!musk) {
      return;
    }
    expect(aehnlichkeit(musk.profil, musk.profil, musk.unsicher)).toBe(1);
    const flach = { koerper: 5, geist: 5, disziplin: 5 };
    const wert = aehnlichkeit(flach, musk.profil);
    expect(wert).not.toBeNull();
    expect(wert ?? 0).toBeGreaterThan(0.4);
    expect(aehnlichkeit({ koerper: 3, geist: 3 }, musk.profil)).not.toBeNull();
    const { koerper, geist, disziplin, intellekt, kreativitaet } = musk.schaetzung;
    const verkleinert = {
      koerper: koerper / 10,
      geist: geist / 10,
      disziplin: disziplin / 10,
      intellekt: intellekt / 10,
      kreativitaet: kreativitaet / 10,
    };
    expect(aehnlichkeit(verkleinert, musk.schaetzung)).toBeCloseTo(1);
    expect(aehnlichkeit(musk.schaetzung, musk.schaetzung)).toBe(1);
  });
});

describe('visionBeute', () => {
  it('gibt zehn Prozent der XP bis zum Visions-Level', () => {
    expect(visionBeute(null)).toBe(0);
    expect(visionBeute(100)).toBe(Math.round(0.1 * xpBisLevel(100, LEVEL_KURVEN.charakter)));
    expect(visionBeute(1000)).toBeGreaterThan(100000);
  });
});
