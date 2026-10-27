export const sql = `
  CREATE TABLE kalender_importe (
    adresse TEXT NOT NULL,
    termin_id TEXT NOT NULL,
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE SET NULL,
    PRIMARY KEY (adresse, termin_id)
  );
  INSERT INTO kalender_importe (adresse, termin_id, eintrag_id)
  SELECT k.adresse, t.termin_id, t.eintrag_id
  FROM kalender_termine t
  JOIN kalender k ON k.id = t.kalender_id;
`;
