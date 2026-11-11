import type { Einstellungen } from '../../../shared/api/einstellungen.ts';
import { datumInZone, tagPlus, uhrInZone } from '../../../shared/spiel/datum.ts';
import { HINWEIS_REIHENFOLGE, waehleHinweis, type HinweisAnlass } from '../../../shared/spiel/hinweis.ts';
import { kettenStand, type Pause } from '../../../shared/spiel/kette.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { alle, eine } from '../../db.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { leseHinweisNichtVor, leseHinweisRuhe, leseHinweisSchalter } from '../einstellungen/hinweisSchluessel.ts';

const MINDESTLAENGE = 2;

const TABELLEN = ['eintraege', 'streak_bruecken', 'streak_pausen', 'rueckkehr', 'vorhaben', 'protokoll'] as const;
type Sammeltabelle = (typeof TABELLEN)[number];

/** Gewinner und die übrigen angeschalteten Anlässe. Beide leer heißt: nichts schreiben. */
export interface HinweisSammlung {
  gewinner: HinweisAnlass | null;
  daneben: HinweisAnlass[];
}

interface BossZeile {
  id: number;
  titel: string;
  deadline: string;
}

function leer(): HinweisSammlung {
  return { gewinner: null, daneben: [] };
}

function tabelleDa(name: Sammeltabelle): boolean {
  return eine<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, name) !== undefined;
}

/** Kalendertage der Einträge in der Nutzerzone. Die Heute-Karte bleibt bei der Serverzeit. */
function aktiveTage(zone: string | null): string[] {
  if (!tabelleDa('eintraege')) {
    return [];
  }
  const tage = new Set<string>();
  for (const zeile of alle<{ erstelltAm: string }>('SELECT erstellt_am AS erstelltAm FROM eintraege')) {
    const zeit = new Date(zeile.erstelltAm);
    if (Number.isNaN(zeit.getTime())) {
      continue;
    }
    tage.add(datumInZone(zeit, zone));
  }
  return [...tage];
}

function bruecken(): string[] {
  if (!tabelleDa('streak_bruecken')) {
    return [];
  }
  return alle<{ tag: string }>('SELECT tag FROM streak_bruecken').map((zeile) => zeile.tag);
}

function pausen(): Pause[] {
  if (!tabelleDa('streak_pausen')) {
    return [];
  }
  return alle<{ von: string; bis: string | null }>('SELECT von, bis FROM streak_pausen').map((zeile) => ({
    von: zeile.von,
    bis: zeile.bis,
  }));
}

function streakAnlass(heute: string, zone: string | null): HinweisAnlass | null {
  const stand = kettenStand(aktiveTage(zone), heute, bruecken(), pausen());
  if (!stand.angeknackst || stand.laenge < MINDESTLAENGE) {
    return null;
  }
  return { art: 'streak', name: String(stand.laenge), ziel: '/', bezugId: null };
}

function rueckkehrAnlass(): HinweisAnlass | null {
  if (!tabelleDa('rueckkehr')) {
    return null;
  }
  const offen = eine<{ id: number; fristAm: string }>(
    `SELECT id, frist_am AS fristAm FROM rueckkehr WHERE status = 'offen' ORDER BY id DESC LIMIT 1`,
  );
  if (!offen) {
    return null;
  }
  const schon = eine<{ id: number }>(
    `SELECT id FROM protokoll
     WHERE art = 'push_gesendet' AND bezug_typ = 'rueckkehr' AND bezug_id = ?
     LIMIT 1`,
    offen.id,
  );
  if (schon) {
    return null;
  }
  return { art: 'rueckkehr', name: offen.fristAm, ziel: '/', bezugId: offen.id };
}

function bossAnlass(morgen: string, einstellungen: Einstellungen): HinweisAnlass | null {
  if (!tabelleDa('vorhaben') || !istAn('bossAngriffe', einstellungen)) {
    return null;
  }
  const zeilen = alle<BossZeile>(
    `SELECT id, titel, deadline FROM vorhaben
     WHERE boss = 1 AND status = 'offen' AND deadline = ?`,
    morgen,
  );
  zeilen.sort(
    (a, b) => a.deadline.localeCompare(b.deadline) || a.titel.localeCompare(b.titel, 'de') || a.id - b.id,
  );
  const boss = zeilen[0];
  if (!boss) {
    return null;
  }
  return { art: 'boss', name: boss.titel, ziel: '/', bezugId: boss.id };
}

function schonGesendet(tag: string): boolean {
  return (
    eine<{ id: number }>(`SELECT id FROM protokoll WHERE art = 'push_gesendet' AND tag = ? LIMIT 1`, tag) !== undefined
  );
}

function anlaesseNeben(
  gewinner: HinweisAnlass,
  liste: HinweisAnlass[],
  schalter: Record<HinweisAnlass['art'], boolean>,
): HinweisAnlass[] {
  const daneben: HinweisAnlass[] = [];
  for (const art of HINWEIS_REIHENFOLGE) {
    if (art === gewinner.art || !schalter[art]) {
      continue;
    }
    const treffer = liste.find((anlass) => anlass.art === art);
    if (treffer) {
      daneben.push(treffer);
    }
  }
  return daneben;
}

/** Höchstens ein Hinweis. Liest nur, schreibt keine Zeile und sendet nicht. */
export function sammleHinweise(jetzt = leseJetzt()): HinweisSammlung {
  if (!tabelleDa('protokoll')) {
    return leer();
  }
  const nichtVor = leseHinweisNichtVor();
  if (nichtVor !== null) {
    const grenze = Date.parse(nichtVor);
    if (Number.isFinite(grenze) && jetzt.getTime() < grenze) {
      return leer();
    }
  }
  const einstellungen = ladeEinstellungen();
  const zone = einstellungen.zeitzone;
  const heute = datumInZone(jetzt, zone);
  const uhr = uhrInZone(jetzt, zone);
  const ruhe = leseHinweisRuhe();
  const schalter = leseHinweisSchalter();
  const liste = [streakAnlass(heute, zone), rueckkehrAnlass(), bossAnlass(tagPlus(heute, 1), einstellungen)].filter(
    (anlass): anlass is HinweisAnlass => anlass !== null,
  );
  const gewinner = waehleHinweis({
    stunde: uhr.stunde,
    minute: uhr.minute,
    ruheVon: ruhe.von,
    ruheBis: ruhe.bis,
    schalter,
    schonGesendet: schonGesendet(heute),
    anlaesse: liste,
  });
  if (gewinner === null) {
    return leer();
  }
  return { gewinner, daneben: anlaesseNeben(gewinner, liste, schalter) };
}
