export const sql = `
  ALTER TABLE projekte ADD COLUMN geschafft_am TEXT;
  ALTER TABLE projekte ADD COLUMN investition INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projekte ADD COLUMN investition_ziel_art TEXT;
  ALTER TABLE projekte ADD COLUMN investition_ziel_id INTEGER;
  ALTER TABLE projekte ADD COLUMN investition_ressourcen INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE projekte ADD COLUMN investition_bonus REAL NOT NULL DEFAULT 0.1;

  WITH ziele AS (
    SELECT
      a.name,
      a.beschreibung,
      a.archiviert,
      a.gekauft_am AS gekauftAm,
      a.bonus,
      CASE
        WHEN a.archiviert = 1 THEN NULL
        WHEN a.ausloeser_vorhaben_id IS NULL THEN a.gekauft_am
        WHEN vh.status = 'geschafft' THEN COALESCE(vh.abgeschlossen_am, a.gekauft_am)
        ELSE NULL
      END AS geschafftAm,
      CASE
        WHEN EXISTS (SELECT 1 FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id) THEN 'vision'
        WHEN proj.anzahl > 1 AND proj.visionen = 1 AND proj.ohneVision = 0 THEN 'vision'
        WHEN proj.anzahl > 0 THEN 'projekt'
        ELSE NULL
      END AS zielArt,
      CASE
        WHEN EXISTS (SELECT 1 FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id)
          THEN (SELECT MIN(av.vision_id) FROM ausruestung_visionen av WHERE av.ausruestung_id = a.id)
        WHEN proj.anzahl > 1 AND proj.visionen = 1 AND proj.ohneVision = 0 THEN proj.visionId
        WHEN proj.anzahl > 0 THEN proj.projektId
        ELSE NULL
      END AS zielId
    FROM ausruestung a
    LEFT JOIN vorhaben vh ON vh.id = a.ausloeser_vorhaben_id
    LEFT JOIN (
      SELECT
        ap.ausruestung_id AS ausruestungId,
        COUNT(DISTINCT ap.projekt_id) AS anzahl,
        COUNT(DISTINCT COALESCE(p.vision_id, o.vision_id)) AS visionen,
        SUM(CASE WHEN COALESCE(p.vision_id, o.vision_id) IS NULL THEN 1 ELSE 0 END) AS ohneVision,
        MIN(ap.projekt_id) AS projektId,
        MIN(COALESCE(p.vision_id, o.vision_id)) AS visionId
      FROM ausruestung_projekte ap
      JOIN projekte p ON p.id = ap.projekt_id
      LEFT JOIN organisationen o ON o.id = p.organisation_id
      GROUP BY ap.ausruestung_id
    ) proj ON proj.ausruestungId = a.id
  )
  INSERT INTO projekte (
    vision_id, organisation_id, standard_vorlage_id, name, beschreibung, archiviert, erstellt_am,
    geschafft_am, investition, investition_ziel_art, investition_ziel_id, investition_ressourcen, investition_bonus
  )
  SELECT
    NULL,
    NULL,
    (SELECT id FROM vorlagen WHERE archiviert = 0 ORDER BY id LIMIT 1),
    name,
    beschreibung,
    archiviert,
    gekauftAm,
    geschafftAm,
    1,
    zielArt,
    zielId,
    0,
    bonus
  FROM ziele
  WHERE EXISTS (SELECT 1 FROM vorlagen WHERE archiviert = 0);
  `;
