import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { istEchteDatenbank } from './testpfad.ts';
import { mitDatenbankPfaden, pfadVariable, schreibePfadVariable, strideVariable } from './umgebung.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NAME = 'UMGEBUNG_PROBE';

afterEach(() => {
  delete process.env[`STRIDE_${NAME}`];
  delete process.env[`ASCEND_${NAME}`];
});

describe('strideVariable', () => {
  it('liest STRIDE_ vor dem alten Namen', () => {
    process.env[`STRIDE_${NAME}`] = 'neu';
    process.env[`ASCEND_${NAME}`] = 'alt';
    expect(strideVariable(NAME)).toBe('neu');
  });

  it('nimmt den alten Namen, wenn STRIDE_ fehlt', () => {
    process.env[`ASCEND_${NAME}`] = 'alt';
    expect(strideVariable(NAME)).toBe('alt');
  });

  it('ist leer, wenn keiner gesetzt ist', () => {
    expect(strideVariable(NAME)).toBeUndefined();
  });

  it('liest die übergebene Umgebung', () => {
    expect(strideVariable(NAME, { [`STRIDE_${NAME}`]: 'aus-env', [`ASCEND_${NAME}`]: 'alt' })).toBe('aus-env');
    expect(strideVariable(NAME, { [`ASCEND_${NAME}`]: 'alt' })).toBe('alt');
  });
});

describe('pfadVariable', () => {
  it('nimmt den neuen Namen allein', () => {
    expect(pfadVariable('DB_PFAD', { STRIDE_DB_PFAD: 'neu-db' })).toBe('neu-db');
    expect(pfadVariable('ZUGANG_PFAD', { STRIDE_ZUGANG_PFAD: 'neu-zugang' })).toBe('neu-zugang');
  });

  it('nimmt den alten Namen allein', () => {
    expect(pfadVariable('DB_PFAD', { DB_PFAD: 'alt-db' })).toBe('alt-db');
    expect(pfadVariable('ZUGANG_PFAD', { ZUGANG_PFAD: 'alt-zugang' })).toBe('alt-zugang');
  });

  it('lässt den neuen Namen vor dem alten gewinnen', () => {
    expect(pfadVariable('DB_PFAD', { STRIDE_DB_PFAD: 'neu-db', DB_PFAD: 'alt-db' })).toBe('neu-db');
    expect(pfadVariable('ZUGANG_PFAD', { STRIDE_ZUGANG_PFAD: 'neu-zugang', ZUGANG_PFAD: 'alt-zugang' })).toBe('neu-zugang');
  });

  it('lässt beide Pfade unabhängig', () => {
    const env = { STRIDE_DB_PFAD: 'neu-db', ZUGANG_PFAD: 'alt-zugang' };
    expect(pfadVariable('DB_PFAD', env)).toBe('neu-db');
    expect(pfadVariable('ZUGANG_PFAD', env)).toBe('alt-zugang');
  });

  it('ist ohne Namen leer und liest ASCEND_ nicht', () => {
    expect(pfadVariable('DB_PFAD', {})).toBeUndefined();
    expect(pfadVariable('ZUGANG_PFAD', {})).toBeUndefined();
    expect(pfadVariable('DB_PFAD', { ASCEND_DB_PFAD: 'ascend-db' })).toBeUndefined();
    expect(pfadVariable('ZUGANG_PFAD', { ASCEND_ZUGANG_PFAD: 'ascend-zugang' })).toBeUndefined();
  });

  it('überschreibt geerbte neue Namen mit dem isolierten Pfad', () => {
    const basis: NodeJS.ProcessEnv = {
      STRIDE_TEST: '1',
      STRIDE_DB_PFAD: path.join('data', 'app.db'),
      DB_PFAD: path.join('data', 'app.db'),
      STRIDE_ZUGANG_PFAD: path.join('data', 'zugang.db'),
      ZUGANG_PFAD: path.join('data', 'zugang.db'),
    };
    const env = mitDatenbankPfaden(basis, path.join('tmp', 'app.db'), path.join('tmp', 'zugang.db'));
    expect(basis.STRIDE_DB_PFAD).toBe(path.join('data', 'app.db'));
    expect(env.STRIDE_TEST).toBe('1');
    expect(pfadVariable('DB_PFAD', env)).toBe(path.join('tmp', 'app.db'));
    expect(pfadVariable('ZUGANG_PFAD', env)).toBe(path.join('tmp', 'zugang.db'));
    expect(env.DB_PFAD).toBe(path.join('tmp', 'app.db'));
    expect(env.ZUGANG_PFAD).toBe(path.join('tmp', 'zugang.db'));
    expect(istEchteDatenbank(env.STRIDE_DB_PFAD ?? '')).toBe(false);
    expect(istEchteDatenbank(env.STRIDE_ZUGANG_PFAD ?? '')).toBe(false);
  });

  it('pinnt Beispieldaten auf die gemeinsame Quelle, bevor Module laden', () => {
    const geerbt: NodeJS.ProcessEnv = { STRIDE_DB_PFAD: path.join(WURZEL, 'data', 'app.db'), DB_PFAD: path.join('tmp', 'alt.db') };
    const datenbank = pfadVariable('DB_PFAD', geerbt) ?? path.join('tmp', 'default.db');
    schreibePfadVariable('DB_PFAD', datenbank, geerbt);
    expect(datenbank).toBe(path.join(WURZEL, 'data', 'app.db'));
    expect(pfadVariable('DB_PFAD', geerbt)).toBe(datenbank);
    expect(geerbt.DB_PFAD).toBe(datenbank);

    const isoliert = path.join('tmp', 'beispiel.db');
    const umgebung: NodeJS.ProcessEnv = { STRIDE_DB_PFAD: path.join(WURZEL, 'data', 'app.db') };
    schreibePfadVariable('DB_PFAD', isoliert, umgebung);
    expect(pfadVariable('DB_PFAD', umgebung)).toBe(isoliert);
    expect(istEchteDatenbank(isoliert)).toBe(false);

    const quelle = fs.readFileSync(path.join(WURZEL, 'server', 'beispieldaten.ts'), 'utf8');
    expect(quelle).toContain("pfadVariable('DB_PFAD')");
    expect(quelle).toContain("schreibePfadVariable('DB_PFAD', DATENBANK)");
    expect(quelle).not.toContain('process.env.DB_PFAD');
  });
});