export const sql = `
  ALTER TABLE attribute ADD COLUMN erschoepfung INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE attribute ADD COLUMN erschoepfung_ziel INTEGER REFERENCES attribute(id);
  ALTER TABLE attribute ADD COLUMN archiv_anteil REAL;
  UPDATE attribute SET erschoepfung = 1 WHERE kennung = 'geist';
  UPDATE attribute SET kennung = NULL WHERE kennung IN ('technik', 'handwerk', 'sprachen');
  UPDATE attribute SET beschreibung = 'Kraft, Ausdauer, Fitness'
    WHERE kennung = 'koerper' AND beschreibung = 'Gesundheit, Sport, Schlaf, Ernährung';
  UPDATE attribute SET beschreibung = 'Wissen, Lernen, Verstehen, Sprachen'
    WHERE kennung = 'intellekt' AND beschreibung = 'Wissen, Lernen, Verstehen';
  `;
