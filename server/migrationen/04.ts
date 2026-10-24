import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  DROP TABLE gold_buchungen;
  DROP TABLE kaeufe;
  DROP TABLE shop_artikel;

  UPDATE attribute SET rolle = 'ressourcen' WHERE id = 7 AND typ = 'status' AND rolle IS NULL;

  INSERT INTO vorlagen (name, icon, sortierung)
    SELECT 'Arbeiten', 'briefcase', COALESCE(MAX(sortierung), 0) + 1 FROM vorlagen
    WHERE NOT EXISTS (SELECT 1 FROM vorlagen WHERE name = 'Arbeiten');
  INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht)
    SELECT v.id, a.id, g.gewicht
    FROM (SELECT 7 AS attribut, 50 AS gewicht UNION ALL SELECT 3, 30 UNION ALL SELECT 4, 20) g
    JOIN vorlagen v ON v.name = 'Arbeiten'
    JOIN attribute a ON a.id = g.attribut
    WHERE NOT EXISTS (SELECT 1 FROM vorlage_gewichte WHERE vorlage_id = v.id);

  ALTER TABLE eintraege ADD COLUMN faktor REAL NOT NULL DEFAULT 1;
  UPDATE eintraege SET faktor = 1 + ausruestung_bonus;

  CREATE TABLE gewohnheiten (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    rhythmus TEXT NOT NULL CHECK (rhythmus IN ('taeglich', 'woechentlich')),
    ziel_pro_woche INTEGER NOT NULL DEFAULT 7,
    ausloeser TEXT NOT NULL DEFAULT '',
    minimalversion TEXT NOT NULL DEFAULT '',
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE basis_aufgaben (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    intervall_tage INTEGER NOT NULL CHECK (intervall_tage > 0),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  ALTER TABLE eintraege ADD COLUMN gewohnheit_id INTEGER REFERENCES gewohnheiten(id);
  ALTER TABLE eintraege ADD COLUMN gewohnheit_minimal INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE eintraege ADD COLUMN basis_aufgabe_id INTEGER REFERENCES basis_aufgaben(id);
  CREATE INDEX eintraege_gewohnheit ON eintraege(gewohnheit_id);
  CREATE INDEX eintraege_basis ON eintraege(basis_aufgabe_id);
  `;
