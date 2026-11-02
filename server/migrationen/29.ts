export const sql = `
  CREATE TABLE kalender_neu (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    adresse TEXT NOT NULL,
    projekt_id INTEGER REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    filter TEXT NOT NULL DEFAULT '',
    seit TEXT NOT NULL,
    letzter_abgleich TEXT,
    fehler TEXT,
    CHECK (projekt_id IS NOT NULL OR vorlage_id IS NOT NULL)
  );
  INSERT INTO kalender_neu (id, name, adresse, projekt_id, vorlage_id, filter, seit, letzter_abgleich, fehler)
    SELECT id, name, adresse, projekt_id, vorlage_id, filter, seit, letzter_abgleich, fehler FROM kalender;
  DROP TABLE kalender;
  ALTER TABLE kalender_neu RENAME TO kalender;
`;
