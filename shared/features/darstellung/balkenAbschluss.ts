import { helligkeit, mische } from '../../spiel/farben.ts';
import type { FarbSchema } from './bedeutung.ts';

/** Nicht-Text gegen den Track, WCAG 1.4.11. */
export const FUELL_KONTRAST = 3;

/** Letzte 24 px: etwa 25 % heller als die Balkenfarbe. */
export const VERLAUF_HELLER = 0.25;

/** Spitze in dunklen Ansichten, noch etwas heller als der Verlauf. */
export const SPITZE_HELLER = 0.4;

/** Spitze in hellen Ansichten, ein Ton dunkler. */
export const SPITZE_DUNKLER = 0.18;

export function verlaufTon(farbe: string): string {
  return mische(farbe, '#ffffff', VERLAUF_HELLER);
}

export function spitzeTon(farbe: string, schema: FarbSchema): string {
  return schema === 'light' ? mische(farbe, '#000000', SPITZE_DUNKLER) : mische(farbe, '#ffffff', SPITZE_HELLER);
}

/** Hellster und dunkelster Ton der Füllung. Der Verlauf läuft von der Balkenfarbe zum helleren Ende. */
export function fuellToene(farbe: string): { hell: string; dunkel: string } {
  const ende = verlaufTon(farbe);
  if (helligkeit(ende) >= helligkeit(farbe)) {
    return { hell: ende, dunkel: farbe };
  }
  return { hell: farbe, dunkel: ende };
}
