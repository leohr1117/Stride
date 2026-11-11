import type { AttributTyp } from '../../shared/spiel/begriffe.ts';
import { ATTRIBUT_TYP_INFO } from '../../shared/spiel/begriffe.ts';
import { alle, ausfuehren, eine } from '../db.ts';
import { nichtGefunden, ungueltig } from '../fehler.ts';

export type LoeschArt =
  | 'vision'
  | 'organisation'
  | 'projekt'
  | 'vorlage'
  | 'attribut'
  | 'faehigkeit'
  | 'investition'
  | 'basis'
  | 'aufgabe'
  | 'uebung'
  | 'trainingsplan'
  | 'knoten'
  | 'vorhaben';

const ARCHIV = 'Das ist schon genutzt und kann nur archiviert werden.';
const BLEIBT = 'Das ist schon genutzt.';

const MENGE: Record<LoeschArt, string> = {
  vision: `
    SELECT v.id FROM visionen v
    WHERE v.erreicht_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM projekte p WHERE p.vision_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM organisationen o WHERE o.vision_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM investitionen n WHERE n.ziel_art = 'vision' AND n.ziel_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM projekte p WHERE p.investition_ziel_art = 'vision' AND p.investition_ziel_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM ausruestung_visionen a WHERE a.vision_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM xp_ereignisse x WHERE x.vision_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.ziel_art = 'vision' AND t.ziel_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_labels l WHERE l.aktiv = 1 AND l.ziel_art = 'vision' AND l.ziel_id = v.id)
      AND NOT EXISTS (
        SELECT 1 FROM eintraege e
        JOIN projekte p ON p.id = e.projekt_id
        LEFT JOIN organisationen o ON o.id = p.organisation_id
        WHERE p.vision_id = v.id OR o.vision_id = v.id
      )
      AND NOT EXISTS (SELECT 1 FROM aufgaben a WHERE a.vision_id = v.id)`,
  organisation: `
    SELECT o.id FROM organisationen o
    WHERE NOT EXISTS (SELECT 1 FROM projekte p WHERE p.organisation_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM aufgaben a WHERE a.organisation_id = o.id)`,
  projekt: `
    SELECT p.id FROM projekte p
    WHERE p.geschafft_am IS NULL
      AND p.abschluss_bonus_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM eintraege e WHERE e.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM projekt_xp x WHERE x.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM vorhaben v WHERE v.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM basis_aufgaben b WHERE b.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM aufgaben a WHERE a.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.ziel_art = 'projekt' AND t.ziel_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_labels l WHERE l.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM kalender k WHERE k.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM investitionen n WHERE n.ziel_art = 'projekt' AND n.ziel_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM projekte i WHERE i.investition_ziel_art = 'projekt' AND i.investition_ziel_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM ausruestung_projekte a WHERE a.projekt_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM trainingsplaene t WHERE t.projekt_id = p.id)`,
  vorlage: `
    SELECT v.id FROM vorlagen v
    WHERE NOT EXISTS (SELECT 1 FROM eintraege e WHERE e.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM projekte p WHERE p.standard_vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM projekte p WHERE p.abschluss_vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM basis_aufgaben b WHERE b.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM aufgaben a WHERE a.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_labels l WHERE l.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM kalender k WHERE k.vorlage_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM trainingsplaene t WHERE t.vorlage_id = v.id)`,
  attribut: `
    SELECT a.id FROM attribute a
    WHERE a.archiv_anteil IS NULL
      AND NOT EXISTS (SELECT 1 FROM xp_ereignisse x WHERE x.attribut_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM vorlage_gewichte g WHERE g.attribut_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM vorlage_abzuege z WHERE z.attribut_id = a.id)
      AND NOT EXISTS (
        SELECT 1 FROM investitionen n
        WHERE n.attribut_id = a.id
          OR n.bezahlt_attribut_id = a.id
          OR (n.ziel_art = 'attribut' AND n.ziel_id = a.id)
      )
      AND NOT EXISTS (SELECT 1 FROM projekte p WHERE p.investition_ziel_art = 'attribut' AND p.investition_ziel_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM attribute z WHERE z.erschoepfung_ziel = a.id AND z.id <> a.id)`,
  faehigkeit: `
    SELECT f.id FROM faehigkeiten f
    WHERE NOT EXISTS (SELECT 1 FROM eintraege e WHERE e.faehigkeit_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM faehigkeit_xp x WHERE x.faehigkeit_id = f.id)
      AND NOT EXISTS (
        SELECT 1 FROM skill_knoten k
        WHERE k.faehigkeit_id = f.id AND (k.freigeschaltet_am IS NOT NULL OR k.eintrag_id IS NOT NULL)
      )
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.faehigkeit_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_labels l WHERE l.faehigkeit_id = f.id)`,
  investition: `
    SELECT n.id FROM investitionen n
    WHERE NOT EXISTS (
      SELECT 1 FROM eintraege e
      WHERE e.erstellt_am >= n.erstellt_am
        AND (
          (n.ziel_art = 'projekt' AND e.projekt_id = n.ziel_id)
          OR (
            n.ziel_art = 'vision' AND e.projekt_id IN (
              SELECT p.id FROM projekte p
              LEFT JOIN organisationen o ON o.id = p.organisation_id
              WHERE p.vision_id = n.ziel_id OR o.vision_id = n.ziel_id
            )
          )
          OR EXISTS (
            SELECT 1 FROM xp_ereignisse x
            WHERE x.eintrag_id = e.id AND (x.attribut_id = n.attribut_id OR (n.ziel_art = 'attribut' AND x.attribut_id = n.ziel_id))
          )
        )
    )`,
  basis: `
    SELECT b.id FROM basis_aufgaben b
    WHERE NOT EXISTS (SELECT 1 FROM eintraege e WHERE e.basis_aufgabe_id = b.id)`,
  aufgabe: `
    SELECT a.id FROM aufgaben a
    WHERE NOT EXISTS (SELECT 1 FROM aufgaben_erledigt r WHERE r.aufgabe_id = a.id)`,
  uebung: `
    SELECT u.id FROM uebungen u
    WHERE NOT EXISTS (SELECT 1 FROM trainingsplan_uebungen z WHERE z.uebung_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM trainingssaetze s WHERE s.uebung_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM bestwerte b WHERE b.uebung_id = u.id)`,
  trainingsplan: `
    SELECT p.id FROM trainingsplaene p
    WHERE NOT EXISTS (SELECT 1 FROM trainingseinheiten e WHERE e.plan_id = p.id)`,
  vorhaben: `
    SELECT v.id FROM vorhaben v
    WHERE v.status = 'offen'
      AND v.anlauf = 1
      AND v.angriff_bis IS NULL
      AND NOT EXISTS (SELECT 1 FROM vorhaben n WHERE n.vorgaenger_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM eintraege e WHERE e.vorhaben_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM xp_ereignisse x WHERE x.vorhaben_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM projekt_xp x WHERE x.vorhaben_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_projekte t WHERE t.ziel_art = 'vorhaben' AND t.ziel_id = v.id)
      AND NOT EXISTS (SELECT 1 FROM todoist_labels l WHERE l.aktiv = 1 AND l.ziel_art = 'vorhaben' AND l.ziel_id = v.id)`,
  knoten: '',
};

