import fs from 'node:fs';
import type { Page } from '@playwright/test';

export const BREITE = 390;
export const HOEHE = 844;
const SCHNITT = 1;
export const BERICHT_ORDNER = 'tmp-test/dichte';

export interface Fund {
  art: string;
  text: string;
  n: number;
}

export interface OrtBericht {
  ort: string;
  funde: Fund[];
}

export interface PlusLage {
  pfad: string;
  amEnde: boolean;
  fab: boolean;
  fabSoll: boolean;
  ueberX: number;
  ueberY: number;
  hatKreis: boolean;
  hatMenue: boolean;
  zeile: boolean;
  text: string;
}

export interface DichteBericht {
  fenster: { breite: number; hoehe: number };
  seiten: OrtBericht[];
  blaetter: OrtBericht[];
  plus: PlusLage[];
  fehler: string[];
}

type Kasten = { links: number; oben: number; rechts: number; unten: number };

/** Misst Zeilen, Chips, Knöpfe, Abschnitte und Einzelkarten in der offenen Fläche. */
export function missDichte(): Fund[] {
  const TOLERANZ = 1;
  const gruppen = new Map<string, Fund>();
  const merke = (art: string, text: string) => {
    const schluessel = `${art}\0${text}`;
    const alt = gruppen.get(schluessel);
    if (alt) alt.n += 1;
    else gruppen.set(schluessel, { art, text, n: 1 });
  };
  const sichtbar = (element: Element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    const stil = getComputedStyle(element);
    if (stil.display === 'none' || stil.visibility === 'hidden') return false;
    const kasten = element.getBoundingClientRect();
    return kasten.width > 1 && kasten.height > 1;
  };
  const nah = (wert: number, ziel: number) => Math.abs(wert - ziel) <= TOLERANZ;
  const nameVon = (element: HTMLElement) => {
    const titel =
      element.querySelector('.zeile-titel, h2, [data-zeile-titel]')?.textContent?.trim() ??
      element.getAttribute('aria-label') ??
      element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40);
    return titel && titel.length > 0 ? titel : element.tagName.toLowerCase();
  };

  const dialoge = document.querySelectorAll('[role="alertdialog"], [role="dialog"]');
  const dialog = dialoge[dialoge.length - 1];
  const haupt = document.querySelector('main');
  const wurzel = dialog instanceof HTMLElement ? dialog : haupt instanceof HTMLElement ? haupt : document.body;

  for (const zeile of wurzel.querySelectorAll('.zeile')) {
    if (!sichtbar(zeile)) continue;
    const hoehe = zeile.getBoundingClientRect().height;
    const zeilen = zeile.getAttribute('data-zeilen');
    const name = nameVon(zeile);
    if (zeile.classList.contains('organisation-kopf')) {
      if (!nah(hoehe, 40)) merke('zeile', `Organisation ${Math.round(hoehe)} px, Soll 40 (${name})`);
    } else if (zeilen === '2') {
      if (!nah(hoehe, 64)) merke('zeile', `${Math.round(hoehe)} px, Soll 64 (${name})`);
    } else if (zeilen === '1') {
      if (!nah(hoehe, 48)) merke('zeile', `${Math.round(hoehe)} px, Soll 48 (${name})`);
    } else if (!nah(hoehe, 48) && !nah(hoehe, 64)) {
      merke('zeile', `${Math.round(hoehe)} px, Soll 48 oder 64 (${name})`);
    }
  }

  for (const flaeche of wurzel.querySelectorAll('.chip-flaeche')) {
    if (!sichtbar(flaeche)) continue;
    const hoehe = flaeche.getBoundingClientRect().height;
    if (!nah(hoehe, 36)) merke('chip', `Fläche ${Math.round(hoehe)} px, Soll 36 (${nameVon(flaeche)})`);
  }
  for (const chip of wurzel.querySelectorAll('.chip')) {
    if (!sichtbar(chip)) continue;
    const hoehe = chip.getBoundingClientRect().height;
    if (!nah(hoehe, 48)) merke('chip', `Treffer ${Math.round(hoehe)} px, Soll 48 (${nameVon(chip)})`);
  }

  for (const knopf of wurzel.querySelectorAll('button.knopf')) {
    if (!sichtbar(knopf) || knopf.classList.contains('eintrag-fab') || knopf.classList.contains('knopf-rund')) continue;
    const hoehe = knopf.getBoundingClientRect().height;
    if (!nah(hoehe, 48)) merke('knopf', `${Math.round(hoehe)} px, Soll 48 (${nameVon(knopf)})`);
  }

  for (const kopf of [...wurzel.querySelectorAll('.abschnitt-kopf')].filter(sichtbar)) {
    const stil = getComputedStyle(kopf);
    const name = kopf.querySelector('h2')?.textContent?.trim() ?? nameVon(kopf);
    const kasten = kopf.getBoundingClientRect();
    if (stil.marginTop !== '24px') merke('abschnitt', `${name}: oben ${stil.marginTop}, Soll 24px`);
    if (stil.marginBottom !== '8px') merke('abschnitt', `${name}: unten ${stil.marginBottom}, Soll 8px`);
    if (!nah(kasten.height, 18)) merke('abschnitt', `${name}: Zeilenbox ${Math.round(kasten.height)} px, Soll 18`);
    const leerOben = Number.parseFloat(stil.marginTop);
    if (!Number.isNaN(leerOben) && leerOben > 24 + TOLERANZ) {
      merke('abschnitt', `${name}: ${Math.round(leerOben)} px Leerraum oben, höchstens 24`);
    }
    const flaeche = kopf.closest('section')?.querySelector('[data-flaeche]');
    if (flaeche instanceof HTMLElement && sichtbar(flaeche)) {
      const abstand = Math.round(flaeche.getBoundingClientRect().top - kasten.bottom);
      if (abstand !== 8) merke('abschnitt', `${name}: ${abstand} px bis zur Fläche, Soll 8`);
    }
  }

  const abschnitte = [...wurzel.querySelectorAll('section')].filter(
    (teil) => teil.querySelector('.abschnitt-kopf') && sichtbar(teil),
  );
  for (let index = 1; index < abschnitte.length; index += 1) {
    const vorher = abschnitte[index - 1];
    const aktuell = abschnitte[index];
    if (!vorher || !aktuell || aktuell.previousElementSibling !== vorher) continue;
    const flaeche = [...vorher.querySelectorAll('[data-flaeche]')].at(-1);
    const kopf = aktuell.querySelector('.abschnitt-kopf');
    if (!(flaeche instanceof HTMLElement) || !(kopf instanceof HTMLElement)) continue;
    const kopfKasten = kopf.getBoundingClientRect();
    const flaecheKasten = flaeche.getBoundingClientRect();
    if (kopfKasten.top < flaecheKasten.top) continue;
    const abstand = Math.round(kopfKasten.top - flaecheKasten.bottom);
    const name = kopf.querySelector('h2')?.textContent?.trim() ?? '?';
    if (abstand !== 24) merke('abstand', `${name}: ${abstand} px nach der vorigen Fläche, Soll 24`);
  }

  const flaechen = [...wurzel.querySelectorAll('[data-flaeche]')].filter(sichtbar);
  const luecken: number[] = [];
  for (let index = 1; index < flaechen.length; index += 1) {
    const vorher = flaechen[index - 1];
    const aktuell = flaechen[index];
    if (!vorher || !aktuell || vorher.contains(aktuell) || aktuell.contains(vorher)) continue;
    const a = vorher.getBoundingClientRect();
    const b = aktuell.getBoundingClientRect();
    if (b.top < a.bottom - 1) continue;
    luecken.push(Math.round(b.top - a.bottom));
  }
  if (luecken.length > 1) {
    const erst = luecken[0] ?? 0;
    if (luecken.some((wert) => Math.abs(wert - erst) > 1)) {
      merke('abstand', `Fläche zu Fläche ${[...new Set(luecken)].join(', ')} px, Soll überall gleich`);
    }
  }

  for (const karte of wurzel.querySelectorAll('.karte')) {
    if (!sichtbar(karte)) continue;
    const stil = getComputedStyle(karte);
    const oben = Math.round(Number.parseFloat(stil.paddingTop));
    const unten = Math.round(Number.parseFloat(stil.paddingBottom));
    const links = Math.round(Number.parseFloat(stil.paddingLeft));
    const rechts = Math.round(Number.parseFloat(stil.paddingRight));
    if (!nah(oben, 12) || !nah(unten, 12) || !nah(links, 16) || !nah(rechts, 16)) {
      merke('karte', `Innen ${oben}/${rechts}/${unten}/${links} px, Soll 12×16 (${nameVon(karte)})`);
    }
    if ([...karte.querySelectorAll('.zeile')].filter(sichtbar).length === 1) merke('einzelkarte', nameVon(karte));
  }

  if (document.documentElement.getAttribute('data-fab') === 'an') {
    const hauptEl = document.querySelector('main');
    if (hauptEl instanceof HTMLElement) {
      const padding = Number.parseFloat(getComputedStyle(hauptEl).paddingBottom);
      if (!Number.isNaN(padding) && padding < 88 - TOLERANZ) {
        merke('unten', `padding-bottom ${Math.round(padding)} px, Soll mindestens 88`);
      }
    }
  }

  return [...gruppen.values()];
}

