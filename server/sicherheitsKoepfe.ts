import type { FastifyInstance } from 'fastify';

export const INHALTSICHERHEIT_TEILE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
] as const;

export const INHALTSICHERHEIT = INHALTSICHERHEIT_TEILE.join('; ');
export const RAHMEN_VERBOT = 'DENY';
export const INHALTSTYP_PRUEFUNG = 'nosniff';
export const VERWEIS_REGEL = 'strict-origin-when-cross-origin';
export const GERAETE_RECHTE = 'camera=(), microphone=(), geolocation=()';
export const FENSTER_TRENNUNG = 'same-origin';

export const SICHERHEITS_KOEPFE = {
  'Content-Security-Policy': INHALTSICHERHEIT,
  'X-Frame-Options': RAHMEN_VERBOT,
  'X-Content-Type-Options': INHALTSTYP_PRUEFUNG,
  'Referrer-Policy': VERWEIS_REGEL,
  'Permissions-Policy': GERAETE_RECHTE,
  'Cross-Origin-Opener-Policy': FENSTER_TRENNUNG,
} as const;

export function registriereSicherheitsKoepfe(app: FastifyInstance): void {
  const namen = Object.keys(SICHERHEITS_KOEPFE) as (keyof typeof SICHERHEITS_KOEPFE)[];
  app.addHook('onRequest', (_anfrage, antwort, fertig) => {
    for (const name of namen) {
      if (antwort.getHeader(name) === undefined) {
        antwort.header(name, SICHERHEITS_KOEPFE[name]);
      }
    }
    fertig();
  });
}
