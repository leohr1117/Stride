/**
 * Prozentpunkte zu Gewichten. Die Summe ist 100, sobald ein Gewicht größer als 0 ist.
 * Der Rest nach dem Abrunden geht an den größten Rundungsrest, bei Gleichstand an den früheren Eintrag.
 */
export function anteileInProzent(gewichte: readonly number[]): number[] {
  const beitrag = gewichte.map((gewicht) => (gewicht > 0 ? gewicht : 0));
  let summe = 0;
  for (const gewicht of beitrag) {
    summe += gewicht;
  }
  if (summe <= 0) {
    return gewichte.map(() => 0);
  }

  const basis: number[] = [];
  const reste: { index: number; rest: number }[] = [];
  let verteilt = 0;
  for (let index = 0; index < beitrag.length; index++) {
    const gewicht = beitrag[index] ?? 0;
    if (gewicht === 0) {
      basis.push(0);
      reste.push({ index, rest: -1 });
      continue;
    }
    const produkt = gewicht * 100;
    const ganz = Math.floor(produkt / summe);
    basis.push(ganz);
    verteilt += ganz;
    reste.push({ index, rest: produkt - ganz * summe });
  }

  const reihenfolge = [...reste].sort((links, rechts) => rechts.rest - links.rest || links.index - rechts.index);
  let uebrig = 100 - verteilt;
  for (const eintrag of reihenfolge) {
    if (uebrig <= 0) {
      break;
    }
    if ((beitrag[eintrag.index] ?? 0) === 0) {
      continue;
    }
    basis[eintrag.index] = (basis[eintrag.index] ?? 0) + 1;
    uebrig -= 1;
  }
  return basis;
}