/** Misst, ob der Plus-Knopf die letzte Zeile am Seitenende schneidet. */
export async function missPlus(seite: Page): Promise<{
  amEnde: boolean;
  fab: boolean;
  zeile: Kasten | null;
  knopf: Kasten | null;
  ueberX: number;
  ueberY: number;
  hatKreis: boolean;
  hatMenue: boolean;
}> {
  return seite.evaluate(async () => {
    const offen = [...document.images].filter((bild) => !bild.complete);
    await Promise.race([
      Promise.all(
        offen.map(
          (bild) =>
            new Promise<void>((fertig) => {
              bild.addEventListener('load', () => fertig(), { once: true });
              bild.addEventListener('error', () => fertig(), { once: true });
            }),
        ),
      ),
      new Promise<void>((fertig) => {
        setTimeout(fertig, 400);
      }),
    ]);
    const scroller = document.scrollingElement ?? document.documentElement;
    const nachUnten = () => {
      scroller.scrollTop = scroller.scrollHeight;
      window.scrollTo(0, scroller.scrollHeight);
    };
    nachUnten();
    await new Promise<void>((fertig) => {
      requestAnimationFrame(() => fertig());
    });
    nachUnten();
    const kastenVon = (element: Element) => {
      const kasten = element.getBoundingClientRect();
      return { links: kasten.left, oben: kasten.top, rechts: kasten.right, unten: kasten.bottom };
    };
    const sichtbar = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      const stil = getComputedStyle(element);
      if (stil.display === 'none' || stil.visibility === 'hidden') return false;
      const kasten = element.getBoundingClientRect();
      return kasten.width > 1 && kasten.height > 1;
    };
    const vereine = (bisher: Kasten, dazu: Kasten) => ({
      links: Math.min(bisher.links, dazu.links),
      oben: Math.min(bisher.oben, dazu.oben),
      rechts: Math.max(bisher.rechts, dazu.rechts),
      unten: Math.max(bisher.unten, dazu.unten),
    });
    let letzte: HTMLElement | null = null;
    let boden = Number.NEGATIVE_INFINITY;
    for (const element of document.querySelectorAll('main .zeile, main [data-schnell]')) {
      if (!sichtbar(element) || !(element instanceof HTMLElement)) continue;
      const unten = element.getBoundingClientRect().bottom;
      if (unten > boden + 0.5) {
        boden = unten;
        letzte = element;
      }
    }
    const knopfElement = document.querySelector('.eintrag-fab');
    const fabSichtbar =
      knopfElement instanceof HTMLElement && getComputedStyle(knopfElement).display !== 'none' && sichtbar(knopfElement);
    const knopf = fabSichtbar && knopfElement instanceof HTMLElement ? kastenVon(knopfElement) : null;
    let zeile: Kasten | null = null;
    let hatKreis = false;
    let hatMenue = false;
    if (letzte) {
      zeile = kastenVon(letzte);
      for (const element of letzte.querySelectorAll('[role="checkbox"], [data-schnell-menue], .zeile-menue button')) {
        if (!sichtbar(element)) continue;
        if (element.getAttribute('role') === 'checkbox') hatKreis = true;
        if (element.hasAttribute('data-schnell-menue') || element.closest('.zeile-menue')) hatMenue = true;
        zeile = vereine(zeile, kastenVon(element));
      }
    }
    const ueber = (anfangA: number, endeA: number, anfangB: number, endeB: number) =>
      Math.min(endeA, endeB) - Math.max(anfangA, anfangB);
    return {
      amEnde: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
      fab: fabSichtbar,
      zeile,
      knopf,
      ueberX: zeile && knopf ? ueber(zeile.links, zeile.rechts, knopf.links, knopf.rechts) : 0,
      ueberY: zeile && knopf ? ueber(zeile.oben, zeile.unten, knopf.oben, knopf.unten) : 0,
      hatKreis,
      hatMenue,
    };
  });
}

