import type { Ebene, Ebenen } from './ebenen.ts';
import { EBENEN, zieleAktiv as ebenenZieleAktiv } from './ebenen.ts';
import type { ErfolgKennzahl } from './erfolge.ts';
import type { Funktion, Funktionen } from './funktionen.ts';

/** Aktive Attribute, an denen eine Funktion hängt. */
export interface FunktionsAttribute {
  disziplin: boolean;
  ressourcen: boolean;
}

export interface Sichtbarkeit {
  funktionen: Funktionen;
  ebenen: Ebenen;
  /** Fehlt der Eintrag, gilt die Attribut-Abhängigkeit als erfüllt. */
  attribute?: FunktionsAttribute;
}

export type Schalter = Funktion | Ebene | 'ziele' | 'laufend';

const EBENEN_SATZ = new Set<string>(EBENEN);

/** Bosse, Comebacks, Basis, Skills, Investitionen, Rückblicke und Visionen hängen an einem Schalter. */
const ERFOLG_SCHALTER: Partial<Record<ErfolgKennzahl, Schalter>> = {
  bosse: 'bossAngriffe',
  bossLevel: 'bossAngriffe',
  comebacks: 'vorhaben',
  basis: 'basis',
  skills: 'faehigkeiten',
  ausruestung: 'ausruestung',
  rueckblicke: 'rueckblick',
  visionen: 'visionen',
};

export function zieleAktiv(sichtbarkeit: Sichtbarkeit): boolean {
  return ebenenZieleAktiv(sichtbarkeit.ebenen);
}

export function laufendAktiv(sichtbarkeit: Sichtbarkeit): boolean {
  return sichtbarkeit.ebenen.vorhaben;
}

export function istAn(schalter: Schalter, sichtbarkeit: Sichtbarkeit): boolean {
  if (schalter === 'ziele') {
    return zieleAktiv(sichtbarkeit);
  }
  if (schalter === 'laufend') {
    return laufendAktiv(sichtbarkeit);
  }
  if (EBENEN_SATZ.has(schalter)) {
    const ebene = schalter as Ebene;
    if (ebene === 'organisationen' && !sichtbarkeit.ebenen.projekte) {
      return false;
    }
    return sichtbarkeit.ebenen[ebene];
  }
  if (schalter === 'bossAngriffe') {
    if (!sichtbarkeit.ebenen.vorhaben) {
      return false;
    }
    if (sichtbarkeit.attribute && !sichtbarkeit.attribute.disziplin) {
      return false;
    }
  }
  if (schalter === 'ausruestung' && sichtbarkeit.attribute && !sichtbarkeit.attribute.ressourcen) {
    return false;
  }
  return sichtbarkeit.funktionen[schalter as Funktion];
}

function pfadOhneAnhang(pfad: string): string {
  const ohneSuche = pfad.split('?')[0] ?? pfad;
  const ohneHash = ohneSuche.split('#')[0] ?? ohneSuche;
  if (ohneHash.length > 1 && ohneHash.endsWith('/')) {
    return ohneHash.slice(0, -1);
  }
  return ohneHash === '' ? '/' : ohneHash;
}

export function pfadAktiv(pfad: string, sichtbarkeit: Sichtbarkeit): boolean {
  const rein = pfadOhneAnhang(pfad);
  if (rein === '/laufend') {
    return istAn('laufend', sichtbarkeit);
  }
  if (rein === '/basis') {
    return istAn('basis', sichtbarkeit);
  }
  if (rein === '/ziele') {
    return istAn('ziele', sichtbarkeit);
  }
  if (rein === '/chronik') {
    return istAn('chronik', sichtbarkeit);
  }
  if (rein === '/rueckblick') {
    return istAn('rueckblick', sichtbarkeit);
  }
  if (rein === '/statistiken') {
    return istAn('statistiken', sichtbarkeit);
  }
  if (rein === '/handbuch') {
    return istAn('handbuch', sichtbarkeit);
  }
  if (rein === '/vorbilder' || rein.startsWith('/vorbilder/')) {
    return istAn('vorbilder', sichtbarkeit);
  }
  if (/^\/faehigkeiten\/[^/]+$/.test(rein)) {
    return istAn('faehigkeiten', sichtbarkeit);
  }
  if (/^\/projekte\/[^/]+$/.test(rein)) {
    return istAn('projekte', sichtbarkeit);
  }
  return true;
}

export function erfolgSichtbar(kennzahl: ErfolgKennzahl, sichtbarkeit: Sichtbarkeit): boolean {
  const schalter = ERFOLG_SCHALTER[kennzahl];
  return schalter === undefined || istAn(schalter, sichtbarkeit);
}
