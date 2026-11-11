import { describe, expect, it } from 'vitest';
import { standardEbenen, type Ebenen } from './ebenen.ts';
import { ERFOLG_KENNZAHLEN } from './erfolge.ts';
import { standardFunktionen, type Funktionen } from './funktionen.ts';
import { erfolgSichtbar, istAn, laufendAktiv, pfadAktiv, zieleAktiv, type Sichtbarkeit } from './sichtbarkeit.ts';

function sicht(funktionen: Partial<Funktionen> = {}, ebenen: Partial<Ebenen> = {}): Sichtbarkeit {
  return {
    funktionen: { ...standardFunktionen(), ...funktionen },
    ebenen: { ...standardEbenen(), ...ebenen },
  };
}

describe('zieleAktiv und laufendAktiv', () => {
  it('zählt Ziele nur bei Vision, Projekt oder Vorhaben', () => {
    expect(zieleAktiv(sicht())).toBe(true);
    expect(zieleAktiv(sicht({}, { visionen: false, projekte: false, vorhaben: true }))).toBe(true);
    expect(zieleAktiv(sicht({}, { visionen: false, organisationen: true, projekte: false, vorhaben: false }))).toBe(false);
  });

  it('hängt Laufend nur an Vorhaben', () => {
    expect(laufendAktiv(sicht())).toBe(true);
    expect(laufendAktiv(sicht({}, { vorhaben: false }))).toBe(false);
    expect(istAn('laufend', sicht({}, { vorhaben: false }))).toBe(false);
  });
});

describe('istAn', () => {
  it('liest Funktionen und Ebenen', () => {
    const lage = sicht({ basis: true, chronik: false }, { visionen: false });
    expect(istAn('basis', lage)).toBe(true);
    expect(istAn('chronik', lage)).toBe(false);
    expect(istAn('visionen', lage)).toBe(false);
    expect(istAn('projekte', lage)).toBe(true);
  });

  it('lässt Bosse aus, wenn Vorhaben aus ist, auch wenn der Schalter an bleibt', () => {
    const lage = sicht({ bossAngriffe: true }, { vorhaben: false });
    expect(lage.funktionen.bossAngriffe).toBe(true);
    expect(istAn('bossAngriffe', lage)).toBe(false);
    expect(istAn('bossAngriffe', sicht({ bossAngriffe: true }))).toBe(true);
    expect(istAn('bossAngriffe', sicht({ bossAngriffe: false }))).toBe(false);
  });

  it('lässt Bosse und Investitionen aus, wenn das Attribut fehlt, auch wenn der Schalter an bleibt', () => {
    const lage = sicht({ bossAngriffe: true, ausruestung: true });
    lage.attribute = { disziplin: false, ressourcen: false };
    expect(lage.funktionen.bossAngriffe).toBe(true);
    expect(istAn('bossAngriffe', lage)).toBe(false);
    expect(istAn('ausruestung', lage)).toBe(false);
    expect(istAn('bossAngriffe', { ...lage, attribute: { disziplin: true, ressourcen: false } })).toBe(true);
    expect(istAn('ausruestung', { ...lage, attribute: { disziplin: false, ressourcen: true } })).toBe(true);
  });

  it('lässt Organisationen aus, wenn Projekte aus sind', () => {
    expect(istAn('organisationen', sicht({}, { projekte: false, organisationen: true }))).toBe(false);
  });
});

