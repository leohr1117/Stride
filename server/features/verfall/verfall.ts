import type { AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { zeitverfallXp, type VerfallStufe } from '../../../shared/spiel/belastung.ts';
import { verfallFunktion } from '../../../shared/spiel/funktionen.ts';
import { tageZwischen } from '../../../shared/spiel/kette.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../../shared/spiel/level.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { aktiveTypen, ladeAttributXp } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { lokalesDatum } from '../../services/zeit.ts';

interface VerfallKandidat {
  id: number;
  typ: AttributTyp;
  stufe: VerfallStufe;
  abgerechnetBis: string | null;
}

function zaehleAktiveTage(attributId: number, von: string, bis: string): number {
  return eine<{ tage: number }>(
    `SELECT COUNT(DISTINCT date(erstellt_am, 'localtime')) AS tage FROM xp_ereignisse
     WHERE attribut_id = ? AND xp > 0 AND date(erstellt_am, 'localtime') >= ? AND date(erstellt_am, 'localtime') < ?`,
    attributId,
    von,
    bis,
  )?.tage ?? 0;
}

export function rechneZeitverfallAb(jetzt = new Date()): void {
  const heute = lokalesDatum(jetzt);
  const kandidaten = alle<VerfallKandidat>(
    `SELECT id, typ, verfall_zeit AS stufe, verfall_bis AS abgerechnetBis FROM attribute
     WHERE archiviert = 0 AND verfall_zeit <> 'aus' AND (verfall_bis IS NULL OR verfall_bis < ?)`,
    heute,
  );
  if (kandidaten.length === 0) {
    return;
  }

  const funktionen = ladeEinstellungen().funktionen;
  const typen = aktiveTypen();
  const zeitpunkt = jetzt.toISOString();
  inTransaktion(() => {
    for (const kandidat of kandidaten) {
      const verfallAktiv = funktionen[verfallFunktion(kandidat.typ)];
      if (verfallAktiv && typen.includes(kandidat.typ) && kandidat.abgerechnetBis !== null) {
        const tage = tageZwischen(kandidat.abgerechnetBis, heute);
        const inaktiveTage = tage - zaehleAktiveTage(kandidat.id, kandidat.abgerechnetBis, heute);
        const vorhanden = ladeAttributXp(kandidat.id);
        const levelKosten = berechneLevel(vorhanden, LEVEL_KURVEN[kandidat.typ]).xpFuerNaechstes;
        const abzug = zeitverfallXp(inaktiveTage, levelKosten, vorhanden, kandidat.stufe);
        if (abzug > 0) {
          bucheAttributXp(
            { quelle: 'verfall', attributId: kandidat.id, xp: -abzug, eintragId: null, vorhabenId: null },
            zeitpunkt,
          );
        }
      }
      ausfuehren('UPDATE attribute SET verfall_bis = ? WHERE id = ?', heute, kandidat.id);
    }
  });
}
