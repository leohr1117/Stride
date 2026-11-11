import { describe, expect, it } from 'vitest';
import { ebenenSperre, funktionsSperre } from './abhaengigkeiten.ts';
import type { Ebenen } from './ebenen.ts';
import { standardFunktionen } from './funktionen.ts';

const EBENEN: Ebenen = { visionen: true, organisationen: true, projekte: true, vorhaben: true };

describe('sperren', () => {
  it('nennt nur Schalter, die sich gerade nicht umlegen lassen', () => {
    const funktionen = standardFunktionen();
    expect(funktionsSperre('koennen', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('status', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('chronik', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('handbuch', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('verfallKoennen', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('verfallHaben', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('bossAngriffe', funktionen, EBENEN)).toBeNull();
    expect(funktionsSperre('erfolge', funktionen, EBENEN)).toBeNull();
    expect(ebenenSperre('visionen', EBENEN)).toBeNull();
    expect(ebenenSperre('projekte', EBENEN)).toBeNull();
    expect(ebenenSperre('vorhaben', EBENEN)).toBeNull();
    expect(ebenenSperre('organisationen', EBENEN)).toBeNull();

    const nurKoennen = { ...funktionen, koennen: true, status: false };
    expect(funktionsSperre('koennen', nurKoennen, EBENEN)).toBe('Können oder Haben muss aktiv bleiben.');
    expect(funktionsSperre('status', nurKoennen, EBENEN)).toBeNull();

    const nurStatus = { ...funktionen, koennen: false, status: true };
    expect(funktionsSperre('status', nurStatus, EBENEN)).toBe('Können oder Haben muss aktiv bleiben.');
    expect(funktionsSperre('koennen', nurStatus, EBENEN)).toBeNull();

    expect(funktionsSperre('bossAngriffe', funktionen, { ...EBENEN, vorhaben: false })).toBe('Erst Vorhaben einschalten.');
    expect(funktionsSperre('bossAngriffe', funktionen, EBENEN, { disziplin: false, ressourcen: true })).toBe(
      'Erst Disziplin einschalten.',
    );
    expect(funktionsSperre('ausruestung', funktionen, EBENEN, { disziplin: true, ressourcen: false })).toBe(
      'Erst Ressourcen einschalten.',
    );
    expect(funktionsSperre('bossAngriffe', funktionen, EBENEN, { disziplin: true, ressourcen: false })).toBeNull();
    expect(funktionsSperre('verfallKoennen', nurStatus, EBENEN)).toBe('Erst Können einschalten.');
    expect(funktionsSperre('verfallHaben', nurKoennen, EBENEN)).toBe('Erst Haben einschalten.');
    expect(funktionsSperre('verfallKoennen', nurKoennen, EBENEN)).toBeNull();
    expect(funktionsSperre('verfallHaben', nurStatus, EBENEN)).toBeNull();
    expect(ebenenSperre('organisationen', { ...EBENEN, projekte: false })).toBe('Erst Projekte einschalten.');
    expect(ebenenSperre('projekte', { ...EBENEN, projekte: false })).toBeNull();
    expect(ebenenSperre('vorhaben', { ...EBENEN, vorhaben: false })).toBeNull();
  });
});