describe('pfadAktiv', () => {
  it('sperrt Seiten und Deep Links der ausgeschalteten Funktion', () => {
    const aus = sicht();
    expect(pfadAktiv('/basis', aus)).toBe(false);
    expect(pfadAktiv('/training-alt', aus)).toBe(true);
    expect(pfadAktiv('/chronik', aus)).toBe(true);
    expect(pfadAktiv('/vorbilder', aus)).toBe(false);
    expect(pfadAktiv('/vorbilder/ada', aus)).toBe(false);
    expect(pfadAktiv('/koennen', aus)).toBe(true);
    expect(pfadAktiv('/haben', aus)).toBe(true);
    expect(pfadAktiv('/faehigkeiten', aus)).toBe(false);
    expect(pfadAktiv('/investitionen', aus)).toBe(false);
    expect(pfadAktiv('/faehigkeiten/4', aus)).toBe(false);
    expect(pfadAktiv('/koennen', sicht({ koennen: false }))).toBe(false);
    expect(pfadAktiv('/handbuch', aus)).toBe(true);
    expect(pfadAktiv('/rueckblick?woche=1', aus)).toBe(false);
    expect(pfadAktiv('/statistiken/', aus)).toBe(false);

    const an = sicht({
      basis: true,
      chronik: true,
      vorbilder: true,
      faehigkeiten: true,
      rueckblick: true,
      statistiken: true,
    });
    expect(pfadAktiv('/basis', an)).toBe(true);
    expect(pfadAktiv('/chronik', an)).toBe(true);
    expect(pfadAktiv('/vorbilder/ada', an)).toBe(true);
    expect(pfadAktiv('/faehigkeiten/4', an)).toBe(true);
    expect(pfadAktiv('/faehigkeiten', an)).toBe(true);
    expect(pfadAktiv('/investitionen', sicht({ ausruestung: true }))).toBe(true);
    expect(pfadAktiv('/rueckblick', an)).toBe(true);
    expect(pfadAktiv('/statistiken', an)).toBe(true);
  });

  it('sperrt Ziele, Projekte und Laufend nach der Stufe', () => {
    const ohneZiele = sicht({}, { visionen: false, organisationen: false, projekte: false, vorhaben: false });
    expect(pfadAktiv('/ziele', ohneZiele)).toBe(false);
    expect(pfadAktiv('/projekte/3', ohneZiele)).toBe(false);
    expect(pfadAktiv('/laufend', ohneZiele)).toBe(false);

    const nurVorhaben = sicht({}, { visionen: false, organisationen: false, projekte: false, vorhaben: true });
    expect(pfadAktiv('/ziele', nurVorhaben)).toBe(true);
    expect(pfadAktiv('/projekte/3', nurVorhaben)).toBe(false);
    expect(pfadAktiv('/laufend', nurVorhaben)).toBe(true);
  });

  it('lässt die alten Pfade Aufgaben und Training durch, die Route leitet auf die Übersicht', () => {
    expect(pfadAktiv('/aufgaben', sicht())).toBe(true);
    expect(pfadAktiv('/aufgaben', sicht({ basis: true }))).toBe(true);
    expect(pfadAktiv('/training', sicht())).toBe(true);
    expect(pfadAktiv('/training?plan=1', sicht())).toBe(true);
    expect(pfadAktiv('/training/', sicht())).toBe(true);
    expect(pfadAktiv('/training/plaene/neu', sicht())).toBe(true);
    expect(pfadAktiv('/training/plaene/3', sicht())).toBe(true);
    expect(pfadAktiv('/training/einheiten/3', sicht())).toBe(true);
    expect(pfadAktiv('/training/uebungen/3', sicht())).toBe(true);
  });

  it('lässt Übersicht, Charakter und Einstellungen immer zu', () => {
    const aus = sicht({}, { visionen: false, organisationen: false, projekte: false, vorhaben: false });
    expect(pfadAktiv('/', aus)).toBe(true);
    expect(pfadAktiv('/charakter', aus)).toBe(true);
    expect(pfadAktiv('/mehr', aus)).toBe(true);
    expect(pfadAktiv('/mehr/funktionen', aus)).toBe(true);
  });
});

describe('erfolgSichtbar', () => {
  it('blendet Erfolge ausgeschalteter Funktionen aus', () => {
    const aus = sicht({ bossAngriffe: false }, { visionen: false, vorhaben: false });
    expect(erfolgSichtbar('bosse', aus)).toBe(false);
    expect(erfolgSichtbar('bossLevel', aus)).toBe(false);
    expect(erfolgSichtbar('comebacks', aus)).toBe(false);
    expect(erfolgSichtbar('visionen', aus)).toBe(false);
    expect(erfolgSichtbar('basis', aus)).toBe(false);
    expect(erfolgSichtbar('skills', aus)).toBe(false);
    expect(erfolgSichtbar('eintraege', aus)).toBe(true);
    expect(erfolgSichtbar('level', aus)).toBe(true);
  });

  it('blendet bei ausgeschalteten Erfolgen jede Kennzahl aus und stellt den Boss nur mit Boss-Schalter wieder her', () => {
    const aus = sicht({
      erfolge: false,
      bossAngriffe: true,
      basis: true,
      faehigkeiten: true,
      ausruestung: true,
      rueckblick: true,
    });
    for (const kennzahl of ERFOLG_KENNZAHLEN) {
      expect(erfolgSichtbar(kennzahl, aus)).toBe(false);
    }
    const an = sicht({ erfolge: true, bossAngriffe: true });
    expect(erfolgSichtbar('bosse', an)).toBe(true);
    expect(erfolgSichtbar('bossLevel', an)).toBe(true);
    expect(erfolgSichtbar('eintraege', an)).toBe(true);
    const ohneBoss = sicht({ erfolge: true, bossAngriffe: false }, { vorhaben: true });
    expect(erfolgSichtbar('bosse', ohneBoss)).toBe(false);
    expect(erfolgSichtbar('bossLevel', ohneBoss)).toBe(false);
    expect(erfolgSichtbar('eintraege', ohneBoss)).toBe(true);
    expect(erfolgSichtbar('level', ohneBoss)).toBe(true);
  });
});
