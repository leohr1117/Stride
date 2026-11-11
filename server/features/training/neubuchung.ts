import type { Belohnung, Bonus, EintragErgebnis } from '../../../shared/api/index.ts';
import { lokalesDatum } from '../../../shared/spiel/datum.ts';
import { abzugXp } from '../../../shared/spiel/belastung.ts';
import { kettenLaenge } from '../../../shared/spiel/kette.ts';
import {
  bestaendigkeitsBonus,
  eintragXp,
  meilensteinBonus,
  verteileNachGewichten,
  verteileTaetigkeit,
  type Multiplikator,
  type XpAnteil,
} from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, inTransaktion } from '../../db.ts';
import { nichtGefunden } from '../../fehler.ts';
import { ladeEintrag, ladeAktiveTageDesProjekts } from '../eintraege/eintraege.ts';
import { bonusAufAttribut } from '../investitionen/ausruestung.ts';
import {
  aktivesAttribut,
  ladeAttributXp,
  ladeErschoepfungen,
  type ErschoepfungRegel,
} from '../attribute/attribute.ts';
import {
  bucheAttributXp,
  bucheProjektXp,
  erstelleBelohnung,
  ladeLevelStand,
  type AttributBuchung,
  type LevelStand,
  type XpQuelle,
} from '../../services/fortschritt.ts';
import { ladeAktiveVerteilung, type AktiveVerteilung } from '../taetigkeiten/vorlagen.ts';
import { verteilungFuerPlan, type PlanBezug } from './zuordnung.ts';

const NEU_QUELLEN = ['eintrag', 'bestaendigkeit', 'meilenstein', 'abzug'] as const;

interface RohBuchung {
  projektId: number | null;
  vorlageId: number;
  faktor: number;
  ausruestungBonus: number;
  erstelltAm: string;
}

interface XpZeile {
  quelle: string;
  attributId: number;
  xp: number;
  vorhabenId: number | null;
}

function mindereGezielt(anteile: XpAnteil[], regeln: ErschoepfungRegel[]): XpAnteil[] {
  return anteile.map((anteil) => {
    let faktor = 1;
    for (const regel of regeln) {
      if (regel.zielId === anteil.attributId) {
        faktor *= regel.faktor;
      }
    }
    return { attributId: anteil.attributId, xp: Math.round(anteil.xp * faktor) };
  });
}

function ladeRohBuchung(eintragId: number): RohBuchung {
  const zeile = eine<RohBuchung>(
    `SELECT projekt_id AS projektId, vorlage_id AS vorlageId, faktor,
            ausruestung_bonus AS ausruestungBonus, erstellt_am AS erstelltAm
     FROM eintraege WHERE id = ?`,
    eintragId,
  );
  if (!zeile) {
    throw nichtGefunden('Der Eintrag');
  }
  return zeile;
}

function bezugDerEinheit(einheitId: number): PlanBezug | null {
  return (
    eine<PlanBezug>(
      `SELECT p.projekt_id AS projektId, p.vorlage_id AS vorlageId
       FROM trainingseinheiten e
       JOIN trainingsplaene p ON p.id = e.plan_id
       WHERE e.id = ?`,
      einheitId,
    ) ?? null
  );
}

function verteilungDerEinheit(einheitId: number, vorlageId: number): AktiveVerteilung {
  const plan = bezugDerEinheit(einheitId);
  return plan ? verteilungFuerPlan(plan) : ladeAktiveVerteilung(vorlageId);
}

function loescheBuchungen(eintragId: number): void {
  const liste = NEU_QUELLEN.map(() => '?').join(', ');
  ausfuehren(`DELETE FROM xp_ereignisse WHERE eintrag_id = ? AND quelle IN (${liste})`, eintragId, ...NEU_QUELLEN);
  ausfuehren(`DELETE FROM projekt_xp WHERE eintrag_id = ? AND quelle IN (${liste})`, eintragId, ...NEU_QUELLEN);
  ausfuehren(`DELETE FROM faehigkeit_xp WHERE eintrag_id = ? AND quelle IN (${liste})`, eintragId, ...NEU_QUELLEN);
}

function istQuelle(wert: string): wert is XpQuelle {
  return (
    wert === 'eintrag' ||
    wert === 'belastung' ||
    wert === 'bestaendigkeit' ||
    wert === 'meilenstein' ||
    wert === 'weitermachen' ||
    wert === 'abzug'
  );
}

function weitermachenBuchungen(eintragId: number): AttributBuchung[] {
  return alle<XpZeile>(
    `SELECT quelle, attribut_id AS attributId, xp, vorhaben_id AS vorhabenId
     FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'weitermachen'`,
    eintragId,
  ).flatMap((zeile) =>
    istQuelle(zeile.quelle)
      ? [{ quelle: zeile.quelle, attributId: zeile.attributId, xp: zeile.xp, eintragId, vorhabenId: zeile.vorhabenId }]
      : [],
  );
}

