import { kettenLaenge, kettenStand, type KettenStand } from '../../shared/spiel/kette.ts';
import { momentumFuerSerie } from '../../shared/spiel/momentum.ts';
import { alle, gemerkt } from '../db.ts';

export function ladeAktiveTage(): string[] {
  return gemerkt('aktive-tage', () =>
    alle<{ tag: string }>(`SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege`).map((zeile) => zeile.tag),
  );
}

export function ladeSerie(heute: string): KettenStand {
  return kettenStand(ladeAktiveTage(), heute);
}

export function momentumFuerTag(tag: string): number {
  return momentumFuerSerie(kettenLaenge([...ladeAktiveTage(), tag], tag));
}
