import { angriffsTage, BOSS, bossLevelAusKampfXp } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, inTransaktion } from '../../db.ts';
import { aktivesAttribut, ladeAttributXp } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { schalteErfolgeFrei } from '../erfolge/erfolge.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { KONTEXT_JOINS, PROJEKT_ODER_FREI } from '../ziele/kontext.ts';
import { leseJetzt, lokalesDatum } from '../../services/zeit.ts';

interface UeberfaelligerBoss {
  id: number;
  deadline: string;
  angriffBis: string | null;
}

export function rechneBossangriffeAb(jetzt = leseJetzt()): void {
  const einstellungen = ladeEinstellungen();
  const heute = lokalesDatum(jetzt);
  const bosseAn = istAn('bossAngriffe', einstellungen);
  const disziplinId = bosseAn ? aktivesAttribut('disziplin') : null;
  const zeitpunkt = jetzt.toISOString();

  if (istAn('vorhaben', einstellungen)) {
    const bosse = alle<UeberfaelligerBoss>(
      `SELECT vh.id, vh.deadline, vh.angriff_bis AS angriffBis
       FROM vorhaben vh
       LEFT JOIN projekte p ON p.id = vh.projekt_id
       ${KONTEXT_JOINS}
       WHERE vh.status = 'offen' AND vh.boss = 1 AND vh.deadline IS NOT NULL AND vh.deadline < ?
         AND (vh.angriff_bis IS NULL OR vh.angriff_bis < ?) AND ${PROJEKT_ODER_FREI}`,
      heute,
      heute,
    );

    if (bosse.length > 0) {
      inTransaktion(() => {
        for (const boss of bosse) {
          const tage = angriffsTage(boss.deadline, boss.angriffBis, heute);
          if (disziplinId !== null && tage > 0) {
            const schaden = Math.min(Math.max(0, ladeAttributXp(disziplinId)), tage * BOSS.angriffXpProTag);
            if (schaden > 0) {
              bucheAttributXp(
                { quelle: 'bossangriff', attributId: disziplinId, xp: -schaden, eintragId: null, vorhabenId: boss.id },
                zeitpunkt,
              );
            }
          }
          ausfuehren('UPDATE vorhaben SET angriff_bis = ? WHERE id = ?', heute, boss.id);
        }
      });
    }

    if (bosseAn && trageBossLevelNach()) {
      schalteErfolgeFrei(jetzt);
    }
  }
}

/** Besiegte Bosse ohne Level bekommen es einmal aus der Kampf-XP, sobald Bosse wirken. */
function trageBossLevelNach(): boolean {
  const offen = alle<{ id: number; kampfXp: number }>(
    `SELECT vh.id, COALESCE((SELECT SUM(boss_schaden) FROM eintraege WHERE vorhaben_id = vh.id), 0) AS kampfXp
     FROM vorhaben vh
     WHERE vh.boss = 1 AND vh.status = 'geschafft' AND vh.boss_level IS NULL`,
  );
  if (offen.length === 0) {
    return false;
  }
  inTransaktion(() => {
    for (const zeile of offen) {
      ausfuehren(
        'UPDATE vorhaben SET boss_level = ? WHERE id = ? AND boss_level IS NULL',
        bossLevelAusKampfXp(zeile.kampfXp),
        zeile.id,
      );
    }
  });
  return true;
}