export function loeschbareMenge(art: LoeschArt): Set<number> {
  if (art === 'knoten') {
    return loeschbareKnoten();
  }
  return new Set(alle<{ id: number }>(MENGE[art]).map((zeile) => zeile.id));
}

export function istLoeschbar(art: LoeschArt, id: number): boolean {
  return loeschbareMenge(art).has(id);
}

export function ergaenze<T extends { id: number }>(art: LoeschArt, liste: T[]): Array<T & { loeschbar: boolean }> {
  const menge = loeschbareMenge(art);
  return liste.map((eintrag) => ({ ...eintrag, loeschbar: menge.has(eintrag.id) }));
}

export function ergaenzeEine<T extends { id: number }>(art: LoeschArt, eintrag: T): T & { loeschbar: boolean } {
  return { ...eintrag, loeschbar: istLoeschbar(art, eintrag.id) };
}

function loeschbareKnoten(): Set<number> {
  const knoten = alle<{ id: number; elternId: number | null; genutzt: number }>(
    `SELECT k.id, k.eltern_id AS elternId,
            CASE
              WHEN k.freigeschaltet_am IS NOT NULL OR k.eintrag_id IS NOT NULL
                OR EXISTS (SELECT 1 FROM faehigkeit_xp x WHERE x.knoten_id = k.id)
              THEN 1 ELSE 0
            END AS genutzt
     FROM skill_knoten k`,
  );
  const kinder = new Map<number, number[]>();
  const direkt = new Set<number>();
  for (const zeile of knoten) {
    if (zeile.elternId !== null) {
      const liste = kinder.get(zeile.elternId) ?? [];
      liste.push(zeile.id);
      kinder.set(zeile.elternId, liste);
    }
    if (zeile.genutzt === 1) {
      direkt.add(zeile.id);
    }
  }
  const cache = new Map<number, boolean>();
  const benutzt = (id: number): boolean => {
    const bekannt = cache.get(id);
    if (bekannt !== undefined) {
      return bekannt;
    }
    let wert = direkt.has(id);
    if (!wert) {
      for (const kind of kinder.get(id) ?? []) {
        if (benutzt(kind)) {
          wert = true;
          break;
        }
      }
    }
    cache.set(id, wert);
    return wert;
  };
  const frei = new Set<number>();
  for (const zeile of knoten) {
    if (!benutzt(zeile.id)) {
      frei.add(zeile.id);
    }
  }
  return frei;
}

