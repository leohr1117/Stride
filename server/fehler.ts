export class AppFehler extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppFehler';
    this.statusCode = statusCode;
  }
}

export function nichtGefunden(was: string): AppFehler {
  return new AppFehler(404, `${was} wurde nicht gefunden.`);
}

export function ungueltig(nachricht: string): AppFehler {
  return new AppFehler(400, nachricht);
}
