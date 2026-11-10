import type { Trainingseinheit } from '../../../shared/api/training.ts';
import { NUR_ABHAKEN } from '../../../shared/spiel/training.ts';
import { ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { schreibeBestwerte } from './bestwerte.ts';
import { bucheEinheit, legeEintragAn, loeseEintrag } from './einheiten.ts';
import { ladeEinheit, ladeRohEinheit, pruefeAenderbar } from './lesen.ts';

export function pruefeSatzKoerper(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ungueltig(NUR_ABHAKEN);
  }
  const schluessel = Object.keys(body);
  const erledigt = (body as { erledigt?: unknown }).erledigt;
  if (schluessel.length !== 1 || schluessel[0] !== 'erledigt' || typeof erledigt !== 'boolean') {
    throw ungueltig(NUR_ABHAKEN);
  }
  return erledigt;
}

export function hakeSatzAb(id: number, erledigt: boolean, jetzt = leseJetzt()): Trainingseinheit {
  return inTransaktion(() => {
    const satz = eine<{ id: number; einheitId: number; erledigt: number }>(
      'SELECT id, einheit_id AS einheitId, erledigt FROM trainingssaetze WHERE id = ?',
      id,
    );
    if (!satz) {
      throw nichtGefunden('Der Satz');
    }
    pruefeAenderbar(satz.einheitId, jetzt);
    if ((satz.erledigt === 1) === erledigt) {
      return ladeEinheit(satz.einheitId, jetzt);
    }
    ausfuehren('UPDATE trainingssaetze SET erledigt = ? WHERE id = ?', Number(erledigt), id);
    const meilenstein = schreibeBestwerte(satz.einheitId, jetzt);
    const arbeit =
      eine<{ n: number }>(
        `SELECT COUNT(*) AS n FROM trainingssaetze WHERE einheit_id = ? AND erledigt = 1 AND aufwaermen = 0`,
        satz.einheitId,
      )?.n ?? 0;
    const einheit = ladeRohEinheit(satz.einheitId);
    if (arbeit === 0) {
      if (einheit.status === 'offen' && einheit.eintragId !== null) {
        loeseEintrag(satz.einheitId);
      } else if (einheit.eintragId !== null) {
        bucheEinheit(satz.einheitId, meilenstein);
      }
    } else if (einheit.eintragId === null) {
      legeEintragAn(satz.einheitId, meilenstein);
    } else {
      bucheEinheit(satz.einheitId, meilenstein);
    }
    return ladeEinheit(satz.einheitId, jetzt);
  });
}
