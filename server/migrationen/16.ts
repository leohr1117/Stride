export const sql = `
  ALTER TABLE vorlagen ADD COLUMN projekt_id INTEGER REFERENCES projekte(id);
  CREATE INDEX vorlagen_projekt ON vorlagen(projekt_id);
  `;
