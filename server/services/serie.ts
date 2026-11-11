import { tagPlus } from '../../shared/spiel/datum.ts';
import { kettenLaenge, kettenStand, tagInPause, type KettenStand, type Pause } from '../../shared/spiel/kette.ts';
import { momentumFuerSerie } from '../../shared/spiel/momentum.ts';
import { alle, ausfuehren, eine, gemerkt } from '../db.ts';

export function ladeAktiveTage(): string[] {
  return gemerkt('aktive-tage', () =>
    alle<{ tag: string }>(`SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege`).map((zeile) => zeile.tag),
  );
}

/** Nicht cachen: der Lesecache verfällt nur beim Schreiben von eintraege, Brücken ändern sich allein. */
export function ladeBrueckentage(): string[] {
  return alle<{ tag: string }>('SELECT tag FROM streak_bruecken ORDER BY tag').map((zeile) => zeile.tag);
}

export function ladePausen(): Pause[] {
  return alle<{ von: string; bis: string | null }>('SELECT von, bis FROM streak_pausen ORDER BY von, id').map((zeile) => ({
    von: zeile.von,
    bis: zeile.bis,
  }));
}

export function pausiereStreak(heute: string): void {
  const offen = eine<{ id: number }>('SELECT id FROM streak_pausen WHERE bis IS NULL LIMIT 1');
  if (offen) {
    return;
  }
  ausfuehren('INSERT INTO streak_pausen (von, bis) VALUES (?, NULL)', heute);
}

export function setzeStreakFort(heute: string): void {
  const offen = eine<{ id: number; von: string }>(
    'SELECT id, von FROM streak_pausen WHERE bis IS NULL ORDER BY id DESC LIMIT 1',
  );
  if (!offen) {
    return;
  }
  const gestern = tagPlus(heute, -1);
  if (gestern < offen.von) {
    ausfuehren('DELETE FROM streak_pausen WHERE id = ?', offen.id);
    return;
  }
  ausfuehren('UPDATE streak_pausen SET bis = ? WHERE id = ?', gestern, offen.id);
}

export function ladeSerie(heute: string): KettenStand {
  return kettenStand(ladeAktiveTage(), heute, ladeBrueckentage(), ladePausen());
}

export function momentumFuerTag(tag: string): number {
  const pausen = ladePausen();
  if (tagInPause(tag, pausen)) {
    return 1;
  }
  return momentumFuerSerie(kettenLaenge([...ladeAktiveTage(), tag], tag, ladeBrueckentage(), pausen));
}
