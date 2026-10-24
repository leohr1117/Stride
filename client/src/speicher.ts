export const TAETIGKEITEN_GESEHEN = 'ascend.taetigkeitenGesehen';

export function leseMerker(schluessel: string): boolean {
  try {
    return window.localStorage.getItem(schluessel) === '1';
  } catch {
    return false;
  }
}

export function merke(schluessel: string, wert: boolean): void {
  try {
    window.localStorage.setItem(schluessel, wert ? '1' : '0');
  } catch {
    return;
  }
}

export function vergiss(schluessel: string): void {
  try {
    window.localStorage.removeItem(schluessel);
  } catch {
    return;
  }
}

export function leseSitzung(schluessel: string): boolean {
  try {
    return window.sessionStorage.getItem(schluessel) === '1';
  } catch {
    return false;
  }
}

export function merkeSitzung(schluessel: string, wert: boolean): void {
  try {
    if (wert) {
      window.sessionStorage.setItem(schluessel, '1');
    } else {
      window.sessionStorage.removeItem(schluessel);
    }
  } catch {
    return;
  }
}

export function leseSitzungszahl(schluessel: string): number | null {
  try {
    const wert = window.sessionStorage.getItem(schluessel);
    return wert === null ? null : Number(wert);
  } catch {
    return null;
  }
}

export function merkeSitzungszahl(schluessel: string, wert: number): void {
  try {
    window.sessionStorage.setItem(schluessel, String(wert));
  } catch {
    return;
  }
}

export function leseText(schluessel: string): string | null {
  try {
    return window.localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

export function merkeText(schluessel: string, wert: string): void {
  try {
    window.localStorage.setItem(schluessel, wert);
  } catch {
    return;
  }
}
