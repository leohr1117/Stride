import { verteileNachGewichten, type XpAnteil } from './xp.ts';

export interface XpStand {
  attributId: number;
  xp: number;
}

const GLEICHES_GEWICHT = 1;

export function zielXpNachAnteil(anteil: number, gesamtXp: number): number {
  return Math.max(0, Math.round(anteil * gesamtXp));
}

export function planeUmverteilung(zielId: number, zielXp: number, staende: XpStand[]): XpAnteil[] {
  const ziel = staende.find((stand) => stand.attributId === zielId);
  const andere = staende.filter((stand) => stand.attributId !== zielId);
  const differenz = Math.round(zielXp) - (ziel?.xp ?? 0);
  if (differenz === 0 || andere.length === 0) {
    return [];
  }

  const gewichte = andere.map((stand) => ({ attributId: stand.attributId, gewicht: Math.max(0, stand.xp) }));
  let verfuegbar = 0;
  for (const gewicht of gewichte) {
    verfuegbar += gewicht.gewicht;
  }

  if (differenz > 0) {
    const betrag = Math.min(differenz, verfuegbar);
    if (betrag === 0) {
      return [];
    }
    const abzuege = verteileNachGewichten(betrag, gewichte).map((anteil) => ({ attributId: anteil.attributId, xp: -anteil.xp }));
    return [{ attributId: zielId, xp: betrag }, ...abzuege];
  }

  const betrag = -differenz;
  const verteilung = verfuegbar > 0 ? gewichte : andere.map((stand) => ({ attributId: stand.attributId, gewicht: GLEICHES_GEWICHT }));
  return [{ attributId: zielId, xp: -betrag }, ...verteileNachGewichten(betrag, verteilung)];
}
