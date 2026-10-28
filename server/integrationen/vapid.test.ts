import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KONFIG, leseVapid, oeffentlicherVapidSchluessel } from '../config.ts';

const GEHEIM = 'privater-testschluessel-nicht-loggen';

function umgebung(teil: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return teil;
}

describe('VAPID', () => {
  it('gibt den öffentlichen Schlüssel nur zurück, wenn alle drei Werte gelten', () => {
    const voll = umgebung({
      VAPID_PUBLIC_KEY: ' oeffentlich-test ',
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'mailto:push@example.com',
    });
    expect(oeffentlicherVapidSchluessel(voll)).toBe('oeffentlich-test');
    expect(leseVapid(voll)).toEqual({
      oeffentlich: 'oeffentlich-test',
      privat: GEHEIM,
      betreff: 'mailto:push@example.com',
    });
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'https://stride.example/kontakt',
    }))).toBe('oeffentlich-test');
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'MAILTO:push@example.com',
    }))).toBe('oeffentlich-test');
  });

  it('ist null, wenn der private Schlüssel oder der Betreff fehlt', () => {
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_SUBJECT: 'mailto:push@example.com',
    }))).toBeNull();
    expect(leseVapid(umgebung({
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'mailto:push@example.com',
    }))).toBeNull();
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: '   ',
      VAPID_SUBJECT: 'mailto:push@example.com',
    }))).toBeNull();
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: GEHEIM,
    }))).toBeNull();
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'http://stride.example/kontakt',
    }))).toBeNull();
    expect(oeffentlicherVapidSchluessel(umgebung({
      VAPID_PUBLIC_KEY: 'oeffentlich-test',
      VAPID_PRIVATE_KEY: GEHEIM,
      VAPID_SUBJECT: 'mailto:',
    }))).toBeNull();
    expect(oeffentlicherVapidSchluessel(umgebung({}))).toBeNull();
  });

  it('legt den privaten Schlüssel nicht in KONFIG', () => {
    const quelle = readFileSync(fileURLToPath(new URL('../config.ts', import.meta.url)), 'utf8');
    const start = quelle.indexOf('export const KONFIG');
    const ende = quelle.indexOf('} as const;', start);
    const block = quelle.slice(start, ende);
    expect(block.includes('VAPID')).toBe(false);
    expect(block.includes('PRIVATE')).toBe(false);
    expect(Object.keys(KONFIG).some((name) => /vapid|privat/i.test(name))).toBe(false);
    expect(JSON.stringify(KONFIG)).not.toContain(GEHEIM);
  });
});
