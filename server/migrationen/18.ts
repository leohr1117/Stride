import { ZEITSTEMPEL_JETZT } from './zeitstempel.ts';

export const sql = `
  -- HP bleibt als Spalte, wird nicht mehr gelesen.
  UPDATE vorhaben SET boss_hp = NULL WHERE boss = 1;

  UPDATE vorhaben
  SET boss_level = NULL,
      deadline = COALESCE(deadline, date('now', 'localtime', '+30 days'))
  WHERE boss = 1 AND status = 'offen';

  UPDATE vorhaben
  SET boss_level = NULL
  WHERE boss = 1 AND status = 'gescheitert';

  -- Leeres Level bei einem besiegten Boss: Charakter-Level der Kampf-XP.
  -- CAST schneidet ab, dieselbe Stufe wie bossLevelAusKampfXp.
  UPDATE vorhaben
  SET boss_level = CAST((
    -99.0 + sqrt(9801.0 + 4.0 * COALESCE((
      SELECT SUM(boss_schaden) FROM eintraege WHERE vorhaben_id = vorhaben.id
    ), 0))
  ) / 2.0 AS INTEGER) + 1
  WHERE boss = 1 AND status = 'geschafft' AND boss_level IS NULL;

  DELETE FROM erfolge WHERE schluessel IN ('bossLevel-100', 'bossLevel-500', 'bossLevel-2000');
  UPDATE einstellungen
  SET wert = 'null'
  WHERE schluessel = 'titel' AND wert IN ('"bossLevel-100"', '"bossLevel-500"', '"bossLevel-2000"');

  INSERT INTO erfolge (schluessel, erreicht_am)
    SELECT 'bossLevel-5', ${ZEITSTEMPEL_JETZT}
    WHERE (SELECT COALESCE(MAX(boss_level), 0) FROM vorhaben WHERE boss = 1 AND status = 'geschafft') >= 5
      AND NOT EXISTS (SELECT 1 FROM erfolge WHERE schluessel = 'bossLevel-5');
  INSERT INTO erfolge (schluessel, erreicht_am)
    SELECT 'bossLevel-15', ${ZEITSTEMPEL_JETZT}
    WHERE (SELECT COALESCE(MAX(boss_level), 0) FROM vorhaben WHERE boss = 1 AND status = 'geschafft') >= 15
      AND NOT EXISTS (SELECT 1 FROM erfolge WHERE schluessel = 'bossLevel-15');
  INSERT INTO erfolge (schluessel, erreicht_am)
    SELECT 'bossLevel-30', ${ZEITSTEMPEL_JETZT}
    WHERE (SELECT COALESCE(MAX(boss_level), 0) FROM vorhaben WHERE boss = 1 AND status = 'geschafft') >= 30
      AND NOT EXISTS (SELECT 1 FROM erfolge WHERE schluessel = 'bossLevel-30');
  `;
