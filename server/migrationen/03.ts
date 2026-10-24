import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  ALTER TABLE vorhaben ADD COLUMN angriff_bis TEXT;
  UPDATE vorhaben SET boss_hp = MAX(1, ROUND(boss_hp)) WHERE boss = 1 AND boss_hp IS NOT NULL;
  UPDATE eintraege SET boss_schaden = CASE
      WHEN id = (SELECT MIN(e2.id) FROM eintraege e2
                 WHERE e2.vorhaben_id = eintraege.vorhaben_id
                   AND date(e2.erstellt_am, 'localtime') = date(eintraege.erstellt_am, 'localtime'))
      THEN 1 ELSE 0 END
    WHERE vorhaben_id IN (SELECT id FROM vorhaben WHERE boss = 1);

  ALTER TABLE faehigkeit_xp ADD COLUMN knoten_id INTEGER REFERENCES skill_knoten(id) ON DELETE CASCADE;
  UPDATE faehigkeit_xp SET knoten_id = (SELECT k.id FROM skill_knoten k WHERE k.eintrag_id = faehigkeit_xp.eintrag_id)
    WHERE quelle = 'knoten';
  CREATE INDEX faehigkeit_xp_knoten ON faehigkeit_xp(knoten_id);

  ALTER TABLE eintraege ADD COLUMN ausruestung_bonus REAL NOT NULL DEFAULT 0;

  CREATE TABLE ausruestung (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL,
    stufe TEXT NOT NULL CHECK (stufe IN ('klein', 'mittel', 'gross')),
    bonus REAL NOT NULL,
    kosten INTEGER NOT NULL,
    archiviert INTEGER NOT NULL DEFAULT 0,
    gekauft_am TEXT NOT NULL
  );

  CREATE TABLE ausruestung_projekte (
    ausruestung_id INTEGER NOT NULL REFERENCES ausruestung(id) ON DELETE CASCADE,
    projekt_id INTEGER NOT NULL REFERENCES projekte(id),
    PRIMARY KEY (ausruestung_id, projekt_id)
  );
  CREATE INDEX ausruestung_projekte_projekt ON ausruestung_projekte(projekt_id);

  CREATE TABLE ausruestung_ertraege (
    id INTEGER PRIMARY KEY,
    ausruestung_id INTEGER NOT NULL REFERENCES ausruestung(id) ON DELETE CASCADE,
    eintrag_id INTEGER NOT NULL REFERENCES eintraege(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX ausruestung_ertraege_ausruestung ON ausruestung_ertraege(ausruestung_id);

  ALTER TABLE xp_ereignisse ADD COLUMN ausruestung_id INTEGER REFERENCES ausruestung(id) ON DELETE CASCADE;

  CREATE TABLE shop_artikel (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    preis INTEGER NOT NULL CHECK (preis > 0),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE kaeufe (
    id INTEGER PRIMARY KEY,
    artikel_id INTEGER NOT NULL REFERENCES shop_artikel(id),
    name TEXT NOT NULL,
    preis INTEGER NOT NULL,
    erstellt_am TEXT NOT NULL
  );

  CREATE TABLE gold_buchungen (
    id INTEGER PRIMARY KEY,
    quelle TEXT NOT NULL,
    betrag INTEGER NOT NULL,
    eintrag_id INTEGER REFERENCES eintraege(id) ON DELETE CASCADE,
    vorhaben_id INTEGER REFERENCES vorhaben(id) ON DELETE CASCADE,
    knoten_id INTEGER REFERENCES skill_knoten(id) ON DELETE CASCADE,
    kauf_id INTEGER REFERENCES kaeufe(id) ON DELETE CASCADE,
    erstellt_am TEXT NOT NULL
  );
  CREATE INDEX gold_buchungen_eintrag ON gold_buchungen(eintrag_id);

  INSERT INTO gold_buchungen (quelle, betrag, erstellt_am)
    SELECT 'start', CAST(SUM(xp) * 0.2 AS INTEGER), ${ZEITSTEMPEL_JETZT}
    FROM xp_ereignisse WHERE xp > 0
    HAVING CAST(SUM(xp) * 0.2 AS INTEGER) > 0;
  `;
