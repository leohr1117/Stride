import type { Vision, VisionErgebnis } from '../../../shared/api/index.ts';
import { sperrtext } from '../../../shared/spiel/ebenen.ts';
import { verteileNachGewichten, visionBeute, type Gewicht } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, inTransaktion } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeWirksameAttribute, nurWirksameGewichte } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { bucheAttributXp, erstelleBelohnung, ladeLevelStand, type AttributBuchung } from '../../services/fortschritt.ts';
import { ladeVision } from '../../services/struktur.ts';

const GLEICHES_GEWICHT = 1;

function ladeGewichteDerVision(visionId: number): Gewicht[] {
  const gewichte = nurWirksameGewichte(
    alle<Gewicht>(
      `SELECT x.attribut_id AS attributId, SUM(x.xp) AS gewicht
       FROM xp_ereignisse x
       JOIN attribute a ON a.id = x.attribut_id
       JOIN eintraege e ON e.id = x.eintrag_id
       LEFT JOIN projekte p ON p.id = e.projekt_id
       LEFT JOIN organisationen o ON o.id = p.organisation_id
       WHERE x.quelle = 'eintrag' AND a.archiviert = 0 AND (p.vision_id = ? OR o.vision_id = ?)
       GROUP BY x.attribut_id
       HAVING SUM(x.xp) > 0`,
      visionId,
      visionId,
    ),
  );
  if (gewichte.length > 0) {
    return gewichte;
  }
  const wirksame = ladeWirksameAttribute();
  const koennen = wirksame.filter((attribut) => attribut.typ === 'attribut');
  return (koennen.length > 0 ? koennen : wirksame).map((attribut) => ({
    attributId: attribut.id,
    gewicht: GLEICHES_GEWICHT,
  }));
}

export function erreicheVision(id: number, jetzt = leseJetzt()): VisionErgebnis {
  if (!ladeEinstellungen().ebenen.visionen) {
    throw ungueltig(sperrtext('visionen'));
  }
  const vision = ladeVision(id);
  if (vision.erreichtAm !== null) {
    throw ungueltig('Diese Vision ist bereits erreicht.');
  }
  if (vision.level === null) {
    throw ungueltig('Gib der Vision zuerst ein Level.');
  }

  const beute = visionBeute(vision.level);
  const gewichte = ladeGewichteDerVision(id);
  const zeitpunkt = jetzt.toISOString();
  const vorher = ladeLevelStand(null);

  const buchungen = inTransaktion(() => {
    ausfuehren('UPDATE visionen SET erreicht_am = ? WHERE id = ?', zeitpunkt, id);
    const gebucht: AttributBuchung[] = [];
    for (const anteil of verteileNachGewichten(beute, gewichte)) {
      gebucht.push(
        bucheAttributXp(
          { quelle: 'vision', attributId: anteil.attributId, xp: anteil.xp, eintragId: null, vorhabenId: null, visionId: id },
          zeitpunkt,
        ),
      );
    }
    return gebucht;
  });

  return {
    vision: ladeVision(id),
    belohnung: erstelleBelohnung({
      buchungen,
      boni: [{ quelle: 'vision', label: `Vision erreicht · Level ${vision.level}`, xp: beute }],
      meilenstein: true,
      projekt: null,
      vorher,
      nachher: ladeLevelStand(null),
    }),
  };
}

export function nimmVisionZurueck(id: number): Vision {
  if (!ladeEinstellungen().ebenen.visionen) {
    throw ungueltig(sperrtext('visionen'));
  }
  const vision = ladeVision(id);
  if (vision.erreichtAm === null) {
    throw ungueltig('Diese Vision ist noch nicht erreicht.');
  }
  inTransaktion(() => {
    ausfuehren(`DELETE FROM xp_ereignisse WHERE quelle = 'vision' AND vision_id = ?`, id);
    ausfuehren('UPDATE visionen SET erreicht_am = NULL WHERE id = ?', id);
  });
  return ladeVision(id);
}
