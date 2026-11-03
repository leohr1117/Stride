import type { InvestitionsRhythmus } from '../../../shared/spiel/betragVorschlag.ts';
import { VORSCHLAG_WOCHEN } from '../../../shared/spiel/betragVorschlag.ts';
import { ausTagesSchluessel } from '../../../shared/spiel/datum.ts';
import { alle } from '../../db.ts';
import { leseJetzt, lokalesDatum, wochenbeginn } from '../../services/zeit.ts';

interface Summe {
  id: number;
  xp: number;
}

export function ladeInvestitionsRhythmus(jetzt = leseJetzt()): InvestitionsRhythmus {
  const seit = wochenbeginn(jetzt, VORSCHLAG_WOCHEN - 1).toISOString();
  const bis = jetzt.toISOString();
  const attribute = alle<Summe>(
    `SELECT attribut_id AS id, SUM(xp) AS xp FROM xp_ereignisse
     WHERE xp > 0 AND erstellt_am >= ? AND erstellt_am <= ? GROUP BY attribut_id`,
    seit,
    bis,
  );
  const projekte = alle<Summe>(
    `SELECT projekt_id AS id, SUM(xp) AS xp FROM projekt_xp
     WHERE xp > 0 AND erstellt_am >= ? AND erstellt_am <= ? GROUP BY projekt_id`,
    seit,
    bis,
  );
  const visionen = alle<Summe>(
    `SELECT COALESCE(p.vision_id, o.vision_id) AS id, SUM(px.xp) AS xp
     FROM projekt_xp px
     JOIN projekte p ON p.id = px.projekt_id
     LEFT JOIN organisationen o ON o.id = p.organisation_id
     WHERE px.xp > 0 AND px.erstellt_am >= ? AND px.erstellt_am <= ?
       AND COALESCE(p.vision_id, o.vision_id) IS NOT NULL
     GROUP BY COALESCE(p.vision_id, o.vision_id)`,
    seit,
    bis,
  );
  const wochen = new Set<string>();
  for (const zeile of alle<{ tag: string | null }>(`SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege`)) {
    if (!zeile.tag) {
      continue;
    }
    wochen.add(lokalesDatum(wochenbeginn(ausTagesSchluessel(zeile.tag))));
  }
  return {
    wochenMitEintraegen: wochen.size,
    posten: [
      ...attribute.map((zeile) => ({ art: 'attribut' as const, id: zeile.id, xp: zeile.xp })),
      ...projekte.map((zeile) => ({ art: 'projekt' as const, id: zeile.id, xp: zeile.xp })),
      ...visionen.map((zeile) => ({ art: 'vision' as const, id: zeile.id, xp: zeile.xp })),
    ],
  };
}
