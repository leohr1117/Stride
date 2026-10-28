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

function passt(farbe: string, hintergruende: readonly string[], mindest: number): boolean {
  return hintergruende.every((hintergrund) => kontrast(farbe, hintergrund) >= mindest);
}

export function lesbareFarbe(
  farbe: string,
  hintergruende: readonly string[],
  mindest = MINDEST_KONTRAST,
  richtung?: string,
): string {
  const mitte = hintergruende.reduce((summe, hintergrund) => summe + helligkeit(hintergrund), 0) / Math.max(1, hintergruende.length);
  const ziel = richtung ?? (mitte > 0.4 ? '#000000' : '#ffffff');
  for (let schritt = 0; schritt <= 20; schritt += 1) {
    const kandidat = schritt === 0 ? farbe : mische(farbe, ziel, schritt / 20);
    if (passt(kandidat, hintergruende, mindest)) {
      return kandidat;
    }
  }
  if (richtung && passt(richtung, hintergruende, mindest)) {
    return richtung;
  }
  const dunkel = richtung ? helligkeit(ziel) < 0.5 : mitte > 0.4;
  return dunkel ? '#1a1a1a' : '#f5f5f6';
}

function rgbZuHsl(rot: number, gruen: number, blau: number): { h: number; s: number; l: number } {
  const r = rot / 255;
  const g = gruen / 255;
  const b = blau / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const spanne = max - min;
  if (spanne === 0) {
    return { h: 0, s: 0, l };
  }
  const s = spanne / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) {
    h = ((g - b) / spanne) % 6;
  } else if (max === g) {
    h = (b - r) / spanne + 2;
  } else {
    h = (r - g) / spanne + 4;
  }
  h *= 60;
  if (h < 0) {
    h += 360;
  }
  return { h, s, l };
}

function hslZuHex(h: number, s: number, l: number): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const basis = l - chroma / 2;
  let rot = 0;
  let gruen = 0;
  let blau = 0;
  if (h < 60) {
    rot = chroma;
    gruen = x;
  } else if (h < 120) {
    rot = x;
    gruen = chroma;
  } else if (h < 180) {
    gruen = chroma;
    blau = x;
  } else if (h < 240) {
    gruen = x;
    blau = chroma;
  } else if (h < 300) {
    rot = x;
    blau = chroma;
  } else {
    rot = chroma;
    blau = x;
  }
  const kanal = (wert: number) => Math.round(Math.min(255, Math.max(0, (wert + basis) * 255)));
  const hex = (wert: number) => kanal(wert).toString(16).padStart(2, '0');
  return `#${hex(rot)}${hex(gruen)}${hex(blau)}`;
}

function mischeBis(farbe: string, ziel: string, hintergruende: readonly string[], mindest: number): string | null {
  for (let schritt = 1; schritt <= 16; schritt += 1) {
    const kandidat = mische(farbe, ziel, schritt / 20);
    if (passt(kandidat, hintergruende, mindest)) {
      return kandidat;
    }
  }
  return null;
}

function lichtBis(farbe: string, hintergruende: readonly string[], mindest: number, aufhellen: boolean): string | null {
  const kanale = kanaele(farbe);
  if (!kanale) {
    return null;
  }
  const { h, s, l } = rgbZuHsl(kanale[0], kanale[1], kanale[2]);
  if (s < 0.08) {
    return null;
  }
  const start = Math.round(l * 100);
  const ende = aufhellen ? 92 : 8;
  const schritt = aufhellen ? 2 : -2;
  for (let prozent = start; aufhellen ? prozent <= ende : prozent >= ende; prozent += schritt) {
    const kandidat = hslZuHex(h, s, prozent / 100);
    if (passt(kandidat, hintergruende, mindest)) {
      return kandidat;
    }
  }
  return null;
}

/** Helligkeit in Richtung von `richtung`. Der Farbton bleibt, Orange bleibt Orange. */
export function farbtonHalten(farbe: string, hintergruende: readonly string[], richtung: string, mindest: number): string {
  if (passt(farbe, hintergruende, mindest)) {
    return farbe;
  }
  // Zuerst die Helligkeit von --haupt. Reicht das nicht, die andere, sonst bleibt der Kontrast unter dem Mindestwert.
  const pole = helligkeit(richtung) >= 0.5 ? (['#ffffff', '#000000'] as const) : (['#000000', '#ffffff'] as const);
  for (const pol of pole) {
    const gemischt = mischeBis(farbe, pol, hintergruende, mindest);
    if (gemischt) {
      return gemischt;
    }
    const geschoben = lichtBis(farbe, hintergruende, mindest, pol === '#ffffff');
    if (geschoben) {
      return geschoben;
    }
  }
  return farbe;
}

export function lesbareSchrift(hintergruende: readonly string[]): string {
  const probe = hintergruende[0] ?? '#000000';
  const ziel = kontrast('#17171c', probe) >= kontrast('#f5f5f6', probe) ? '#17171c' : '#f5f5f6';
  return lesbareFarbe(ziel, hintergruende);
}
