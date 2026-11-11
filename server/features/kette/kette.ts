import type { KetteHeute, SchutzErgebnis } from '../../../shared/api/index.ts';
import {
  ERLAUBTE_PAUSENTAGE,
  brueckentag,
  kettenLaenge,
  kettenStand,
  pausentageZwischen,
  tageZwischen,
  tagInPause,
} from '../../../shared/spiel/kette.ts';
import { ruhendeFrist, schutzHeuteMoeglich, schwelleFuerEintrag } from '../../../shared/spiel/schutz.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { leseSchutzSchwelle, leseSchutzVorrat, schreibeSchutzSchwelle, schreibeSchutzVorrat } from '../einstellungen/einstellungen.ts';
import { ladeAktiveTage, ladeBrueckentage, ladePausen, ladeSerie } from '../../services/serie.ts';
import { leseJetzt, lokalesDatum } from '../../services/zeit.ts';

export const SCHUTZ_HEUTE_NEIN = 'Der Schutz kann heute nicht eingesetzt werden.';

const BRUCH_ABSTAND = ERLAUBTE_PAUSENTAGE + 2;

function letzterBis(tage: readonly string[], heute: string): string | null {
  let letzter: string | null = null;
  for (const tag of tage) {
    if (tag <= heute && (letzter === null || tag > letzter)) {
      letzter = tag;
    }
  }
  return letzter;
}

function schutzAntwort(heute: string): SchutzErgebnis {
  return {
    serie: ladeSerie(heute),
    schutz: schutzHeuteMoeglich(ladeAktiveTage(), heute, ladeBrueckentage(), leseSchutzVorrat()),
  };
}

export function ladeKetteHeute(jetzt = leseJetzt()): KetteHeute {
  const heute = lokalesDatum(jetzt);
  const tage = ladeAktiveTage();
  const bruecken = ladeBrueckentage();
  const pausen = ladePausen();
  const serie = kettenStand(tage, heute, bruecken, pausen);
  const vorrat = leseSchutzVorrat();
  const schutz = schutzHeuteMoeglich(tage, heute, bruecken, vorrat, pausen);
  const letzter = letzterBis(
    pausen.length === 0 ? tage : tage.filter((tag) => !tagInPause(tag, pausen)),
    heute,
  );
  const offen = eine<{ geoeffnetAm: string; fristAm: string }>(
    `SELECT geoeffnet_am AS geoeffnetAm, frist_am AS fristAm FROM rueckkehr WHERE status = 'offen' ORDER BY id DESC LIMIT 1`,
  );
  const rueckkehr = !offen
    ? null
    : pausen.length === 0 || heute <= ruhendeFrist(offen.geoeffnetAm, offen.fristAm, heute, pausen)
      ? { fristAm: offen.fristAm }
      : null;
  return {
    schutz,
    schutzLaenge: schutz && letzter !== null ? kettenLaenge(tage, letzter, bruecken, pausen) : null,
    rueckkehr,
    angeschlagen: serie.angeknackst && serie.laenge >= 2 ? { laenge: serie.laenge } : null,
    serie,
    heuteErfasst: letzter === heute,
  };
}

export function setzeSchutzEin(jetzt = leseJetzt()): SchutzErgebnis {
  const heute = lokalesDatum(jetzt);
  const tage = ladeAktiveTage();
  const bruecken = ladeBrueckentage();
  const pausen = ladePausen();
  if (tagInPause(heute, pausen)) {
    throw ungueltig(SCHUTZ_HEUTE_NEIN);
  }
  const letzter = letzterBis(
    pausen.length === 0 ? tage : tage.filter((tag) => !tagInPause(tag, pausen)),
    heute,
  );
  if (
    letzter !== null &&
    tageZwischen(letzter, heute) - pausentageZwischen(letzter, heute, pausen) === BRUCH_ABSTAND &&
    bruecken.includes(brueckentag(letzter, pausen))
  ) {
    return schutzAntwort(heute);
  }
  if (letzter === null || !schutzHeuteMoeglich(tage, heute, bruecken, leseSchutzVorrat(), pausen)) {
    throw ungueltig(SCHUTZ_HEUTE_NEIN);
  }
  const bruecke = brueckentag(letzter, pausen);
  inTransaktion(() => {
    const vorhanden = eine<{ id: number }>('SELECT id FROM streak_bruecken WHERE tag = ?', bruecke);
    if (vorhanden) {
      return;
    }
    ausfuehren('INSERT INTO streak_bruecken (tag) VALUES (?)', bruecke);
    schreibeSchutzVorrat(0);
    ausfuehren(`INSERT INTO protokoll (art, tag) VALUES ('schutz_eingesetzt', ?)`, bruecke);
    const offen = alle<{ id: number }>(
      `SELECT id FROM rueckkehr WHERE status = 'offen' AND geoeffnet_am = ? AND eintrag_id IS NULL`,
      heute,
    );
    if (offen.length === 0) {
      return;
    }
    for (const zeile of offen) {
      ausfuehren('DELETE FROM rueckkehr WHERE id = ?', zeile.id);
    }
    ausfuehren(`DELETE FROM protokoll WHERE art = 'rueckkehr_offen' AND tag = ?`, heute);
  });
  return schutzAntwort(heute);
}

/** Nur aus erstelleEintrag, nach dem Schreiben des Tages. Keine XP. */
export function verdieneSchutz(tag: string, eintragId: number): void {
  const tage = ladeAktiveTage();
  const bruecken = ladeBrueckentage();
  const andere =
    eine<{ anzahl: number }>(
      `SELECT COUNT(*) AS anzahl FROM eintraege WHERE id <> ? AND date(erstellt_am, 'localtime') = ?`,
      eintragId,
      tag,
    )?.anzahl ?? 0;
  const pausen = ladePausen();
  const laengeNachher = kettenLaenge(tage, tag, bruecken, pausen);
  const laengeVorher =
    andere > 0 ? laengeNachher : kettenStand(tage.filter((eintrag) => eintrag !== tag), tag, bruecken, pausen).laenge;
  const schwelle = leseSchutzSchwelle();
  const vorrat = leseSchutzVorrat();
  const entscheid = schwelleFuerEintrag({ laengeVorher, laengeNachher, vorrat, schwelle });
  const vorherBit: 0 | 1 = vorrat >= 1 ? 1 : 0;
  if (schwelle !== null && entscheid.schwelle === schwelle && entscheid.vorrat === vorherBit && !entscheid.verdient) {
    return;
  }
  schreibeSchutzSchwelle(entscheid.schwelle);
  if (entscheid.vorrat !== vorherBit) {
    schreibeSchutzVorrat(entscheid.vorrat);
  }
  if (entscheid.verdient) {
    ausfuehren(`INSERT INTO protokoll (art, tag) VALUES ('schutz_verdient', ?)`, tag);
  }
}
