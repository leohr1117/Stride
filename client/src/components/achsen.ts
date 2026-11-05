/** Werte von 0 bis mindestens `maximum`. Der Abstand liegt in der Reihe 1, 2, 5. */
export function achsenSchritte(maximum: number, ziel = 4): number[] {
  if (!Number.isFinite(maximum) || maximum <= 0) {
    return [0];
  }
  const roh = maximum / Math.max(1, ziel);
  const zehner = 10 ** Math.floor(Math.log10(roh));
  const bruch = roh / zehner;
  const faktor = bruch <= 1 ? 1 : bruch <= 2 ? 2 : bruch <= 5 ? 5 : 10;
  let schritt = faktor * zehner;
  if (Number.isInteger(maximum) && schritt < 1) {
    schritt = 1;
  }
  const anzahl = Math.ceil(maximum / schritt - 1e-9);
  const werte: number[] = [];
  for (let index = 0; index <= anzahl; index += 1) {
    const wert = index * schritt;
    werte.push(Number.isInteger(schritt) ? wert : Math.round(wert * 1e6) / 1e6);
  }
  return werte;
}

export function yAchse(werte: readonly number[]): { ticks: number[]; domain: [number, number] } {
  let maximum = 0;
  for (const wert of werte) {
    if (wert > maximum) {
      maximum = wert;
    }
  }
  const ticks = achsenSchritte(maximum);
  const letzte = ticks[ticks.length - 1] ?? 0;
  return { ticks, domain: [0, letzte > 0 ? letzte : 1] };
}

/** 1 zeigt jede zweite Beschriftung, im gleichen Abstand der Kategorien. */
export function xIntervall(jedeZweite: boolean): 1 | 'preserveStartEnd' {
  return jedeZweite ? 1 : 'preserveStartEnd';
}
