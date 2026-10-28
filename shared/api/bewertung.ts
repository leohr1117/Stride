/** Antwort von POST /api/bewertung. Die Werte verlassen den Server nur hier. */
export interface BewertungStand {
  wert: number | null;
  am: string | null;
  nie: boolean;
}
