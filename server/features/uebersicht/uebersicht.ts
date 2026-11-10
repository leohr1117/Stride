import type { Charakter, Erschoepfung, HeatmapTag, Identitaet, Uebersicht } from '../../../shared/api/index.ts';
import { momentumFuerSerie } from '../../../shared/spiel/momentum.ts';
import { eine, alle } from '../../db.ts';
import { ladeAttribute, ladeCharakterLevel, ladeErschoepfungen, ladeKlasse } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeTitel } from '../erfolge/erfolge.ts';
import { ladeAktiveTage, ladeSerie } from '../../services/serie.ts';
import { ladeAngreifendeBosse, ladeComebacks } from '../ziele/vorhaben.ts';
import { leseJetzt, lokalesDatum, wochenbeginn } from '../../services/zeit.ts';

const HEATMAP_WOCHEN = 13;
const ANZAHL_COMEBACKS = 3;

function ladeWochenXp(jetzt: Date): number {
  const { xp } = eine<{ xp: number }>(
    'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE xp > 0 AND erstellt_am >= ?',
    wochenbeginn(jetzt).toISOString(),
  ) ?? { xp: 0 };
  return xp;
}

function ladeHeatmap(jetzt: Date): HeatmapTag[] {
  const beginn = wochenbeginn(jetzt, HEATMAP_WOCHEN - 1);
  const heute = lokalesDatum(jetzt);
  const werte = new Map<string, number>();
  for (const zeile of alle<{ datum: string; xp: number }>(
    `SELECT date(erstellt_am, 'localtime') AS datum, SUM(xp) AS xp
     FROM xp_ereignisse WHERE xp > 0 AND erstellt_am >= ?
     GROUP BY datum`,
    beginn.toISOString(),
  )) {
    werte.set(zeile.datum, zeile.xp);
  }

  const tage: HeatmapTag[] = [];
  const tag = new Date(beginn);
  while (lokalesDatum(tag) <= heute) {
    const datum = lokalesDatum(tag);
    tage.push({ datum, xp: werte.get(datum) ?? 0 });
    tag.setDate(tag.getDate() + 1);
  }
  return tage;
}

function ladeIdentitaet(): Identitaet {
  return { name: ladeEinstellungen().charakterName, klasse: ladeKlasse(), titel: ladeTitel() };
}

function teileAttributeAuf() {
  const alleAttribute = ladeAttribute(false);
  return {
    attribute: alleAttribute.filter((attribut) => attribut.typ === 'attribut'),
    status: alleAttribute.filter((attribut) => attribut.typ === 'status'),
  };
}

function ladeSichtbareErschoepfungen(): Erschoepfung[] {
  return ladeErschoepfungen()
    .filter((regel) => regel.faktor < 1)
    .map((regel) => ({
      attributId: regel.quelleId,
      faktor: regel.faktor,
      zielId: regel.zielId,
      zielName: regel.zielName,
    }));
}

export function ladeUebersicht(jetzt = leseJetzt()): Uebersicht {
  const serie = ladeSerie(lokalesDatum(jetzt));
  return {
    ...ladeIdentitaet(),
    level: ladeCharakterLevel(),
    ...teileAttributeAuf(),
    momentum: momentumFuerSerie(serie.laenge),
    erschoepfungen: ladeSichtbareErschoepfungen(),
    serie,
    wocheXp: ladeWochenXp(jetzt),
    comebacks: ladeComebacks(ANZAHL_COMEBACKS, jetzt),
    angriffe: ladeAngreifendeBosse(jetzt),
    heatmap: ladeHeatmap(jetzt),
  };
}

export function ladeCharakter(): Charakter {
  const statistik = eine<Omit<Charakter['statistik'], 'aktiveTage'>>(
    `SELECT (SELECT COUNT(*) FROM eintraege) AS eintraegeGesamt,
            (SELECT COUNT(*) FROM eintraege WHERE meilenstein = 1) AS meilensteine,
            (SELECT COUNT(*) FROM vorhaben WHERE status = 'geschafft') AS vorhabenGeschafft`,
  ) ?? { eintraegeGesamt: 0, meilensteine: 0, vorhabenGeschafft: 0 };

  return {
    ...ladeIdentitaet(),
    level: ladeCharakterLevel(),
    ...teileAttributeAuf(),
    erschoepfungen: ladeSichtbareErschoepfungen(),
    statistik: { ...statistik, aktiveTage: ladeAktiveTage().length },
  };
}
