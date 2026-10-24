import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  CREATE TABLE aufgaben (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) <= 80),
    icon TEXT NOT NULL,
    projekt_id INTEGER REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    stunden REAL,
    faellig_am TEXT,
    wiederholung TEXT NOT NULL DEFAULT 'keine' CHECK (wiederholung IN ('keine', 'taeglich', 'woechentlich', 'monatlich')),
    wochentage TEXT,
    monatstag INTEGER CHECK (monatstag IS NULL OR monatstag BETWEEN 1 AND 31),
    prioritaet INTEGER CHECK (prioritaet IS NULL OR prioritaet BETWEEN 1 AND 4),
    nur_heute_am TEXT,
    faellig_um TEXT,
    organisation_id INTEGER REFERENCES organisationen(id),
    vision_id INTEGER REFERENCES visionen(id),
    meilenstein INTEGER NOT NULL DEFAULT 0,
    gegner INTEGER NOT NULL DEFAULT 0,
    boss INTEGER NOT NULL DEFAULT 0,
    deadline TEXT,
    angriff_bis TEXT,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    CHECK (vorlage_id IS NOT NULL OR projekt_id IS NOT NULL),
    CHECK (
      faellig_um IS NULL
      OR (
        faellig_am IS NOT NULL
        AND (
          faellig_um GLOB '[01][0-9]:[0-5][0-9]'
          OR faellig_um GLOB '2[0-3]:[0-5][0-9]'
        )
      )
    ),
    CHECK (gegner = 0 OR (meilenstein = 0 AND boss = 0 AND wiederholung = 'keine')),
    CHECK (boss = 0 OR (meilenstein = 1 AND gegner = 0 AND wiederholung = 'keine')),
    CHECK (deadline IS NULL OR gegner = 1 OR boss = 1)
  );

  CREATE TABLE aufgaben_erledigt (
    id INTEGER PRIMARY KEY,
    aufgabe_id INTEGER NOT NULL REFERENCES aufgaben(id),
    vorkommen TEXT NOT NULL,
    eintrag_id INTEGER NOT NULL UNIQUE REFERENCES eintraege(id) ON DELETE CASCADE,
    erledigt_am TEXT NOT NULL,
    UNIQUE (aufgabe_id, vorkommen)
  );

  ALTER TABLE xp_ereignisse ADD COLUMN aufgabe_id INTEGER REFERENCES aufgaben(id) ON DELETE CASCADE;
  CREATE INDEX xp_ereignisse_aufgabe ON xp_ereignisse(aufgabe_id);
  `;
