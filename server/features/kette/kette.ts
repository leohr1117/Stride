import type { KetteHeute, SchutzErgebnis } from '../../../shared/api/index.ts';
import { ERLAUBTE_PAUSENTAGE, brueckentag, kettenLaenge, kettenStand, tageZwischen } from '../../../shared/spiel/kette.ts';
import { schutzHeuteMoeglich, schwelleFuerEintrag } from '../../../shared/spiel/schutz.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { leseSchutzSchwelle, leseSchutzVorrat, schreibeSchutzSchwelle, schreibeSchutzVorrat } from '../einstellungen/einstellungen.ts';
import { ladeAktiveTage, ladeBrueckentage, ladeSerie } from '../../services/serie.ts';
import { lokalesDatum } from '../../services/zeit.ts';

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

export function ladeKetteHeute(jetzt = new Date()): KetteHeute {
  const heute = lokalesDatum(jetzt);
  const tage = ladeAktiveTage();
  const bruecken = ladeBrueckentage();
  const serie = kettenStand(tage, heute, bruecken);
  const offen = eine<{ fristAm: string }>(
    `SELECT frist_am AS fristAm FROM rueckkehr WHERE status = 'offen' ORDER BY id DESC LIMIT 1`,
  );
  return {
    schutz: schutzHeuteMoeglich(tage, heute, bruecken, leseSchutzVorrat()),
    rueckkehr: offen ? { fristAm: offen.fristAm } : null,
    angeschlagen: serie.angeknackst && serie.laenge >= 2 ? { laenge: serie.laenge } : null,
  };
}

export function setzeSchutzEin(jetzt = new Date()): SchutzErgebnis {
  const heute = lokalesDatum(jetzt);
  const tage = ladeAktiveTage();
  const bruecken = ladeBrueckentage();
  const letzter = letzterBis(tage, heute);
  if (
    letzter !== null &&
    tageZwischen(letzter, heute) === BRUCH_ABSTAND &&
    bruecken.includes(brueckentag(letzter))
  ) {
    return schutzAntwort(heute);
  }
  if (letzter === null || !schutzHeuteMoeglich(tage, heute, bruecken, leseSchutzVorrat())) {
    throw ungueltig(SCHUTZ_HEUTE_NEIN);
  }
  const bruecke = brueckentag(letzter);
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
  const laengeNachher = kettenLaenge(tage, tag, bruecken);
  const laengeVorher =
    andere > 0 ? laengeNachher : kettenStand(tage.filter((eintrag) => eintrag !== tag), tag, bruecken).laenge;
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
