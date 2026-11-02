import type { FastifyInstance } from 'fastify';

export const PASSWORT_AENDERN_PFAD = '/mehr/profil/passwort';
export const CHANGE_PASSWORD_PFAD = '/.well-known/change-password';

export function registrierePasswortAdresse(app: FastifyInstance): void {
  app.get(CHANGE_PASSWORD_PFAD, async (_anfrage, antwort) => antwort.redirect(PASSWORT_AENDERN_PFAD, 302));
}
