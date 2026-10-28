import { DURCHSCHNITT, findeVorbild } from '../../shared/features/vorbilder/vorbilder.ts';
import type { Funktionen } from '../../shared/spiel/funktionen.ts';
import { START_BOSS_NAME, START_PROJEKT } from '../../shared/spiel/onboarding.ts';
import { FOKUS_PFLICHT, START_TAETIGKEITEN, type FokusId } from '../../shared/spiel/profil.ts';
import type { Sprache } from '../../shared/sprache/kern.ts';
import { zeige } from '../../shared/sprache/index.ts';
import { legeVorhabenAn } from '../features/ziele/vorhaben.ts';
import { ausfuehren, eine } from '../db.ts';
import { ungueltig } from '../fehler.ts';
import { erstelleProjekt } from './struktur.ts';
import { datumPlus, lokalesDatum } from './zeit.ts';

const START_VORBILD = 'start_vorbild';
const START_BOSS = 'start_boss_id';

function speichere(schluessel: string, wert: unknown): void {
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    schluessel,
    JSON.stringify(wert),
  );
}

function leseRoh(schluessel: string): unknown {
  const roh = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', schluessel)?.wert;
  if (roh === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(roh) as unknown;
  } catch {
    return undefined;
  }
}

function nochOffen(wert: unknown): boolean {
  return wert === undefined || wert === null;
}

function vorlageId(fokus: FokusId, sprache: Sprache): number {
  const quelle = START_TAETIGKEITEN[fokus][0]?.name;
  if (!quelle) {
    throw new Error('Start-Tätigkeit fehlt.');
  }
  const uebersetzt = zeige(quelle, sprache);
  const zeile = eine<{ id: number }>(
    `SELECT id FROM vorlagen WHERE name = ? OR name = ?
     ORDER BY CASE name WHEN ? THEN 0 ELSE 1 END, id
     LIMIT 1`,
    uebersetzt,
    quelle,
    uebersetzt,
  );
  if (!zeile) {
    throw new Error('Start-Tätigkeit fehlt.');
  }
  return zeile.id;
}

/** Vorbild und erster Boss, in derselben Transaktion wie die Profilanlage. */
export function wendeStartAn(angaben: {
  startVorbild?: string | null;
  startBoss?: boolean;
  funktionen: Funktionen;
  projekteAn: boolean;
  vorhabenAn: boolean;
  fokus: readonly FokusId[];
  sprache: Sprache;
}): void {
  if (angaben.startVorbild !== undefined && angaben.startVorbild !== null && nochOffen(leseRoh(START_VORBILD))) {
    const schluessel = angaben.startVorbild.trim();
    const vorbild = schluessel === '' || schluessel === DURCHSCHNITT ? undefined : findeVorbild(schluessel);
    if (!vorbild || vorbild.schluessel === DURCHSCHNITT) {
      throw ungueltig('Das Vorbild ist unbekannt.');
    }
    speichere('funktionen', { ...angaben.funktionen, vorbilder: true });
    speichere(START_VORBILD, vorbild.schluessel);
  }

  if (!angaben.projekteAn || !angaben.vorhabenAn || angaben.startBoss === undefined) {
    return;
  }
  if (!nochOffen(leseRoh(START_BOSS))) {
    return;
  }
  if (angaben.startBoss !== true) {
    speichere(START_BOSS, 0);
    return;
  }
  const erster = angaben.fokus[0];
  if (!erster) {
    throw ungueltig(FOKUS_PFLICHT);
  }
  const projekt = erstelleProjekt({
    name: zeige(START_PROJEKT, angaben.sprache),
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlageId(erster, angaben.sprache),
  });
  const id = legeVorhabenAn(projekt.id, zeige(START_BOSS_NAME[erster], angaben.sprache), new Date());
  // aendereVorhaben prüft bossAngriffe. Der Start-Boss entsteht, während Angriffe aus sind.
  ausfuehren(
    'UPDATE vorhaben SET boss = 1, boss_hp = NULL, boss_level = NULL, deadline = ? WHERE id = ?',
    datumPlus(lokalesDatum(new Date()), 7),
    id,
  );
  speichere(START_BOSS, id);
}
