import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  ALTER TABLE projekte ADD COLUMN investition_groesse INTEGER NOT NULL DEFAULT 1 CHECK (investition_groesse BETWEEN 0 AND 3);

  UPDATE projekte
  SET investition_groesse = CASE
    WHEN investition_bonus < 0.075 THEN 0
    WHEN investition_bonus < 0.15 THEN 1
    WHEN investition_bonus < 0.25 THEN 2
    ELSE 3
  END;

  UPDATE projekte
  SET investition_bonus = CASE investition_groesse
    WHEN 0 THEN 0.05
    WHEN 1 THEN 0.1
    WHEN 2 THEN 0.2
    ELSE 0.3
  END
  WHERE investition = 1
    AND ABS(investition_bonus - 0.05) >= 0.001
    AND ABS(investition_bonus - 0.1) >= 0.001
    AND ABS(investition_bonus - 0.2) >= 0.001
    AND ABS(investition_bonus - 0.3) >= 0.001;

  CREATE TABLE investitionen (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'gem',
    groesse INTEGER NOT NULL CHECK (groesse BETWEEN 0 AND 3),
    bonus REAL NOT NULL,
    ziel_art TEXT CHECK (ziel_art IS NULL OR ziel_art IN ('vision', 'projekt', 'attribut')),
    ziel_id INTEGER,
    attribut_id INTEGER NOT NULL REFERENCES attribute(id),
    archiviert INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT NOT NULL DEFAULT ${ZEITSTEMPEL_JETZT}
  );
  CREATE INDEX investitionen_attribut ON investitionen(attribut_id);

  INSERT INTO investitionen (name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id, archiviert, erstellt_am)
  SELECT
    a.name,
    COALESCE(NULLIF(a.icon, ''), 'gem'),
    CASE
      WHEN a.bonus < 0.075 THEN 0
      WHEN a.bonus < 0.15 THEN 1
      WHEN a.bonus < 0.25 THEN 2
      ELSE 3
    END,
    CASE
      WHEN a.bonus < 0.075 THEN 0.05
      WHEN a.bonus < 0.15 THEN 0.1
      WHEN a.bonus < 0.25 THEN 0.2
      ELSE 0.3
    END,
    CASE
      WHEN EXISTS (SELECT 1 FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id) THEN 'vision'
      WHEN EXISTS (
        SELECT 1 FROM ausruestung_projekte ap
        JOIN projekte p ON p.id = ap.projekt_id
        WHERE ap.ausruestung_id = a.id
      ) THEN 'projekt'
      ELSE NULL
    END,
    CASE
      WHEN EXISTS (SELECT 1 FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id)
        THEN (SELECT MIN(av.vision_id) FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id)
      WHEN EXISTS (
        SELECT 1 FROM ausruestung_projekte ap
        JOIN projekte p ON p.id = ap.projekt_id
        WHERE ap.ausruestung_id = a.id
      )
        THEN (
          SELECT MIN(ap.projekt_id) FROM ausruestung_projekte ap
          JOIN projekte p ON p.id = ap.projekt_id
          WHERE ap.ausruestung_id = a.id
        )
      ELSE NULL
    END,
    COALESCE(
      (SELECT id FROM attribute WHERE kennung = 'ressourcen' AND archiviert = 0 ORDER BY id LIMIT 1),
      (SELECT id FROM attribute WHERE archiviert = 0 ORDER BY id LIMIT 1)
    ),
    COALESCE(a.archiviert, 0),
    COALESCE(a.gekauft_am, ${ZEITSTEMPEL_JETZT})
  FROM ausruestung a
  WHERE COALESCE(
      (SELECT id FROM attribute WHERE kennung = 'ressourcen' AND archiviert = 0 ORDER BY id LIMIT 1),
      (SELECT id FROM attribute WHERE archiviert = 0 ORDER BY id LIMIT 1)
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM projekte p
      WHERE p.investition = 1 AND p.name = a.name
    )
    AND NOT EXISTS (
      SELECT 1 FROM projekte p
      WHERE p.investition = 1
        AND p.erstellt_am = a.gekauft_am
        AND ABS(p.investition_bonus - CASE
          WHEN a.bonus < 0.075 THEN 0.05
          WHEN a.bonus < 0.15 THEN 0.1
          WHEN a.bonus < 0.25 THEN 0.2
          ELSE 0.3
        END) < 0.001
    );

  UPDATE eintraege SET krit = 0;
  `;
