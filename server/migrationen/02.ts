import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  ALTER TABLE vorhaben ADD COLUMN boss INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE vorhaben ADD COLUMN boss_hp REAL;
  ALTER TABLE vorhaben ADD COLUMN deadline TEXT;
  ALTER TABLE eintraege ADD COLUMN boss_schaden REAL;

  ALTER TABLE visionen ADD COLUMN woop_ergebnis TEXT NOT NULL DEFAULT '';
  ALTER TABLE visionen ADD COLUMN woop_hindernis TEXT NOT NULL DEFAULT '';
  ALTER TABLE visionen ADD COLUMN woop_plan TEXT NOT NULL DEFAULT '';

  CREATE TABLE faehigkeiten (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    farbe TEXT NOT NULL,
    icon TEXT NOT NULL,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  ALTER TABLE eintraege ADD COLUMN faehigkeit_id INTEGER REFERENCES faehigkeiten(id);
  CREATE INDEX eintraege_faehigkeit ON eintraege(faehigkeit_id);

  CREATE TABLE skill_knoten (
    id INTEGER PRIMARY KEY,
    faehigkeit_id INTEGER NOT NULL REFERENCES faehigkeiten(id) ON DELETE CASCADE,
    eltern_id INTEGER REFERENCES skill_knoten(id) ON DELETE CASCADE,
    titel TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE SET NULL,
    freigeschaltet_am TEXT,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );
  CREATE INDEX skill_knoten_faehigkeit ON skill_knoten(faehigkeit_id);

  CREATE TABLE faehigkeit_xp (
    id INTEGER PRIMARY KEY,
    quelle TEXT NOT NULL,
    faehigkeit_id INTEGER NOT NULL REFERENCES faehigkeiten(id),
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX faehigkeit_xp_faehigkeit ON faehigkeit_xp(faehigkeit_id);
  `;
