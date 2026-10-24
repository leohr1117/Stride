export const sql = `
  ALTER TABLE basis_aufgaben ADD COLUMN stunden REAL;
  ALTER TABLE basis_aufgaben ADD COLUMN gewohnheit_alt INTEGER;
  INSERT INTO basis_aufgaben (projekt_id, vorlage_id, name, icon, intervall_tage, archiviert, erstellt_am, gewohnheit_alt)
    SELECT projekt_id, vorlage_id, name, icon, 1, archiviert, erstellt_am, id FROM gewohnheiten;
  UPDATE eintraege
    SET basis_aufgabe_id = (SELECT b.id FROM basis_aufgaben b WHERE b.gewohnheit_alt = eintraege.gewohnheit_id),
        gewohnheit_id = NULL,
        gewohnheit_minimal = 0
    WHERE gewohnheit_id IS NOT NULL;
  DELETE FROM gewohnheiten;
  ALTER TABLE basis_aufgaben DROP COLUMN gewohnheit_alt;
  ALTER TABLE basis_aufgaben DROP COLUMN intervall_tage;

  ALTER TABLE vorhaben ADD COLUMN boss_level INTEGER;
  `;
