import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { istEchteDatenbank, verweigereEchteDatenbank } from './testpfad.ts';

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
    expect(istEchteDatenbank(path.join(os.tmpdir(), 'ascend-vitest', 'app.db'))).toBe(false);
  });

  it('bricht bei echten Dateien ab und lässt Kopien durch', () => {
    expect(() => verweigereEchteDatenbank(path.join(WURZEL, 'data', 'app.db'))).toThrow(/Abbruch/);
    expect(() => verweigereEchteDatenbank(path.join(WURZEL, 'data', 'welten', '3.db'))).toThrow(/echte Datenbank/);
    const kopie = path.join(WURZEL, 'tmp-playwright', 'welten', '3.db');
    expect(verweigereEchteDatenbank(kopie)).toBe(path.resolve(kopie));
    expect(verweigereEchteDatenbank(':memory:')).toBe(':memory:');
  });
});
