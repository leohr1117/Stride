import type { Statistiken, Zeitraum } from '../../../shared/api/index.ts';
import { TAGE_PRO_WOCHE } from '../../../shared/spiel/datum.ts';
import { laengsteKette } from '../../../shared/spiel/kette.ts';
import { alle, eine } from '../../db.ts';
import { ladePausen } from '../../services/serie.ts';
import { KONTEXT_JOINS } from '../ziele/kontext.ts';
import { ausTagesSchluessel, leseJetzt, lokalesDatum, monatsbeginn, plusTage, wochenbeginn } from '../../services/zeit.ts';

const WOCHEN_FUER_3_MONATE = 13;
const MONATE_FUER_12_MONATE = 12;
const ANZAHL_PROJEKTE = 8;

interface Rahmen {
  seit: Date;
  einheit: Statistiken['verlaufEinheit'];
}

function ersterEintrag(): Date | null {
  const zeile = eine<{ erster: string | null }>('SELECT MIN(erstellt_am) AS erster FROM eintraege');
  return zeile?.erster ? new Date(zeile.erster) : null;
}

function bestimmeRahmen(zeitraum: Zeitraum, jetzt: Date): Rahmen {
  if (zeitraum === '3m') {
    return { seit: wochenbeginn(jetzt, WOCHEN_FUER_3_MONATE - 1), einheit: 'woche' };
  }
  if (zeitraum === '12m') {
    return { seit: monatsbeginn(jetzt, MONATE_FUER_12_MONATE - 1), einheit: 'monat' };
  }
  const erster = ersterEintrag() ?? jetzt;
  return { seit: monatsbeginn(erster), einheit: 'monat' };
}

function ladeTagesXp(seit: string): Map<string, number> {
  const werte = new Map<string, number>();
  for (const zeile of alle<{ tag: string; xp: number }>(
    `SELECT date(erstellt_am, 'localtime') AS tag, SUM(xp) AS xp FROM xp_ereignisse
     WHERE xp > 0 AND erstellt_am >= ? GROUP BY tag`,
    seit,
  )) {
    werte.set(zeile.tag, zeile.xp);
  }
  return werte;
}

function naechsterAbschnitt(beginn: Date, einheit: Rahmen['einheit']): Date {
  return einheit === 'woche' ? plusTage(beginn, TAGE_PRO_WOCHE) : new Date(beginn.getFullYear(), beginn.getMonth() + 1, 1);
}

function baueVerlauf(rahmen: Rahmen, tagesXp: Map<string, number>, jetzt: Date): Statistiken['verlauf'] {
  const verlauf: Statistiken['verlauf'] = [];
  for (let beginn = rahmen.seit; beginn <= jetzt; beginn = naechsterAbschnitt(beginn, rahmen.einheit)) {
    verlauf.push({ beginn: lokalesDatum(beginn), xp: 0 });
  }
  for (const [tag, xp] of tagesXp) {
    const datum = ausTagesSchluessel(tag);
    for (let index = verlauf.length - 1; index >= 0; index--) {
      if (ausTagesSchluessel(verlauf[index].beginn) <= datum) {
        verlauf[index].xp += xp;
        break;
      }
    }
  }
  return verlauf;
}

function baueWochentage(tagesXp: Map<string, number>): Statistiken['wochentage'] {
  const summen = new Array<number>(TAGE_PRO_WOCHE).fill(0);
  for (const [tag, xp] of tagesXp) {
    const wochentag = (ausTagesSchluessel(tag).getDay() + TAGE_PRO_WOCHE - 1) % TAGE_PRO_WOCHE;
    summen[wochentag] += xp;
  }
  return summen.map((xp, tag) => ({ tag, xp }));
}

export function ladeStatistiken(zeitraum: Zeitraum, jetzt = leseJetzt()): Statistiken {
  const rahmen = bestimmeRahmen(zeitraum, jetzt);
  const seit = rahmen.seit.toISOString();
  const tagesXp = ladeTagesXp(seit);

  const zaehlungen = eine<Omit<Statistiken['kennzahlen'], 'laengsterStreak'>>(
    `SELECT (SELECT COUNT(*) FROM eintraege WHERE erstellt_am >= ?1) AS eintraege,
            (SELECT COALESCE(SUM(stunden), 0) FROM eintraege WHERE erstellt_am >= ?1) AS stunden,
            (SELECT COUNT(DISTINCT date(erstellt_am, 'localtime')) FROM eintraege WHERE erstellt_am >= ?1) AS aktiveTage,
            (SELECT COUNT(*) FROM eintraege WHERE meilenstein = 1 AND erstellt_am >= ?1) AS meilensteine,
            (SELECT COUNT(*) FROM vorhaben WHERE boss = 1 AND status = 'geschafft' AND abgeschlossen_am >= ?1) AS bosseBesiegt`,
    seit,
  ) ?? { eintraege: 0, stunden: 0, aktiveTage: 0, meilensteine: 0, bosseBesiegt: 0 };
  const aktiveTage = alle<{ tag: string }>(
    `SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege WHERE erstellt_am >= ?`,
    seit,
  ).map((zeile) => zeile.tag);

  const vorlagen = alle<Statistiken['vorlagen'][number]>(
    `SELECT vl.id, vl.name, vl.icon, COALESCE(SUM(px.xp), 0) AS xp, COALESCE(SUM(e.stunden), 0) AS stunden
     FROM eintraege e
     JOIN vorlagen vl ON vl.id = e.vorlage_id
     LEFT JOIN projekt_xp px ON px.eintrag_id = e.id AND px.quelle = 'eintrag'
     WHERE e.erstellt_am >= ?
     GROUP BY vl.id ORDER BY xp DESC`,
    seit,
  );
  const projekte = alle<Statistiken['projekte'][number]>(
    `SELECT p.id, p.name, COALESCE(v.farbe, o.farbe) AS farbe, SUM(px.xp) AS xp
     FROM projekt_xp px
     JOIN projekte p ON p.id = px.projekt_id
     ${KONTEXT_JOINS}
     WHERE px.xp > 0 AND px.erstellt_am >= ?
     GROUP BY p.id ORDER BY xp DESC LIMIT ?`,
    seit,
    ANZAHL_PROJEKTE,
  );

  return {
    kennzahlen: { ...zaehlungen, laengsterStreak: laengsteKette(aktiveTage, [], ladePausen()) },
    verlaufEinheit: rahmen.einheit,
    verlauf: baueVerlauf(rahmen, tagesXp, jetzt),
    vorlagen,
    projekte,
    wochentage: baueWochentage(tagesXp),
  };
}
