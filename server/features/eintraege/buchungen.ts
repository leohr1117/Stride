import type { InvestitionsBuchung } from '../../../shared/api/index.ts';
import { alle, platzhalter } from '../../db.ts';

export function ladeInvestitionsBuchungen(ids: number[]): Map<number, InvestitionsBuchung> {
  if (ids.length === 0) {
    return new Map();
  }
  const zeilen = alle<InvestitionsBuchung>(
    `SELECT x.id, x.xp, x.erstellt_am AS erstelltAm,
            CASE WHEN i.id IS NULL OR i.erstellt_am > x.erstellt_am THEN NULL ELSE x.investition_id END AS investitionId,
            CASE WHEN i.id IS NULL OR i.erstellt_am > x.erstellt_am THEN NULL ELSE i.name END AS name,
            CASE WHEN i.id IS NULL OR i.erstellt_am > x.erstellt_am THEN NULL ELSE i.icon END AS icon,
            a.name AS attributName, a.kennung AS attributKennung
     FROM xp_ereignisse x
     JOIN attribute a ON a.id = x.attribut_id
     LEFT JOIN investitionen i ON i.id = x.investition_id
     WHERE x.quelle = 'investition' AND x.id IN (${platzhalter(ids.length)})`,
    ...ids,
  );
  return new Map(zeilen.map((zeile) => [zeile.id, zeile]));
}