function bucheAnteile(
  buchungen: AttributBuchung[],
  quelle: XpQuelle,
  anteile: { attributId: number; xp: number }[],
  eintragId: number,
  zeitpunkt: string,
): number {
  let summe = 0;
  for (const anteil of anteile) {
    if (anteil.xp > 0) {
      buchungen.push(bucheAttributXp({ quelle, attributId: anteil.attributId, xp: anteil.xp, eintragId, vorhabenId: null }, zeitpunkt));
      summe += anteil.xp;
    }
  }
  return summe;
}

function bucheAbzuege(
  abzuege: { attributId: number; prozent: number }[],
  grund: number,
  eintragId: number,
  iso: string,
  buchungen: AttributBuchung[],
  stand: LevelStand,
): { name: string; farbe: string }[] {
  const beiNull: { name: string; farbe: string }[] = [];
  for (const abzug of abzuege) {
    const offen = abzugXp(grund, abzug.prozent, Number.POSITIVE_INFINITY);
    if (offen <= 0) {
      continue;
    }
    const betrag = abzugXp(grund, abzug.prozent, ladeAttributXp(abzug.attributId));
    if (betrag > 0) {
      buchungen.push(
        bucheAttributXp({ quelle: 'abzug', attributId: abzug.attributId, xp: -betrag, eintragId, vorhabenId: null }, iso),
      );
    } else {
      const attribut = stand.attribute.get(abzug.attributId);
      if (attribut) {
        beiNull.push({ name: attribut.name, farbe: attribut.farbe ?? '' });
      }
    }
  }
  return beiNull;
}

export function bucheNeu(eintragId: number, einheitId: number, stunden: number, meilenstein: boolean): EintragErgebnis {
  const roh = ladeRohBuchung(eintragId);
  const verteilung = verteilungDerEinheit(einheitId, roh.vorlageId);
  const gewichte = verteilung.gewichte;
  const vorher = ladeLevelStand(roh.projektId, null);
  const gebucht = inTransaktion(() => {
    ausfuehren('UPDATE eintraege SET stunden = ?, meilenstein = ? WHERE id = ?', stunden, Number(meilenstein), eintragId);
    loescheBuchungen(eintragId);
    const erschoepfungen = ladeErschoepfungen().filter((regel) => regel.faktor < 1);
    const gezielte = erschoepfungen.filter((regel) => regel.zielId !== null);
    const xp = eintragXp(stunden, roh.faktor);
    const zeitpunkt = roh.erstelltAm;
    const buchungen: AttributBuchung[] = [];
    const boni: Bonus[] = [];
    const anteile = mindereGezielt(verteileTaetigkeit(xp, gewichte, verteilung.fest), gezielte).map((anteil) => ({
      attributId: anteil.attributId,
      xp: Math.round(anteil.xp * (1 + bonusAufAttribut(anteil.attributId, zeitpunkt))),
    }));
    bucheAnteile(buchungen, 'eintrag', anteile, eintragId, zeitpunkt);
    let projektXp = 0;
    if (roh.projektId !== null) {
      const betrag = Math.round(xp * (1 + roh.ausruestungBonus));
      bucheProjektXp({ quelle: 'eintrag', projektId: roh.projektId, xp: betrag, eintragId, vorhabenId: null }, zeitpunkt);
      projektXp += betrag;
    }
    const abzugBeiNull = verteilung.fest
      ? bucheAbzuege(verteilung.abzuege, eintragXp(stunden), eintragId, zeitpunkt, buchungen, vorher)
      : [];
    const disziplinId = aktivesAttribut('disziplin');
    const tag = lokalesDatum(new Date(zeitpunkt));
    const tageVorher = ladeAktiveTageDesProjekts(roh.projektId, eintragId);
    if (disziplinId !== null && !tageVorher.includes(tag)) {
      const laenge = kettenLaenge([...tageVorher, tag], tag);
      const kettenBonus = bucheAnteile(
        buchungen,
        'bestaendigkeit',
        [{ attributId: disziplinId, xp: bestaendigkeitsBonus(laenge) }],
        eintragId,
        zeitpunkt,
      );
      if (kettenBonus > 0) {
        boni.push({ quelle: 'bestaendigkeit', label: `Tageskette: Tag ${laenge}`, xp: kettenBonus });
      }
    }
    if (meilenstein) {
      const bonus = meilensteinBonus(xp, false);
      bucheAnteile(buchungen, 'meilenstein', verteileNachGewichten(bonus, gewichte), eintragId, zeitpunkt);
      if (roh.projektId !== null) {
        bucheProjektXp({ quelle: 'meilenstein', projektId: roh.projektId, xp: bonus, eintragId, vorhabenId: null }, zeitpunkt);
        projektXp += bonus;
      }
      boni.push({ quelle: 'meilenstein', label: 'Meilenstein erreicht', xp: bonus });
    }
    const weiter = weitermachenBuchungen(eintragId);
    if (weiter.length > 0) {
      buchungen.push(...weiter);
      const summe = weiter.reduce((bisher, zeile) => bisher + zeile.xp, 0);
      if (summe > 0) {
        boni.push({ quelle: 'weitermachen', label: 'Weitergemacht nach Rückschlag', xp: summe });
      }
    }
    const multiplikatoren: Multiplikator[] = [];
    if (Math.abs(roh.faktor - 1) > Number.EPSILON) {
      multiplikatoren.push({ art: 'momentum', faktor: roh.faktor });
    }
    if (roh.ausruestungBonus > 0) {
      multiplikatoren.push({ art: 'ausruestung', faktor: 1 + roh.ausruestungBonus });
    }
    for (const regel of gezielte) {
      multiplikatoren.push({
        art: 'erschoepfung',
        faktor: regel.faktor,
        label: `Erschöpfung: ${regel.quelleName} → ${regel.zielName ?? ''}`,
      });
    }
    return { buchungen, boni, projektXp, multiplikatoren, abzugBeiNull };
  });
  return belohnungFuer(
    eintragId,
    roh.projektId,
    gebucht.projektXp,
    gebucht.buchungen,
    gebucht.boni,
    meilenstein,
    gebucht.multiplikatoren,
    vorher,
    gebucht.abzugBeiNull,
  );
}

