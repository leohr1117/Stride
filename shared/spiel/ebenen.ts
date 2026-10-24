import type { Zielstrebigkeit } from './profil.ts';

export const EBENEN = ['visionen', 'organisationen', 'projekte', 'vorhaben'] as const;
export type Ebene = (typeof EBENEN)[number];
export type Ebenen = Record<Ebene, boolean>;
export type EbenenZahlen = Record<Ebene, number>;

export interface ZielMarkeInfo {
  name: string;
  mehrzahl: string;
  kuerzel: string;
  leer: string;
}

export const ZIEL_MARKE: Record<Ebene, ZielMarkeInfo> = {
  visionen: { name: 'Vision', mehrzahl: 'Visionen', kuerzel: 'großes Ziel', leer: 'Noch keine Vision.' },
  projekte: { name: 'Projekt', mehrzahl: 'Projekte', kuerzel: 'mittleres Ziel', leer: 'Noch kein Projekt.' },
  vorhaben: { name: 'Vorhaben', mehrzahl: 'Vorhaben', kuerzel: 'kleines Ziel', leer: 'Noch kein Vorhaben.' },
  organisationen: { name: 'Organisation', mehrzahl: 'Organisationen', kuerzel: 'wo / für wen', leer: 'Noch keine Organisation.' },
};

export function zielTitel(ebene: Ebene, mehrzahl = true): string {
  const marke = ZIEL_MARKE[ebene];
  return mehrzahl ? marke.mehrzahl : marke.name;
}

export function passendeZielEbene(ebenen: Ebenen): 'visionen' | 'projekte' | 'vorhaben' | null {
  if (ebenen.visionen) {
    return 'visionen';
  }
  if (ebenen.projekte) {
    return 'projekte';
  }
  if (ebenen.vorhaben) {
    return 'vorhaben';
  }
  return null;
}

export function zieleAktiv(ebenen: Ebenen): boolean {
  return ebenen.visionen || ebenen.projekte || ebenen.vorhaben;
}

export function standardEbenen(): Ebenen {
  return { visionen: true, organisationen: true, projekte: true, vorhaben: true };
}

export function leereEbenenZahlen(): EbenenZahlen {
  return { visionen: 0, organisationen: 0, projekte: 0, vorhaben: 0 };
}

export function ebenenFuerStufe(stufe: Zielstrebigkeit): Ebenen {
  switch (stufe) {
    case 'traeumer':
      return { visionen: true, organisationen: false, projekte: true, vorhaben: true };
    case 'macher':
      return { visionen: false, organisationen: false, projekte: true, vorhaben: true };
    case 'bodenstaendig':
      return { visionen: false, organisationen: false, projekte: true, vorhaben: true };
    case 'uebung':
    case 'einfach':
      return { visionen: false, organisationen: false, projekte: false, vorhaben: false };
  }
}

export function normalisiereEbenen(wert: Partial<Ebenen>): Ebenen {
  const ergebnis = standardEbenen();
  for (const ebene of EBENEN) {
    const eintrag = wert[ebene];
    if (typeof eintrag === 'boolean') {
      ergebnis[ebene] = eintrag;
    }
  }
  if (ergebnis.vorhaben) {
    ergebnis.projekte = true;
  }
  if (!ergebnis.projekte) {
    ergebnis.organisationen = false;
    ergebnis.vorhaben = false;
  }
  return ergebnis;
}

export function wendeEbenenAn(bisher: Ebenen, aenderung: Partial<Ebenen>): Ebenen {
  const nachher: Ebenen = { ...bisher };
  for (const ebene of EBENEN) {
    const eintrag = aenderung[ebene];
    if (typeof eintrag === 'boolean') {
      nachher[ebene] = eintrag;
    }
  }
  if (aenderung.projekte === false) {
    nachher.vorhaben = false;
    nachher.organisationen = false;
  }
  return normalisiereEbenen(nachher);
}

