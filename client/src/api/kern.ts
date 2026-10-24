import { aktiveSprache } from '../../../shared/sprache/index.ts';

export class ApiFehler extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiFehler';
    this.status = status;
  }
}

type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const KEIN_INHALT = 204;
const anmeldeBeobachter = new Set<() => void>();

export function beobachteAnmeldung(fn: () => void): () => void {
  anmeldeBeobachter.add(fn);
  return () => {
    anmeldeBeobachter.delete(fn);
  };
}

export function meldeAnmeldungAbgelaufen(): void {
  for (const fn of anmeldeBeobachter) {
    fn();
  }
}

export async function anfrage<T>(pfad: string, methode: Methode = 'GET', daten?: unknown): Promise<T> {
  let antwort: Response;
  try {
    const kopf: Record<string, string> = { 'Accept-Language': aktiveSprache() };
    if (daten !== undefined) {
      kopf['Content-Type'] = 'application/json';
    }
    antwort = await fetch(`/api${pfad}`, {
      method: methode,
      credentials: 'same-origin',
      headers: kopf,
      body: daten === undefined ? undefined : JSON.stringify(daten),
    });
  } catch {
    throw new ApiFehler(0, 'Server nicht erreichbar.');
  }

  if (antwort.status === KEIN_INHALT) {
    return undefined as T;
  }
  const inhalt: unknown = await antwort.json().catch(() => null);
  if (!antwort.ok) {
    const nachricht =
      inhalt !== null && typeof inhalt === 'object' && 'fehler' in inhalt && typeof inhalt.fehler === 'string'
        ? inhalt.fehler
        : `Anfrage fehlgeschlagen (Status ${antwort.status}).`;
    if (antwort.status === 401 && !pfad.startsWith('/zugang')) {
      meldeAnmeldungAbgelaufen();
    }
    throw new ApiFehler(antwort.status, nachricht);
  }
  return inhalt as T;
}

export function abfrageText(werte: Record<string, string | number | boolean | undefined>): string {
  const parameter = new URLSearchParams();
  for (const [schluessel, wert] of Object.entries(werte)) {
    if (wert !== undefined) {
      parameter.set(schluessel, String(wert));
    }
  }
  const text = parameter.toString();
  return text ? `?${text}` : '';
}

export type MitArchiv<T> = Partial<T> & { archiviert?: boolean };
