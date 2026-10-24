export const MOMENTUM = {
  plusProVerdopplung: 0.25,
  tageProStufe: 7,
  rundung: 100,
} as const;

export function momentumFuerSerie(serienLaenge: number): number {
  const laenge = Math.max(0, serienLaenge);
  const momentum = 1 + MOMENTUM.plusProVerdopplung * Math.log2(1 + laenge / MOMENTUM.tageProStufe);
  return Math.round(momentum * MOMENTUM.rundung) / MOMENTUM.rundung;
}
