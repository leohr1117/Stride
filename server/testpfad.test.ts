import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GEERBTE_ZUGANGS_NAMEN, istEchteDatenbank, leereGeerbteZugangsVariablen, verweigereEchteDatenbank } from './testpfad.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('echte Datenbanken', () => {
  it('erkennt data/*.db und data/welten/*.db, auch Neben- und Umwegpfade', () => {
    expect(istEchteDatenbank(path.join(WURZEL, 'data', 'app.db'))).toBe(true);
    expect(istEchteDatenbank(path.join(WURZEL, 'data', 'zugang.db'))).toBe(true);
    expect(istEchteDatenbank(path.join(WURZEL, 'data', 'welten', '2.db'))).toBe(true);
    expect(istEchteDatenbank(path.join(WURZEL, 'data', 'welten', '3.db-wal'))).toBe(true);
    expect(istEchteDatenbank(path.join(WURZEL, 'data', 'welten', '..', 'app.db'))).toBe(true);
    expect(istEchteDatenbank(':memory:')).toBe(false);
    expect(istEchteDatenbank(path.join(WURZEL, 'tmp-playwright', 'app.db'))).toBe(false);
    expect(istEchteDatenbank(path.join(WURZEL, 'tmp-playwright', 'welten', '3.db'))).toBe(false);
    expect(istEchteDatenbank(path.join(os.tmpdir(), 'stride-vitest', 'app.db'))).toBe(false);
  });

  it('bricht bei echten Dateien ab und lässt Kopien durch', () => {
    expect(() => verweigereEchteDatenbank(path.join(WURZEL, 'data', 'app.db'))).toThrow(/Abbruch/);
    expect(() => verweigereEchteDatenbank(path.join(WURZEL, 'data', 'welten', '3.db'))).toThrow(/echte Datenbank/);
    const kopie = path.join(WURZEL, 'tmp-playwright', 'welten', '3.db');
    expect(verweigereEchteDatenbank(kopie)).toBe(path.resolve(kopie));
    expect(verweigereEchteDatenbank(':memory:')).toBe(':memory:');
  });

  it('leert SMTP, Google und Registrierung und lässt andere Variablen stehen', () => {
    const env: NodeJS.ProcessEnv = {
      STRIDE_DB_PFAD: 'bleibt',
      STRIDE_TEST: '1',
      STRIDE_TOKEN_SCHLUESSEL: 'bleibt',
      STRIDE_SMTP_HOST: 'nicht-verwenden',
      STRIDE_SMTP_ZUSATZ: 'nicht-verwenden',
      ASCEND_SMTP_PASSWORT: 'nicht-verwenden',
      STRIDE_GOOGLE: '1',
      STRIDE_GOOGLE_CLIENT_ID: 'nicht-verwenden',
      ASCEND_GOOGLE_CLIENT_SECRET: 'nicht-verwenden',
      STRIDE_GOOGLE_ZUSATZ: 'nicht-verwenden',
      STRIDE_REGISTRIERUNG: '1',
      ASCEND_REGISTRIERUNG: '1',
    };
    const namen = leereGeerbteZugangsVariablen(env);
    expect(env.STRIDE_DB_PFAD).toBe('bleibt');
    expect(env.STRIDE_TEST).toBe('1');
    expect(env.STRIDE_TOKEN_SCHLUESSEL).toBe('bleibt');
    for (const name of GEERBTE_ZUGANGS_NAMEN) {
      expect(namen).toContain(name);
      expect(env[name]).toBeUndefined();
    }
    expect(env.STRIDE_SMTP_ZUSATZ).toBeUndefined();
    expect(env.STRIDE_GOOGLE_ZUSATZ).toBeUndefined();
    expect(namen).toContain('STRIDE_SMTP_ZUSATZ');
    expect(namen).toContain('STRIDE_GOOGLE_ZUSATZ');
    for (const name of namen) {
      expect(env[name]).toBeUndefined();
    }
  });
});
