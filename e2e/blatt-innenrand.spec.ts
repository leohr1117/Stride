import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const BAHN = [
  'formular',
  'formular-felder',
  'formular-fuss',
  'blatt-sofort',
  'blatt-sofort-felder',
  'blatt-sofort-fuss',
  'dialog-auswahl',
  'dialog-auswahl-liste',
  'dialog-aktionen',
];

/** Inhalt bleibt 16 px vom Rand. Der Balken liegt daneben, nicht auf Feldern. */
async function rechterInnenrand(dialog: Locator, eng: boolean): Promise<void> {
  const ergebnis = await dialog.evaluate((el, bahn) => {
    const koerper = el.querySelector('.dialog-koerper');
    if (!(koerper instanceof HTMLElement)) {
      return { fehler: 'koerper' };
    }
    const stil = getComputedStyle(koerper);
    const kasten = koerper.getBoundingClientRect();
    const probleme: string[] = [];
    const istBahn = (knoten: HTMLElement) => bahn.some((name) => knoten.classList.contains(name));
    const fein = window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 768;
    const gutterSoll = (knoten: HTMLElement) => {
      if (knoten.classList.contains('formular-felder') || knoten.classList.contains('blatt-sofort-felder')) {
        return true;
      }
      if (knoten.classList.contains('dialog-auswahl-liste') && knoten.parentElement?.classList.contains('dialog-auswahl')) {
        return true;
      }
      if (
        knoten.classList.contains('dialog-koerper') &&
        !knoten.querySelector(':scope > .formular, :scope > .dialog-auswahl, :scope > .blatt-sofort')
      ) {
        return true;
      }
      return (
        fein &&
        (knoten.classList.contains('formular-fuss') ||
          knoten.classList.contains('blatt-sofort-fuss') ||
          knoten.classList.contains('dialog-aktionen'))
      );
    };
    const pruefeGutter = (knoten: HTMLElement) => {
      if (!gutterSoll(knoten)) {
        return;
      }
      const wert = getComputedStyle(knoten).scrollbarGutter;
      const erwartet = fein ? 'stable' : 'auto';
      if (!wert.startsWith(erwartet)) {
        probleme.push(`gutter ${erwartet} ${wert} ${knoten.className}`.slice(0, 80));
      }
    };
    pruefeGutter(koerper);
    for (const knoten of koerper.querySelectorAll(
      '.formular-felder, .blatt-sofort-felder, .dialog-auswahl-liste, .formular-fuss, .blatt-sofort-fuss, .dialog-aktionen',
    )) {
      if (knoten instanceof HTMLElement) {
        pruefeGutter(knoten);
      }
    }
    const portVon = (knoten: HTMLElement): HTMLElement | null => {
      let vorfahr: HTMLElement | null = knoten;
      while (vorfahr) {
        const ueber = getComputedStyle(vorfahr).overflowY;
        if (ueber === 'auto' || ueber === 'scroll') {
          return vorfahr;
        }
        vorfahr = vorfahr.parentElement;
      }
      return null;
    };
    const voll = (knoten: Element, name: string) => {
      if (!(knoten instanceof HTMLElement)) {
        probleme.push(name);
        return;
      }
      const lage = knoten.getBoundingClientRect();
      if (lage.width < 2 || lage.right > kasten.right - 16 + 1 || lage.left < kasten.left + parseFloat(stil.paddingLeft) - 1) {
        probleme.push(`${name} ${Math.round(lage.left)}-${Math.round(lage.right)}`);
      }
    };
    const name = el.querySelector('input');
    const chip = [...el.querySelectorAll('button')].find((knopf) => knopf.getAttribute('aria-label') === '800 XP');
    if (name) {
      voll(name, 'name');
    }
    if (chip) {
      voll(chip, 'chip');
    }
    for (const knoten of koerper.querySelectorAll('*')) {
      if (!(knoten instanceof HTMLElement)) {
        continue;
      }
      const eigen = getComputedStyle(knoten);
      if (eigen.display === 'none' || eigen.visibility === 'hidden' || eigen.opacity === '0') {
        continue;
      }
      const lage = knoten.getBoundingClientRect();
      if (lage.width < 2 || lage.height < 2) {
        continue;
      }
      let rechts = lage.right;
      let links = lage.left;
      let oben = lage.top;
      let unten = lage.bottom;
      let vorfahr: HTMLElement | null = knoten.parentElement;
      while (vorfahr) {
        const vStil = getComputedStyle(vorfahr);
        const kante = vorfahr.getBoundingClientRect();
        if (vStil.overflowX === 'hidden' || vStil.overflowX === 'clip' || vStil.overflowX === 'auto' || vStil.overflowX === 'scroll') {
          links = Math.max(links, kante.left);
          rechts = Math.min(rechts, kante.right);
        }
        if (vStil.overflowY === 'hidden' || vStil.overflowY === 'clip' || vStil.overflowY === 'auto' || vStil.overflowY === 'scroll') {
          oben = Math.max(oben, kante.top);
          unten = Math.min(unten, kante.bottom);
        }
        vorfahr = vorfahr.parentElement;
      }
      if (rechts - links < 2 || unten - oben < 2) {
        continue;
      }
      if (istBahn(knoten)) {
        if (rechts > kasten.right + 1) {
          probleme.push(`bahn ${Math.round(rechts)} ${knoten.className}`.slice(0, 70));
        }
        continue;
      }
      if (rechts > kasten.right - 16 + 1) {
        const text = (knoten.getAttribute('aria-label') || knoten.innerText || knoten.className).replace(/\s+/g, ' ').slice(0, 40);
        probleme.push(`rand ${Math.round(rechts)} ${text}`);
      }
      const port = portVon(knoten);
      if (port) {
        const box = port.getBoundingClientRect();
        const inhaltRechts = box.left + port.clientLeft + port.clientWidth;
        if (rechts > inhaltRechts + 1) {
          const text = (knoten.getAttribute('aria-label') || knoten.className).replace(/\s+/g, ' ').slice(0, 30);
          probleme.push(`balken ${Math.round(rechts)}>${Math.round(inhaltRechts)} ${text}`);
        }
      }
    }
    for (const knoten of [el, ...el.querySelectorAll('*')]) {
      if (!(knoten instanceof HTMLElement)) {
        continue;
      }
      const vStil = getComputedStyle(knoten);
      if (
        !knoten.classList.contains('chip-reihe') &&
        (vStil.overflowX === 'auto' || vStil.overflowX === 'scroll') &&
        knoten.scrollWidth > knoten.clientWidth + 1
      ) {
        probleme.push(`scroll ${knoten.className}`.slice(0, 60));
      }
    }
    const feld = koerper.querySelector('.formular-felder .feld-eingabe, .blatt-sofort-felder .feld-eingabe');
    const knopf = koerper.querySelector('.formular-fuss .knopf-primaer, .blatt-sofort-fuss .knopf-primaer');
    const flucht =
      feld instanceof HTMLElement && knopf instanceof HTMLElement
        ? Math.round(feld.getBoundingClientRect().right - knopf.getBoundingClientRect().right)
        : 0;
    const scroller = koerper.querySelector('.formular-felder, .blatt-sofort-felder, .dialog-auswahl > .dialog-auswahl-liste');
    const blatt = el.getBoundingClientRect();
    const balken =
      scroller instanceof HTMLElement
        ? scroller.offsetWidth - scroller.clientWidth - scroller.clientLeft
        : koerper.offsetWidth - koerper.clientWidth - koerper.clientLeft;
    return {
      fehler: '',
      paddingLinks: Math.round(parseFloat(stil.paddingLeft)),
      paddingRechts: Math.round(parseFloat(stil.paddingRight)),
      innenHost: Boolean(koerper.querySelector(':scope > .formular, :scope > .dialog-auswahl, :scope > .blatt-sofort')),
      scrollerPad: scroller instanceof HTMLElement ? Math.round(parseFloat(getComputedStyle(scroller).paddingRight)) : null,
      balken,
      flucht,
      seitenGutter: getComputedStyle(document.documentElement).scrollbarGutter,
      links: Math.round(blatt.left),
      rechts: Math.round(blatt.right),
      fenster: window.innerWidth,
      offset: document.documentElement.offsetWidth,
      probleme: probleme.slice(0, 8),
    };
  }, BAHN);
  expect(ergebnis.fehler).toBe('');
  if (!('paddingLinks' in ergebnis)) {
    return;
  }
  expect(ergebnis.paddingLinks).toBe(16);
  expect(ergebnis.paddingRechts).toBe(ergebnis.innenHost ? 0 : 16);
  if (ergebnis.scrollerPad !== null) {
    expect(ergebnis.scrollerPad).toBe(16);
  }
  expect(Math.abs(ergebnis.flucht)).toBeLessThanOrEqual(1);
  expect(ergebnis.seitenGutter).toBe('auto');
  if (eng) {
    expect(ergebnis.balken).toBeLessThanOrEqual(1);
  } else {
    expect(ergebnis.balken).toBeGreaterThanOrEqual(8);
  }
  expect(ergebnis.probleme).toEqual([]);
  if (eng) {
    expect(ergebnis.links).toBeLessThanOrEqual(1);
    expect(ergebnis.rechts).toBeGreaterThanOrEqual(ergebnis.fenster - 1);
    expect(ergebnis.offset).toBeGreaterThanOrEqual(ergebnis.fenster - 1);
  }
  await ohneSeitlichenUeberlauf(dialog.page());
}