export function plusWeichtAb(lage: PlusLage): boolean {
  if (!lage.amEnde || lage.fab !== lage.fabSoll) return true;
  return lage.fab && lage.ueberX > SCHNITT && lage.ueberY > SCHNITT;
}

export function plusText(pfad: string, lage: PlusLage): string {
  if (!lage.zeile) return `${pfad}: keine Zeile`;
  const teile = [
    pfad,
    `Überlappung ${lage.ueberX.toFixed(1)} mal ${lage.ueberY.toFixed(1)}`,
    lage.hatKreis ? 'mit Abhakkreis' : 'ohne Abhakkreis',
    lage.hatMenue ? 'mit Menü' : 'ohne Menü',
  ];
  if (!lage.amEnde) teile.push('nicht am Seitenende');
  if (lage.fab !== lage.fabSoll) teile.push(lage.fabSoll ? 'Plus-Knopf fehlt' : 'Plus-Knopf unerwartet');
  if (lage.fab && lage.ueberX > SCHNITT && lage.ueberY > SCHNITT) teile.push('schneidet die letzte Zeile');
  return teile.join(', ');
}

export function formatBericht(bericht: DichteBericht): string {
  const zeilen = [
    `Fenster ${bericht.fenster.breite} mal ${bericht.fenster.hoehe}`,
    `Seiten ${bericht.seiten.length}, Blätter ${bericht.blaetter.length}`,
    '',
  ];
  const block = (titel: string, orte: OrtBericht[]) => {
    zeilen.push(`## ${titel}`);
    let leer = true;
    for (const ort of orte) {
      if (ort.funde.length === 0) continue;
      leer = false;
      zeilen.push(`### ${ort.ort}`);
      for (const fund of ort.funde) {
        zeilen.push(`- ${fund.art}: ${fund.text}${fund.n > 1 ? ` (${fund.n} mal)` : ''}`);
      }
    }
    zeilen.push(leer ? '- keine Abweichung' : '', '');
  };
  block('Seiten', bericht.seiten);
  block('Blätter', bericht.blaetter);
  zeilen.push('## Plus-Knopf');
  const plusFunde = bericht.plus.filter(plusWeichtAb);
  if (plusFunde.length === 0) zeilen.push('- keine Abweichung');
  else for (const lage of plusFunde) zeilen.push(`- ${lage.text}`);
  zeilen.push('');
  if (bericht.fehler.length > 0) {
    zeilen.push('## Fehler');
    for (const text of bericht.fehler) zeilen.push(`- ${text}`);
    zeilen.push('');
  }
  return zeilen.join('\n');
}

export function schreibeBericht(bericht: DichteBericht, name = 'bericht'): void {
  fs.mkdirSync(BERICHT_ORDNER, { recursive: true });
  fs.writeFileSync(`${BERICHT_ORDNER}/${name}.json`, `${JSON.stringify(bericht, null, 2)}\n`);
  fs.writeFileSync(`${BERICHT_ORDNER}/${name}.txt`, formatBericht(bericht));
}
