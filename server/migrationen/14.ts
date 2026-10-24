export const sql = `
  CREATE TABLE todoist_projekte (
    todoist_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    projekt_id INTEGER REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    stunden REAL,
    sortierung INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE todoist_erledigt (
    ereignis_id TEXT PRIMARY KEY,
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE SET NULL,
    erledigt_am TEXT NOT NULL
  );
  CREATE TABLE kalender (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    adresse TEXT NOT NULL,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    filter TEXT NOT NULL DEFAULT '',
    seit TEXT NOT NULL,
    letzter_abgleich TEXT,
    fehler TEXT
  );
  CREATE TABLE kalender_termine (
    kalender_id INTEGER NOT NULL REFERENCES kalender(id) ON DELETE CASCADE,
    termin_id TEXT NOT NULL,
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE SET NULL,
    PRIMARY KEY (kalender_id, termin_id)
  );
  `;
