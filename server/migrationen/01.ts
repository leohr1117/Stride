import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  CREATE TABLE einstellungen (
    schluessel TEXT PRIMARY KEY,
    wert TEXT NOT NULL
  );

  CREATE TABLE attribute (
    id INTEGER PRIMARY KEY,
    typ TEXT NOT NULL CHECK (typ IN ('attribut', 'status')),
    rolle TEXT UNIQUE,
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    farbe TEXT NOT NULL,
    icon TEXT NOT NULL,
    sortierung INTEGER NOT NULL DEFAULT 0,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE vorlagen (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    sortierung INTEGER NOT NULL DEFAULT 0,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE vorlage_gewichte (
    vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id) ON DELETE CASCADE,
    attribut_id INTEGER NOT NULL REFERENCES attribute(id),
    gewicht INTEGER NOT NULL CHECK (gewicht > 0),
    PRIMARY KEY (vorlage_id, attribut_id)
  );

  CREATE TABLE visionen (
    id INTEGER PRIMARY KEY,
    titel TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    farbe TEXT NOT NULL,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE organisationen (
    id INTEGER PRIMARY KEY,
    vision_id INTEGER REFERENCES visionen(id),
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    farbe TEXT NOT NULL,
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE projekte (
    id INTEGER PRIMARY KEY,
    vision_id INTEGER REFERENCES visionen(id),
    organisation_id INTEGER REFERENCES organisationen(id),
    standard_vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id),
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    CHECK ((vision_id IS NULL) <> (organisation_id IS NULL))
  );
  CREATE INDEX projekte_vision ON projekte(vision_id);
  CREATE INDEX projekte_organisation ON projekte(organisation_id);

  CREATE TABLE vorhaben (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    vorgaenger_id INTEGER UNIQUE REFERENCES vorhaben(id),
    titel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'geschafft', 'gescheitert', 'losgelassen')),
    anlauf INTEGER NOT NULL DEFAULT 1,
    erkenntnis TEXT NOT NULL DEFAULT '',
    weitermachen_eingeloest INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT},
    abgeschlossen_am TEXT
  );
  CREATE INDEX vorhaben_projekt ON vorhaben(projekt_id, status);

  CREATE TABLE eintraege (
    id INTEGER PRIMARY KEY,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    vorlage_id INTEGER NOT NULL REFERENCES vorlagen(id),
    vorhaben_id INTEGER REFERENCES vorhaben(id),
    abschluss TEXT CHECK (abschluss IN ('geschafft', 'gescheitert')),
    stunden REAL,
    notiz TEXT NOT NULL DEFAULT '',
    meilenstein INTEGER NOT NULL DEFAULT 0,
    krit INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX eintraege_erstellt ON eintraege(erstellt_am);
  CREATE INDEX eintraege_projekt ON eintraege(projekt_id, erstellt_am);
  CREATE INDEX eintraege_vorhaben ON eintraege(vorhaben_id);

  CREATE TABLE xp_ereignisse (
    id INTEGER PRIMARY KEY,
    quelle TEXT NOT NULL,
    attribut_id INTEGER NOT NULL REFERENCES attribute(id),
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE CASCADE,
    vorhaben_id INTEGER REFERENCES vorhaben(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX xp_ereignisse_attribut ON xp_ereignisse(attribut_id);
  CREATE INDEX xp_ereignisse_eintrag ON xp_ereignisse(eintrag_id);
  CREATE INDEX xp_ereignisse_vorhaben ON xp_ereignisse(vorhaben_id);
  CREATE INDEX xp_ereignisse_erstellt ON xp_ereignisse(erstellt_am);

  CREATE TABLE projekt_xp (
    id INTEGER PRIMARY KEY,
    quelle TEXT NOT NULL,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE CASCADE,
    vorhaben_id INTEGER REFERENCES vorhaben(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX projekt_xp_projekt ON projekt_xp(projekt_id);
  CREATE INDEX projekt_xp_vorhaben ON projekt_xp(vorhaben_id);

  INSERT INTO attribute (id, typ, rolle, name, beschreibung, farbe, icon, sortierung) VALUES
    (1, 'attribut', NULL, 'Körper', 'Gesundheit, Sport, Schlaf, Ernährung', '#f87171', 'heart-pulse', 1),
    (2, 'attribut', 'geist', 'Geist', 'Mentale Gesundheit, Ruhe, Reflexion, Resilienz', '#34d399', 'leaf', 2),
    (3, 'attribut', 'disziplin', 'Disziplin', 'Durchhalten, Fokus, Ordnung', '#60a5fa', 'target', 3),
    (4, 'attribut', NULL, 'Intellekt', 'Wissen, Lernen, Verstehen', '#a78bfa', 'brain', 4),
    (5, 'attribut', NULL, 'Soziales', 'Soft Skills, Beziehungen, Kommunikation', '#f472b6', 'users', 5),
    (6, 'status', NULL, 'Einfluss', 'Wie sehr du andere bewegst', '#818cf8', 'handshake', 6),
    (7, 'status', NULL, 'Ressourcen', 'Geld, Eigentum, Mittel', '#facc15', 'coins', 7),
    (8, 'status', NULL, 'Autorität', 'Verantwortung, Position, Vertrauen', '#fb923c', 'crown', 8),
    (9, 'status', NULL, 'Reichweite', 'Wie viele Menschen dich erreichen', '#2dd4bf', 'megaphone', 9);

  INSERT INTO vorlagen (id, name, icon, sortierung) VALUES
    (1, 'Umsetzen', 'hammer', 1),
    (2, 'Lernen', 'book-open', 2),
    (3, 'Sport', 'dumbbell', 3),
    (4, 'Hobby', 'palette', 4),
    (5, 'Erholung', 'battery-charging', 5),
    (6, 'Netzwerken', 'users', 6),
    (7, 'Organisieren', 'clipboard-list', 7),
    (8, 'Veröffentlichen', 'rocket', 8),
    (9, 'Aufräumen', 'sparkles', 9);

  INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht) VALUES
    (1, 3, 60), (1, 4, 40),
    (2, 4, 80), (2, 3, 20),
    (3, 1, 80), (3, 3, 20),
    (4, 2, 70), (4, 1, 30),
    (5, 2, 60), (5, 1, 40),
    (6, 5, 70), (6, 6, 30),
    (7, 3, 50), (7, 5, 30), (7, 8, 20),
    (8, 9, 50), (8, 3, 30), (8, 5, 20),
    (9, 3, 70), (9, 2, 30);

  INSERT INTO visionen (id, titel, beschreibung, farbe) VALUES
    (1, 'Gesund & ausgeglichen', 'Ein Körper und ein Geist, die mich tragen.', '#34d399'),
    (2, 'Fundament', 'Ordnung und Alltag, auf denen alles andere aufbaut.', '#60a5fa');

  INSERT INTO projekte (id, vision_id, standard_vorlage_id, name, beschreibung) VALUES
    (1, 1, 5, 'Erholung', 'Pausen, Schlaf, Abschalten'),
    (2, 1, 3, 'Sport', 'Training und Bewegung'),
    (3, 2, 9, 'Ordnung', 'Zimmer, Wäsche, Haushalt');
  `;
