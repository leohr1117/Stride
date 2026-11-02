import type { AttributKennung } from '../../../shared/spiel/begriffe.ts';
import { rueckkehrFaellig } from '../../../shared/spiel/schutz.ts';
import { NEUER_ANLAUF } from '../../../shared/spiel/xp.ts';
import { ausfuehren, eine, inTransaktion } from '../../db.ts';
import { aktivesAttribut } from '../attribute/attribute.ts';
import { leseRueckkehrAb, schreibeRueckkehrAb } from '../einstellungen/einstellungen.ts';
import { bucheAttributXp, type AttributBuchung } from '../../services/fortschritt.ts';
import { ladeAktiveTage, ladeBrueckentage } from '../../services/serie.ts';
import { leseJetzt, lokalesDatum } from '../../services/zeit.ts';

export interface RueckkehrBuchung {
  buchungen: AttributBuchung[];
  xp: number;
}

interface GeschlosseneRueckkehr {
  status: string;
  fristAm: string;
  eintragTag: string | null;
}

interface OffeneRueckkehr {
  id: number;
  fristAm: string;
  eintragId: number | null;
}

const LEER: RueckkehrBuchung = { buchungen: [], xp: 0 };

function esGibtOffene(): boolean {
  return eine<{ id: number }>(`SELECT id FROM rueckkehr WHERE status = 'offen' LIMIT 1`) !== undefined;
}

function letzterSchluss(): string | null {
  const zeile = eine<GeschlosseneRueckkehr>(
    `SELECT r.status, r.frist_am AS fristAm, date(e.erstellt_am, 'localtime') AS eintragTag
     FROM rueckkehr r
     LEFT JOIN eintraege e ON e.id = r.eintrag_id
     WHERE r.status IN ('geschafft', 'zu')
     ORDER BY r.id DESC
     LIMIT 1`,
  );
  if (!zeile) {
    return null;
  }
  if (zeile.status === 'geschafft' && zeile.eintragTag) {
    return zeile.eintragTag;
  }
  return zeile.fristAm;
}

function protokoll(art: string, rueckkehrId: number, tag: string): void {
  ausfuehren(
    `INSERT INTO protokoll (art, bezug_typ, bezug_id, tag) VALUES (?, 'rueckkehr', ?, ?)`,
    art,
    rueckkehrId,
    tag,
  );
}

function loescheProtokoll(art: string, rueckkehrId: number): void {
  ausfuehren('DELETE FROM protokoll WHERE art = ? AND bezug_id = ?', art, rueckkehrId);
}

/** Eine offene Rückkehr nach der Frist wird zu, ohne XP und ohne offene Zeile. */
function verstreicheOffene(heute: string): void {
  const offen = eine<OffeneRueckkehr>(
    `SELECT id, frist_am AS fristAm, eintrag_id AS eintragId
     FROM rueckkehr WHERE status = 'offen' ORDER BY id DESC LIMIT 1`,
  );
  if (!offen || offen.eintragId !== null || heute <= offen.fristAm) {
    return;
  }
  ausfuehren(`UPDATE rueckkehr SET status = 'zu' WHERE id = ?`, offen.id);
  loescheProtokoll('rueckkehr_offen', offen.id);
  protokoll('rueckkehr_zu', offen.id, heute);
}

function hatAnlaufOderWeitermachen(eintragId: number): boolean {
  const anzahl =
    eine<{ n: number }>(
      `SELECT COUNT(*) AS n FROM xp_ereignisse WHERE eintrag_id = ? AND quelle IN ('anlauf', 'weitermachen')`,
      eintragId,
    )?.n ?? 0;
  return anzahl > 0;
}

