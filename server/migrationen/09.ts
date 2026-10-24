export const sql = `
  ALTER TABLE attribute ADD COLUMN verfall_belastung TEXT NOT NULL DEFAULT 'aus'
    CHECK (verfall_belastung IN ('aus', 'leicht', 'mittel', 'stark'));
  ALTER TABLE attribute ADD COLUMN verfall_zeit TEXT NOT NULL DEFAULT 'aus'
    CHECK (verfall_zeit IN ('aus', 'leicht', 'mittel', 'stark'));
  ALTER TABLE attribute ADD COLUMN verfall_bis TEXT;
  UPDATE attribute SET verfall_belastung = 'mittel' WHERE kennung = 'geist';

  INSERT INTO attribute (typ, kennung, name, beschreibung, farbe, icon, sortierung)
    SELECT 'attribut', 'kreativitaet', 'Kreativität', 'Ideen, Gestalten, Erschaffen', '#fb923c', 'lightbulb',
           COALESCE(MAX(sortierung), 0) + 1
    FROM attribute
    WHERE NOT EXISTS (SELECT 1 FROM attribute WHERE kennung = 'kreativitaet');

  INSERT INTO vorlagen (name, icon, sortierung)
    SELECT 'Erschaffen', 'lightbulb', COALESCE(MAX(sortierung), 0) + 1 FROM vorlagen
    WHERE NOT EXISTS (SELECT 1 FROM vorlagen WHERE name = 'Erschaffen');
  INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht)
    SELECT v.id, a.id, g.gewicht
    FROM (SELECT 'kreativitaet' AS kennung, 70 AS gewicht UNION ALL SELECT 'disziplin', 30) g
    JOIN vorlagen v ON v.name = 'Erschaffen'
    JOIN attribute a ON a.kennung = g.kennung
    WHERE NOT EXISTS (SELECT 1 FROM vorlage_gewichte WHERE vorlage_id = v.id);

  ALTER TABLE visionen ADD COLUMN level INTEGER;
  ALTER TABLE visionen ADD COLUMN erreicht_am TEXT;
  ALTER TABLE xp_ereignisse ADD COLUMN vision_id INTEGER REFERENCES visionen(id) ON DELETE CASCADE;
  `;
