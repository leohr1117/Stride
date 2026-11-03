export const sql = `
  ALTER TABLE investitionen ADD COLUMN bezahlt_attribut_id INTEGER REFERENCES attribute(id);
  ALTER TABLE investitionen ADD COLUMN betrag INTEGER NOT NULL DEFAULT 0 CHECK (betrag >= 0);
  ALTER TABLE xp_ereignisse ADD COLUMN investition_id INTEGER;
  CREATE INDEX xp_ereignisse_investition ON xp_ereignisse(investition_id);
`;
