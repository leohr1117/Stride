export const sql = `
  DELETE FROM xp_ereignisse
    WHERE quelle = 'belastung' AND attribut_id IN (SELECT id FROM attribute WHERE rolle = 'koerper');
  UPDATE attribute SET rolle = NULL WHERE rolle = 'koerper';
  `;
