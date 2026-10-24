import type { Gewicht } from '../../../shared/spiel/xp.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { gleicherKatalogtext } from '../../../shared/sprache/index.ts';
import { alle, eine } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { aktivesAttribut } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeAktiveGewichte } from '../taetigkeiten/vorlagen.ts';

export interface PlanBezug {
  projektId: number | null;
  vorlageId: number | null;
}

const FESTE_GEWICHTE = [
  { kennung: 'koerper', gewicht: 50 },
  { kennung: 'disziplin', gewicht: 30 },
  { kennung: 'vitalitaet', gewicht: 20 },
] as const;

const OHNE_TAETIGKEIT = 'Wähle eine Tätigkeit.';

function trainingVorlageId(): number | null {
  const zeilen = alle<{ id: number; name: string }>('SELECT id, name FROM vorlagen WHERE archiviert = 0 ORDER BY id');
  return zeilen.find((zeile) => gleicherKatalogtext('Training', zeile.name))?.id ?? null;
}

function standardVorlageId(projektId: number | null): number | null {
  if (projektId === null) {
    return null;
  }
  return eine<{ id: number }>('SELECT standard_vorlage_id AS id FROM projekte WHERE id = ?', projektId)?.id ?? null;
}

export function vorlageFuerPlan(plan: PlanBezug): number {
  if (plan.vorlageId !== null) {
    return plan.vorlageId;
  }
  const training = trainingVorlageId();
  if (training !== null) {
    return training;
  }
  const standard = standardVorlageId(plan.projektId);
  if (standard !== null) {
    return standard;
  }
  throw ungueltig(OHNE_TAETIGKEIT);
}

function festeGewichte(): Gewicht[] {
  const gewichte: Gewicht[] = [];
  for (const fest of FESTE_GEWICHTE) {
    const attributId = aktivesAttribut(fest.kennung);
    if (attributId !== null) {
      gewichte.push({ attributId, gewicht: fest.gewicht });
    }
  }
  return gewichte;
}

export function gewichteFuerPlan(plan: PlanBezug): Gewicht[] {
  if (plan.vorlageId !== null) {
    return ladeAktiveGewichte(plan.vorlageId);
  }
  const training = trainingVorlageId();
  if (training !== null) {
    return ladeAktiveGewichte(training);
  }
  const fest = festeGewichte();
  if (fest.length > 0) {
    return fest;
  }
  const standard = standardVorlageId(plan.projektId);
  if (standard !== null) {
    return ladeAktiveGewichte(standard);
  }
  throw ungueltig(OHNE_TAETIGKEIT);
}

export function gewichtePassen(vorlageId: number, plan: PlanBezug): boolean {
  return gleicheGewichte(ladeAktiveGewichte(vorlageId), gewichteFuerPlan(plan));
}

export function projektFuerPlan(projektId: number | null): number | null {
  if (projektId === null || !istAn('projekte', ladeEinstellungen())) {
    return null;
  }
  return projektId;
}

function gleicheGewichte(links: readonly Gewicht[], rechts: readonly Gewicht[]): boolean {
  if (links.length !== rechts.length) {
    return false;
  }
  const sortiert = (liste: readonly Gewicht[]) => [...liste].sort((a, b) => a.attributId - b.attributId);
  const a = sortiert(links);
  const b = sortiert(rechts);
  return a.every((gewicht, index) => gewicht.attributId === b[index]?.attributId && gewicht.gewicht === b[index]?.gewicht);
}
