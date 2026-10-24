export const sql = `
  ALTER TABLE todoist_projekte ADD COLUMN ziel_art TEXT;
  ALTER TABLE todoist_projekte ADD COLUMN ziel_id INTEGER;
  ALTER TABLE todoist_projekte ADD COLUMN faehigkeit_id INTEGER;
  ALTER TABLE todoist_projekte ADD COLUMN abschluss TEXT;
  ALTER TABLE todoist_projekte ADD COLUMN erkenntnis TEXT NOT NULL DEFAULT '';
  ALTER TABLE todoist_projekte ADD COLUMN notiz TEXT NOT NULL DEFAULT '';
  ALTER TABLE todoist_projekte ADD COLUMN meilenstein INTEGER;
  UPDATE todoist_projekte SET ziel_art = 'projekt', ziel_id = projekt_id WHERE projekt_id IS NOT NULL;
  CREATE TABLE todoist_labels (
    todoist_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sortierung INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    aktiv INTEGER NOT NULL DEFAULT 0,
    ziel_art TEXT,
    ziel_id INTEGER,
    projekt_id INTEGER,
    vorlage_id INTEGER,
    stunden REAL,
    faehigkeit_id INTEGER,
    abschluss TEXT,
    erkenntnis TEXT NOT NULL DEFAULT '',
    notiz TEXT NOT NULL DEFAULT '',
    meilenstein INTEGER
  );
  `;
