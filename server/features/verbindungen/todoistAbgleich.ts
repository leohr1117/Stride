import type { AbgleichErgebnis } from '../../../shared/api/index.ts';
import { alle, ausfuehren } from '../../db.ts';
import { ladeErledigungen, ladeLabels, ladeProjekte, type TodoistErledigung } from '../../integrationen/todoist.ts';
import { fuehreRegelnZusammen, notizFuerEintrag, stundenAusDauer } from '../../services/todoistRegeln.ts';
import { tagesbeginn } from '../../services/zeit.ts';
import { fehlertext, legeEintragAn, leseWert, setzeWert } from './gemeinsam.ts';
import { alsZiel, ladeLabelZeilen, ladeProjektZeilen, SCHLUESSEL, speichereLabels, speichereProjekte, zuQuelle, loeseZiel, type LabelZeile } from './todoist.ts';

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
    if (zusammen.zielArt === null || zusammen.zielId === null) {
      continue;
    }
    const name = projekt?.name ?? regeln[0]?.name ?? 'Todoist';
    try {
      const ziel = loeseZiel(zusammen.zielArt, zusammen.zielId, zusammen.projektId);
      const vorhaben = ziel.vorhabenId !== null;
      const abschluss = vorhaben ? zusammen.abschluss : null;
      const eintragId = legeEintragAn(
        { projektId: ziel.projektId, vorlageId: zusammen.vorlageId },
        stundenAusDauer(erledigung.dauer) ?? zusammen.stunden,
        notizFuerEintrag(erledigung.inhalt, zusammen.notiz),
        erledigung.erledigtAm,
        jetzt,
        {
          vorhabenId: ziel.vorhabenId,
          faehigkeitId: zusammen.faehigkeitId,
          abschluss,
          erkenntnis: abschluss === 'gescheitert' ? zusammen.erkenntnis : '',
          meilenstein: vorhaben ? false : zusammen.meilenstein,
        },
      );
      ausfuehren(
        'INSERT INTO todoist_erledigt (ereignis_id, eintrag_id, erledigt_am) VALUES (?, ?, ?)',
        erledigung.ereignisId,
        eintragId,
        erledigung.erledigtAm.toISOString(),
      );
      bekannt.add(erledigung.ereignisId);
      neu++;
    } catch (ausnahme) {
      fehler.add(`${name}: ${fehlertext(ausnahme, 'Todoist')}`);
    }
  }
  return { neu, fehler: [...fehler] };
}

export async function gleicheTodoistAb(jetzt = new Date()): Promise<AbgleichErgebnis> {
  const token = leseWert(SCHLUESSEL.token);
  if (token === null) {
    return { neu: 0, fehler: [] };
  }
  const seit = new Date(leseWert(SCHLUESSEL.seit) ?? tagesbeginn(jetzt).toISOString());
  try {
    const projekte = await ladeProjekte(token);
    const labels = await ladeLabels(token);
    const erledigungen = await ladeErledigungen(token, seit);
    speichereProjekte(projekte);
    speichereLabels(labels);
    const ergebnis = uebernimmErledigungen(erledigungen, jetzt);
    setzeWert(SCHLUESSEL.abgleich, jetzt.toISOString());
    setzeWert(SCHLUESSEL.fehler, ergebnis.fehler[0] ?? null);
    return ergebnis;
  } catch (ausnahme) {
    const nachricht = fehlertext(ausnahme, 'Todoist');
    setzeWert(SCHLUESSEL.fehler, nachricht);
    return { neu: 0, fehler: [nachricht] };
  }
}
