import type { Rueckblick, RueckblickAntworten, RueckblickErgebnis } from '../../../shared/api/index.ts';
import { erfolgName, kennzahlAusSchluessel } from '../../../shared/spiel/erfolge.ts';
import { erfolgSichtbar } from '../../../shared/spiel/sichtbarkeit.ts';
import { TAGE_PRO_WOCHE } from '../../../shared/spiel/datum.ts';
import { RUECKBLICK } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, inTransaktion, platzhalter } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { ladeEinstellungen, pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { aktiveTypen, aktivesAttribut } from '../attribute/attribute.ts';
import { bucheAttributXp, erstelleBelohnung, ladeLevelStand } from '../../services/fortschritt.ts';
import { ausTagesSchluessel, lokalesDatum, plusTage, wochenbeginn } from '../../services/zeit.ts';

const MONTAG = 1;

interface RueckblickZeile extends RueckblickAntworten {
  belohnt: number;
}

interface Zeitfenster {
  von: string;
  bis: string;
}

export function aktuelleWoche(jetzt = new Date()): string {
  return lokalesDatum(wochenbeginn(jetzt));
}

function pruefeWoche(woche: string, jetzt: Date): Date {
  const beginn = ausTagesSchluessel(woche);
  if (beginn.getDay() !== MONTAG) {
    throw ungueltig('Eine Woche beginnt immer an einem Montag.');
  }
  if (woche > aktuelleWoche(jetzt)) {
    throw ungueltig('Ein Rückblick auf eine künftige Woche ist nicht möglich.');
  }
  return beginn;
}

function fenster(beginn: Date): Zeitfenster {
  return { von: beginn.toISOString(), bis: plusTage(beginn, TAGE_PRO_WOCHE).toISOString() };
}

function ladeXp({ von, bis }: Zeitfenster): number {
  return eine<{ xp: number }>(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE xp > 0 AND erstellt_am >= ? AND erstellt_am < ?',
    von,
    bis,
  )?.xp ?? 0;
}

function istBonusMoeglich(woche: string, jetzt: Date): boolean {
  return woche >= lokalesDatum(wochenbeginn(jetzt, RUECKBLICK.bonusWochenZurueck));
}

export function ladeRueckblick(woche: string, jetzt = new Date()): Rueckblick {
  const beginn = pruefeWoche(woche, jetzt);
  const zeitraum = fenster(beginn);
  const { von, bis } = zeitraum;

  const eintraege = eine<{ anzahl: number; tage: number }>(
    `SELECT COUNT(*) AS anzahl, COUNT(DISTINCT date(erstellt_am, 'localtime')) AS tage
     FROM eintraege WHERE erstellt_am >= ? AND erstellt_am < ?`,
    von,
    bis,
  ) ?? { anzahl: 0, tage: 0 };
  const besterTag = eine<{ datum: string; xp: number }>(
    `SELECT date(erstellt_am, 'localtime') AS datum, SUM(xp) AS xp FROM xp_ereignisse
     WHERE xp > 0 AND erstellt_am >= ? AND erstellt_am < ?
     GROUP BY datum ORDER BY xp DESC LIMIT 1`,
    von,
    bis,
  );
  const typen = aktiveTypen();
  const attribute = alle<Rueckblick['attribute'][number]>(
    `SELECT a.id AS attributId, a.name, a.farbe, SUM(x.xp) AS xp
     FROM xp_ereignisse x JOIN attribute a ON a.id = x.attribut_id
     WHERE x.erstellt_am >= ? AND x.erstellt_am < ? AND a.archiviert = 0 AND a.typ IN (${platzhalter(typen.length)})
     GROUP BY a.id HAVING SUM(x.xp) <> 0
     ORDER BY xp DESC`,
    von,
    bis,
    ...typen,
  );
  const meilensteine = alle<Rueckblick['meilensteine'][number]>(
    `SELECT COALESCE(vh.titel, NULLIF(e.notiz, ''), vl.name) AS titel, p.name AS projektName
     FROM eintraege e
     LEFT JOIN projekte p ON p.id = e.projekt_id
     JOIN vorlagen vl ON vl.id = e.vorlage_id
     LEFT JOIN vorhaben vh ON vh.id = e.vorhaben_id
     WHERE e.meilenstein = 1 AND e.erstellt_am >= ? AND e.erstellt_am < ?
     ORDER BY e.erstellt_am`,
    von,
    bis,
  );
  const erfolge: string[] = [];
  const sichtbarkeit = ladeEinstellungen();
  for (const { schluessel } of alle<{ schluessel: string }>(
    'SELECT schluessel FROM erfolge WHERE erreicht_am >= ? AND erreicht_am < ? ORDER BY erreicht_am',
    von,
    bis,
  )) {
    const kennzahl = kennzahlAusSchluessel(schluessel);
    const name = erfolgName(schluessel);
    if (name !== null && kennzahl !== null && erfolgSichtbar(kennzahl, sichtbarkeit)) {
      erfolge.push(name);
    }
  }
  const gespeichert = eine<RueckblickZeile>('SELECT gut, lernen, fokus, belohnt FROM rueckblicke WHERE woche = ?', woche);
  const belohnt = gespeichert?.belohnt === 1;

  return {
    woche,
    wocheBis: lokalesDatum(plusTage(beginn, TAGE_PRO_WOCHE - 1)),
    aktuelleWoche: woche === aktuelleWoche(jetzt),
    xp: ladeXp(zeitraum),
    xpVorwoche: ladeXp(fenster(plusTage(beginn, -TAGE_PRO_WOCHE))),
    eintraege: eintraege.anzahl,
    aktiveTage: eintraege.tage,
    besterTag: besterTag ?? null,
    attribute,
    meilensteine,
    erfolge,
    antworten: { gut: gespeichert?.gut ?? '', lernen: gespeichert?.lernen ?? '', fokus: gespeichert?.fokus ?? '' },
    belohnt,
    bonusMoeglich: !belohnt && istBonusMoeglich(woche, jetzt) && aktivesAttribut('geist') !== null,
  };
}

function hatInhalt(antworten: RueckblickAntworten): boolean {
  return antworten.gut.trim() !== '' || antworten.lernen.trim() !== '' || antworten.fokus.trim() !== '';
}

export function speichereRueckblick(woche: string, antworten: RueckblickAntworten, jetzt = new Date()): RueckblickErgebnis {
  pruefeFunktion('rueckblick');
  pruefeWoche(woche, jetzt);
  const bisher = eine<{ belohnt: number }>('SELECT belohnt FROM rueckblicke WHERE woche = ?', woche);
  const geistId = aktivesAttribut('geist');
  const belohnen =
    geistId !== null && bisher?.belohnt !== 1 && hatInhalt(antworten) && istBonusMoeglich(woche, jetzt);
  const zeitpunkt = jetzt.toISOString();
  const vorher = ladeLevelStand(null);

  const buchungen = inTransaktion(() => {
    ausfuehren(
      `INSERT INTO rueckblicke (woche, gut, lernen, fokus, belohnt, geaendert_am) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (woche) DO UPDATE SET gut = excluded.gut, lernen = excluded.lernen, fokus = excluded.fokus,
         belohnt = MAX(belohnt, excluded.belohnt), geaendert_am = excluded.geaendert_am`,
      woche,
      antworten.gut,
      antworten.lernen,
      antworten.fokus,
      Number(belohnen),
      zeitpunkt,
    );
    if (!belohnen || geistId === null) {
      return [];
    }
    return [
      bucheAttributXp(
        { quelle: 'rueckblick', attributId: geistId, xp: RUECKBLICK.geistXp, eintragId: null, vorhabenId: null },
        zeitpunkt,
      ),
    ];
  });

  const belohnung =
    buchungen.length > 0
      ? erstelleBelohnung({
          buchungen,
          boni: [{ quelle: 'rueckblick', label: 'Wochenrückblick', xp: RUECKBLICK.geistXp }],
          meilenstein: false,
          projekt: null,
          vorher,
          nachher: ladeLevelStand(null),
        })
      : null;
  return { rueckblick: ladeRueckblick(woche, jetzt), belohnung };
}
