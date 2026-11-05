import { ausfuehren, eine } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { ladeAttributXp } from '../attribute/attribute.ts';

export interface Zahlung {
  bezahltAttributId: number | null;
  betrag: number;
}

export const KEINE_ZAHLUNG: Zahlung = { bezahltAttributId: null, betrag: 0 };

export function loeseZahlung(bisher: Zahlung | null, angabe: { bezahltAttributId?: number | null; betrag?: number }): Zahlung {
  const attributId = angabe.bezahltAttributId !== undefined ? angabe.bezahltAttributId : (bisher?.bezahltAttributId ?? null);
  const betrag = angabe.betrag !== undefined ? angabe.betrag : (bisher?.betrag ?? 0);
  if (!Number.isInteger(betrag) || betrag < 0) {
    throw ungueltig('Der Betrag muss eine ganze Zahl ab 0 sein.');
  }
  if (attributId === null || betrag === 0) {
    if (betrag > 0) {
      throw ungueltig('Eine Bezahlung braucht ein Attribut.');
    }
    return KEINE_ZAHLUNG;
  }
  return { bezahltAttributId: attributId, betrag };
}

export function anlageHinterAltenBuchungen(investitionId: number): void {
  const zeile = eine<{ angelegt: string; alt: string | null }>(
    `SELECT n.erstellt_am AS angelegt,
            (SELECT MAX(x.erstellt_am) FROM xp_ereignisse x WHERE x.investition_id = n.id) AS alt
     FROM investitionen n
     WHERE n.id = ?`,
    investitionId,
  );
  if (!zeile?.alt || zeile.angelegt > zeile.alt) {
    return;
  }
  const millis = Date.parse(zeile.alt);
  if (Number.isNaN(millis)) {
    return;
  }
  const danach = new Date(millis + 1).toISOString();
  if (!(danach > zeile.alt)) {
    return;
  }
  ausfuehren('UPDATE investitionen SET erstellt_am = ? WHERE id = ?', danach, investitionId);
}

function zeitAbAnlage(investitionId: number, zeitpunkt: string): string {
  const anlage = eine<{ erstelltAm: string }>('SELECT erstellt_am AS erstelltAm FROM investitionen WHERE id = ?', investitionId);
  if (anlage && zeitpunkt < anlage.erstelltAm) {
    return anlage.erstelltAm;
  }
  return zeitpunkt;
}

export function bucheZahlungsDifferenz(investitionId: number, bisher: Zahlung, neu: Zahlung, zeitpunkt: string): void {
  const bewegungen = new Map<number, number>();
  const dazu = (attributId: number | null, xp: number): void => {
    if (attributId === null || xp === 0) {
      return;
    }
    bewegungen.set(attributId, (bewegungen.get(attributId) ?? 0) + xp);
  };
  dazu(bisher.bezahltAttributId, bisher.betrag);
  dazu(neu.bezahltAttributId, -neu.betrag);

  for (const [attributId, xp] of bewegungen) {
    if (xp < 0 && ladeAttributXp(attributId) < -xp) {
      throw ungueltig('Dafür ist nicht genug XP da.');
    }
  }
  for (const [attributId, xp] of bewegungen) {
    if (xp === 0) {
      continue;
    }
    bucheAttributXp(
      {
        quelle: 'investition',
        attributId,
        xp,
        eintragId: null,
        vorhabenId: null,
        investitionId,
      },
      zeitAbAnlage(investitionId, zeitpunkt),
    );
  }
}
