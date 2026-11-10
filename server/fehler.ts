import type { VerbindungsFehlerArt } from '../shared/verbindungsFehler.ts';

export type { VerbindungsFehlerArt };

export class AppFehler extends Error {
  readonly statusCode: number;
  readonly art?: VerbindungsFehlerArt;

  constructor(statusCode: number, message: string, art?: VerbindungsFehlerArt) {
    super(message);
    this.name = 'AppFehler';
    this.statusCode = statusCode;
    this.art = art;
  }
}

export function nichtGefunden(was: string): AppFehler {
  return new AppFehler(404, `${was} wurde nicht gefunden.`);
}

export function ungueltig(nachricht: string, art?: VerbindungsFehlerArt): AppFehler {
  return new AppFehler(400, nachricht, art);
}

export function artVon(fehler: unknown): VerbindungsFehlerArt | null {
  return fehler instanceof AppFehler && fehler.art ? fehler.art : null;
}
