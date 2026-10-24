import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  CREATE TABLE projekte_neu (
    id INTEGER PRIMARY KEY,
    vision_id INTEGER REFERENCES visionen(id),
    organisation_id INTEGER REFERENCES organisationen(id),
    standard_vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id),
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    CHECK (vision_id IS NULL OR organisation_id IS NULL)
  );
  INSERT INTO projekte_neu (id, vision_id, organisation_id, standard_vorlage_id, name, beschreibung, archiviert, erstellt_am)
    SELECT id, vision_id, organisation_id, standard_vorlage_id, name, beschreibung, archiviert, erstellt_am FROM projekte;
  DROP TABLE projekte;
  ALTER TABLE projekte_neu RENAME TO projekte;
  CREATE INDEX projekte_vision ON projekte(vision_id);
  CREATE INDEX projekte_organisation ON projekte(organisation_id);

  CREATE TABLE vorhaben_neu (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER REFERENCES projekte(id),
    vorgaenger_id INTEGER UNIQUE REFERENCES vorhaben(id),
    titel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'geschafft', 'gescheitert', 'losgelassen')),
    anlauf INTEGER NOT NULL DEFAULT 1,
    erkenntnis TEXT NOT NULL DEFAULT '',
    weitermachen_eingeloest INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    abgeschlossen_am TEXT,
    boss INTEGER NOT NULL DEFAULT 0,
    boss_hp REAL,
    deadline TEXT,
    angriff_bis TEXT,
    boss_level INTEGER
  );
  INSERT INTO vorhaben_neu (
    id, projekt_id, vorgaenger_id, titel, status, anlauf, erkenntnis, weitermachen_eingeloest, erstellt_am, abgeschlossen_am,
    boss, boss_hp, deadline, angriff_bis, boss_level
  )
    SELECT id, projekt_id, vorgaenger_id, titel, status, anlauf, erkenntnis, weitermachen_eingeloest, erstellt_am, abgeschlossen_am,
           boss, boss_hp, deadline, angriff_bis, boss_level
    FROM vorhaben;
  DROP TABLE vorhaben;
  ALTER TABLE vorhaben_neu RENAME TO vorhaben;
  CREATE INDEX vorhaben_projekt ON vorhaben(projekt_id, status);

  CREATE TABLE eintraege_neu (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER REFERENCES projekte(id),
    vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id),
    vorhaben_id INTEGER REFERENCES vorhaben(id),
    abschluss TEXT CHECK (abschluss IN ('geschafft', 'gescheitert')),
    stunden REAL,
    notiz TEXT NOT NULL DEFAULT '',
    meilenstein INTEGER NOT NULL DEFAULT 0,
    krit INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL,
    boss_schaden REAL,
    faehigkeit_id INTEGER REFERENCES faehigkeiten(id),
    ausruestung_bonus REAL NOT NULL DEFAULT 0,
    faktor REAL NOT NULL DEFAULT 1,
    gewohnheit_id INTEGER REFERENCES gewohnheiten(id),
    gewohnheit_minimal INTEGER NOT NULL DEFAULT 0,
    basis_aufgabe_id INTEGER REFERENCES basis_aufgaben(id)
  );
  INSERT INTO eintraege_neu (
    id, projekt_id, vorlage_id, vorhaben_id, abschluss, stunden, notiz, meilenstein, krit, erstellt_am,
    boss_schaden, faehigkeit_id, ausruestung_bonus, faktor, gewohnheit_id, gewohnheit_minimal, basis_aufgabe_id
  )
    SELECT id, projekt_id, vorlage_id, vorhaben_id, abschluss, stunden, notiz, meilenstein, krit, erstellt_am,
           boss_schaden, faehigkeit_id, ausruestung_bonus, faktor, gewohnheit_id, gewohnheit_minimal, basis_aufgabe_id
    FROM eintraege;
  DROP TABLE eintraege;
  ALTER TABLE eintraege_neu RENAME TO eintraege;
  CREATE INDEX eintraege_erstellt ON eintraege(erstellt_am);
  CREATE INDEX eintraege_projekt ON eintraege(projekt_id, erstellt_am);
  CREATE INDEX eintraege_vorhaben ON eintraege(vorhaben_id);
  CREATE INDEX eintraege_faehigkeit ON eintraege(faehigkeit_id);
  CREATE INDEX eintraege_gewohnheit ON eintraege(gewohnheit_id);
  CREATE INDEX eintraege_basis ON eintraege(basis_aufgabe_id);

  CREATE TABLE basis_aufgaben_neu (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER REFERENCES projekte(id),
    vorlage_id INTEGER REFERENCES vorlagen(id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    stunden REAL
  );
  INSERT INTO basis_aufgaben_neu (id, projekt_id, vorlage_id, name, icon, archiviert, erstellt_am, stunden)
    SELECT id, projekt_id, vorlage_id, name, icon, archiviert, erstellt_am, stunden FROM basis_aufgaben;
  DROP TABLE basis_aufgaben;
  ALTER TABLE basis_aufgaben_neu RENAME TO basis_aufgaben;

  CREATE TABLE gewohnheiten_neu (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER REFERENCES projekte(id),
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
  INSERT INTO gewohnheiten_neu (
    id, projekt_id, vorlage_id, name, icon, rhythmus, ziel_pro_woche, ausloeser, minimalversion, archiviert, erstellt_am
  )
    SELECT id, projekt_id, vorlage_id, name, icon, rhythmus, ziel_pro_woche, ausloeser, minimalversion, archiviert, erstellt_am
    FROM gewohnheiten;
  DROP TABLE gewohnheiten;
  ALTER TABLE gewohnheiten_neu RENAME TO gewohnheiten;
  `;
