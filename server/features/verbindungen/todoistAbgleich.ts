import type { AbgleichErgebnis, TodoistVorschau } from '../../../shared/api/index.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { datumInZone } from '../../../shared/spiel/datum.ts';
import { tageZwischen } from '../../../shared/spiel/kette.ts';
import { BOSS, eintragXp, GEGNER, meilensteinBonus } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren } from '../../db.ts';
import { ladeErledigungen, ladeLabels, ladeProjekte, type TodoistErledigung } from '../../integrationen/todoist.ts';
import { bucheAttributXp } from '../../services/fortschritt.ts';
import { fuehreRegelnZusammen, notizFuerEintrag, stundenAusDauer, type RegelErgebnis } from '../../services/todoistRegeln.ts';
import { aktivesAttribut, ladeAttributXp } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeVorlage } from '../taetigkeiten/vorlagen.ts';
import { fasseFehler, fehlertext, legeEintragAn, leseWert, pruefeProjekt, setzeWert } from './gemeinsam.ts';
import {
  alsZiel,
  ladeLabelZeilen,
  ladeProjektZeilen,
  liesTodoistOhne,
  SCHLUESSEL,
  speichereLabels,
  speichereProjekte,
  zuQuelle,
  loeseZiel,
  type LabelZeile,
  type TodoistZeile,
} from './todoist.ts';

const VORSCHAU_TAGE = 7;
const MS_PRO_TAG = 24 * 60 * 60 * 1000;

function passendeLabels(namen: string[], labels: LabelZeile[]): LabelZeile[] {
  const nachName = new Map<string, LabelZeile>();
  for (const label of labels) {
    if (label.aktiv !== 1) {
      continue;
    }
    const bisher = nachName.get(label.name);
    if (!bisher || label.rang < bisher.rang) {
      nachName.set(label.name, label);
    }
  }
  const treffer: LabelZeile[] = [];
  const gesehen = new Set<string>();
  for (const name of namen) {
    if (gesehen.has(name)) {
      continue;
    }
    gesehen.add(name);
    const label = nachName.get(name);
    if (label) {
      treffer.push(label);
    }
  }
  return treffer.sort((links, rechts) => links.rang - rechts.rang || links.sortierung - rechts.sortierung || links.name.localeCompare(rechts.name, 'de'));
}

interface TodoistPlan {
  name: string;
  projektId: number | null;
  vorlageId: number | null;
  stunden: number | null;
  notiz: string;
  vorhabenId: number | null;
  faehigkeitId: number | null;
  abschluss: 'geschafft' | 'gescheitert' | null;
  erkenntnis: string;
  meilenstein: boolean;
  boss: boolean;
  gegner: boolean;
  deadline: string | null;
}

function standardZiel(vorlageId: number): { projektId: number | null; vorlageId: number } | null {
  try {
    const vorlage = ladeVorlage(vorlageId);
    if (vorlage.archiviert) {
      return null;
    }
    if (vorlage.projektId !== null) {
      pruefeProjekt(vorlage.projektId);
    }
    return { projektId: vorlage.projektId, vorlageId: vorlage.id };
  } catch {
    return null;
  }
}

function planAusZusammen(erledigung: TodoistErledigung, zusammen: RegelErgebnis, name: string): TodoistPlan | { fehler: string } {
  if (zusammen.zielArt === null || zusammen.zielId === null) {
    return { fehler: `${name}: ${'Wähle eine Tätigkeit.'}` };
  }
  try {
    const ziel = loeseZiel(zusammen.zielArt, zusammen.zielId, zusammen.projektId);
    const vorhaben = ziel.vorhabenId !== null;
    const abschluss = vorhaben ? zusammen.abschluss : null;
    const meilenstein = vorhaben ? false : zusammen.meilenstein;
    const deadline = erledigung.deadline ?? null;
    const boss = !vorhaben && deadline !== null && meilenstein;
    const gegner = !vorhaben && deadline !== null && !meilenstein;
    return {
      name,
      projektId: ziel.projektId,
      vorlageId: zusammen.vorlageId,
      stunden: stundenAusDauer(erledigung.dauer) ?? zusammen.stunden,
      notiz: notizFuerEintrag(erledigung.inhalt, zusammen.notiz),
      vorhabenId: ziel.vorhabenId,
      faehigkeitId: zusammen.faehigkeitId,
      abschluss,
      erkenntnis: abschluss === 'gescheitert' ? zusammen.erkenntnis : '',
      meilenstein: boss || meilenstein,
      boss,
      gegner,
      deadline,
    };
  } catch (ausnahme) {
    return { fehler: `${name}: ${fehlertext(ausnahme, 'Todoist')}` };
  }
}

