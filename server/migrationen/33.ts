const DATUM = `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`;

export const sql = `
  CREATE TABLE streak_pausen (
    id INTEGER PRIMARY KEY,
    von TEXT NOT NULL CHECK (von ${DATUM} AND date(von) IS von),
    bis TEXT CHECK (bis IS NULL OR (bis ${DATUM} AND date(bis) IS bis AND bis >= von))
  );
`;
