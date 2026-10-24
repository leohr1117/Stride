export const sql = `
  ALTER TABLE projekte ADD COLUMN abschluss_vorlage_id INTEGER REFERENCES vorlagen(id);
  ALTER TABLE projekte ADD COLUMN abschluss_bonus_am TEXT;
  UPDATE projekte SET abschluss_bonus_am = geschafft_am WHERE geschafft_am IS NOT NULL;
  `;
