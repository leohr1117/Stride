import fs from 'node:fs';

export const BERICHT_ORDNER = 'tmp-test/mitte';

export const PFLICHT_PAARE = [
  'Boss-Schwert ↔ Boss-Kreis',
  'Levelzahl+LEVEL ↔ Levelring',
  'Symbol ↔ Fähigkeits-Knoten',
  'Plus ↔ FAB',
  'Leistensymbol ↔ Beschriftung',
  'Menü ↔ Trefferfläche',
  'Pfeil ↔ Trefferfläche',
  'Schließen ↔ Trefferfläche',
  '(i) ↔ Trefferfläche',
  'Zeilensymbol ↔ Textblock',
  'Textkante',
  'Rechte Kante',
  'Kennzahl Wert ↔ Wort ↔ Spaltenmitte',
  'Abschnittsüberschrift ↔ Link',
  'Kopftitel ↔ Profilbild',
] as const;

export interface MitteZeile {
  paar: string;
  abweichung: string;
  ausreisser: boolean;
}

export interface TabellenZeile extends MitteZeile {
  seite: string;
}

interface Punkt {
  cx: number;
  cy: number;
}

/** Symbolmitte aus path, circle und line. Läuft im Browser, ohne äußere Bindung. */
export function missMitte(modus: string): MitteZeile[] {
  const grenze = 0.5;
  const zeilen: MitteZeile[] = [];
  const cache = new WeakMap<Element, boolean>();

  function verborgen(element: Element): boolean {
    const bekannt = cache.get(element);
    if (bekannt !== undefined) return bekannt;
    let weg = false;
    for (let aktuell: Element | null = element; aktuell && aktuell !== document.documentElement; aktuell = aktuell.parentElement) {
      const stil = getComputedStyle(aktuell);
      if (aktuell.hasAttribute('inert') || stil.display === 'none' || stil.visibility === 'hidden' || Number(stil.opacity) === 0) {
        weg = true;
        break;
      }
    }
    cache.set(element, weg);
    return weg;
  }

  function kastenVon(element: Element): DOMRect | null {
    if (verborgen(element)) return null;
    const kasten = element.getBoundingClientRect();
    return kasten.width < 0.5 && kasten.height < 0.5 ? null : kasten;
  }

  function mitteVon(kasten: DOMRect): Punkt {
    return { cx: kasten.left + kasten.width / 2, cy: kasten.top + kasten.height / 2 };
  }

  function flaechen(liste: Element[]): DOMRect[] {
    return liste
      .map((teil) => teil.getBoundingClientRect())
      .filter((kasten) => kasten.width > 0.05 || kasten.height > 0.05);
  }

  function tinte(wurzel: Element): Punkt | null {
    let kaesten = flaechen([...wurzel.querySelectorAll('path, circle, line')]);
    if (kaesten.length === 0) kaesten = flaechen([...wurzel.querySelectorAll('polyline, polygon')]);
    if (kaesten.length === 0) return null;
    const left = Math.min(...kaesten.map((kasten) => kasten.left));
    const right = Math.max(...kaesten.map((kasten) => kasten.right));
    const top = Math.min(...kaesten.map((kasten) => kasten.top));
    const bottom = Math.max(...kaesten.map((kasten) => kasten.bottom));
    return { cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }

  function inhalt(element: Element): Punkt | null {
    const bereich = document.createRange();
    bereich.selectNodeContents(element);
    const kasten = bereich.getBoundingClientRect();
    return kasten.width < 0.5 && kasten.height < 0.5 ? null : mitteVon(kasten);
  }

  function rund(wert: number): string {
    const gerundet = Math.round(wert * 100) / 100;
    const text = Math.abs(gerundet).toFixed(2);
    if (gerundet > 0) return `+${text}`;
    if (gerundet < 0) return `-${text}`;
    return '0.00';
  }

  function merke(name: string, abweichung: string, ausreisser: boolean, quelle: Element | null): void {
    const text = (quelle?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const zusatz = text.length <= 42 ? text : `${text.slice(0, 41)}...`;
    zeilen.push({ paar: zusatz ? `${name} · ${zusatz}` : name, abweichung, ausreisser });
  }

  function achse(name: string, werte: { x?: number; y?: number }, quelle: Element | null): void {
    const teile: string[] = [];
    let aus = false;
    for (const achseName of ['x', 'y'] as const) {
      const wert = werte[achseName];
      if (wert === undefined) continue;
      teile.push(`${achseName} ${rund(wert)}`);
      if (Math.abs(wert) > grenze) aus = true;
    }
    if (teile.length > 0) merke(name, teile.join(', '), aus, quelle);
  }

  function spanne(name: string, werte: number[], quelle: Element | null): void {
    if (werte.length < 2) return;
    const delta = Math.max(...werte) - Math.min(...werte);
    merke(name, `Spanne ${rund(delta)}`, delta > grenze, quelle);
  }

  const alleDialoge = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')];
  const dialog = alleDialoge.length > 0 ? (alleDialoge[alleDialoge.length - 1] ?? null) : null;
  const wurzel: ParentNode = modus === 'dialog' ? (dialog ?? document.body) : document.body;
  const drin = (element: Element) => (modus === 'dialog' ? Boolean(dialog?.contains(element)) : !dialog?.contains(element));
  const suche = (selektor: string) => [...wurzel.querySelectorAll(selektor)].filter((element) => drin(element) && kastenVon(element));

  function groessterKreis(element: Element): DOMRect | null {
    let beste: DOMRect | null = null;
    for (const kreis of element.querySelectorAll('circle')) {
      const kasten = kreis.getBoundingClientRect();
      if ((kasten.width >= 1 || kasten.height >= 1) && (!beste || kasten.width > beste.width)) beste = kasten;
    }
    return beste;
  }

  function grundlinie(element: Element): number | null {
    const wandler = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let knoten = wandler.nextNode();
    let text: Text | null = null;
    while (knoten) {
      if ((knoten.textContent ?? '').trim() && knoten.parentElement?.closest('svg') === null) {
        text = knoten as Text;
        break;
      }
      knoten = wandler.nextNode();
    }
    if (!text?.parentElement) return null;
    const bereich = document.createRange();
    bereich.selectNodeContents(text);
    const kasten = bereich.getClientRects()[0];
    if (!kasten || kasten.height < 0.5) return null;
    const stil = getComputedStyle(text.parentElement);
    const sand = document.createElement('span');
    sand.style.cssText = `position:fixed;left:0;top:-1000px;visibility:hidden;font:${stil.font};line-height:${stil.lineHeight};padding:0;margin:0;border:0;`;
    sand.textContent = 'Hg';
    const sonde = document.createElement('span');
    sonde.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0;border:0;';
    sand.appendChild(sonde);
    document.body.appendChild(sand);
    const versatz = sonde.getBoundingClientRect().top - sand.getBoundingClientRect().top;
    sand.remove();
    return Number.isFinite(versatz) ? kasten.top + versatz : null;
  }

  for (const ring of suche('.boss-ring')) {
    const schwert = ring.querySelector('.boss-ring-symbol svg');
    const kreis = groessterKreis(ring.querySelector('.boss-ring-bild') ?? ring);
    const ink = schwert ? tinte(schwert) : null;
    if (!kreis || !ink) continue;
    const ziel = mitteVon(kreis);
    achse('Boss-Schwert ↔ Boss-Kreis', { x: ink.cx - ziel.cx, y: ink.cy - ziel.cy }, ring.closest('[data-zeile], .symbol-zeile, li'));
  }

  for (const ring of suche('[data-levelring]')) {
    const kreis = groessterKreis(ring);
    const zahl = ring.querySelector('.zahl');
    const label = [...ring.querySelectorAll('span')].find((span) => span !== zahl && /level/i.test(span.textContent ?? ''));
    if (!kreis || !zahl || !label) continue;
    const text = [label, zahl].map((element) => kastenVon(element)).filter((kasten): kasten is DOMRect => kasten !== null);
    if (text.length === 0) continue;
    const left = Math.min(...text.map((kasten) => kasten.left));
    const right = Math.max(...text.map((kasten) => kasten.right));
    const top = Math.min(...text.map((kasten) => kasten.top));
    const bottom = Math.max(...text.map((kasten) => kasten.bottom));
    const ziel = mitteVon(kreis);
    achse('Levelzahl+LEVEL ↔ Levelring', { x: (left + right) / 2 - ziel.cx, y: (top + bottom) / 2 - ziel.cy }, ring);
  }

  for (const knoten of suche('.baum-wurzel, .baum-knoten')) {
    const bild = knoten.querySelector('svg');
    const kasten = kastenVon(knoten);
    const ink = bild ? tinte(bild) : null;
    if (!bild || !kasten || !ink) continue;
    const name = bild.classList.contains('lucide-check') ? 'Haken ↔ Fähigkeits-Knoten' : 'Symbol ↔ Fähigkeits-Knoten';
    const ziel = mitteVon(kasten);
    achse(name, { x: ink.cx - ziel.cx, y: ink.cy - ziel.cy }, knoten);
  }

  for (const kasten of suche('[data-abhak]')) {
    const bild = kasten.querySelector('svg');
    const rahmen = kastenVon(kasten);
    const ink = bild ? tinte(bild) : null;
    if (!rahmen || !ink) continue;
    const ziel = mitteVon(rahmen);
    achse('Haken ↔ Abhakkasten', { x: ink.cx - ziel.cx, y: ink.cy - ziel.cy }, kasten.closest('li, [data-zeile]'));
  }

  for (const fab of suche('.eintrag-fab')) {
    const rahmen = kastenVon(fab);
    const ink = tinte(fab);
    if (!rahmen || !ink) continue;
    achse('Plus ↔ FAB', { x: ink.cx - mitteVon(rahmen).cx }, fab);
  }

  for (const link of suche('.mobilleiste a')) {
    const bild = link.querySelector('svg');
    const label = [...link.querySelectorAll('span')].find((span) => !span.querySelector('svg') && (span.textContent ?? '').trim() !== '');
    const icon = bild ? tinte(bild) : null;
    const schrift = label ? kastenVon(label) : null;
    if (!icon || !schrift || mitteVon(schrift).cy <= icon.cy) continue;
    achse('Leistensymbol ↔ Beschriftung', { x: icon.cx - mitteVon(schrift).cx }, link);
  }

  for (const knopf of suche('button, a')) {
    if (knopf.classList.contains('eintrag-fab') || !knopf.querySelector('svg')) continue;
    const klon = knopf.cloneNode(true);
    if (!(klon instanceof Element)) continue;
    for (const bild of klon.querySelectorAll('svg')) bild.remove();
    if ((klon.textContent ?? '').replace(/\s+/g, '') !== '') continue;
    const rahmen = kastenVon(knopf);
    const ink = tinte(knopf);
    if (!rahmen || !ink) continue;
    const label = knopf.getAttribute('aria-label') ?? '';
    const name = label.startsWith('Aktionen für')
      ? 'Menü ↔ Trefferfläche'
      : label === 'Schließen'
        ? 'Schließen ↔ Trefferfläche'
        : label.startsWith('Info')
          ? '(i) ↔ Trefferfläche'
          : knopf.hasAttribute('data-zurueck') || label.startsWith('Zurück')
            ? 'Pfeil ↔ Trefferfläche'
            : '';
    if (!name) continue;
    const ziel = mitteVon(rahmen);
    achse(name, { x: ink.cx - ziel.cx, y: ink.cy - ziel.cy }, knopf);
  }

  function textblock(zeile: Element): Element | null {
    const direkt = zeile.querySelector('.zeilen-text');
    if (direkt && kastenVon(direkt)) return direkt;
    return [...zeile.querySelectorAll('.flex-1')].find((element) => kastenVon(element)) ?? null;
  }

  function symbolQuelle(zeile: Element): Element | null {
    const platz = zeile.querySelector('.symbol-platz, .boss-platz');
    if (platz && kastenVon(platz)) return platz;
    return (
      [...zeile.querySelectorAll('svg')].find((bild) => !bild.closest('button, a, [role="checkbox"], [data-schnell-menue], .zeile-pfeil') && kastenVon(bild)) ??
      null
    );
  }

  const zeilenElemente = suche('[data-zeile], .symbol-zeile');
  const kartenText = new Map<Element, number[]>();
  const kartenEnde = new Map<Element, number[]>();
  for (const zeile of zeilenElemente) {
    const quelle = symbolQuelle(zeile);
    const text = textblock(zeile);
    const ink = quelle ? tinte(quelle) : null;
    const block = text ? kastenVon(text) : null;
    if (ink && block) achse('Zeilensymbol ↔ Textblock', { y: ink.cy - mitteVon(block).cy }, zeile);
    const karte = zeile.closest('[data-flaeche], .karte, .dialog-fenster');
    if (!karte || !drin(karte)) continue;
    if (block) {
      const liste = kartenText.get(karte) ?? [];
      liste.push(block.left);
      kartenText.set(karte, liste);
    }
    const enden = [...zeile.querySelectorAll('button[data-schnell-menue], [role="checkbox"], [data-zeile-wert]')]
      .map((element) => kastenVon(element))
      .filter((kasten): kasten is DOMRect => kasten !== null);
    if (enden.length === 0) continue;
    const liste = kartenEnde.get(karte) ?? [];
    liste.push(Math.max(...enden.map((kasten) => kasten.right)));
    kartenEnde.set(karte, liste);
  }
  for (const [karte, werte] of kartenText) spanne('Textkante', werte, karte);
  for (const [karte, werte] of kartenEnde) spanne('Rechte Kante', werte, karte);

  for (const spalte of suche('[data-kennzahlen] > div, [data-wochenwert]')) {
    const wert = spalte.querySelector('.zahl, p');
    const wort = [...spalte.querySelectorAll('p')].find((absatz) => absatz !== wert);
    const rahmen = kastenVon(spalte);
    const wertPunkt = wert ? inhalt(wert) : null;
    const wortPunkt = wort ? inhalt(wort) : null;
    if (!rahmen || !wertPunkt || !wortPunkt) continue;
    const dxWert = wertPunkt.cx - mitteVon(rahmen).cx;
    const dxWort = wortPunkt.cx - mitteVon(rahmen).cx;
    const aus = Math.abs(dxWert) > grenze || Math.abs(dxWort) > grenze || Math.abs(dxWert - dxWort) > grenze;
    merke('Kennzahl Wert ↔ Wort ↔ Spaltenmitte', `Wert ${rund(dxWert)}, Wort ${rund(dxWort)}`, aus, spalte);
  }

  for (const titel of suche('h2.ueberschrift')) {
    const bereich = titel.closest('.abschnitt-kopf')?.querySelector('.abschnitt-textaktion') ?? titel.parentElement;
    const link = bereich ? [...bereich.querySelectorAll('a')].find((anker) => !titel.contains(anker) && kastenVon(anker)) : undefined;
    if (!link) continue;
    const links = grundlinie(titel);
    const rechts = grundlinie(link);
    if (links === null || rechts === null) continue;
    achse('Abschnittsüberschrift ↔ Link', { y: links - rechts }, titel);
  }

  if (modus !== 'dialog') {
    const kopf = document.querySelector('header[data-kopf]');
    const titel = kopf?.querySelector('h1') ?? null;
    const bild = kopf?.querySelector('[data-profilbild]') ?? null;
    const titelKasten = titel && kopf && drin(kopf) ? kastenVon(titel) : null;
    const bildKasten = bild && kopf && drin(kopf) ? kastenVon(bild) : null;
    if (titelKasten && bildKasten) {
      achse('Kopftitel ↔ Profilbild', { y: mitteVon(titelKasten).cy - mitteVon(bildKasten).cy }, titel);
    }
  }

  return zeilen;
}

export function schreibeTabelle(zeilen: TabellenZeile[], fehler: string[]): void {
  fs.mkdirSync(BERICHT_ORDNER, { recursive: true });
  const kopf = 'Seite\tPaar\tAbweichung\tAusreisser';
  const koerper = zeilen.map((zeile) => `${zeile.seite}\t${zeile.paar}\t${zeile.abweichung}\t${zeile.ausreisser ? 'Ausreißer' : ''}`);
  fs.writeFileSync(`${BERICHT_ORDNER}/tabelle.txt`, `${[kopf, ...koerper].join('\n')}\n`);
  const ausreisser = zeilen.filter((zeile) => zeile.ausreisser);
  const liste = ausreisser.length === 0 ? 'keine\n' : `${ausreisser.map((zeile) => `${zeile.seite}\t${zeile.paar}\t${zeile.abweichung}`).join('\n')}\n`;
  fs.writeFileSync(`${BERICHT_ORDNER}/ausreisser.txt`, liste);
  if (fehler.length > 0) fs.writeFileSync(`${BERICHT_ORDNER}/fehler.txt`, `${fehler.join('\n')}\n`);
}
