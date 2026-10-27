import { attributVorlage } from '../../shared/features/attribute/attributKatalog.ts';
import type { AttributKennung, AttributTyp } from '../../shared/spiel/begriffe.ts';
import { FOKUS_PFLICHT, normalisiereFokus, startAttribute, startTaetigkeiten, type FokusId } from '../../shared/spiel/profil.ts';
import type { Sprache } from '../../shared/sprache/kern.ts';
import { gleicherKatalogtext, zeige } from '../../shared/sprache/index.ts';
import { anfrageSprache } from '../anfrageSprache.ts';
import { alle, ausfuehren, eine } from '../db.ts';
import { ungueltig } from '../fehler.ts';
import { lokalesDatum } from './zeit.ts';

const INHALT = [
  'eintraege',
  'vorhaben',
  'xp_ereignisse',
  'basis_aufgaben',
  'aufgaben',
  'uebungen',
  'trainingsplaene',
  'trainingseinheiten',
  'visionen',
  'projekte',
  'vorlagen',
  'organisationen',
  'ausruestung',
  'gewohnheiten',
  'faehigkeiten',
  'rueckblicke',
] as const;

interface AttributZeile {
  id: number;
  typ: AttributTyp;
  kennung: string | null;
  archiviert: number;
}

export function istWeltLeer(): boolean {
  for (const tabelle of INHALT) {
    if (eine<{ da: number }>(`SELECT 1 AS da FROM ${tabelle} LIMIT 1`)) {
      return false;
    }
  }
  return true;
}

export function wendeFokusAn(
  fokus: readonly FokusId[],
  jetzt = new Date(),
  sprache: Sprache = anfrageSprache(),
  katalogUmbenennen = false,
): { koennen: boolean; status: boolean } {
  const sauber = normalisiereFokus([...fokus]);
  if (sauber.length === 0) {
    throw ungueltig(FOKUS_PFLICHT);
  }
  if (katalogUmbenennen) {
    benenneKatalog(sprache);
  }

  const zeilen = alle<AttributZeile>('SELECT id, typ, kennung, archiviert FROM attribute');
  const plan = startAttribute(sauber);
  const ziel = new Set<AttributKennung>(plan.gewaehlt);
  const typAn: Record<AttributTyp, boolean> = { attribut: false, status: false };
  for (const kennung of ziel) {
    typAn[attributVorlage(kennung).typ] = true;
  }

  const nachKennung = new Map<string, AttributZeile>();
  for (const zeile of zeilen) {
    if (zeile.kennung !== null) {
      nachKennung.set(zeile.kennung, zeile);
    }
  }
  const datum = lokalesDatum(jetzt);
  let sortierung =
    eine<{ naechste: number }>('SELECT COALESCE(MAX(sortierung), 0) AS naechste FROM attribute')?.naechste ?? 0;
  for (const kennung of ziel) {
    const vorhanden = nachKennung.get(kennung);
    if (!vorhanden) {
      sortierung += 1;
      const vorlage = attributVorlage(kennung);
      ausfuehren(
        `INSERT INTO attribute (typ, kennung, name, beschreibung, farbe, icon, sortierung, verfall_bis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        vorlage.typ,
        vorlage.kennung,
        zeige(vorlage.name, sprache),
        zeige(vorlage.beschreibung, sprache),
        vorlage.farbe,
        vorlage.icon,
        sortierung,
        datum,
      );
    } else if (vorhanden.archiviert === 1) {
      ausfuehren('UPDATE attribute SET archiviert = 0, verfall_bis = ? WHERE id = ?', datum, vorhanden.id);
    }
  }

  const gesamt = eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse')?.xp ?? 0;
  for (const zeile of zeilen) {
    if (zeile.kennung === null || zeile.archiviert === 1 || ziel.has(zeile.kennung as AttributKennung)) {
      continue;
    }
    if (gesamt > 0) {
      const xp =
        eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', zeile.id)?.xp ?? 0;
      ausfuehren('UPDATE attribute SET archiviert = 1, archiv_anteil = ? WHERE id = ?', xp / gesamt, zeile.id);
    } else {
      ausfuehren('UPDATE attribute SET archiviert = 1 WHERE id = ?', zeile.id);
    }
  }

  legeStartTaetigkeitenAn(sauber, sprache);
  return { koennen: typAn.attribut, status: typAn.status };
}

function benenneKatalog(sprache: Sprache): void {
  const zeilen = alle<{ id: number; kennung: string; name: string; beschreibung: string }>(
    'SELECT id, kennung, name, beschreibung FROM attribute WHERE kennung IS NOT NULL',
  );
  for (const zeile of zeilen) {
    let vorlage: ReturnType<typeof attributVorlage>;
    try {
      vorlage = attributVorlage(zeile.kennung as AttributKennung);
    } catch {
      continue;
    }
    const name = gleicherKatalogtext(vorlage.name, zeile.name) ? zeige(vorlage.name, sprache) : zeile.name;
    const beschreibung = gleicherKatalogtext(vorlage.beschreibung, zeile.beschreibung)
      ? zeige(vorlage.beschreibung, sprache)
      : zeile.beschreibung;
    if (name === zeile.name && beschreibung === zeile.beschreibung) {
      continue;
    }
    ausfuehren('UPDATE attribute SET name = ?, beschreibung = ? WHERE id = ?', name, beschreibung, zeile.id);
  }
}

function legeStartTaetigkeitenAn(fokus: readonly FokusId[], sprache: Sprache): void {
  const namen = new Set(alle<{ name: string }>('SELECT name FROM vorlagen').map((zeile) => zeile.name));
  let sortierung =
    eine<{ naechste: number }>('SELECT COALESCE(MAX(sortierung), 0) AS naechste FROM vorlagen')?.naechste ?? 0;
  for (const taetigkeit of startTaetigkeiten(fokus)) {
    const name = zeige(taetigkeit.name, sprache);
    if (namen.has(name)) {
      continue;
    }
    const gewichte: { id: number; gewicht: number }[] = [];
    for (const gewicht of taetigkeit.gewichte) {
      const attribut = eine<{ id: number }>(
        'SELECT id FROM attribute WHERE kennung = ? AND archiviert = 0',
        gewicht.kennung,
      );
      if (attribut) {
        gewichte.push({ id: attribut.id, gewicht: gewicht.gewicht });
      }
    }
    if (gewichte.length === 0) {
      continue;
    }
    sortierung += 1;
    const { id } = ausfuehren(
      'INSERT INTO vorlagen (name, icon, sortierung) VALUES (?, ?, ?)',
      name,
      taetigkeit.icon,
      sortierung,
    );
    for (const gewicht of gewichte) {
      ausfuehren(
        'INSERT INTO vorlage_gewichte (vorlage_id, attribut_id, gewicht) VALUES (?, ?, ?)',
        id,
        gewicht.id,
        gewicht.gewicht,
      );
    }
    namen.add(name);
  }
}
