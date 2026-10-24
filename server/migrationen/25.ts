export const sql = `
  CREATE TABLE trainingsplan_uebungen_neu (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES trainingsplaene(id) ON DELETE CASCADE,
    uebung_id INTEGER NOT NULL REFERENCES uebungen(id),
    reihenfolge INTEGER NOT NULL,
    ziel_saetze INTEGER CHECK (ziel_saetze IS NULL OR ziel_saetze BETWEEN 1 AND 20),
    ziel_wiederholungen INTEGER CHECK (ziel_wiederholungen IS NULL OR ziel_wiederholungen >= 1),
    ziel_gewicht_g INTEGER,
    ziel_sekunden INTEGER CHECK (ziel_sekunden IS NULL OR ziel_sekunden >= 1),
    aufwaerm_saetze INTEGER CHECK (aufwaerm_saetze IS NULL OR aufwaerm_saetze BETWEEN 1 AND 20),
    aufwaerm_wiederholungen INTEGER CHECK (aufwaerm_wiederholungen IS NULL OR aufwaerm_wiederholungen >= 1),
    aufwaerm_gewicht_g INTEGER,
    aufwaerm_sekunden INTEGER CHECK (aufwaerm_sekunden IS NULL OR aufwaerm_sekunden >= 1),
    CHECK (ziel_wiederholungen IS NULL OR ziel_sekunden IS NULL),
    CHECK (ziel_sekunden IS NULL OR ziel_gewicht_g IS NULL),
    CHECK (aufwaerm_wiederholungen IS NULL OR aufwaerm_sekunden IS NULL),
    CHECK (aufwaerm_sekunden IS NULL OR aufwaerm_gewicht_g IS NULL)
  );
  INSERT INTO trainingsplan_uebungen_neu (
    id, plan_id, uebung_id, reihenfolge, ziel_saetze, ziel_wiederholungen, ziel_gewicht_g, ziel_sekunden,
    aufwaerm_saetze, aufwaerm_wiederholungen, aufwaerm_gewicht_g, aufwaerm_sekunden
  )
  SELECT
    id, plan_id, uebung_id, reihenfolge, ziel_saetze, ziel_wiederholungen, ziel_gewicht_g, ziel_sekunden,
    aufwaerm_saetze, aufwaerm_wiederholungen, aufwaerm_gewicht_g, aufwaerm_sekunden
  FROM trainingsplan_uebungen;
  DROP TABLE trainingsplan_uebungen;
  ALTER TABLE trainingsplan_uebungen_neu RENAME TO trainingsplan_uebungen;
`;