function vorhanden(tabelle: string, id: number, name: string): void {
  const zeile = eine<{ id: number }>(`SELECT id FROM ${tabelle} WHERE id = ?`, id);
  if (!zeile) {
    throw nichtGefunden(name);
  }
}

function pruefe(art: LoeschArt, id: number, endgueltig: boolean): void {
  if (!istLoeschbar(art, id)) {
    throw ungueltig(endgueltig ? BLEIBT : ARCHIV);
  }
}

export function loescheVision(id: number): void {
  vorhanden('visionen', id, 'Die Vision');
  pruefe('vision', id, false);
  ausfuehren('DELETE FROM visionen WHERE id = ?', id);
}

export function loescheOrganisation(id: number): void {
  vorhanden('organisationen', id, 'Die Organisation');
  pruefe('organisation', id, false);
  ausfuehren('DELETE FROM organisationen WHERE id = ?', id);
}

export function loescheProjekt(id: number): void {
  vorhanden('projekte', id, 'Das Projekt');
  pruefe('projekt', id, false);
  ausfuehren('DELETE FROM projekte WHERE id = ?', id);
}

export function loescheVorlage(id: number): void {
  vorhanden('vorlagen', id, 'Die Tätigkeit');
  pruefe('vorlage', id, false);
  ausfuehren('DELETE FROM vorlagen WHERE id = ?', id);
}

export function loescheAttribut(id: number): void {
  const attribut = eine<{ typ: AttributTyp; archiviert: number }>('SELECT typ, archiviert FROM attribute WHERE id = ?', id);
  if (!attribut) {
    throw nichtGefunden('Das Attribut');
  }
  if (attribut.archiviert === 0) {
    const anzahl =
      eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM attribute WHERE typ = ? AND archiviert = 0', attribut.typ)
        ?.anzahl ?? 0;
    if (anzahl <= 1) {
      throw ungueltig(
        `Der letzte ${ATTRIBUT_TYP_INFO[attribut.typ].label}-Wert bleibt aktiv. Schalte den Bereich in den Einstellungen aus.`,
      );
    }
  }
  pruefe('attribut', id, false);
  ausfuehren('DELETE FROM attribute WHERE id = ?', id);
}

export function loescheFaehigkeit(id: number): void {
  vorhanden('faehigkeiten', id, 'Die Fähigkeit');
  pruefe('faehigkeit', id, false);
  ausfuehren('DELETE FROM faehigkeiten WHERE id = ?', id);
}

export function loescheBasisAufgabe(id: number): void {
  vorhanden('basis_aufgaben', id, 'Die Basis-Aufgabe');
  pruefe('basis', id, false);
  ausfuehren('DELETE FROM basis_aufgaben WHERE id = ?', id);
}

export function loescheAufgabe(id: number): void {
  vorhanden('aufgaben', id, 'Die Aufgabe');
  pruefe('aufgabe', id, false);
  ausfuehren('DELETE FROM aufgaben WHERE id = ?', id);
}

export function loescheUebung(id: number): void {
  vorhanden('uebungen', id, 'Die Übung');
  pruefe('uebung', id, false);
  ausfuehren('DELETE FROM uebungen WHERE id = ?', id);
}

export function loescheTrainingsplan(id: number): void {
  vorhanden('trainingsplaene', id, 'Der Trainingsplan');
  pruefe('trainingsplan', id, false);
  ausfuehren('DELETE FROM trainingsplaene WHERE id = ?', id);
}

export function loescheVorhaben(id: number): void {
  vorhanden('vorhaben', id, 'Das Vorhaben');
  pruefe('vorhaben', id, true);
  ausfuehren('DELETE FROM vorhaben WHERE id = ?', id);
}

export function pruefeKnotenLoeschbar(id: number): void {
  vorhanden('skill_knoten', id, 'Der Skill');
  pruefe('knoten', id, true);
}
