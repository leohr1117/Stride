export const sql = `
  ALTER TABLE vorlagen ADD COLUMN feste_anteile INTEGER NOT NULL DEFAULT 0 CHECK (feste_anteile IN (0, 1));
  CREATE TABLE vorlage_abzuege (
    vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id) ON DELETE CASCADE,
    attribut_id INTEGER NOT NULL REFERENCES attribute(id),
    prozent INTEGER NOT NULL CHECK (prozent BETWEEN 1 AND 100),
    PRIMARY KEY (vorlage_id, attribut_id)
  );
`;