function planeErledigung(
  erledigung: TodoistErledigung,
  projekte: Map<string, TodoistZeile>,
  labels: LabelZeile[],
): TodoistPlan | { fehler: string } | null {
  const projekt = erledigung.projektId === null ? undefined : projekte.get(erledigung.projektId);
  const regeln = passendeLabels(erledigung.labels ?? [], labels);
  const basis =
    projekt && alsZiel(projekt.zielArt) !== null && projekt.zielId !== null
      ? zuQuelle(projekt, projekt.meilenstein === 1)
      : null;
  const zusammen = fuehreRegelnZusammen(
    regeln.map((label) => zuQuelle(label, label.meilenstein === null ? null : label.meilenstein === 1)),
    basis,
  );
  const name = projekt?.name ?? regeln[0]?.name ?? 'Todoist';
  if (zusammen.zielArt !== null && zusammen.zielId !== null) {
    return planAusZusammen(erledigung, zusammen, name);
  }
  const ohne = liesTodoistOhne();
  if (ohne.art !== 'standard' || ohne.vorlageId === null) {
    return null;
  }
  const standard = standardZiel(ohne.vorlageId);
  if (!standard) {
    return { fehler: `${name}: ${'Die gewählte Tätigkeit ist archiviert.'}` };
  }
  const deadline = erledigung.deadline ?? null;
  return {
    name,
    projektId: standard.projektId,
    vorlageId: standard.vorlageId,
    stunden: stundenAusDauer(erledigung.dauer),
    notiz: notizFuerEintrag(erledigung.inhalt, ''),
    vorhabenId: null,
    faehigkeitId: null,
    abschluss: null,
    erkenntnis: '',
    meilenstein: false,
    boss: false,
    gegner: deadline !== null,
    deadline,
  };
}

function zieheNachDeadlineAb(plan: TodoistPlan, erledigtAm: Date, eintragId: number): void {
  if (plan.deadline === null || (!plan.boss && !plan.gegner)) {
    return;
  }
  const einstellungen = ladeEinstellungen();
  if (!istAn('bossAngriffe', einstellungen)) {
    return;
  }
  const tag = datumInZone(erledigtAm, einstellungen.zeitzone);
  if (tag <= plan.deadline) {
    return;
  }
  const disziplinId = aktivesAttribut('disziplin');
  if (disziplinId === null) {
    return;
  }
  const tage = tageZwischen(plan.deadline, tag);
  const proTag = plan.boss ? BOSS.angriffXpProTag : Math.floor(BOSS.angriffXpProTag / GEGNER.angriffTeiler);
  const schaden = Math.min(Math.max(0, ladeAttributXp(disziplinId)), tage * proTag);
  if (schaden <= 0) {
    return;
  }
  bucheAttributXp(
    { quelle: 'bossangriff', attributId: disziplinId, xp: -schaden, eintragId, vorhabenId: null },
    erledigtAm.toISOString(),
  );
}

function vorschauXp(plan: TodoistPlan): number {
  const xp = eintragXp(plan.stunden);
  if (plan.boss) {
    return xp + meilensteinBonus(xp, false, true);
  }
  if (plan.gegner) {
    return xp + Math.round(meilensteinBonus(xp, false) / GEGNER.belohnungTeiler);
  }
  if (plan.meilenstein) {
    return xp + meilensteinBonus(xp, false);
  }
  return xp;
}

