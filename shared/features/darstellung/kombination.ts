import { farbtonHalten, kontrast, lesbareFarbe, MINDEST_KONTRAST } from '../../spiel/farben.ts';
import { bedeutungsfarben } from './bedeutung.ts';
import { wacheKontrast } from './kontrastWaechter.ts';
import { type Erscheinung } from './paletten.ts';
import { type Stil } from './stile.ts';

const RAHMEN = 3;

const AKZENT_ALS_TEXT: ReadonlySet<Stil> = new Set(['jade', 'holo', 'antik']);

export interface KombinationsFarben {
  haupt: string;
  leise: string;
  akzentSchrift: string;
  rahmen: string;
  symbol: string;
  aktionText: string;
  fortschritt: string;
  gefahr: string;
}

function haelt(farbe: string, hintergruende: readonly string[], mindest: number): boolean {
  return hintergruende.every((grund) => kontrast(farbe, grund) >= mindest);
}

function sicher(farbe: string, hintergruende: readonly string[], mindest: number, richtung: string): string {
  const gehalten = farbtonHalten(farbe, hintergruende, richtung, mindest);
  if (haelt(gehalten, hintergruende, mindest)) {
    return gehalten;
  }
  const gelesen = lesbareFarbe(farbe, hintergruende, mindest, richtung);
  if (haelt(gelesen, hintergruende, mindest)) {
    return gelesen;
  }
  const dunkel = '#141414';
  const hell = '#f2f2f2';
  let beste = dunkel;
  let wert = 0;
  for (const kandidat of [dunkel, hell]) {
    const summe = hintergruende.reduce((bisher, grund) => Math.min(bisher, kontrast(kandidat, grund)), Number.POSITIVE_INFINITY);
    if (summe > wert) {
      wert = summe;
      beste = kandidat;
    }
  }
  return beste;
}

export function kombination(bild: Erscheinung, stil: Stil): KombinationsFarben {
  const fest = bedeutungsfarben(bild.flaechen.schema);
  const wache = wacheKontrast(bild, fest);
  const flaechen = [bild.hintergrund, wache.flaeche, wache.flaeche2];
  const akzentSchrift = AKZENT_ALS_TEXT.has(stil)
    ? sicher(bild.primaer, flaechen, MINDEST_KONTRAST, wache.haupt)
    : bild.primaer;
  const rahmen = AKZENT_ALS_TEXT.has(stil)
    ? sicher(bild.flaechen.rand, [wache.flaeche, bild.hintergrund], RAHMEN, wache.haupt)
    : wache.feldrand;
  return {
    haupt: wache.haupt,
    leise: wache.leise,
    akzentSchrift,
    rahmen,
    symbol: sicher(bild.primaer, flaechen, RAHMEN, wache.haupt),
    aktionText: wache.aktionText,
    fortschritt: fest.fortschritt,
    gefahr: fest.gefahr,
  };
}
