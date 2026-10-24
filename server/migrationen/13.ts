export const sql = `
  CREATE TEMP TABLE leerer_start AS SELECT (
    NOT EXISTS (SELECT 1 FROM eintraege)
    AND NOT EXISTS (SELECT 1 FROM vorhaben)
    AND NOT EXISTS (SELECT 1 FROM xp_ereignisse)
    AND NOT EXISTS (SELECT 1 FROM basis_aufgaben)
    AND NOT EXISTS (SELECT 1 FROM gewohnheiten)
    AND NOT EXISTS (SELECT 1 FROM ausruestung)
    AND NOT EXISTS (SELECT 1 FROM organisationen)
    AND NOT EXISTS (SELECT 1 FROM visionen WHERE titel NOT IN ('Gesund & ausgeglichen', 'Fundament'))
    AND NOT EXISTS (SELECT 1 FROM projekte WHERE name NOT IN ('Erholung', 'Sport', 'Ordnung'))
    AND NOT EXISTS (
      SELECT 1 FROM vorlagen WHERE name NOT IN (
        'Umsetzen', 'Lernen', 'Sport', 'Hobby', 'Erholung', 'Netzwerken',
        'Organisieren', 'Veröffentlichen', 'Aufräumen', 'Arbeiten', 'Erschaffen'
      )
    )
  ) AS gilt;
  DELETE FROM projekte WHERE (SELECT gilt FROM leerer_start);
  DELETE FROM visionen WHERE (SELECT gilt FROM leerer_start);
  DELETE FROM vorlage_gewichte WHERE (SELECT gilt FROM leerer_start);
  DELETE FROM vorlagen WHERE (SELECT gilt FROM leerer_start);
  DROP TABLE leerer_start;
  `;
