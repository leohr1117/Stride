import { kettenLaenge, kettenStand, type KettenStand } from '../../shared/spiel/kette.ts';
import { momentumFuerSerie } from '../../shared/spiel/momentum.ts';
import { alle, gemerkt } from '../db.ts';

export function ladeAktiveTage(): string[] {
  return gemerkt('aktive-tage', () =>
    alle<{ tag: string }>(`SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege`).map((zeile) => zeile.tag),
  );
}

/** Nicht cachen: der Lesecache verfällt nur beim Schreiben von eintraege, Brücken ändern sich allein. */
export function ladeBrueckentage(): string[] {
  return alle<{ tag: string }>('SELECT tag FROM streak_bruecken ORDER BY tag').map((zeile) => zeile.tag);
}

export function ladeSerie(heute: string): KettenStand {
  return kettenStand(ladeAktiveTage(), heute, ladeBrueckentage());
}

export function momentumFuerTag(tag: string): number {
  return momentumFuerSerie(kettenLaenge([...ladeAktiveTage(), tag], tag, ladeBrueckentage()));
}
