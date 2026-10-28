import type { HinweisStand } from '../../../shared/api/hinweise.ts';
import { UHRZEIT_FORMAT, UHRZEIT_MUSTER } from '../../../shared/spiel/aufgabe.ts';
import { HINWEIS_SCHLUESSEL } from '../../../shared/spiel/hinweis.ts';
import { oeffentlicherVapidSchluessel } from '../../config.ts';
import { ausfuehren, eine, inTransaktion } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import {
  leseHinweisRuhe,
  leseHinweisSchalter,
  schreibeHinweisAngebotGesehen,
  schreibeHinweisRuhe,
  schreibeHinweisSchalter,
} from '../einstellungen/hinweisSchluessel.ts';

const RUHE_VON = '22:00';
const RUHE_BIS = '08:00';
const SCHALTER = [HINWEIS_SCHLUESSEL.streak, HINWEIS_SCHLUESSEL.rueckkehr, HINWEIS_SCHLUESSEL.boss] as const;

export interface HinweisAboDaten {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface HinweisAenderung {
  ruheVon?: string;
  ruheBis?: string;
  streak?: boolean;
  rueckkehr?: boolean;
  boss?: boolean;
}

function tabelleDa(): boolean {
  return eine<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, 'push_abos') !== undefined;
}

function schluesselDa(name: string): boolean {
  return eine<{ schluessel: string }>('SELECT schluessel FROM einstellungen WHERE schluessel = ?', name) !== undefined;
}

function zaehleGeraete(): number {
  if (!tabelleDa()) {
    return 0;
  }
  return eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM push_abos WHERE ungueltig_am IS NULL')?.anzahl ?? 0;
}

/** Öffentlicher Schlüssel nur über oeffentlicherVapidSchluessel. Der private Wert hat hier kein Feld. */
export function ladeHinweisStand(): HinweisStand {
  const ruhe = leseHinweisRuhe();
  const schalter = leseHinweisSchalter();
  const geraete = zaehleGeraete();
  return {
    oeffentlicherSchluessel: oeffentlicherVapidSchluessel(),
    angemeldet: geraete > 0,
    geraete,
    ruheVon: ruhe.von,
    ruheBis: ruhe.bis,
    streak: schalter.streak,
    rueckkehr: schalter.rueckkehr,
    boss: schalter.boss,
    angebot: false,
  };
}

function vorschlagBeiErsterAnmeldung(): void {
  if (SCHALTER.every((name) => !schluesselDa(name))) {
    schreibeHinweisSchalter({ streak: false, rueckkehr: false, boss: false });
  }
  if (!schluesselDa(HINWEIS_SCHLUESSEL.ruheVon) && !schluesselDa(HINWEIS_SCHLUESSEL.ruheBis)) {
    schreibeHinweisRuhe(RUHE_VON, RUHE_BIS);
  }
}

export function speichereHinweisAbo(daten: HinweisAboDaten): HinweisStand {
  inTransaktion(() => {
    ausfuehren(
      `INSERT INTO push_abos (endpoint, p256dh, auth, ungueltig_am) VALUES (?, ?, ?, NULL)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, ungueltig_am = NULL`,
      daten.endpoint,
      daten.p256dh,
      daten.auth,
    );
    vorschlagBeiErsterAnmeldung();
  });
  return ladeHinweisStand();
}

export function entferneHinweisAbo(endpoint: string): HinweisStand {
  if (tabelleDa()) {
    ausfuehren(
      `UPDATE push_abos SET ungueltig_am = ? WHERE endpoint = ? AND ungueltig_am IS NULL`,
      new Date().toISOString(),
      endpoint,
    );
  }
  return ladeHinweisStand();
}

export function aendereHinweisWahl(teil: HinweisAenderung): HinweisStand {
  if (zaehleGeraete() === 0) {
    throw new AppFehler(400, 'Zuerst einschalten.');
  }
  if (teil.ruheVon !== undefined || teil.ruheBis !== undefined) {
    const bisher = leseHinweisRuhe();
    const von = teil.ruheVon ?? bisher.von;
    const bis = teil.ruheBis ?? bisher.bis;
    if (!UHRZEIT_MUSTER.test(von) || !UHRZEIT_MUSTER.test(bis)) {
      throw new AppFehler(400, UHRZEIT_FORMAT);
    }
    schreibeHinweisRuhe(von, bis);
  }
  schreibeHinweisSchalter({
    streak: teil.streak,
    rueckkehr: teil.rueckkehr,
    boss: teil.boss,
  });
  return ladeHinweisStand();
}

export function merkeHinweisAngebot(): { gesehen: true } {
  schreibeHinweisAngebotGesehen();
  return { gesehen: true };
}
