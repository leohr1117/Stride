import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { anmelden } from './helfer.ts';

const TOLERANZ = 0.5;

interface SymbolMass {
  art: 'basis' | 'boss';
  deltaY: number;
  breite: number;
  hoehe: number;
  text: number;
  strich: string;
}

interface Kante {
  art: 'abhak' | 'menue' | 'menue-allein' | 'disziplin';
  abstand: number;
}

interface Bericht {
  symbole: SymbolMass[];
  kanten: Kante[];
  nav: { breite: string; hoehe: string; strich: string } | null;
  werte: number[];
  kopf: number[];
  pfeil: { breite: string; strich: string } | null;
}

function messen(): Bericht {
  function innen(element: Element): { links: number; rechts: number } | null {
    const karte = element.closest('[data-flaeche]');
    if (!(karte instanceof HTMLElement)) {
      return null;
    }
    const kasten = karte.getBoundingClientRect();
    const stil = getComputedStyle(karte);
    const links = Number.parseFloat(stil.borderLeftWidth) || 0;
    const rechts = Number.parseFloat(stil.borderRightWidth) || 0;
    return { links: kasten.left + links, rechts: kasten.right - rechts };
  }

  function mitte(elemente: Element[]): { cx: number; cy: number } | null {
    const kaesten = elemente
      .map((element) => element.getBoundingClientRect())
      .filter((kasten) => kasten.width > 0.5 || kasten.height > 0.5);
    if (kaesten.length === 0) {
      return null;
    }
    const left = Math.min(...kaesten.map((kasten) => kasten.left));
    const right = Math.max(...kaesten.map((kasten) => kasten.right));
    const top = Math.min(...kaesten.map((kasten) => kasten.top));
    const bottom = Math.max(...kaesten.map((kasten) => kasten.bottom));
    return { cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }

  const symbole: SymbolMass[] = [];
  const plaetze = [...document.querySelectorAll('main .symbol-platz, main .boss-platz')];
  for (const platz of plaetze) {
    if (!(platz instanceof HTMLElement) || platz.getBoundingClientRect().height < 1) {
      continue;
    }
    const zeile = platz.closest('.zeile, .symbol-zeile, li');
    const text = zeile?.querySelector('.zeilen-text');
    const rand = innen(platz);
    if (!(text instanceof HTMLElement) || !rand) {
      continue;
    }
    const tinte = mitte([...platz.querySelectorAll('path, circle, line, polyline, polygon')]);
    const block = text.getBoundingClientRect();
    if (!tinte || block.height < 1) {
      continue;
    }
    const bild = platz.querySelector('svg.lucide');
    const svg = bild instanceof SVGElement ? bild.getBoundingClientRect() : null;
    symbole.push({
      art: platz.classList.contains('symbol-platz') ? 'basis' : 'boss',
      deltaY: tinte.cy - (block.top + block.height / 2),
      breite: svg ? svg.width : 0,
      hoehe: svg ? svg.height : 0,
      text: block.left - rand.links,
      strich: bild instanceof SVGElement ? getComputedStyle(bild).getPropertyValue('stroke-width').trim() : '',
    });
  }

  const kanten: Kante[] = [];
  const zeilen = [...document.querySelectorAll('main .zeile, main .symbol-zeile')];
  for (const zeile of zeilen) {
    if (!(zeile instanceof HTMLElement) || zeile.getBoundingClientRect().height < 1) {
      continue;
    }
    const rand = innen(zeile);
    if (!rand) {
      continue;
    }
    const abhak = zeile.querySelector('[role="checkbox"]');
    const menue = zeile.querySelector('[data-schnell-menue]');
    const wert = zeile.querySelector('[data-zeile-wert]');
    const disziplin = wert instanceof HTMLElement && (wert.textContent ?? '').includes('Disziplin') ? wert : null;
    const paar: Array<[Kante['art'], Element | null]> = [
      ['abhak', abhak],
      ['menue', abhak ? menue : null],
      ['menue-allein', abhak ? null : menue],
      ['disziplin', disziplin],
    ];
    for (const [art, element] of paar) {
      if (!(element instanceof HTMLElement) || element.getBoundingClientRect().height < 1) {
        continue;
      }
      kanten.push({ art, abstand: rand.rechts - element.getBoundingClientRect().right });
    }
  }

  const navBild = document.querySelector('.mobilleiste a svg.lucide, .seitenleiste a svg.lucide');
  const nav =
    navBild instanceof SVGElement
      ? {
          breite: getComputedStyle(navBild).width,
          hoehe: getComputedStyle(navBild).height,
          strich: getComputedStyle(navBild).getPropertyValue('stroke-width').trim(),
        }
      : null;
  const werte = [...document.querySelectorAll('[data-werte] svg.lucide.size-4')]
    .filter((element) => element.getBoundingClientRect().height > 1)
    .map((element) => element.getBoundingClientRect().width);
  const kopf = [...document.querySelectorAll('[data-werte] .kopf-pfeil svg.lucide')]
    .filter((element) => element.getBoundingClientRect().height > 1)
    .map((element) => element.getBoundingClientRect().width);
  const pfeilBild = [...document.querySelectorAll('.zeile svg.lucide.zeile-pfeil')].find(
    (element) => element.getBoundingClientRect().height > 1,
  );
  const pfeil =
    pfeilBild instanceof SVGElement
      ? {
          breite: getComputedStyle(pfeilBild).width,
          strich: getComputedStyle(pfeilBild).getPropertyValue('stroke-width').trim(),
        }
      : null;
  return { symbole, kanten, nav, werte, kopf, pfeil };
}

function strichZahl(wert: string | undefined): number {
  const text = wert ?? '';
  const bruch = text.match(/^calc\(([-\d.]+)px\s*\/\s*([-\d.]+)px\)$/);
  if (bruch?.[1] !== undefined && bruch[2] !== undefined) {
    return Number(bruch[1]) / Number(bruch[2]);
  }
  return Number.parseFloat(text);
}

function spanne(werte: number[]): number {
  if (werte.length === 0) {
    return 0;
  }
  return Math.max(...werte) - Math.min(...werte);
}

function pruefe(name: string, bericht: Bericht): void {
  expect(bericht.symbole.length, `${name}: Symbole`).toBeGreaterThan(0);
  const texte = bericht.symbole.map((symbol) => symbol.text);
  expect(spanne(texte), `${name}: Textkanten ${texte.map((wert) => wert.toFixed(2)).join(', ')}`).toBeLessThanOrEqual(TOLERANZ);
  for (const symbol of bericht.symbole) {
    expect(Math.abs(symbol.text - 68), `${name}: Text bei ${symbol.text.toFixed(2)}`).toBeLessThanOrEqual(TOLERANZ);
    expect(Math.abs(symbol.deltaY), `${name}: Symbolmitte ${symbol.deltaY.toFixed(2)}`).toBeLessThanOrEqual(TOLERANZ);
    if (symbol.art === 'basis') {
      expect(symbol.breite, name).toBeGreaterThan(21.5);
      expect(symbol.breite, name).toBeLessThan(22.5);
      expect(symbol.hoehe, name).toBeGreaterThan(21.5);
      expect(symbol.hoehe, name).toBeLessThan(22.5);
      expect(strichZahl(symbol.strich), `${name}: ${symbol.strich}`).toBeCloseTo(1.925, 2);
    }
  }
}

test('Zeilensymbole stehen in der Spalte und mittig am Text', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await anmelden(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bosse greifen an' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Basis', exact: true })).toBeVisible();
  const heute = await page.evaluate(messen);
  pruefe('Heute', heute);
  const basisSymbole = heute.symbole.filter((symbol) => symbol.art === 'basis');
  const bossSymbole = heute.symbole.filter((symbol) => symbol.art === 'boss');
  expect(basisSymbole.length).toBeGreaterThan(0);
  expect(bossSymbole.length).toBeGreaterThan(0);
  expect(heute.nav?.breite).toBe('20px');
  expect(heute.nav?.hoehe).toBe('20px');
  expect(strichZahl(heute.nav?.strich), heute.nav?.strich).toBeCloseTo(1.75, 2);
  expect(heute.pfeil?.breite).toBe('20px');
  expect(strichZahl(heute.pfeil?.strich), heute.pfeil?.strich).toBeCloseTo(1.75, 2);

  if (testInfo.project.name === 'handy') {
    fs.mkdirSync('tmp-test/zeilensymbole', { recursive: true });
    await page.screenshot({ path: 'tmp-test/zeilensymbole/nachher-390-heute.png', fullPage: true });
  }

  await page.getByRole('button', { name: 'Werte', exact: true }).click();
  await expect(page.locator('main [data-werte] svg.lucide').first()).toBeVisible();
  const werteOffen = await page.evaluate(messen);
  expect(werteOffen.werte.length).toBeGreaterThan(0);
  for (const breite of werteOffen.werte) {
    expect(breite).toBeGreaterThan(15.5);
    expect(breite).toBeLessThan(16.5);
  }
  expect(werteOffen.kopf.length).toBeGreaterThan(0);
  for (const breite of werteOffen.kopf) {
    expect(breite).toBeGreaterThan(19.5);
    expect(breite).toBeLessThan(20.5);
  }

  await page.goto('/basis');
  await expect(page.locator('main h1')).toHaveText('Basis');
  await expect(page.locator('main .symbol-platz').first()).toBeVisible();
  const basis = await page.evaluate(messen);
  pruefe('Basis', basis);
  if (testInfo.project.name === 'handy') {
    await page.screenshot({ path: 'tmp-test/zeilensymbole/nachher-390-basis.png', fullPage: true });
  }

  await page.goto('/laufend');
  await expect(page.locator('main h1')).toHaveText('Laufend');
  await expect(page.locator('main .boss-platz').first()).toBeVisible();
  const laufend = await page.evaluate(messen);
  pruefe('Laufend', laufend);
  if (testInfo.project.name === 'handy') {
    await page.screenshot({ path: 'tmp-test/zeilensymbole/nachher-390-laufend.png', fullPage: true });
  }

  const texte = [...heute.symbole, ...basis.symbole, ...laufend.symbole].map((symbol) => symbol.text);
  expect(spanne(texte), `Textkanten ${texte.map((wert) => wert.toFixed(2)).join(', ')}`).toBeLessThanOrEqual(TOLERANZ);

  const kanten = [...heute.kanten, ...basis.kanten, ...laufend.kanten];
  const ende = kanten.filter((kante) => kante.art === 'abhak' || kante.art === 'disziplin' || kante.art === 'menue-allein');
  const menue = kanten.filter((kante) => kante.art === 'menue');
  expect(ende.length).toBeGreaterThan(0);
  expect(menue.length).toBeGreaterThan(0);
  expect(kanten.some((kante) => kante.art === 'abhak')).toBe(true);
  expect(kanten.some((kante) => kante.art === 'disziplin')).toBe(true);
  expect(kanten.some((kante) => kante.art === 'menue')).toBe(true);
  const endAbstaende = ende.map((kante) => kante.abstand);
  const menueAbstaende = menue.map((kante) => kante.abstand);
  expect(spanne(endAbstaende), `Abschluss ${endAbstaende.map((wert) => wert.toFixed(2)).join(', ')}`).toBeLessThanOrEqual(TOLERANZ);
  expect(spanne(menueAbstaende), `Drei-Punkte ${menueAbstaende.map((wert) => wert.toFixed(2)).join(', ')}`).toBeLessThanOrEqual(TOLERANZ);
});
