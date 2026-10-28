/** Stand für Heute. `schutz` ist nur wahr, wenn genau eine Brücke die Länge von 0 auf die alte Länge hebt. */
export interface KetteHeute {
  schutz: boolean;
  rueckkehr: { fristAm: string } | null;
  angeschlagen: { laenge: number } | null;
}

/** Antwort von POST /api/kette/schutz. Keine XP. */
export interface SchutzErgebnis {
  serie: { laenge: number; angeknackst: boolean };
  schutz: boolean;
}
