import type { BasisAufgabe, BasisAufgabeDaten, EintragErgebnis } from '../../../shared/api/index.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { istLoeschbar } from '../../services/loeschen.ts';
import { ladeEinstellungen, pruefeEbene, pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV, PROJEKT_FARBE, PROJEKT_ODER_FREI } from '../ziele/kontext.ts';
import { pruefeAktiveVorlage, pruefeVorlageZumProjekt } from '../taetigkeiten/vorlagen.ts';
import { lokalesDatum } from '../../services/zeit.ts';

interface AufgabeZeile {
  id: number;
  name: string;
  icon: string;
  projektId: number | null;
  projektName: string | null;
  farbe: string;
  vorlageId: number | null;
  standardVorlageId: number | null;
  stunden: number | null;
  archiviert: number;
  anzahl: number;
  heuteEintragId: number | null;
}

const AUFGABE_ABFRAGE = `
  SELECT b.id, b.name, b.icon, b.projekt_id AS projektId, p.name AS projektName, ${PROJEKT_FARBE} AS farbe,
         b.vorlage_id AS vorlageId, p.standard_vorlage_id AS standardVorlageId, b.stunden, b.archiviert,
         (SELECT COUNT(*) FROM eintraege e WHERE e.basis_aufgabe_id = b.id) AS anzahl,
         (SELECT MAX(e.id) FROM eintraege e
          WHERE e.basis_aufgabe_id = b.id AND date(e.erstellt_am, 'localtime') = ?) AS heuteEintragId
  FROM basis_aufgaben b
  LEFT JOIN projekte p ON p.id = b.projekt_id
  ${KONTEXT_JOINS}
`;

function zuAufgabe(zeile: AufgabeZeile): BasisAufgabe {
  return {
    id: zeile.id,
    name: zeile.name,
    icon: zeile.icon,
    projektId: zeile.projektId,
    projektName: zeile.projektName,
    farbe: zeile.farbe,
    vorlageId: zeile.vorlageId,
    stunden: zeile.stunden,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('basis', zeile.id),
    anzahl: zeile.anzahl,
    heuteEintragId: zeile.heuteEintragId,
  };
}

function ladeAufgabeZeile(id: number, heute: string): AufgabeZeile {
  const zeile = eine<AufgabeZeile>(`${AUFGABE_ABFRAGE} WHERE b.id = ?`, heute, id);
  if (!zeile) {
    throw nichtGefunden('Die Basis-Aufgabe');
  }
  return zeile;
}

export function ladeBasisAufgaben(jetzt = new Date()): BasisAufgabe[] {
  return alle<AufgabeZeile>(
    `${AUFGABE_ABFRAGE} WHERE ${PROJEKT_ODER_FREI} ORDER BY b.archiviert, p.name COLLATE NOCASE, b.name COLLATE NOCASE`,
    lokalesDatum(jetzt),
  ).map(zuAufgabe);
}

export function pruefeProjektUndVorlage(projektId: number | null, vorlageId: number | null): void {
  if (projektId !== null) {
    const projekt = eine<{ aktiv: number }>(
      `SELECT (${PROJEKT_AKTIV}) AS aktiv FROM projekte p ${KONTEXT_JOINS} WHERE p.id = ?`,
      projektId,
    );
    if (!projekt) {
      throw nichtGefunden('Das Projekt');
    }
    if (projekt.aktiv !== 1) {
      throw ungueltig('Das Projekt oder seine Vision bzw. Organisation ist archiviert.');
    }
  }
  if (vorlageId !== null) {
    pruefeAktiveVorlage(vorlageId);
    pruefeVorlageZumProjekt(vorlageId, projektId);
  }
  if (projektId === null && vorlageId === null) {
    throw ungueltig('Wähle eine Tätigkeit.');
  }
}

export function erstelleBasisAufgabe(daten: BasisAufgabeDaten, jetzt = new Date()): BasisAufgabe {
  pruefeFunktion('basis');
  if (daten.projektId !== null) {
    pruefeEbene('projekte');
  }
  pruefeProjektUndVorlage(daten.projektId, daten.vorlageId);
  const { id } = ausfuehren(
    'INSERT INTO basis_aufgaben (projekt_id, vorlage_id, name, icon, stunden) VALUES (?, ?, ?, ?, ?)',
    daten.projektId,
    daten.vorlageId,
    daten.name,
    daten.icon,
    daten.stunden,
  );
  return zuAufgabe(ladeAufgabeZeile(id, lokalesDatum(jetzt)));
}

export function aendereBasisAufgabe(
  id: number,
  aenderung: Partial<BasisAufgabeDaten> & { archiviert?: boolean },
  jetzt = new Date(),
): BasisAufgabe {
  pruefeFunktion('basis');
  const heute = lokalesDatum(jetzt);
  const bisher = ladeAufgabeZeile(id, heute);
  if (aenderung.projektId !== undefined && aenderung.projektId !== null) {
    pruefeEbene('projekte');
  }
  if (aenderung.projektId !== undefined || aenderung.vorlageId !== undefined) {
    pruefeProjektUndVorlage(
      aenderung.projektId !== undefined ? aenderung.projektId : bisher.projektId,
      aenderung.vorlageId !== undefined ? aenderung.vorlageId : bisher.vorlageId,
    );
  }
  aktualisiere('basis_aufgaben', id, {
    name: aenderung.name,
    icon: aenderung.icon,
    projekt_id: aenderung.projektId,
    archiviert: alsZahl(aenderung.archiviert),
  });
  if (aenderung.vorlageId !== undefined) {
    ausfuehren('UPDATE basis_aufgaben SET vorlage_id = ? WHERE id = ?', aenderung.vorlageId, id);
  }
  if (aenderung.stunden !== undefined) {
    ausfuehren('UPDATE basis_aufgaben SET stunden = ? WHERE id = ?', aenderung.stunden, id);
  }
  return zuAufgabe(ladeAufgabeZeile(id, heute));
}

export function erledigeBasisAufgabe(id: number, jetzt = new Date(), datum: string | null = null): EintragErgebnis {
  pruefeFunktion('basis');
  const tag = datum ?? lokalesDatum(jetzt);
  const aufgabe = ladeAufgabeZeile(id, tag);
  if (aufgabe.archiviert === 1) {
    throw ungueltig('Die Basis-Aufgabe ist archiviert.');
  }
  if (aufgabe.heuteEintragId !== null) {
    throw ungueltig('Diese Basis-Aufgabe ist für den Tag schon erledigt.');
  }
  const vorlageId = aufgabe.vorlageId ?? aufgabe.standardVorlageId;
  if (vorlageId === null) {
    throw ungueltig('Wähle eine Tätigkeit.');
  }
  return erstelleEintrag(
    {
      projektId: istAn('projekte', ladeEinstellungen()) ? aufgabe.projektId : null,
      vorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: aufgabe.stunden,
      notiz: '',
      meilenstein: false,
      faehigkeitId: null,
      datum,
    },
    jetzt,
    { basisAufgabeId: id },
  );
}
