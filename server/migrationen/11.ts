export const sql = `
  UPDATE attribute
    SET kennung = 'motorik', name = 'Motorik', beschreibung = 'Geschick, Koordination, Technik in Hand und Körper',
        icon = 'hand', farbe = '#2dd4bf'
    WHERE kennung IS NULL AND name = 'Handwerk' AND typ = 'attribut'
      AND NOT EXISTS (SELECT 1 FROM attribute WHERE kennung = 'motorik');
  UPDATE attribute SET archiviert = 1
    WHERE kennung IS NULL AND name IN ('Technik', 'Sprachen', 'Handwerk') AND typ = 'attribut';
  `;
