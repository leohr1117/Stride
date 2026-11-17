export const sql = `
  ALTER TABLE eintraege ADD COLUMN nur_abzug INTEGER NOT NULL DEFAULT 0 CHECK (nur_abzug IN (0, 1));
`;