function belohnungFuer(
  eintragId: number,
  projektId: number | null,
  projektXp: number,
  buchungen: AttributBuchung[],
  boni: Bonus[],
  meilenstein: boolean,
  multiplikatoren: Multiplikator[],
  vorher: ReturnType<typeof ladeLevelStand>,
  abzugBeiNull: { name: string; farbe: string }[],
): EintragErgebnis {
  const nachher = ladeLevelStand(projektId, null);
  const name = projektId === null ? null : eine<{ name: string }>('SELECT name FROM projekte WHERE id = ?', projektId)?.name ?? null;
  const belohnung: Belohnung = erstelleBelohnung({
    buchungen,
    boni,
    meilenstein,
    projekt: name === null ? null : { name, xp: projektXp },
    multiplikatoren,
    vorher,
    nachher,
    abzugBeiNull,
  });
  return { eintrag: ladeEintrag(eintragId), belohnung };
}

export function gespeichertesErgebnis(eintragId: number): EintragErgebnis {
  const eintrag = ladeEintrag(eintragId);
  const buchungen = alle<XpZeile>(
    `SELECT quelle, attribut_id AS attributId, xp, vorhaben_id AS vorhabenId
     FROM xp_ereignisse WHERE eintrag_id = ?`,
    eintragId,
  ).flatMap((zeile) =>
    istQuelle(zeile.quelle)
      ? [{ quelle: zeile.quelle, attributId: zeile.attributId, xp: zeile.xp, eintragId, vorhabenId: zeile.vorhabenId }]
      : [],
  );
  const boni: Bonus[] = [];
  const summe = (quelle: string) => buchungen.filter((zeile) => zeile.quelle === quelle).reduce((bisher, zeile) => bisher + zeile.xp, 0);
  const kette = summe('bestaendigkeit');
  if (kette > 0) {
    const tag = lokalesDatum(new Date(eintrag.erstelltAm));
    const tage = ladeAktiveTageDesProjekts(eintrag.projektId, eintragId);
    const laenge = kettenLaenge(tage.includes(tag) ? tage : [...tage, tag], tag);
    boni.push({ quelle: 'bestaendigkeit', label: `Tageskette: Tag ${laenge}`, xp: kette });
  }
  const meilensteinXp = summe('meilenstein');
  if (meilensteinXp > 0) {
    boni.push({ quelle: 'meilenstein', label: 'Meilenstein erreicht', xp: meilensteinXp });
  }
  const weiter = summe('weitermachen');
  if (weiter > 0) {
    boni.push({ quelle: 'weitermachen', label: 'Weitergemacht nach Rückschlag', xp: weiter });
  }
  const projektXp =
    eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM projekt_xp WHERE eintrag_id = ?', eintragId)?.xp ?? 0;
  const stand = ladeLevelStand(eintrag.projektId, null);
  return belohnungFuer(eintragId, eintrag.projektId, projektXp, buchungen, boni, eintrag.meilenstein, [], stand, []);
}