async function oeffneInvestition(page: Page): Promise<Locator> {
  await page.goto('/investitionen');
  await page.getByRole('button', { name: /Investition anlegen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(dialog.getByRole('button', { name: '800 XP', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
  return dialog;
}

test('Investitionsblatt bleibt im rechten Innenrand', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/blatt-rand', { recursive: true });
  await anmelden(page);
  const eng = testInfo.project.name === 'handy';
  const investition = await oeffneInvestition(page);
  await rechterInnenrand(investition, eng);
  await page.screenshot({ path: `tmp-test/blatt-rand/${testInfo.project.name}-d11.png` });
  await investition.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
  const wahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
  await expect(wahl.getByRole('option', { name: 'Nichts', exact: true })).toBeVisible();
  await rechterInnenrand(wahl, eng);
  await page.screenshot({ path: `tmp-test/blatt-rand/${testInfo.project.name}-bezahlt.png` });
  await wahl.getByRole('button', { name: 'Schließen' }).click();
  await expect(wahl).toBeHidden();
  await investition.getByRole('button', { name: 'Schließen' }).click();
  await expect(investition).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(eintrag.getByRole('button', { name: 'Schließen' })).toBeVisible();
  await rechterInnenrand(eintrag, eng);
  await page.screenshot({ path: `tmp-test/blatt-rand/${testInfo.project.name}-eintrag.png` });
  await eintrag.getByRole('button', { name: 'Schließen' }).click();
  await expect(eintrag).toBeHidden();

  await page.goto('/basis');
  await page.getByRole('button', { name: /Basis-Aufgabe/ }).first().click();
  const basis = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
  await expect(basis.getByRole('button', { name: 'Schließen' })).toBeVisible();
  await rechterInnenrand(basis, eng);
  await page.screenshot({ path: `tmp-test/blatt-rand/${testInfo.project.name}-basis.png` });
});