function bucheRueckkehr(eintragId: number, zeitpunkt: string): RueckkehrBuchung {
  if (hatAnlaufOderWeitermachen(eintragId)) {
    return LEER;
  }
  const paare: readonly [AttributKennung, number][] = [
    ['disziplin', NEUER_ANLAUF.disziplin],
    ['geist', NEUER_ANLAUF.geist],
  ];
  const buchungen: AttributBuchung[] = [];
  let xp = 0;
  for (const [kennung, betrag] of paare) {
    const attributId = aktivesAttribut(kennung);
    if (attributId === null || betrag <= 0) {
      continue;
    }
    buchungen.push(
      bucheAttributXp({ quelle: 'rueckkehr', attributId, xp: betrag, eintragId, vorhabenId: null }, zeitpunkt),
    );
    xp += betrag;
  }
  return { buchungen, xp };
}

/** Im onRequest-Hook und zu Beginn von erstelleEintrag. Idempotent, keine XP. */
export function pflegeRueckkehr(jetzt = leseJetzt()): void {
  const heute = lokalesDatum(jetzt);
  inTransaktion(() => {
    if (leseRueckkehrAb() === null) {
      schreibeRueckkehrAb(heute);
    }
    verstreicheOffene(heute);
    const entscheid = rueckkehrFaellig({
      aktiveTage: ladeAktiveTage(),
      heute,
      bruecken: ladeBrueckentage(),
      rueckkehrAb: leseRueckkehrAb(),
      offen: esGibtOffene(),
      schlussAm: letzterSchluss(),
    });
    if (!entscheid.faellig || entscheid.status === null || entscheid.bruchtag === null || entscheid.fristAm === null) {
      return;
    }
    const { id } = ausfuehren(
      `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES (?, ?, ?)`,
      entscheid.status,
      entscheid.bruchtag,
      entscheid.fristAm,
    );
    protokoll(entscheid.status === 'offen' ? 'rueckkehr_offen' : 'rueckkehr_zu', id, heute);
  });
}

/** Nur aus erstelleEintrag, nachdem die anderen Boni des Eintrags geschrieben sind. */
export function erfuelleRueckkehr(eintragId: number, tag: string, zeitpunkt: string): RueckkehrBuchung {
  return inTransaktion(() => {
    const offen = eine<{ id: number }>(
      `SELECT id FROM rueckkehr
       WHERE status = 'offen' AND geoeffnet_am <= ? AND frist_am >= ?
       ORDER BY id LIMIT 1`,
      tag,
      tag,
    );
    if (!offen) {
      return LEER;
    }
    ausfuehren(`UPDATE rueckkehr SET status = 'geschafft', eintrag_id = ? WHERE id = ?`, eintragId, offen.id);
    protokoll('rueckkehr_geschafft', offen.id, tag);
    return bucheRueckkehr(eintragId, zeitpunkt);
  });
}

/**
 * Nach dem Löschen des erfüllenden Eintrags. Die XP sind per Fremdschlüssel weg.
 * Keine negative XP: entweder neu buchen oder nichts.
 */
export function haengeRueckkehrUm(rueckkehrId: number, geoeffnetAm: string, fristAm: string, heute: string): void {
  const anderer = eine<{ id: number; erstelltAm: string }>(
    `SELECT id, erstellt_am AS erstelltAm FROM eintraege
     WHERE date(erstellt_am, 'localtime') >= ? AND date(erstellt_am, 'localtime') <= ?
     ORDER BY date(erstellt_am, 'localtime'), id
     LIMIT 1`,
    geoeffnetAm,
    fristAm,
  );
  if (anderer) {
    ausfuehren(`UPDATE rueckkehr SET status = 'geschafft', eintrag_id = ? WHERE id = ?`, anderer.id, rueckkehrId);
    bucheRueckkehr(anderer.id, anderer.erstelltAm);
    return;
  }
  loescheProtokoll('rueckkehr_geschafft', rueckkehrId);
  if (heute <= fristAm) {
    ausfuehren(`UPDATE rueckkehr SET status = 'offen', eintrag_id = NULL WHERE id = ?`, rueckkehrId);
    return;
  }
  ausfuehren(`UPDATE rueckkehr SET status = 'zu', eintrag_id = NULL WHERE id = ?`, rueckkehrId);
  loescheProtokoll('rueckkehr_offen', rueckkehrId);
  protokoll('rueckkehr_zu', rueckkehrId, heute);
}
