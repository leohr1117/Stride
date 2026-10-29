/** Vergleich und Anzeige des Update-Hinweises. Eine Snackbar, unabhängig von der Anzahl verpasster Versionen. */

export interface Versionsstand {
  benachrichtigt: string | null;
  gesehen: string | null;
}

export interface HinweisEntscheid {
  snackbar: boolean;
  badge: boolean;
  /** Felder, die sofort auf die aktuelle Version gesetzt werden. Null heißt: nichts schreiben. */
  schreiben: { benachrichtigt: string; gesehen?: string } | { gesehen: string; benachrichtigt?: string } | null;
}

const NUMMER = /^\d+\.\d+\.\d+$/;

export function istVersionsnummer(text: string): boolean {
  return NUMMER.test(text);
}

export function versionKleiner(links: string, rechts: string): boolean {
  if (!istVersionsnummer(links) || !istVersionsnummer(rechts)) {
    return false;
  }
  const a = links.split('.').map(Number);
  const b = rechts.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const linksTeil = a[index] ?? 0;
    const rechtsTeil = b[index] ?? 0;
    if (linksTeil !== rechtsTeil) {
      return linksTeil < rechtsTeil;
    }
  }
  return false;
}

/** Die höhere Nummer gewinnt. Null verliert gegen jede Nummer. */
export function hoehereVersion(links: string | null, rechts: string | null): string | null {
  if (!links || !istVersionsnummer(links)) {
    return rechts && istVersionsnummer(rechts) ? rechts : null;
  }
  if (!rechts || !istVersionsnummer(rechts)) {
    return links;
  }
  return versionKleiner(links, rechts) ? rechts : links;
}

/** Versionen strikt nach `gesehen`, neueste zuerst. Null heißt: noch nie geöffnet, also alle. */
export function neuereVersionen<T extends { version: string }>(liste: readonly T[], gesehen: string | null): T[] {
  return liste.filter((eintrag) => gesehen === null || !istVersionsnummer(gesehen) || versionKleiner(gesehen, eintrag.version));
}

/**
 * Frisches Profil: keine Snackbar, beide Werte werden die aktuelle Version.
 * Sonst genau eine Snackbar, wenn die benachrichtigte Version fehlt oder älter ist.
 * Der Punkt bleibt, bis die gesehene Version die aktuelle ist.
 */
export function entscheideUpdateHinweis(stand: Versionsstand, aktuell: string, frisch: boolean): HinweisEntscheid {
  const benachrichtigt = stand.benachrichtigt && istVersionsnummer(stand.benachrichtigt) ? stand.benachrichtigt : null;
  const gesehen = stand.gesehen && istVersionsnummer(stand.gesehen) ? stand.gesehen : null;
  if (frisch) {
    const fertig = benachrichtigt === aktuell && gesehen === aktuell;
    return {
      snackbar: false,
      badge: false,
      schreiben: fertig ? null : { benachrichtigt: aktuell, gesehen: aktuell },
    };
  }
  const snackbar = benachrichtigt === null || versionKleiner(benachrichtigt, aktuell);
  const badge = gesehen === null || versionKleiner(gesehen, aktuell);
  return {
    snackbar,
    badge,
    schreiben: snackbar ? { benachrichtigt: aktuell } : null,
  };
}
