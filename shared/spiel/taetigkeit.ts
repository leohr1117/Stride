export interface TaetigkeitZuordnung {
  id: number;
  projektId: number | null;
  archiviert?: boolean;
}

export function taetigkeitPasst(vorlageProjektId: number | null, projektId: number | null): boolean {
  return vorlageProjektId === null || vorlageProjektId === projektId;
}

export function taetigkeitenFuerProjekt<T extends TaetigkeitZuordnung>(
  vorlagen: readonly T[],
  projektId: number | null,
  behaltenId: number | null = null,
): T[] {
  return vorlagen.filter(
    (vorlage) => taetigkeitPasst(vorlage.projektId, projektId) && (vorlage.archiviert !== true || vorlage.id === behaltenId),
  );
}
