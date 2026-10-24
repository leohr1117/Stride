export const sql = `
  CREATE TABLE ausruestung_visionen (
    ausruestung_id INTEGER NOT NULL REFERENCES ausruestung(id) ON DELETE CASCADE,
    vision_id INTEGER NOT NULL REFERENCES visionen(id),
    PRIMARY KEY (ausruestung_id, vision_id)
  );
  CREATE INDEX ausruestung_visionen_vision ON ausruestung_visionen(vision_id);
  ALTER TABLE ausruestung ADD COLUMN ausloeser_vorhaben_id INTEGER REFERENCES vorhaben(id);
  UPDATE attribute SET erschoepfung = 0
    WHERE EXISTS (
      SELECT 1 FROM einstellungen WHERE schluessel = 'funktionen' AND json_extract(wert, '$.erschoepfung') = 0
    );
  `;
