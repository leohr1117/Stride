export const TAETIGKEITEN_GESEHEN = 'stride.taetigkeitenGesehen';

type Lager = 'localStorage' | 'sessionStorage';

function alterSchluessel(schluessel: string): string | null {
  if (schluessel.startsWith('stride.')) {
    return `ascend.${schluessel.slice('stride.'.length)}`;
  }
  if (schluessel.startsWith('stride-')) {
    return `ascend-${schluessel.slice('stride-'.length)}`;
  }
  return null;
}

function leseRoh(name: Lager, schluessel: string): string | null {
  try {
    const speicher = window[name];
    const neu = speicher.getItem(schluessel);
    if (neu !== null) {
      return neu;
    }
    const alt = alterSchluessel(schluessel);
    if (alt === null) {
      return null;
    }
    const wert = speicher.getItem(alt);
    if (wert !== null) {
      try {
        speicher.setItem(schluessel, wert);
      } catch {
        return wert;
      }
    }
    return wert;
  } catch {
    return null;
  }
}

function schreibeRoh(name: Lager, schluessel: string, wert: string): void {
  try {
    window[name].setItem(schluessel, wert);
  } catch {
    return;
  }
}

function loescheRoh(name: Lager, schluessel: string): void {
  try {
    const speicher = window[name];
    speicher.removeItem(schluessel);
    const alt = alterSchluessel(schluessel);
    if (alt !== null) {
      speicher.removeItem(alt);
    }
  } catch {
    return;
  }
}

export function leseMerker(schluessel: string): boolean {
  return leseRoh('localStorage', schluessel) === '1';
}

export function merke(schluessel: string, wert: boolean): void {
  schreibeRoh('localStorage', schluessel, wert ? '1' : '0');
}

export function vergiss(schluessel: string): void {
  loescheRoh('localStorage', schluessel);
}

export function leseSitzung(schluessel: string): boolean {
  return leseRoh('sessionStorage', schluessel) === '1';
}

export function merkeSitzung(schluessel: string, wert: boolean): void {
  if (wert) {
    schreibeRoh('sessionStorage', schluessel, '1');
    return;
  }
  loescheRoh('sessionStorage', schluessel);
}

export function leseSitzungszahl(schluessel: string): number | null {
  const wert = leseRoh('sessionStorage', schluessel);
  return wert === null ? null : Number(wert);
}

export function merkeSitzungszahl(schluessel: string, wert: number): void {
  schreibeRoh('sessionStorage', schluessel, String(wert));
}

export function leseSitzungstext(schluessel: string): string | null {
  return leseRoh('sessionStorage', schluessel);
}

export function merkeSitzungstext(schluessel: string, wert: string): void {
  schreibeRoh('sessionStorage', schluessel, wert);
}

export function vergissSitzung(schluessel: string): void {
  loescheRoh('sessionStorage', schluessel);
}

export function leseText(schluessel: string): string | null {
  return leseRoh('localStorage', schluessel);
}

export function merkeText(schluessel: string, wert: string): void {
  schreibeRoh('localStorage', schluessel, wert);
}
