import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  CREATE TABLE uebungen (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) <= 80),
    art TEXT NOT NULL CHECK (art IN ('kraft', 'dauer')),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE trainingsplaene (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) <= 80),
    wochentage TEXT,
    vorlage_id INTEGER REFERENCES vorlagen(id),
    projekt_id INTEGER REFERENCES projekte(id),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE trainingsplan_uebungen (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES trainingsplaene(id) ON DELETE CASCADE,
    uebung_id INTEGER NOT NULL REFERENCES uebungen(id),
    reihenfolge INTEGER NOT NULL,
    ziel_saetze INTEGER NOT NULL CHECK (ziel_saetze BETWEEN 1 AND 20),
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

  CREATE TABLE trainingseinheiten (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER REFERENCES trainingsplaene(id),
    eintrag_id INTEGER UNIQUE REFERENCES eintraege(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('offen', 'fertig')),
    begonnen_am TEXT NOT NULL,
    beendet_am TEXT,
    krit_festgelegt INTEGER NOT NULL DEFAULT 0 CHECK (krit_festgelegt = 0)
  );

  CREATE TABLE trainingssaetze (
    id INTEGER PRIMARY KEY,
    einheit_id INTEGER NOT NULL REFERENCES trainingseinheiten(id) ON DELETE CASCADE,
    uebung_id INTEGER NOT NULL REFERENCES uebungen(id),
    reihenfolge INTEGER NOT NULL,
    gewicht_g INTEGER,
    wiederholungen INTEGER CHECK (wiederholungen IS NULL OR wiederholungen >= 1),
    sekunden INTEGER CHECK (sekunden IS NULL OR sekunden >= 1),
    aufwaermen INTEGER NOT NULL DEFAULT 0,
    erledigt INTEGER NOT NULL DEFAULT 0,
    CHECK (wiederholungen IS NULL OR sekunden IS NULL),
    CHECK (sekunden IS NULL OR gewicht_g IS NULL)
  );

  CREATE TABLE bestwerte (
    id INTEGER PRIMARY KEY,
    uebung_id INTEGER NOT NULL REFERENCES uebungen(id),
    art TEXT NOT NULL CHECK (art IN ('gewicht', 'eins', 'dauer')),
    wert INTEGER NOT NULL CHECK (wert > 0),
    wiederholungen INTEGER,
    satz_id INTEGER NOT NULL REFERENCES trainingssaetze(id) ON DELETE CASCADE,
    erreicht_am TEXT NOT NULL,
    CHECK (
      (art = 'dauer' AND wiederholungen IS NULL)
      OR (art IN ('gewicht', 'eins') AND wiederholungen IS NOT NULL AND wiederholungen >= 1)
    )
  );
  `;
