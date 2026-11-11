import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  CREATE TABLE investitionen_neu (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'gem',
    groesse INTEGER NOT NULL CHECK (groesse BETWEEN 0 AND 3),
    bonus REAL NOT NULL,
    ziel_art TEXT,
    ziel_id INTEGER,
    attribut_id INTEGER REFERENCES attribute(id),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    bezahlt_attribut_id INTEGER REFERENCES attribute(id),
    betrag INTEGER NOT NULL DEFAULT 0 CHECK (betrag >= 0),
    CHECK (attribut_id IS NOT NULL OR (ziel_art IS NOT NULL AND ziel_id IS NOT NULL)),
    CHECK (ziel_art IS NULL OR ziel_art IN ('vision', 'projekt', 'attribut')),
    CHECK (NOT (attribut_id IS NULL AND ziel_art = 'attribut'))
  );
  INSERT INTO investitionen_neu (
    id, name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id,
    archiviert, erstellt_am, bezahlt_attribut_id, betrag
  )
  SELECT
    id, name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id,
    archiviert, erstellt_am, bezahlt_attribut_id, betrag
  FROM investitionen;
  DROP TABLE investitionen;
  ALTER TABLE investitionen_neu RENAME TO investitionen;
  CREATE INDEX investitionen_attribut ON investitionen(attribut_id);
`;
