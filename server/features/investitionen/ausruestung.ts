import {
  investitionsZieleGueltig,
  type Investition,
  type InvestitionAenderung,
  type InvestitionDaten,
  type InvestitionsArt,
  type InvestitionsZiel,
} from '../../../shared/api/index.ts';
import type { AttributTyp } from '../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../shared/spiel/funktionen.ts';
import { ausruestungsBonus, investitionsBonus } from '../../../shared/spiel/xp.ts';
import { aktualisiere, alle, alsZahl, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { istLoeschbar } from '../../services/loeschen.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { aktivesAttribut } from '../attribute/attribute.ts';
import { funktionAktiv, ladeEinstellungen, pruefeEbene } from '../einstellungen/einstellungen.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV } from '../ziele/kontext.ts';
import { anlageHinterAltenBuchungen, bucheZahlungsDifferenz, KEINE_ZAHLUNG, loeseZahlung } from './zahlung.ts';

const AKTIV = `i.investition = 1 AND i.archiviert = 0 AND i.geschafft_am IS NOT NULL AND i.geschafft_am <= ?`;

function boni(sql: string, ...parameter: (string | number | null)[]): number {
  if (!funktionAktiv('ausruestung')) {
    return 0;
  }
  return ausruestungsBonus(alle<{ bonus: number }>(sql, ...parameter).map((zeile) => zeile.bonus));
}

/** Bonus, den dieses Projekt auf seine Projekt-XP bekommt. Vision und Projekt teilen sich die Decke. */
export function bonusAufProjekt(projektId: number, visionId: number | null, zeitpunkt: string): number {
  return boni(
    `SELECT i.investition_bonus AS bonus FROM projekte i
     WHERE ${AKTIV}
       AND (
         (i.investition_ziel_art = 'projekt' AND i.investition_ziel_id = ?)
         OR (i.investition_ziel_art = 'vision' AND ? IS NOT NULL AND i.investition_ziel_id = ?)
       )
     UNION ALL
     SELECT n.bonus AS bonus FROM investitionen n
     WHERE n.archiviert = 0
       AND (
         (n.ziel_art = 'projekt' AND n.ziel_id = ?)
         OR (n.ziel_art = 'vision' AND ? IS NOT NULL AND n.ziel_id = ?)
       )`,
    zeitpunkt,
    projektId,
    visionId,
    visionId,
    projektId,
    visionId,
    visionId,
  );
}

/** Bonus auf den Anteil genau dieses Attributs. Die Decke gilt je Attribut. */
export function bonusAufAttribut(attributId: number, zeitpunkt: string): number {
  if (!funktionAktiv('ausruestung')) {
    return 0;
  }
  const attribut = eine<{ archiviert: number; typ: AttributTyp; kennung: string | null }>(
    'SELECT archiviert, typ, kennung FROM attribute WHERE id = ?',
    attributId,
  );
  if (!attribut || attribut.archiviert === 1 || !istTypAktiv(ladeEinstellungen().funktionen, attribut.typ)) {
    return 0;
  }
  return boni(
    `SELECT i.investition_bonus AS bonus FROM projekte i
     WHERE ${AKTIV}
       AND (
         (i.investition_ziel_art = 'attribut' AND i.investition_ziel_id = ?)
         OR (i.investition_ressourcen = 1 AND ? = 'ressourcen')
       )
     UNION ALL
     SELECT n.bonus AS bonus FROM investitionen n
     WHERE n.archiviert = 0
       AND (
         n.attribut_id = ?
         OR (n.ziel_art = 'attribut' AND n.ziel_id = ? AND n.attribut_id IS NOT n.ziel_id)
       )`,
    zeitpunkt,
    attributId,
    attribut.kennung,
    attributId,
    attributId,
  );
}

/** Bonus, den jedes Projekt gerade empfängt. Für die Anzeige, ohne Zeitpunkt. */
export function ladeBoniJeProjekt(): Map<number, number> {
  if (!funktionAktiv('ausruestung')) {
    return new Map();
  }
  const zeilen = alle<{ projektId: number; bonus: number }>(
    `SELECT p.id AS projektId, i.investition_bonus AS bonus
     FROM projekte p
     JOIN projekte i ON i.investition = 1 AND i.archiviert = 0 AND i.geschafft_am IS NOT NULL
     LEFT JOIN organisationen o ON o.id = p.organisation_id
     WHERE (i.investition_ziel_art = 'projekt' AND i.investition_ziel_id = p.id)
        OR (i.investition_ziel_art = 'vision' AND i.investition_ziel_id = COALESCE(p.vision_id, o.vision_id))
     UNION ALL
     SELECT p.id AS projektId, n.bonus AS bonus
     FROM projekte p
     LEFT JOIN organisationen o ON o.id = p.organisation_id
     JOIN investitionen n ON n.archiviert = 0
       AND (
         (n.ziel_art = 'projekt' AND n.ziel_id = p.id)
         OR (n.ziel_art = 'vision' AND n.ziel_id = COALESCE(p.vision_id, o.vision_id))
       )`,
  );
  const boniJeProjekt = new Map<number, number[]>();
  for (const zeile of zeilen) {
    boniJeProjekt.set(zeile.projektId, [...(boniJeProjekt.get(zeile.projektId) ?? []), zeile.bonus]);
  }
  const ergebnis = new Map<number, number>();
  for (const [projektId, liste] of boniJeProjekt) {
    ergebnis.set(projektId, ausruestungsBonus(liste));
  }
  return ergebnis;
}

function pruefeVisionZiel(id: number): void {
  pruefeEbene('visionen');
  const vision = eine<{ archiviert: number }>('SELECT archiviert FROM visionen WHERE id = ?', id);
  if (!vision || vision.archiviert === 1) {
    throw ungueltig('Die Vision existiert nicht oder ist archiviert.');
  }
}

function pruefeProjektZiel(id: number): void {
  const treffer = eine<{ id: number }>(
    `SELECT p.id FROM projekte p ${KONTEXT_JOINS} WHERE p.id = ? AND ${PROJEKT_AKTIV}`,
    id,
  );
  if (!treffer) {
    throw ungueltig('Das Projekt existiert nicht oder ist archiviert.');
  }
}

function pruefeAttributZiel(id: number): void {
  const attribut = eine<{ archiviert: number; typ: AttributTyp }>('SELECT archiviert, typ FROM attribute WHERE id = ?', id);
  if (!attribut || attribut.archiviert === 1) {
    throw ungueltig('Das Attribut existiert nicht oder ist archiviert.');
  }
  if (!istTypAktiv(ladeEinstellungen().funktionen, attribut.typ)) {
    throw ungueltig('Das Attribut ist ausgeschaltet.');
  }
}

function pruefeZiel(ziel: InvestitionsZiel): void {
  if (ziel.art === 'vision') {
    pruefeVisionZiel(ziel.id);
    return;
  }
  if (ziel.art === 'projekt') {
    pruefeProjektZiel(ziel.id);
    return;
  }
  pruefeAttributZiel(ziel.id);
}

export function normalisiereInvestition(
  bisher: { investitionZiel: InvestitionsZiel | null; investitionRessourcen: boolean },
  aenderung: { investitionZiel?: InvestitionsZiel | null; investitionRessourcen?: boolean },
): { ziel: InvestitionsZiel | null; ressourcen: boolean } {
  const ziel = aenderung.investitionZiel !== undefined ? aenderung.investitionZiel : bisher.investitionZiel;
  let ressourcen = aenderung.investitionRessourcen !== undefined ? aenderung.investitionRessourcen : bisher.investitionRessourcen;
  if (aenderung.investitionZiel) {
    pruefeZiel(aenderung.investitionZiel);
  }
  const ressourcenId = aktivesAttribut('ressourcen');
  if (ziel?.art === 'attribut' && ressourcenId !== null && ziel.id === ressourcenId) {
    ressourcen = false;
  }
  if (ressourcen && ressourcenId === null) {
    throw ungueltig('Ressourcen ist ausgeschaltet.');
  }
  return { ziel, ressourcen };
}

export function istInvestitionsArt(art: string | null): art is InvestitionsArt {
  return art === 'vision' || art === 'projekt' || art === 'attribut';
}

interface InvestitionZeile {
  id: number;
  name: string;
  icon: string;
  groesse: number;
  bonus: number;
  zielArt: string | null;
  zielId: number | null;
  zielName: string | null;
  attributId: number | null;
  attributName: string | null;
  bezahltAttributId: number | null;
  betrag: number;
  archiviert: number;
  erstelltAm: string;
}

const INVESTITION_ABFRAGE = `
  SELECT n.id, n.name, n.icon, n.groesse, n.bonus,
         n.ziel_art AS zielArt, n.ziel_id AS zielId, n.attribut_id AS attributId,
         a.name AS attributName, n.bezahlt_attribut_id AS bezahltAttributId, n.betrag,
         n.archiviert, n.erstellt_am AS erstelltAm,
         CASE n.ziel_art
           WHEN 'vision' THEN (SELECT titel FROM visionen WHERE id = n.ziel_id)
           WHEN 'projekt' THEN (SELECT name FROM projekte WHERE id = n.ziel_id)
           WHEN 'attribut' THEN (SELECT name FROM attribute WHERE id = n.ziel_id)
           ELSE NULL
         END AS zielName
  FROM investitionen n
  LEFT JOIN attribute a ON a.id = n.attribut_id
`;

function zuInvestition(zeile: InvestitionZeile): Investition {
  const ziel = istInvestitionsArt(zeile.zielArt) && zeile.zielId !== null ? { art: zeile.zielArt, id: zeile.zielId } : null;
  return {
    id: zeile.id,
    name: zeile.name,
    icon: zeile.icon,
    groesse: zeile.groesse,
    bonus: zeile.bonus,
    ziel,
    zielName: zeile.zielName,
    attributId: zeile.attributId,
    attributName: zeile.attributName,
    bezahltAttributId: zeile.bezahltAttributId,
    betrag: zeile.betrag,
    archiviert: zeile.archiviert === 1,
    loeschbar: istLoeschbar('investition', zeile.id),
    erstelltAm: zeile.erstelltAm,
  };
}

export function ladeInvestitionen(): Investition[] {
  return alle<InvestitionZeile>(`${INVESTITION_ABFRAGE} ORDER BY n.archiviert, n.name COLLATE NOCASE`).map(zuInvestition);
}

function ladeInvestition(id: number): Investition {
  const zeile = eine<InvestitionZeile>(`${INVESTITION_ABFRAGE} WHERE n.id = ?`, id);
  if (!zeile) {
    throw nichtGefunden('Die Investition');
  }
  return zuInvestition(zeile);
}

function groesseVon(groesse: number): number {
  return Math.min(3, Math.max(0, Math.round(groesse)));
}

function pruefeZahlung(zahlung: { bezahltAttributId: number | null; betrag: number }, bisher: { bezahltAttributId: number | null; betrag: number } | null): void {
  if (zahlung.bezahltAttributId === null) {
    return;
  }
  const wechsel = bisher === null || zahlung.bezahltAttributId !== bisher.bezahltAttributId;
  if (wechsel || zahlung.betrag > (bisher?.betrag ?? 0)) {
    pruefeAttributZiel(zahlung.bezahltAttributId);
  }
}

const ZIEL_FEHLT = 'Wähle ein Attribut oder ein Projekt.';

function kanonZiel(ziel: InvestitionsZiel | null | undefined): InvestitionsZiel | null {
  if (!ziel) {
    return null;
  }
  if (ziel.art === 'attribut') {
    throw ungueltig(ZIEL_FEHLT);
  }
  return ziel;
}

export function erstelleInvestition(daten: InvestitionDaten): Investition {
  const attributId = daten.attributId ?? null;
  const ziel = kanonZiel(daten.ziel);
  if (!investitionsZieleGueltig(attributId, ziel)) {
    throw ungueltig(ZIEL_FEHLT);
  }
  if (attributId !== null) {
    pruefeAttributZiel(attributId);
  }
  if (ziel) {
    pruefeZiel(ziel);
  }
  const zahlung = loeseZahlung(null, daten);
  pruefeZahlung(zahlung, null);
  const groesse = groesseVon(daten.groesse);
  return inTransaktion(() => {
    const { id } = ausfuehren(
      `INSERT INTO investitionen (name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id, bezahlt_attribut_id, betrag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      daten.name,
      daten.icon,
      groesse,
      investitionsBonus(groesse),
      ziel?.art ?? null,
      ziel?.id ?? null,
      attributId,
      zahlung.bezahltAttributId,
      zahlung.betrag,
    );
    const investitionId = Number(id);
    anlageHinterAltenBuchungen(investitionId);
    bucheZahlungsDifferenz(investitionId, KEINE_ZAHLUNG, zahlung, leseJetzt().toISOString());
    return ladeInvestition(investitionId);
  });
}

export function aendereInvestition(id: number, aenderung: InvestitionAenderung): Investition {
  const bisher = ladeInvestition(id);
  const attributId = aenderung.attributId !== undefined ? aenderung.attributId : bisher.attributId;
  const ziel = aenderung.ziel !== undefined ? kanonZiel(aenderung.ziel) : bisher.ziel;
  if (!investitionsZieleGueltig(attributId, ziel)) {
    throw ungueltig(ZIEL_FEHLT);
  }
  if (attributId !== null && aenderung.attributId !== undefined) {
    pruefeAttributZiel(attributId);
  }
  if (ziel && aenderung.ziel !== undefined) {
    pruefeZiel(ziel);
  }
  const zahlung = loeseZahlung(bisher, aenderung);
  pruefeZahlung(zahlung, bisher);
  const zahlungNeu = zahlung.bezahltAttributId !== bisher.bezahltAttributId || zahlung.betrag !== bisher.betrag;
  const groesse = aenderung.groesse === undefined ? undefined : groesseVon(aenderung.groesse);
  return inTransaktion(() => {
    aktualisiere('investitionen', id, {
      name: aenderung.name,
      icon: aenderung.icon,
      groesse,
      bonus: groesse === undefined ? undefined : investitionsBonus(groesse),
      attribut_id: aenderung.attributId,
      archiviert: alsZahl(aenderung.archiviert),
      bezahlt_attribut_id: zahlungNeu ? zahlung.bezahltAttributId : undefined,
      betrag: zahlungNeu ? zahlung.betrag : undefined,
    });
    if (aenderung.ziel !== undefined) {
      ausfuehren(
        'UPDATE investitionen SET ziel_art = ?, ziel_id = ? WHERE id = ?',
        ziel?.art ?? null,
        ziel?.id ?? null,
        id,
      );
    }
    if (zahlungNeu) {
      bucheZahlungsDifferenz(id, bisher, zahlung, leseJetzt().toISOString());
    }
    return ladeInvestition(id);
  });
}

export function loescheInvestition(id: number): void {
  inTransaktion(() => {
    const bisher = ladeInvestition(id);
    if (!istLoeschbar('investition', id)) {
      throw ungueltig('Das ist schon genutzt und kann nur archiviert werden.');
    }
    bucheZahlungsDifferenz(id, bisher, KEINE_ZAHLUNG, leseJetzt().toISOString());
    ausfuehren('DELETE FROM investitionen WHERE id = ?', id);
  });
}
