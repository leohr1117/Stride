import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

const DATUM = `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`;

export const sql = `
  CREATE TABLE streak_bruecken (
    id INTEGER PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE CHECK (tag ${DATUM}),
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );

  CREATE TABLE rueckkehr (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('offen', 'geschafft', 'zu')),
    geoeffnet_am TEXT NOT NULL CHECK (geoeffnet_am ${DATUM}),
    frist_am TEXT NOT NULL CHECK (frist_am ${DATUM}),
    eintrag_id INTEGER UNIQUE REFERENCES eintraege(id) ON DELETE SET NULL
  );

  CREATE TABLE protokoll (
    id INTEGER PRIMARY KEY,
    art TEXT NOT NULL,
    bezug_typ TEXT,
    bezug_id INTEGER,
    tag TEXT CHECK (tag ${DATUM}),
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );
`;
