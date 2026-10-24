import type { Belohnung } from '../../../shared/api/index.ts';
import type { Gewicht } from '../../../shared/spiel/xp.ts';
import { projektAbschlussBonus, verteileNachGewichten } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { aktiveTypen, nurWirksameGewichte } from '../attribute/attribute.ts';
import type { AttributBuchung } from '../../services/fortschritt.ts';
import { bucheAttributXp, bucheProjektXp, erstelleBelohnung, ladeLevelStand } from '../../services/fortschritt.ts';

function gewichteDerVorlage(vorlageId: number): Gewicht[] {
  const typen = aktiveTypen();
  if (typen.length === 0) {
    return [];
  }
  return alle<Gewicht>(
    `SELECT g.attribut_id AS attributId, g.gewicht
     FROM vorlage_gewichte g
     JOIN attribute a ON a.id = g.attribut_id
     WHERE g.vorlage_id = ? AND a.archiviert = 0 AND g.gewicht > 0 AND a.typ IN (${platzhalter(typen.length)})`,
    vorlageId,
    ...typen,
  );
}

function wirfLeereTaetigkeit(vorlageId: number): never {
  const name = eine<{ name: string }>('SELECT name FROM vorlagen WHERE id = ?', vorlageId)?.name ?? '';
  throw ungueltig(`Die Tätigkeit "${name}" stärkt kein aktives Attribut. Passe sie unter "Mehr" an.`);
}

function gewichteFuerAbschluss(projektId: number, abschlussVorlageId: number | null, standardVorlageId: number): Gewicht[] {
  if (abschlussVorlageId !== null) {
    const gewichte = gewichteDerVorlage(abschlussVorlageId);
    if (gewichte.length === 0) {
      wirfLeereTaetigkeit(abschlussVorlageId);
    }
    return gewichte;
  }
  const historisch = nurWirksameGewichte(
    alle<Gewicht>(
      `SELECT attribut_id AS attributId, SUM(xp) AS gewicht
       FROM xp_ereignisse
       WHERE quelle = 'eintrag' AND xp > 0
         AND eintrag_id IN (SELECT id FROM eintraege WHERE projekt_id = ?)
       GROUP BY attribut_id
       HAVING SUM(xp) > 0`,
      projektId,
    ),
  );
  if (historisch.length > 0) {
    return historisch;
  }
  const standard = gewichteDerVorlage(standardVorlageId);
  if (standard.length === 0) {
    wirfLeereTaetigkeit(standardVorlageId);
  }
  return standard;
}

/**
 * Zahlt den Abschluss-Bonus höchstens einmal.
 * Der Umfang ist nur Eintrags-XP, damit Meilensteine und der Bonus sich nicht selbst vergrößern.
 */
export function schliesseProjekt(id: number, jetzt: Date): Belohnung | null {
  const iso = jetzt.toISOString();
  const stand = eine<{
    bonusAm: string | null;
    vorlageId: number | null;
    name: string;
    standardVorlageId: number;
  }>(
    `SELECT abschluss_bonus_am AS bonusAm, abschluss_vorlage_id AS vorlageId, name,
            standard_vorlage_id AS standardVorlageId
     FROM projekte WHERE id = ?`,
    id,
  );
  if (!stand) {
    throw nichtGefunden('Das Projekt');
  }
  if (stand.bonusAm !== null) {
    ausfuehren('UPDATE projekte SET geschafft_am = COALESCE(geschafft_am, ?) WHERE id = ?', iso, id);
    return null;
  }

  const umfang =
    eine<{ xp: number }>(
      `SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp WHERE projekt_id = ? AND quelle = 'eintrag'`,
      id,
    )?.xp ?? 0;
  const bonus = projektAbschlussBonus(umfang);
  const gewichte = gewichteFuerAbschluss(id, stand.vorlageId, stand.standardVorlageId);
  const vorher = ladeLevelStand(id, null);

  const gebucht = inTransaktion(() => {
    const gesetzt = ausfuehren(
      `UPDATE projekte
       SET geschafft_am = COALESCE(geschafft_am, ?), abschluss_bonus_am = ?
       WHERE id = ? AND abschluss_bonus_am IS NULL`,
      iso,
      iso,
      id,
    );
    if (gesetzt.geaendert === 0) {
      ausfuehren('UPDATE projekte SET geschafft_am = COALESCE(geschafft_am, ?) WHERE id = ?', iso, id);
      return null;
    }

    let eintragId: number | null = null;
    if (stand.vorlageId !== null) {
      eintragId = ausfuehren(
        `INSERT INTO eintraege (projekt_id, vorlage_id, vorhaben_id, faehigkeit_id, abschluss, stunden, notiz,
                                meilenstein, krit, boss_schaden, ausruestung_bonus, faktor, basis_aufgabe_id, erstellt_am)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        stand.vorlageId,
        null,
        null,
        null,
        null,
        '',
        0,
        0,
        null,
        0,
        1,
        null,
        iso,
      ).id;
    }

    const buchungen: AttributBuchung[] = [];
    for (const anteil of verteileNachGewichten(bonus, gewichte)) {
      if (anteil.xp > 0) {
        buchungen.push(
          bucheAttributXp(
            { quelle: 'abschluss', attributId: anteil.attributId, xp: anteil.xp, eintragId, vorhabenId: null },
            iso,
          ),
        );
      }
    }
    bucheProjektXp({ quelle: 'abschluss', projektId: id, xp: bonus, eintragId, vorhabenId: null }, iso);
    return buchungen;
  });

  if (!gebucht) {
    return null;
  }
  return erstelleBelohnung({
    buchungen: gebucht,
    boni: [{ quelle: 'abschluss', label: 'Projekt abgeschlossen', xp: bonus }],
    meilenstein: false,
    projekt: { name: stand.name, xp: bonus },
    vorher,
    nachher: ladeLevelStand(id, null),
  });
}