function uebernimmErledigungen(erledigungen: TodoistErledigung[], jetzt: Date): AbgleichErgebnis {
  const projekte = new Map(ladeProjektZeilen().map((zeile) => [zeile.todoistId, zeile]));
  const labels = ladeLabelZeilen();
  const fehler = new Set<string>();
  const bekannt = new Set(
    alle<{ ereignisId: string }>('SELECT ereignis_id AS ereignisId FROM todoist_erledigt').map((zeile) => zeile.ereignisId),
  );
  let neu = 0;
  for (const erledigung of erledigungen) {
    if (bekannt.has(erledigung.ereignisId)) {
      continue;
    }
    const entscheidung = planeErledigung(erledigung, projekte, labels);
    if (entscheidung === null) {
      continue;
    }
    if ('fehler' in entscheidung) {
      fehler.add(entscheidung.fehler);
      continue;
    }
    try {
      const eintragId = legeEintragAn(
        { projektId: entscheidung.projektId, vorlageId: entscheidung.vorlageId },
        entscheidung.stunden,
        entscheidung.notiz,
        erledigung.erledigtAm,
        jetzt,
        {
          vorhabenId: entscheidung.vorhabenId,
          faehigkeitId: entscheidung.faehigkeitId,
          abschluss: entscheidung.abschluss,
          erkenntnis: entscheidung.erkenntnis,
          meilenstein: entscheidung.meilenstein,
        },
        { bossBesiegt: entscheidung.boss, gegnerBesiegt: entscheidung.gegner },
      );
      ausfuehren(
        'INSERT INTO todoist_erledigt (ereignis_id, eintrag_id, erledigt_am) VALUES (?, ?, ?)',
        erledigung.ereignisId,
        eintragId,
        erledigung.erledigtAm.toISOString(),
      );
      zieheNachDeadlineAb(entscheidung, erledigung.erledigtAm, eintragId);
      bekannt.add(erledigung.ereignisId);
      neu++;
    } catch (ausnahme) {
      fehler.add(`${entscheidung.name}: ${fehlertext(ausnahme, 'Todoist')}`);
    }
  }
  return { neu, fehler: [...fehler] };
}

export async function todoistVorschau(jetzt = new Date()): Promise<TodoistVorschau> {
  const token = leseWert(SCHLUESSEL.token);
  if (token === null) {
    return { xp: 0, anzahl: 0 };
  }
  const erledigungen = await ladeErledigungen(token, new Date(jetzt.getTime() - VORSCHAU_TAGE * MS_PRO_TAG));
  const projekte = new Map(ladeProjektZeilen().map((zeile) => [zeile.todoistId, zeile]));
  const labels = ladeLabelZeilen();
  let xp = 0;
  let anzahl = 0;
  for (const erledigung of erledigungen) {
    const entscheidung = planeErledigung(erledigung, projekte, labels);
    if (entscheidung === null || 'fehler' in entscheidung) {
      continue;
    }
    xp += vorschauXp(entscheidung);
    anzahl += 1;
  }
  return { xp, anzahl };
}

export async function gleicheTodoistAb(jetzt = new Date()): Promise<AbgleichErgebnis> {
  const token = leseWert(SCHLUESSEL.token);
  if (token === null) {
    return { neu: 0, fehler: [] };
  }
  const seit = new Date(leseWert(SCHLUESSEL.seit) ?? jetzt.toISOString());
  try {
    const projekte = await ladeProjekte(token);
    const labels = await ladeLabels(token);
    const erledigungen = await ladeErledigungen(token, seit);
    speichereProjekte(projekte);
    speichereLabels(labels);
    const ergebnis = uebernimmErledigungen(erledigungen, jetzt);
    setzeWert(SCHLUESSEL.abgleich, jetzt.toISOString());
    setzeWert(SCHLUESSEL.fehler, fasseFehler(ergebnis.fehler));
    return ergebnis;
  } catch (ausnahme) {
    const nachricht = fehlertext(ausnahme, 'Todoist');
    setzeWert(SCHLUESSEL.fehler, nachricht);
    return { neu: 0, fehler: [nachricht] };
  }
}
