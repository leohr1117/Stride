export const sql = `
  UPDATE attribute SET rolle = 'koerper'
    WHERE id = 1 AND typ = 'attribut' AND rolle IS NULL
      AND NOT EXISTS (SELECT 1 FROM attribute WHERE rolle = 'koerper');
  UPDATE attribute SET archiviert = 0 WHERE rolle IS NOT NULL;
  `;
