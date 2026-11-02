import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { PASSWORT_MAX, PASSWORT_MIN, PASSWORT_REGEL } from '../../../shared/spiel/passwort.ts';
import { anmeldeSchema, passwortAenderungSchema } from '../../validierung.ts';
import { CHANGE_PASSWORD_PFAD, PASSWORT_AENDERN_PFAD, registrierePasswortAdresse } from './passwortAdresse.ts';

describe('passwortadresse', () => {
  it('leitet die bekannte Adresse mit 302 auf die Passwortseite', async () => {
    const app = Fastify();
    registrierePasswortAdresse(app);
    const antwort = await app.inject({ method: 'GET', url: CHANGE_PASSWORD_PFAD });
    expect(antwort.statusCode).toBe(302);
    expect(antwort.headers.location).toBe(PASSWORT_AENDERN_PFAD);
    await app.close();
  });

  it('nennt in der Passwortregel dieselben Grenzen wie der Server', () => {
    expect(PASSWORT_MIN).toBe(10);
    expect(PASSWORT_MAX).toBe(200);
    expect(PASSWORT_MAX).toBeGreaterThanOrEqual(128);
    expect(PASSWORT_REGEL).toBe(`minlength: ${PASSWORT_MIN}; maxlength: ${PASSWORT_MAX};`);
    const kurz = 'x'.repeat(PASSWORT_MIN - 1);
    const passend = 'x'.repeat(PASSWORT_MIN);
    const zuLang = 'x'.repeat(PASSWORT_MAX + 1);
    expect(anmeldeSchema.safeParse({ passwort: kurz }).success).toBe(false);
    expect(anmeldeSchema.safeParse({ passwort: passend }).success).toBe(true);
    expect(anmeldeSchema.safeParse({ passwort: zuLang }).success).toBe(false);
    expect(passwortAenderungSchema.safeParse({ bisher: 'a', neu: passend }).success).toBe(true);
    expect(passwortAenderungSchema.safeParse({ bisher: 'a', neu: zuLang }).success).toBe(false);
  });
});
