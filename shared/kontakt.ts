export const KONTAKT_EMPFAENGER = 'kontakt@leohr.de';
export const KONTAKT_BETREFF = 'Kontaktformular';
export const NAME_MAX = 80;
export const EMAIL_MAX = 200;
export const NACHRICHT_MAX = 4000;

export function istKontaktEmail(wert: string): boolean {
  if (wert.length > EMAIL_MAX || /[\r\n]/.test(wert)) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert);
}
