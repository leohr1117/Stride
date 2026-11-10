import type {
  AnlaufErgebnis,
  BossInfo,
  Laufendes,
  Vorhaben,
  VorhabenAenderung,
  VorhabenMitProjekt,
} from '../../../shared/api/index.ts';
import type { VorhabenStatus } from '../../../shared/spiel/begriffe.ts';
import { sperrtext } from '../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { BOSS, bossBeute, bossPhase, bossRingAnteil, NEUER_ANLAUF, WEITERMACHEN } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, inTransaktion, type Parameter } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { istLoeschbar } from '../../services/loeschen.ts';
import { aktivesAttribut } from '../attribute/attribute.ts';
import { ladeEinstellungen, pruefeFunktion } from '../einstellungen/einstellungen.ts';
import { bucheAttributXp, erstelleBelohnung, ladeLevelStand, type AttributBuchung } from '../../services/fortschritt.ts';
import { KONTEXT_JOINS, PROJEKT_AKTIV, PROJEKT_FARBE, PROJEKT_ODER_FREI } from './kontext.ts';
import { datumPlus, leseJetzt, lokalesDatum, tagesbeginn } from '../../services/zeit.ts';

interface VorhabenZeile {
  id: number;
  projektId: number | null;
  titel: string;
  status: VorhabenStatus;
  anlauf: number;
  vorgaengerId: number | null;
  hatNachfolger: number;
  erkenntnis: string;
  eingeloest: number;
  anzahlEintraege: number;
  stunden: number;
  xp: number;
  erstelltAm: string;
  abgeschlossenAm: string | null;
  letzteAktivitaet: string;
  projektName: string | null;
  farbe: string;
  boss: number;
  bossSchaden: number;
  bossLevel: number | null;
  deadline: string | null;
  angriffXp: number;
}

const VORHABEN_ABFRAGE = `
  SELECT vh.id, vh.projekt_id AS projektId, vh.titel, vh.status, vh.anlauf, vh.vorgaenger_id AS vorgaengerId,
         EXISTS (SELECT 1 FROM vorhaben n WHERE n.vorgaenger_id = vh.id) AS hatNachfolger,
         vh.erkenntnis, vh.weitermachen_eingeloest AS eingeloest,
         COALESCE(e.anzahl, 0) AS anzahlEintraege, COALESCE(e.stunden, 0) AS stunden, COALESCE(x.xp, 0) AS xp,
         vh.erstellt_am AS erstelltAm, vh.abgeschlossen_am AS abgeschlossenAm,
         COALESCE(e.letzter, vh.erstellt_am) AS letzteAktivitaet,
         p.name AS projektName, ${PROJEKT_FARBE} AS farbe,
         vh.boss, COALESCE(e.schaden, 0) AS bossSchaden, vh.boss_level AS bossLevel, vh.deadline,
         COALESCE((SELECT -SUM(xp) FROM xp_ereignisse WHERE quelle = 'bossangriff' AND vorhaben_id = vh.id), 0) AS angriffXp
  FROM vorhaben vh
  LEFT JOIN projekte p ON p.id = vh.projekt_id
  ${KONTEXT_JOINS}
  LEFT JOIN (
    SELECT vorhaben_id, COUNT(*) AS anzahl, SUM(COALESCE(stunden, 0)) AS stunden, MAX(erstellt_am) AS letzter,
           SUM(COALESCE(boss_schaden, 0)) AS schaden
    FROM eintraege
    WHERE vorhaben_id IS NOT NULL
    GROUP BY vorhaben_id
  ) e ON e.vorhaben_id = vh.id
  LEFT JOIN (
    SELECT vorhaben_id, SUM(xp) AS xp FROM projekt_xp WHERE vorhaben_id IS NOT NULL GROUP BY vorhaben_id
  ) x ON x.vorhaben_id = vh.id
`;

function weitermachenFrist(jetzt: Date): string {
  return tagesbeginn(jetzt, WEITERMACHEN.fristTage).toISOString();
}

function zuBossInfo(zeile: VorhabenZeile, heute: string): BossInfo | null {
  if (zeile.boss !== 1 || zeile.deadline === null) {
    return null;
  }
  const geschafft = zeile.status === 'geschafft';
  const level = geschafft ? zeile.bossLevel : null;
  return {
    deadline: zeile.deadline,
    phase: bossPhase(zeile.deadline, heute),
    ring: bossRingAnteil(lokalesDatum(new Date(zeile.erstelltAm)), zeile.deadline, heute),
    angriffXp: zeile.angriffXp,
    level,
    kampfXp: geschafft ? zeile.bossSchaden : null,
    beute: geschafft ? bossBeute(level) : 0,
  };
}

