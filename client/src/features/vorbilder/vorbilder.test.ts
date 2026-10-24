import { describe, expect, it } from 'vitest';
import type { Attribut } from '../../../../shared/api/index.ts';
import { ATTRIBUT_KENNUNGEN, type AttributKennung, type AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import type { LevelInfo } from '../../../../shared/spiel/level.ts';
import { aehnlichkeit, findeVorbild, type KennungsLevel } from '../../../../shared/features/vorbilder/index.ts';
import { auswahlAus } from './vorbilderAuswahl.ts';
import { eigenesProfil } from '../../pages/eigenesProfil.ts';

function level(stufe: number): LevelInfo {
  return { level: stufe, xpGesamt: 0, xpImLevel: 0, xpFuerNaechstes: 1, fortschritt: 0 };
}

function attribut(teil: {
  id: number;
  kennung: AttributKennung | null;
  typ: AttributTyp;
  archiviert?: boolean;
  stufe?: number;
  name?: string;
}): Attribut {
  return {
    id: teil.id,
    typ: teil.typ,
    kennung: teil.kennung,
    name: teil.name ?? teil.kennung ?? 'frei',
    beschreibung: '',
    farbe: '#000000',
    icon: 'circle',
    archiviert: teil.archiviert ?? false,
    loeschbar: false,
    level: level(teil.stufe ?? 10),
    hoechstXp: 0,
    verfallBelastung: 'aus',
    verfallZeit: 'aus',
    erschoepfung: false,
    erschoepfungZiel: null,
    archivAnteil: null,
  };
}

describe('eigenesProfil', () => {
  it('lässt archivierte Attribute weg und behält beide aktiven Typen', () => {
    const profil = eigenesProfil([
      attribut({ id: 1, kennung: 'koerper', typ: 'attribut', stufe: 40, name: 'Körper' }),
      attribut({ id: 2, kennung: 'ressourcen', typ: 'status', archiviert: true, stufe: 7, name: 'Geld' }),
      attribut({ id: 3, kennung: 'ansehen', typ: 'status', stufe: 4, name: 'Ruf' }),
      attribut({ id: 4, kennung: null, typ: 'attribut', stufe: 99, name: 'ohne Kennung' }),
    ]);
    expect(profil.level.koerper).toBe(40);
    expect(profil.level.ressourcen).toBeUndefined();
    expect(profil.level.ansehen).toBe(4);
    expect(profil.kennungen).toEqual(['koerper', 'ansehen']);
  });

  it('bevorzugt das aktive Attribut und nimmt den Fortschritt mit', () => {
    const aktiv = attribut({ id: 2, kennung: 'geist', typ: 'attribut', archiviert: false, stufe: 22, name: 'neu' });
    aktiv.level = { ...aktiv.level, fortschritt: 0.25 };
    const profil = eigenesProfil([
      attribut({ id: 1, kennung: 'geist', typ: 'attribut', archiviert: true, stufe: 3, name: 'alt' }),
      aktiv,
    ]);
    expect(profil.level.geist).toBeCloseTo(22.25);
    expect(profil.namen.get('geist')).toBe('neu');
  });

  it('blendet einen ausgeschalteten Bereich aus', () => {
    const profil = eigenesProfil(
      [
        attribut({ id: 1, kennung: 'koerper', typ: 'attribut', stufe: 4 }),
        attribut({ id: 2, kennung: 'ressourcen', typ: 'status', stufe: 8 }),
      ],
      { koennen: true, status: false },
    );
    expect(profil.kennungen).toEqual(['koerper']);
    expect(profil.level.ressourcen).toBeUndefined();
  });

  it('ändert die Ähnlichkeit nicht durch archivierte Werte', () => {
    const ronaldo = findeVorbild('ronaldo');
    if (!ronaldo) {
      throw new Error('Ronaldo fehlt');
    }
    const sichtbar: AttributKennung[] = ['koerper', 'geist', 'disziplin', 'intellekt', 'soziales'];
    const attribute = ATTRIBUT_KENNUNGEN.map((kennung, index) => {
      const typ: AttributTyp = index < 10 ? 'attribut' : 'status';
      const offen = sichtbar.includes(kennung);
      return attribut({
        id: index + 1,
        kennung,
        typ,
        archiviert: !offen,
        stufe: offen ? ronaldo.profil[kennung] : 1,
      });
    });
    const profil = eigenesProfil(attribute);
    expect(profil.kennungen).toEqual(sichtbar);
    expect(aehnlichkeit(profil.level, ronaldo.profil, ronaldo.unsicher)).toBe(1);
    const mitArchiv: Partial<KennungsLevel> = { ...profil.level, ressourcen: 1 };
    expect(aehnlichkeit(mitArchiv, ronaldo.profil, ronaldo.unsicher) ?? 1).toBeLessThan(1);
  });
});

describe('Vorbild-Filter', () => {
  it('behält die Richtung, wenn die Adresse sie nicht nennt', () => {
    expect(auswahlAus(null, 'Wettkampf')).toBe('Wettkampf');
    expect(auswahlAus('Wissenschaft/Genies', null)).toBe('Wissenschaft/Genies');
    expect(auswahlAus('unbekannt', 'Wettkampf')).toBe('alle');
    expect(auswahlAus(null, null)).toBe('alle');
    expect(auswahlAus(null, 'erfunden')).toBe('alle');
  });
});
