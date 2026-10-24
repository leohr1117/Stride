export interface BaumKnoten {
  id: number;
  elternId: number | null;
}

export interface BaumPosition {
  spalte: number;
  ebene: number;
}

export interface BaumLayout {
  positionen: Map<number, BaumPosition>;
  kinder: Map<number | null, number[]>;
  wurzel: BaumPosition;
  spalten: number;
  ebenen: number;
}

export function berechneBaum(knoten: BaumKnoten[]): BaumLayout {
  const vorhanden = new Set(knoten.map((eintrag) => eintrag.id));
  const kinder = new Map<number | null, number[]>();
  for (const eintrag of knoten) {
    const elternId = eintrag.elternId !== null && vorhanden.has(eintrag.elternId) ? eintrag.elternId : null;
    kinder.set(elternId, [...(kinder.get(elternId) ?? []), eintrag.id]);
  }

  const positionen = new Map<number, BaumPosition>();
  const besucht = new Set<number>();
  let naechsteSpalte = 0;
  let tiefsteEbene = 0;

  const setze = (id: number | null, ebene: number): number => {
    tiefsteEbene = Math.max(tiefsteEbene, ebene);
    const eigeneKinder = (kinder.get(id) ?? []).filter((kind) => !besucht.has(kind));
    let spalte: number;
    if (eigeneKinder.length === 0) {
      spalte = naechsteSpalte;
      naechsteSpalte += 1;
    } else {
      const spalten = eigeneKinder.map((kind) => {
        besucht.add(kind);
        return setze(kind, ebene + 1);
      });
      spalte = (spalten[0] + spalten[spalten.length - 1]) / 2;
    }
    if (id !== null) {
      positionen.set(id, { spalte, ebene });
    }
    return spalte;
  };

  const wurzelSpalte = setze(null, 0);
  return {
    positionen,
    kinder,
    wurzel: { spalte: wurzelSpalte, ebene: 0 },
    spalten: Math.max(1, naechsteSpalte),
    ebenen: tiefsteEbene + 1,
  };
}
