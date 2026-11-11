import type { Erfolge } from '../../../shared/api/index.ts';
import { erfolgName, erfolgSchluessel, ERFOLGE, erreichteErfolge, kennzahlAusSchluessel, type Kennzahlen } from '../../../shared/spiel/erfolge.ts';
import { erfolgSichtbar } from '../../../shared/spiel/sichtbarkeit.ts';
import { laengsteKette } from '../../../shared/spiel/kette.ts';
import { alle, ausfuehren, eine } from '../../db.ts';
import { ungueltig } from '../../fehler.ts';
import { leseJetzt } from '../../services/zeit.ts';
import { ladeCharakterLevel } from '../attribute/attribute.ts';
import { ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { ladeAktiveTage, ladePausen } from '../../services/serie.ts';

const TITEL_EINSTELLUNG = 'titel';

type ZaehlbareKennzahlen = Omit<Kennzahlen, 'streak' | 'level' | 'aktiveTage'>;

export function ladeKennzahlen(): Kennzahlen {
  const zaehlungen = eine<ZaehlbareKennzahlen>(
    `SELECT (SELECT COUNT(*) FROM eintraege) AS eintraege,
            (SELECT COUNT(*) FROM eintraege WHERE meilenstein = 1) AS meilensteine,
            (SELECT COUNT(*) FROM vorhaben WHERE boss = 1 AND status = 'geschafft') AS bosse,
            (SELECT COALESCE(MAX(boss_level), 0) FROM vorhaben WHERE boss = 1 AND status = 'geschafft') AS bossLevel,
            (SELECT COUNT(*) FROM vorhaben WHERE status = 'geschafft' AND anlauf > 1) AS comebacks,
            (SELECT COUNT(*) FROM eintraege WHERE basis_aufgabe_id IS NOT NULL) AS basis,
            (SELECT COUNT(*) FROM skill_knoten WHERE freigeschaltet_am IS NOT NULL) AS skills,
            (SELECT COUNT(*) FROM projekte WHERE investition = 1 AND archiviert = 0 AND geschafft_am IS NOT NULL)
              + (SELECT COUNT(*) FROM investitionen WHERE archiviert = 0) AS ausruestung,
            (SELECT COALESCE(SUM(stunden), 0) FROM eintraege) AS stunden,
            (SELECT COUNT(*) FROM rueckblicke WHERE gut <> '' OR lernen <> '' OR fokus <> '') AS rueckblicke,
            (SELECT COUNT(*) FROM visionen WHERE erreicht_am IS NOT NULL) AS visionen`,
  );
  if (!zaehlungen) {
    throw new Error('Die Kennzahlen für Erfolge konnten nicht geladen werden.');
  }
  const tage = ladeAktiveTage();
  return { ...zaehlungen, aktiveTage: tage.length, streak: laengsteKette(tage, [], ladePausen()), level: ladeCharakterLevel().level };
}

function ladeErreichte(): Map<string, string> {
  const erreicht = new Map<string, string>();
  for (const zeile of alle<{ schluessel: string; erreichtAm: string }>(
    'SELECT schluessel, erreicht_am AS erreichtAm FROM erfolge',
  )) {
    erreicht.set(zeile.schluessel, zeile.erreichtAm);
  }
  return erreicht;
}

export function schalteErfolgeFrei(zeitpunkt = leseJetzt()): string[] {
  const vorhanden = ladeErreichte();
  const sichtbarkeit = ladeEinstellungen();
  const neu: string[] = [];
  for (const schluessel of erreichteErfolge(ladeKennzahlen())) {
    if (!vorhanden.has(schluessel)) {
      ausfuehren('INSERT INTO erfolge (schluessel, erreicht_am) VALUES (?, ?)', schluessel, zeitpunkt.toISOString());
      const kennzahl = kennzahlAusSchluessel(schluessel);
      const name = erfolgName(schluessel);
      if (name !== null && kennzahl !== null && erfolgSichtbar(kennzahl, sichtbarkeit)) {
        neu.push(name);
      }
    }
  }
  return neu;
}

function ladeTitelSchluessel(): string | null {
  const zeile = eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', TITEL_EINSTELLUNG);
  if (!zeile) {
    return null;
  }
  try {
    const wert: unknown = JSON.parse(zeile.wert);
    return typeof wert === 'string' ? wert : null;
  } catch {
    return null;
  }
}

export function ladeTitel(): string | null {
  const schluessel = ladeTitelSchluessel();
  if (schluessel === null || !ladeErreichte().has(schluessel)) {
    return null;
  }
  return erfolgName(schluessel);
}

export function ladeErfolge(): Erfolge {
  const kennzahlen = ladeKennzahlen();
  const erreicht = ladeErreichte();
  return {
    kategorien: ERFOLGE.map((erfolg) => ({
      kennzahl: erfolg.kennzahl,
      label: erfolg.label,
      wert: kennzahlen[erfolg.kennzahl],
      stufen: erfolg.stufen.map((stufe) => {
        const schluessel = erfolgSchluessel(erfolg.kennzahl, stufe.schwelle);
        return { schluessel, name: stufe.name, schwelle: stufe.schwelle, erreichtAm: erreicht.get(schluessel) ?? null };
      }),
    })),
    titel: ladeTitelSchluessel(),
  };
}

export function setzeTitel(schluessel: string | null): Erfolge {
  if (schluessel !== null && !ladeErreichte().has(schluessel)) {
    throw ungueltig('Diesen Titel hast du noch nicht freigeschaltet.');
  }
  ausfuehren(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    TITEL_EINSTELLUNG,
    JSON.stringify(schluessel),
  );
  return ladeErfolge();
}
