export const sql = `
  -- 30 Tage, wie BOSS.fristOhneDatumTage. Lokal, damit der Tag nicht schon vorbei ist.
  UPDATE vorhaben
  SET deadline = date('now', 'localtime', '+30 days')
  WHERE boss = 1 AND deadline IS NULL;

  -- HP = max(100, Beute). Beute = round(0.05 * (level-1) * (level+98)) bei der Charakter-Kurve.
  UPDATE vorhaben
  SET boss_hp = MAX(100, ROUND(0.05 * CASE
    WHEN boss_level IS NULL OR boss_level < 1 THEN 0
    ELSE (boss_level - 1) * (boss_level + 98)
  END))
  WHERE boss = 1;

  -- Schaden ist die XP des Eintrags. NULL bleibt, das war kein Boss-Eintrag.
  UPDATE eintraege
  SET boss_schaden = COALESCE(
    (SELECT SUM(xp) FROM projekt_xp WHERE eintrag_id = eintraege.id AND quelle = 'eintrag'),
    (SELECT SUM(xp) FROM xp_ereignisse WHERE eintrag_id = eintraege.id AND quelle = 'eintrag'),
    boss_schaden
  )
  WHERE vorhaben_id IN (SELECT id FROM vorhaben WHERE boss = 1)
    AND boss_schaden IS NOT NULL;
  `;
