import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  ALTER TABLE attribute ADD COLUMN kennung TEXT;
  UPDATE attribute SET kennung = CASE id
      WHEN 1 THEN 'koerper' WHEN 2 THEN 'geist' WHEN 3 THEN 'disziplin' WHEN 4 THEN 'intellekt' WHEN 5 THEN 'soziales'
      WHEN 6 THEN 'einfluss' WHEN 7 THEN 'ressourcen' WHEN 8 THEN 'autoritaet' WHEN 9 THEN 'reichweite'
    END
    WHERE id BETWEEN 1 AND 9;
  CREATE UNIQUE INDEX attribute_kennung ON attribute(kennung);

  CREATE TABLE erfolge (
    schluessel TEXT PRIMARY KEY,
    erreicht_am TEXT NOT NULL
  );

  CREATE TABLE rueckblicke (
    woche TEXT PRIMARY KEY,
    gut TEXT NOT NULL DEFAULT '',
    lernen TEXT NOT NULL DEFAULT '',
    fokus TEXT NOT NULL DEFAULT '',
    belohnt INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    geaendert_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );
  `;
