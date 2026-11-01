import { describe, expect, it } from 'vitest';
import { ebenenFuerStufe } from './ebenen.ts';
import { funktionenFuerStufe, standardFunktionen } from './funktionen.ts';
import {
  empfehlungSchluessel,
  empfohleneFunktionen,
  investitionWegenRessourcen,
  naechsteEmpfehlung,
  startZielArt,
  willkommensZeilen,
  type PfadStand,
} from '../features/handbuch/handbuchPfad.ts';
import { FOKUS_IDS, type FokusId } from './profil.ts';

function stand(teil: Partial<PfadStand> = {}): PfadStand {
  const stufe = teil.stufe ?? 'traeumer';
  return {
    taetigkeiten: 0,
    visionen: 0,
    projekte: 0,
    vorhaben: 0,
    faehigkeiten: 0,
    eintraege: 0,
    stufe,
    funktionen: { ...standardFunktionen(), ...funktionenFuerStufe(stufe) },
    ebenen: ebenenFuerStufe(stufe),
    ...teil,
  };
}

describe('naechsteEmpfehlung', () => {
  it('führt ohne Tätigkeit zur Tätigkeit, sonst über das Ziel zum Eintrag', () => {
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand()))).toBe('start:ersteTaetigkeit');
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ taetigkeiten: 1 })))).toBe('start:ziel');
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ eintraege: 1 })))).toBe('start:ersteTaetigkeit');
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ taetigkeiten: 1, stufe: 'macher', projekte: 1 })))).toBe(
      'start:eintrag',
    );
    expect(
      empfehlungSchluessel(
        naechsteEmpfehlung(stand({ taetigkeiten: 1, stufe: 'bodenstaendig', visionen: 4, vorhaben: 1 })),
      ),
    ).toBe('start:ziel');
    expect(
      empfehlungSchluessel(
        naechsteEmpfehlung(
          stand({ taetigkeiten: 1, stufe: 'bodenstaendig', visionen: 4, projekte: 1, vorhaben: 1 }),
        ),
      ),
    ).toBe('start:eintrag');
    expect(naechsteEmpfehlung(stand({ taetigkeiten: 1, visionen: 1, eintraege: 1 }))).toBeNull();
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ visionen: 1, eintraege: 1 })))).toBe(
      'start:ersteTaetigkeit',
    );
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ taetigkeiten: 1, stufe: 'uebung' })))).toBe(
      'start:faehigkeit',
    );
    expect(
      empfehlungSchluessel(naechsteEmpfehlung(stand({ taetigkeiten: 1, stufe: 'uebung', faehigkeiten: 1 }))),
    ).toBe('start:eintrag');
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ taetigkeiten: 1, stufe: 'einfach' })))).toBe('start:eintrag');
    expect(empfehlungSchluessel(naechsteEmpfehlung(stand({ stufe: 'einfach' })))).toBe('start:ersteTaetigkeit');
  });

  it('nimmt die aktiven Ziel-Stufen, nicht die gespeicherte Stufe', () => {
    expect(
      empfehlungSchluessel(
        naechsteEmpfehlung(
          stand({
            taetigkeiten: 1,
            stufe: 'traeumer',
            ebenen: ebenenFuerStufe('bodenstaendig'),
          }),
        ),
      ),
    ).toBe('start:ziel');
    expect(
      empfehlungSchluessel(
        naechsteEmpfehlung(
          stand({
            taetigkeiten: 1,
            stufe: 'traeumer',
            ebenen: ebenenFuerStufe('einfach'),
          }),
        ),
      ),
    ).toBe('start:eintrag');
    expect(
      empfehlungSchluessel(
        naechsteEmpfehlung(
          stand({
            taetigkeiten: 1,
            stufe: 'einfach',
            ebenen: ebenenFuerStufe('macher'),
          }),
        ),
      ),
    ).toBe('start:ziel');
  });

  it('empfiehlt keine Funktion und keine Ebene, auch wenn fast alles aus ist', () => {
    expect(
      naechsteEmpfehlung(
        stand({
          taetigkeiten: 1,
          visionen: 1,
          eintraege: 1,
          ebenen: { visionen: true, organisationen: false, projekte: false, vorhaben: false },
        }),
      ),
    ).toBeNull();
  });
});

describe('willkommensZeilen', () => {
  it('zeigt das angelegte Ziel mit Haken und den Eintrag nur bei einer Tätigkeit', () => {
    expect(willkommensZeilen(stand({ taetigkeiten: 2, stufe: 'macher', projekte: 1 }))).toEqual([
      { schluessel: 'ziel', art: 'projekte', erledigt: true },
      { schluessel: 'eintrag', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ stufe: 'macher' }))).toEqual([
      { schluessel: 'ersteTaetigkeit', erledigt: false },
      { schluessel: 'ziel', art: 'projekte', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ taetigkeiten: 1, stufe: 'einfach' }))).toEqual([
      { schluessel: 'eintrag', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ stufe: 'traeumer' }))).toEqual([
      { schluessel: 'ersteTaetigkeit', erledigt: false },
      { schluessel: 'ziel', art: 'visionen', erledigt: false },
    ]);
    expect(willkommensZeilen(stand({ taetigkeiten: 1, stufe: 'uebung', faehigkeiten: 1, eintraege: 1 }))).toEqual([
      { schluessel: 'faehigkeit', erledigt: true },
      { schluessel: 'eintrag', erledigt: true },
    ]);
    expect(
      willkommensZeilen(
        stand({
          taetigkeiten: 1,
          ebenen: { visionen: false, organisationen: false, projekte: false, vorhaben: true },
          funktionen: { ...standardFunktionen(), ...funktionenFuerStufe('bodenstaendig') },
        }),
      ),
    ).toEqual([
      { schluessel: 'ziel', art: 'vorhaben', erledigt: false },
      { schluessel: 'eintrag', erledigt: false },
    ]);
  });
});

