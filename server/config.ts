import path from 'node:path';
import { istTestlauf, verweigereEchteDatenbank } from './testpfad.ts';

const PROJEKT_WURZEL = path.resolve(import.meta.dirname, '..');
const STANDARD_PORT = 3000;
const ECHTE_DATENBANK = path.join(PROJEKT_WURZEL, 'data', 'app.db');

function datenbankPfadAufloesen(): string {
  const gesetzt = process.env.DB_PFAD;
  if (istTestlauf()) {
    if (!gesetzt) {
      throw new Error('Abbruch: Tests brauchen DB_PFAD auf eine Kopie. Echte Dateien unter data/ sind gesperrt.');
    }
    return verweigereEchteDatenbank(gesetzt);
  }
  return gesetzt ?? ECHTE_DATENBANK;
}

const datenbankPfad = datenbankPfadAufloesen();

function zugangPfadAufloesen(): string {
  const standard = path.join(path.dirname(datenbankPfad), 'zugang.db');
  const gesetzt = process.env.ZUGANG_PFAD ?? standard;
  if (istTestlauf()) {
    return verweigereEchteDatenbank(gesetzt);
  }
  return gesetzt;
}

function lesePort(wert: string | undefined): number {
  if (wert === undefined || wert === '') {
    return STANDARD_PORT;
  }
  const port = Number(wert);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Ungültiger PORT "${wert}". Erlaubt sind ganze Zahlen von 1 bis 65535.`);
  }
  return port;
}

export const KONFIG = {
  port: lesePort(process.env.PORT),
  host: '127.0.0.1',
  logLevel: process.env.LOG_LEVEL ?? 'warn',
  datenbankPfad,
  zugangPfad: zugangPfadAufloesen(),
  clientPfad: path.join(PROJEKT_WURZEL, 'client', 'dist'),
  todoistApi: process.env.TODOIST_API ?? 'https://api.todoist.com/api/v1/',
} as const;
