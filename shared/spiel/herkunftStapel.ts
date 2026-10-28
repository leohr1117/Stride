import {
  gleicheAdresse,
  herkunftsLabel,
  istUmlenkung,
  pfadname,
  schiebeHerkunft,
  type NavStapel,
} from './herkunft.ts';

export function leererStapel(platz: string, adresse: string): NavStapel {
  return { aktiv: platz, orte: { [platz]: [adresse] } };
}

export function stapelAus(roh: unknown): NavStapel | null {
  if (typeof roh !== 'object' || roh === null) {
    return null;
  }
  const daten = roh as { aktiv?: unknown; orte?: unknown };
  if (typeof daten.aktiv !== 'string' || typeof daten.orte !== 'object' || daten.orte === null) {
    return null;
  }
  const orte: Record<string, string[]> = {};
  for (const [platz, liste] of Object.entries(daten.orte)) {
    if (!Array.isArray(liste) || liste.some((eintrag) => typeof eintrag !== 'string')) {
      continue;
    }
    orte[platz] = liste;
  }
  if (orte[daten.aktiv] === undefined) {
    return null;
  }
  return { aktiv: daten.aktiv, orte };
}

function letzterIndex(stapel: readonly string[], adresse: string): number {
  for (let index = stapel.length - 1; index >= 0; index -= 1) {
    const eintrag = stapel[index];
    if (eintrag !== undefined && (gleicheAdresse(eintrag, adresse) || pfadname(eintrag) === pfadname(adresse))) {
      return index;
    }
  }
  return -1;
}

function oberste(nav: NavStapel): string | null {
  return nav.orte[nav.aktiv]?.at(-1) ?? null;
}

export function stapelPasst(nav: NavStapel, adresse: string): boolean {
  const oben = oberste(nav);
  return oben !== null && (gleicheAdresse(oben, adresse) || pfadname(oben) === pfadname(adresse));
}

/** Direktaufruf oder Refresh: passender Stapel bleibt, sonst nur dieser Platz neu. */
export function stapelNachLaden(alt: NavStapel | null, adresse: string, platz: string): NavStapel {
  if (alt && stapelPasst(alt, adresse)) {
    return alt;
  }
  if (alt) {
    for (const [ort, liste] of Object.entries(alt.orte)) {
      const oben = liste.at(-1);
      if (oben && (gleicheAdresse(oben, adresse) || pfadname(oben) === pfadname(adresse))) {
        return { aktiv: ort, orte: alt.orte };
      }
    }
  }
  const orte = { ...(alt?.orte ?? {}) };
  orte[platz] = [adresse];
  return { aktiv: platz, orte };
}

export function oeffneImStapel(nav: NavStapel, adresse: string): NavStapel {
  if (istUmlenkung(adresse) || herkunftsLabel(adresse) === null) {
    return nav;
  }
  const bisher = nav.orte[nav.aktiv] ?? [];
  const oben = bisher.at(-1);
  if (oben && gleicheAdresse(oben, adresse)) {
    if (oben === adresse) {
      return nav;
    }
    const ersetzt = [...bisher];
    ersetzt[ersetzt.length - 1] = adresse;
    return { ...nav, orte: { ...nav.orte, [nav.aktiv]: ersetzt } };
  }
  const neu = schiebeHerkunft(bisher, adresse);
  if (neu === bisher) {
    return nav;
  }
  return { ...nav, orte: { ...nav.orte, [nav.aktiv]: [...neu] } };
}

export function ersetzeOben(nav: NavStapel, adresse: string): NavStapel {
  if (istUmlenkung(adresse) || herkunftsLabel(adresse) === null) {
    return nav;
  }
  const bisher = nav.orte[nav.aktiv] ?? [];
  if (bisher.length === 0) {
    return oeffneImStapel(nav, adresse);
  }
  const neu = [...bisher];
  neu[neu.length - 1] = adresse;
  return { ...nav, orte: { ...nav.orte, [nav.aktiv]: neu } };
}

export function wechslePlatz(nav: NavStapel, platz: string): { nav: NavStapel; adresse: string } {
  const bestehend = nav.orte[platz];
  const adresse = bestehend && bestehend.length > 0 ? (bestehend.at(-1) ?? platz) : platz;
  const orte = { ...nav.orte, [platz]: bestehend && bestehend.length > 0 ? [...bestehend] : [adresse] };
  return { nav: { aktiv: platz, orte }, adresse };
}

/** Tipp auf den aktiven Platz: die Platzseite, nicht eine Unterseite. */
export function anfangDesPlatzes(nav: NavStapel): { nav: NavStapel; adresse: string } {
  const platz = nav.aktiv;
  const wurzel = nav.orte[platz]?.[0] ?? platz;
  const adresse = pfadname(wurzel) === pfadname(platz) ? wurzel : platz;
  return { nav: { ...nav, orte: { ...nav.orte, [platz]: [adresse] } }, adresse };
}

export function beiPop(nav: NavStapel, adresse: string, platz: string): NavStapel {
  const stapel = nav.orte[nav.aktiv] ?? [];
  const index = letzterIndex(stapel, adresse);
  if (index >= 0) {
    return { ...nav, orte: { ...nav.orte, [nav.aktiv]: stapel.slice(0, index + 1) } };
  }
  for (const [ort, liste] of Object.entries(nav.orte)) {
    const bei = letzterIndex(liste, adresse);
    if (bei >= 0) {
      return { aktiv: ort, orte: { ...nav.orte, [ort]: liste.slice(0, bei + 1) } };
    }
  }
  return { ...nav, aktiv: platz, orte: { ...nav.orte, [platz]: [adresse] } };
}
