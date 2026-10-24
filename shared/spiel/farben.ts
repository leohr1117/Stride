export const MINDEST_KONTRAST = 4.5;

const HEX = /^#[0-9a-f]{6}$/i;

export function istHexFarbe(wert: unknown): wert is string {
  return typeof wert === 'string' && HEX.test(wert);
}

export function normaleHex(wert: string): string {
  return wert.toLowerCase();
}

function kanaele(wert: string): [number, number, number] | null {
  const text = wert.trim();
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const roh = hex[1];
    return [Number.parseInt(roh.slice(0, 2), 16), Number.parseInt(roh.slice(2, 4), 16), Number.parseInt(roh.slice(4, 6), 16)];
  }
  const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb?.[1] !== undefined && rgb[2] !== undefined && rgb[3] !== undefined) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

function linear(anteil: number): number {
  return anteil <= 0.04045 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4;
}

export function helligkeit(wert: string): number {
  const kanale = kanaele(wert);
  if (!kanale) {
    return 0;
  }
  const [rot, gruen, blau] = kanale;
  return 0.2126 * linear(rot / 255) + 0.7152 * linear(gruen / 255) + 0.0722 * linear(blau / 255);
}

export function kontrast(a: string, b: string): number {
  const hell = Math.max(helligkeit(a), helligkeit(b));
  const dunkel = Math.min(helligkeit(a), helligkeit(b));
  return (hell + 0.05) / (dunkel + 0.05);
}

export function mische(von: string, nach: string, anteil: number): string {
  const quelle = kanaele(von) ?? [0, 0, 0];
  const ziel = kanaele(nach) ?? [0, 0, 0];
  const kanal = (index: number) => Math.round((quelle[index] ?? 0) * (1 - anteil) + (ziel[index] ?? 0) * anteil);
  const hex = (wert: number) => wert.toString(16).padStart(2, '0');
  return `#${hex(kanal(0))}${hex(kanal(1))}${hex(kanal(2))}`;
}

export function schriftAuf(farbe: string): '#000000' | '#ffffff' {
  return kontrast(farbe, '#000000') >= kontrast(farbe, '#ffffff') ? '#000000' : '#ffffff';
}

export function lesbareFarbe(farbe: string, hintergruende: readonly string[], mindest = MINDEST_KONTRAST): string {
  const mitte = hintergruende.reduce((summe, hintergrund) => summe + helligkeit(hintergrund), 0) / Math.max(1, hintergruende.length);
  const richtung = mitte > 0.4 ? '#000000' : '#ffffff';
  for (let schritt = 0; schritt <= 20; schritt += 1) {
    const kandidat = schritt === 0 ? farbe : mische(farbe, richtung, schritt / 20);
    if (hintergruende.every((hintergrund) => kontrast(kandidat, hintergrund) >= mindest)) {
      return kandidat;
    }
  }
  return richtung === '#000000' ? '#1a1a1a' : '#f5f5f6';
}

export function lesbareSchrift(hintergruende: readonly string[]): string {
  const probe = hintergruende[0] ?? '#000000';
  const ziel = kontrast('#17171c', probe) >= kontrast('#f5f5f6', probe) ? '#17171c' : '#f5f5f6';
  return lesbareFarbe(ziel, hintergruende);
}