function funktionsIds(fokus: readonly FokusId[] = [], quellen: { ressourcen?: boolean } = {}) {
  return empfohleneFunktionen(fokus, quellen).map((eintrag) => eintrag.funktion);
}

describe('empfohleneFunktionen', () => {
  it('empfiehlt ohne Fokus nichts', () => {
    expect(funktionsIds([])).toEqual([]);
  });

  it('empfiehlt jedem Fokus eine passende Liste und nennt jede Funktion nur einmal', () => {
    expect(funktionsIds(['sport'])).toEqual(['faehigkeiten', 'basis', 'statistiken']);
    expect(funktionsIds(['gesundheit'])).toEqual(['basis']);
    expect(funktionsIds(['weisheit'])).toEqual(['rueckblick', 'chronik']);
    expect(funktionsIds(['lernen'])).toEqual(['faehigkeiten', 'rueckblick', 'bossAngriffe']);
    expect(funktionsIds(['erfolg'])).toEqual(['bossAngriffe', 'statistiken', 'vorbilder']);
    expect(funktionsIds(['soziales'])).toEqual(['faehigkeiten', 'chronik']);
    expect(funktionsIds(['geld'])).toEqual(['ausruestung', 'statistiken']);
    expect(funktionsIds(['kreativitaet'])).toEqual(['faehigkeiten']);
    expect(funktionsIds(['mut'])).toEqual(['vorbilder', 'chronik']);
    const lernen = empfohleneFunktionen(['lernen']);
    expect(lernen.find((eintrag) => eintrag.funktion === 'faehigkeiten')?.info).toBe(
      'Eintrag verbessert die Fähigkeit. Ein Vorhaben ist dafür nicht nötig.',
    );
    expect(funktionsIds(['sport', 'gesundheit'])).toEqual(['faehigkeiten', 'basis', 'statistiken']);
    expect(funktionsIds(['soziales', 'mut'])).toEqual(['faehigkeiten', 'chronik', 'vorbilder']);
    expect(funktionsIds(['geld', 'lernen', 'erfolg'])).toEqual([
      'faehigkeiten',
      'rueckblick',
      'bossAngriffe',
      'statistiken',
      'vorbilder',
      'ausruestung',
    ]);
    for (const id of FOKUS_IDS) {
      const liste = funktionsIds([id]);
      expect(liste.length).toBeGreaterThan(0);
      expect(new Set(liste).size).toBe(liste.length);
    }
    const alle = funktionsIds([...FOKUS_IDS]);
    expect(new Set(alle).size).toBe(alle.length);
    expect(alle).toEqual([
      'faehigkeiten',
      'basis',
      'statistiken',
      'rueckblick',
      'chronik',
      'bossAngriffe',
      'vorbilder',
      'ausruestung',
    ]);
  });

  it('nennt die entfernten Bereiche Aufgaben und Training nicht', () => {
    const texte = empfohleneFunktionen([...FOKUS_IDS], { ressourcen: true }).map((eintrag) => eintrag.info);
    expect(texte).toContain('Tägliche Aufgaben zum Abhaken.');
    const zusammen = texte.join('\n');
    expect(zusammen).not.toContain('Eigene Aufgaben');
    expect(zusammen).not.toContain('Eine Einheit ist ein Eintrag');
    expect(zusammen).not.toContain('Trainingsplan');
  });

  it('empfiehlt Investitionen, sobald Ressourcen an ist, und nennt sie nur einmal', () => {
    expect(investitionWegenRessourcen(false, [{ kennung: 'ressourcen', archiviert: false }])).toBe(false);
    expect(investitionWegenRessourcen(true, [{ kennung: 'ressourcen', archiviert: true }])).toBe(false);
    expect(investitionWegenRessourcen(true, [])).toBe(false);
    expect(investitionWegenRessourcen(true, [{ kennung: 'ressourcen', archiviert: false }])).toBe(true);
    expect(funktionsIds([], { ressourcen: true })).toEqual(['ausruestung']);
    expect(funktionsIds(['sport'], { ressourcen: true })).toEqual(['faehigkeiten', 'basis', 'statistiken', 'ausruestung']);
    expect(funktionsIds(['geld'], { ressourcen: true })).toEqual(['ausruestung', 'statistiken']);
    expect(funktionsIds([...FOKUS_IDS], { ressourcen: true })).toEqual(funktionsIds([...FOKUS_IDS]));
  });
});

describe('startZielArt', () => {
  it('folgt der höchsten aktiven Ziel-Stufe, sonst der Fähigkeit', () => {
    expect(startZielArt(ebenenFuerStufe('traeumer'), standardFunktionen())).toBe('visionen');
    expect(startZielArt(ebenenFuerStufe('macher'), standardFunktionen())).toBe('projekte');
    expect(startZielArt(ebenenFuerStufe('bodenstaendig'), standardFunktionen())).toBe('projekte');
    expect(startZielArt(ebenenFuerStufe('uebung'), { ...standardFunktionen(), faehigkeiten: true })).toBe('faehigkeit');
    expect(startZielArt(ebenenFuerStufe('einfach'), standardFunktionen())).toBeNull();
  });
});
