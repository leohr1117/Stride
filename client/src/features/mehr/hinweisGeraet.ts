import { tx } from '../../text.ts';

export type HinweisBerechtigung = NotificationPermission | 'fehlt';

export interface HinweisGeraet {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  berechtigung: HinweisBerechtigung;
}

/** Gesperrt: Knopf aus. Fragen: Systemdialog. Anmelden: schon erlaubt. Still: abgelehnt, kein zweites Fragen. */
export type EinschaltKlick = 'gesperrt' | 'fragen' | 'anmelden' | 'still';

const IOS = /iPad|iPhone|iPod/;
const MAC = /Macintosh/;

export function istIosGeraet(userAgent: string, maxTouchPoints: number): boolean {
  if (IOS.test(userAgent)) {
    return true;
  }
  return MAC.test(userAgent) && maxTouchPoints > 1;
}

export function iosOhneApp(geraet: HinweisGeraet): boolean {
  return istIosGeraet(geraet.userAgent, geraet.maxTouchPoints) && !geraet.standalone;
}

export function einschaltKlick(geraet: HinweisGeraet, schluessel: string | null): EinschaltKlick {
  if (!schluessel || iosOhneApp(geraet) || geraet.berechtigung === 'fehlt') {
    return 'gesperrt';
  }
  if (geraet.berechtigung === 'denied') {
    return 'still';
  }
  if (geraet.berechtigung === 'granted') {
    return 'anmelden';
  }
  return 'fragen';
}

/** Wert der Zeile Benachrichtigungen. Kein Gerät ist aus, eines ist an, mehrere zählen. */
export function kachelText(geraete: number): string {
  if (geraete <= 0) {
    return tx('Aus');
  }
  if (geraete === 1) {
    return tx('An');
  }
  return tx('{n} Geräte', { n: geraete });
}

/** Öffentlicher VAPID-Schlüssel, base64url, als Bytes für pushManager.subscribe. */
export function schluesselBytes(text: string): Uint8Array<ArrayBuffer> {
  const basis = text.replaceAll('-', '+').replaceAll('_', '/');
  const rest = basis.length % 4;
  const gepolstert = rest === 0 ? basis : basis + '='.repeat(4 - rest);
  const roh = atob(gepolstert);
  const bytes = new Uint8Array(roh.length);
  for (let index = 0; index < roh.length; index += 1) {
    bytes[index] = roh.charCodeAt(index);
  }
  return bytes;
}