export function leseEbenen(wert: unknown): Ebenen {
  if (wert === null || typeof wert !== 'object' || Array.isArray(wert)) {
    return standardEbenen();
  }
  const roh = wert as Record<string, unknown>;
  const teilweise: Partial<Ebenen> = {};
  let gesehen = false;
  for (const ebene of EBENEN) {
    if (typeof roh[ebene] === 'boolean') {
      teilweise[ebene] = roh[ebene];
      gesehen = true;
    }
  }
  if (!gesehen) {
    return standardEbenen();
  }
  return normalisiereEbenen({ ...standardEbenen(), ...teilweise });
}

export function setzeEbene(aktuell: Ebenen, ebene: Ebene, an: boolean): Ebenen {
  return wendeEbenenAn(aktuell, { [ebene]: an });
}

export function sperrtext(ebene: Ebene): string {
  return `${ZIEL_MARKE[ebene].mehrzahl} sind ausgeschaltet.`;
}

export function hinweisAusblenden(vorher: Ebenen, nachher: Ebenen, zahlen: EbenenZahlen): string | null {
  const teile: { text: string; einzeln: boolean }[] = [];
  for (const ebene of EBENEN) {
    if (vorher[ebene] && !nachher[ebene] && zahlen[ebene] > 0) {
      const anzahl = zahlen[ebene];
      const marke = ZIEL_MARKE[ebene];
      const name = anzahl === 1 ? marke.name : marke.mehrzahl;
      teile.push({ text: `${anzahl} ${name}`, einzeln: anzahl === 1 });
    }
  }
  if (teile.length === 0) {
    return null;
  }
  const liste =
    teile.length === 1
      ? teile[0].text
      : `${teile
          .slice(0, -1)
          .map((teil) => teil.text)
          .join(', ')} und ${teile[teile.length - 1].text}`;
  const verb = teile.length === 1 && teile[0].einzeln ? 'wird' : 'werden';
  return `${liste} ${verb} ausgeblendet. Einschalten bringt sie zurück.`;
}

export function fehlendeZuordnung(angaben: {
  ebene: 'projekt' | 'vorhaben';
  ebenen: Ebenen;
  visionId?: number | null;
  organisationId?: number | null;
  projektId?: number | null;
}): string | null {
  if (angaben.ebene === 'projekt') {
    const vision = angaben.ebenen.visionen;
    const organisation = angaben.ebenen.organisationen;
    const leer = (angaben.visionId ?? null) === null && (angaben.organisationId ?? null) === null;
    if (!leer || (!vision && !organisation)) {
      return null;
    }
    if (vision && organisation) {
      return 'Nicht zugeordnet: zählt nicht für Vision oder Organisation.';
    }
    if (vision) {
      return 'Nicht zugeordnet: zählt nicht für die Vision.';
    }
    return 'Nicht zugeordnet: zählt nicht für die Organisation.';
  }

  const ohneProjekt = angaben.ebenen.projekte && (angaben.projektId ?? null) === null;
  return ohneProjekt ? 'Nicht zugeordnet: zählt nicht für das Projekt.' : null;
}

/** Grauer Tipp im neuen Eintrag, solange keine sichtbare Wahl getroffen ist. */
export function eintragTipp(angaben: {
  vorhabenSichtbar: boolean;
  faehigkeitSichtbar: boolean;
  vorhabenGewaehlt: boolean;
  faehigkeitGewaehlt: boolean;
}): string | null {
  const { vorhabenSichtbar, faehigkeitSichtbar, vorhabenGewaehlt, faehigkeitGewaehlt } = angaben;
  if (!vorhabenSichtbar && !faehigkeitSichtbar) {
    return null;
  }
  if ((vorhabenSichtbar && vorhabenGewaehlt) || (faehigkeitSichtbar && faehigkeitGewaehlt)) {
    return null;
  }
  if (vorhabenSichtbar && faehigkeitSichtbar) {
    return 'Tipp: Wähl ein Vorhaben oder eine Fähigkeit.';
  }
  if (vorhabenSichtbar) {
    return 'Tipp: Wähl ein Vorhaben.';
  }
  return 'Tipp: Wähl eine Fähigkeit.';
}