function zuVorhaben(zeile: VorhabenZeile, jetzt: Date): VorhabenMitProjekt {
  const innerhalbFrist = zeile.abgeschlossenAm !== null && zeile.abgeschlossenAm >= weitermachenFrist(jetzt);
  return {
    boss: zuBossInfo(zeile, lokalesDatum(jetzt)),
    id: zeile.id,
    projektId: zeile.projektId,
    titel: zeile.titel,
    status: zeile.status,
    anlauf: zeile.anlauf,
    vorgaengerId: zeile.vorgaengerId,
    hatNachfolger: zeile.hatNachfolger === 1,
    erkenntnis: zeile.erkenntnis,
    anzahlEintraege: zeile.anzahlEintraege,
    stunden: zeile.stunden,
    xp: zeile.xp,
    erstelltAm: zeile.erstelltAm,
    letzteAktivitaet: zeile.letzteAktivitaet,
    abgeschlossenAm: zeile.abgeschlossenAm,
    weitermachenOffen: zeile.status === 'gescheitert' && zeile.eingeloest === 0 && innerhalbFrist,
    loeschbar: istLoeschbar('vorhaben', zeile.id),
    projektName: zeile.projektName,
    farbe: zeile.farbe,
  };
}

function ladeVorhabenListe(bedingung: string, parameter: Parameter[], jetzt: Date, limit?: number): VorhabenMitProjekt[] {
  const begrenzung = limit === undefined ? '' : `LIMIT ${Math.floor(limit)}`;
  return alle<VorhabenZeile>(
    `${VORHABEN_ABFRAGE} WHERE ${bedingung} ORDER BY letzteAktivitaet DESC, vh.id DESC ${begrenzung}`,
    ...parameter,
  ).map((zeile) => zuVorhaben(zeile, jetzt));
}

export function ladeVorhaben(id: number, jetzt = leseJetzt()): VorhabenMitProjekt {
  const [vorhaben] = ladeVorhabenListe('vh.id = ?', [id], jetzt);
  if (!vorhaben) {
    throw nichtGefunden('Das Vorhaben');
  }
  return vorhaben;
}

export function ladeVorhabenFuerProjekt(projektId: number, jetzt = leseJetzt()): Vorhaben[] {
  return ladeVorhabenListe('vh.projekt_id = ?', [projektId], jetzt);
}

export function ladeComebacks(limit: number, jetzt = leseJetzt()): VorhabenMitProjekt[] {
  if (!ladeEinstellungen().ebenen.vorhaben) {
    return [];
  }
  return ladeVorhabenListe(
    `vh.status = 'gescheitert' AND vh.abgeschlossen_am >= ? AND ${PROJEKT_ODER_FREI}
     AND NOT EXISTS (SELECT 1 FROM vorhaben n WHERE n.vorgaenger_id = vh.id)`,
    [weitermachenFrist(jetzt)],
    jetzt,
    limit,
  );
}

function pruefeAktivesProjekt(projektId: number): void {
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

export function legeVorhabenAn(projektId: number | null, titel: string, zeitpunkt: Date): number {
  const ebenen = ladeEinstellungen().ebenen;
  if (!ebenen.vorhaben) {
    throw ungueltig(sperrtext('vorhaben'));
  }
  if (projektId === null) {
    throw ungueltig('Ein Vorhaben braucht ein Projekt.');
  }
  if (!ebenen.projekte) {
    throw ungueltig(sperrtext('projekte'));
  }
  pruefeAktivesProjekt(projektId);
  return ausfuehren(
    'INSERT INTO vorhaben (projekt_id, titel, erstellt_am) VALUES (?, ?, ?)',
    projektId,
    titel,
    zeitpunkt.toISOString(),
  ).id;
}

export function erstelleVorhaben(projektId: number | null, titel: string, jetzt = leseJetzt()): Vorhaben {
  return ladeVorhaben(legeVorhabenAn(projektId, titel, jetzt), jetzt);
}

export function ladeVorhabenAlle(jetzt = leseJetzt()): VorhabenMitProjekt[] {
  if (!ladeEinstellungen().ebenen.vorhaben) {
    return [];
  }
  return ladeVorhabenListe(PROJEKT_ODER_FREI, [], jetzt);
}

function nachDeadline(a: VorhabenMitProjekt, b: VorhabenMitProjekt): number {
  const deadlineA = a.boss?.deadline ?? null;
  const deadlineB = b.boss?.deadline ?? null;
  if (deadlineA === deadlineB) {
    return 0;
  }
  if (deadlineA === null) {
    return 1;
  }
  if (deadlineB === null) {
    return -1;
  }
  return deadlineA.localeCompare(deadlineB);
}

export function ladeLaufendes(jetzt = leseJetzt()): Laufendes {
  if (!ladeEinstellungen().ebenen.vorhaben) {
    return { bosse: [], vorhaben: [] };
  }
  const offene = ladeVorhabenListe(`vh.status = 'offen' AND ${PROJEKT_ODER_FREI}`, [], jetzt);
  return {
    bosse: offene.filter((vorhaben) => vorhaben.boss !== null).sort(nachDeadline),
    vorhaben: offene.filter((vorhaben) => vorhaben.boss === null),
  };
}

export function ladeAngreifendeBosse(jetzt = leseJetzt()): VorhabenMitProjekt[] {
  return ladeLaufendes(jetzt).bosse.filter((vorhaben) => vorhaben.boss?.phase === 'erwacht');
}

export function aendereVorhaben(id: number, aenderung: VorhabenAenderung, jetzt = leseJetzt()): Vorhaben {
  const vorhaben = ladeVorhaben(id, jetzt);
  if (aenderung.boss !== undefined && aenderung.boss !== null) {
    pruefeFunktion('bossAngriffe');
  }
  if (aenderung.boss !== undefined && vorhaben.status !== 'offen') {
    throw ungueltig('Den Boss-Modus kann man nur bei offenen Vorhaben ändern.');
  }
  const neueDeadline = aenderung.boss?.deadline ?? null;
  if (neueDeadline !== null && neueDeadline !== vorhaben.boss?.deadline && neueDeadline < lokalesDatum(jetzt)) {
    throw ungueltig('Die Deadline darf nicht in der Vergangenheit liegen.');
  }

  inTransaktion(() => {
    if (aenderung.titel !== undefined) {
      ausfuehren('UPDATE vorhaben SET titel = ? WHERE id = ?', aenderung.titel, id);
    }
    if (aenderung.boss === null) {
      ausfuehren('UPDATE vorhaben SET boss = 0, boss_hp = NULL, boss_level = NULL, deadline = NULL WHERE id = ?', id);
    } else if (aenderung.boss !== undefined) {
      ausfuehren(
        'UPDATE vorhaben SET boss = 1, boss_hp = NULL, boss_level = NULL, deadline = ? WHERE id = ?',
        aenderung.boss.deadline,
        id,
      );
    }
  });
  return ladeVorhaben(id);
}

export function lasseVorhabenLos(id: number, jetzt = leseJetzt()): Vorhaben {
  const vorhaben = ladeVorhaben(id, jetzt);
  if (vorhaben.status !== 'offen') {
    throw ungueltig('Nur offene Vorhaben können losgelassen werden.');
  }
  ausfuehren(
    `UPDATE vorhaben SET status = 'losgelassen', abgeschlossen_am = ? WHERE id = ?`,
    jetzt.toISOString(),
    id,
  );
  return ladeVorhaben(id, jetzt);
}

export function starteNeuenAnlauf(id: number, jetzt = leseJetzt()): AnlaufErgebnis {
  const alt = ladeVorhaben(id, jetzt);
  if (alt.status !== 'gescheitert') {
    throw ungueltig('Einen neuen Anlauf gibt es nur für gescheiterte Vorhaben.');
  }
  if (alt.hatNachfolger) {
    throw ungueltig('Für dieses Vorhaben läuft bereits ein neuer Anlauf.');
  }
  if (!ladeEinstellungen().ebenen.vorhaben) {
    throw ungueltig(sperrtext('vorhaben'));
  }
  if (alt.projektId !== null) {
    pruefeAktivesProjekt(alt.projektId);
  }

  const disziplinId = aktivesAttribut('disziplin');
  const geistId = aktivesAttribut('geist');
  const zeitpunkt = jetzt.toISOString();
  const vorher = ladeLevelStand(alt.projektId);
  const alsBoss = istAn('bossAngriffe', ladeEinstellungen()) && alt.boss !== null;
  const heute = lokalesDatum(jetzt);
  const alteDeadline = alt.boss?.deadline ?? null;
  const deadline = alsBoss
    ? alteDeadline !== null && alteDeadline >= heute
      ? alteDeadline
      : datumPlus(heute, BOSS.fristOhneDatumTage)
    : null;

  const { neuId, buchungen } = inTransaktion(() => {
    const { id: neueId } = ausfuehren(
      `INSERT INTO vorhaben (projekt_id, vorgaenger_id, titel, anlauf, boss, boss_hp, boss_level, deadline, erstellt_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      alt.projektId,
      alt.id,
      alt.titel,
      alt.anlauf + 1,
      Number(alsBoss),
      null,
      null,
      deadline,
      zeitpunkt,
    );
    const gebucht: AttributBuchung[] = [];
    const bonusZiele: [number | null, number][] = [
      [disziplinId, NEUER_ANLAUF.disziplin],
      [geistId, NEUER_ANLAUF.geist],
    ];
    for (const [attributId, xp] of bonusZiele) {
      if (attributId !== null) {
        gebucht.push(
          bucheAttributXp({ quelle: 'anlauf', attributId, xp, eintragId: null, vorhabenId: neueId }, zeitpunkt),
        );
      }
    }
    return { neuId: neueId, buchungen: gebucht };
  });

  let bonusXp = 0;
  for (const buchung of buchungen) {
    bonusXp += buchung.xp;
  }
  const nachher = ladeLevelStand(alt.projektId);

  return {
    vorhaben: ladeVorhaben(neuId, jetzt),
    belohnung: erstelleBelohnung({
      buchungen,
      boni: bonusXp > 0 ? [{ quelle: 'anlauf', label: `Neuer Anlauf: ${alt.titel}`, xp: bonusXp }] : [],
      meilenstein: false,
      projekt: null,
      vorher,
      nachher,
    }),
  };
}
