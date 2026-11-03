import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

/** Sichtbarer Kasten gegen den Innenrand des Blattkörpers. Abgeschnitten zählt mit. */
async function rechterInnenrand(dialog: Locator, eng: boolean): Promise<void> {
  const ergebnis = await dialog.evaluate((el) => {
    const koerper = el.querySelector('.dialog-koerper');
    if (!(koerper instanceof HTMLElement)) {
      return { fehler: 'koerper' };
    }
    const stil = getComputedStyle(koerper);
    const kasten = koerper.getBoundingClientRect();
    const innen = kasten.right - parseFloat(stil.paddingRight);
    const probleme: string[] = [];
    const voll = (knoten: Element, name: string) => {
      if (!(knoten instanceof HTMLElement)) {
        probleme.push(name);
        return;
      }
      const lage = knoten.getBoundingClientRect();
      if (lage.width < 2 || lage.right > innen + 1 || lage.left < kasten.left + parseFloat(stil.paddingLeft) - 1) {
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
      if (rechts > innen + 1) {
        const text = (knoten.getAttribute('aria-label') || knoten.innerText || knoten.className).replace(/\s+/g, ' ').slice(0, 40);
        probleme.push(`rand ${Math.round(rechts)} ${text}`);
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
    const blatt = el.getBoundingClientRect();
    return {
      fehler: '',
      paddingLinks: Math.round(parseFloat(stil.paddingLeft)),
      paddingRechts: Math.round(parseFloat(stil.paddingRight)),
      links: Math.round(blatt.left),
      rechts: Math.round(blatt.right),
      fenster: window.innerWidth,
      offset: document.documentElement.offsetWidth,
      probleme: probleme.slice(0, 8),
    };
  });
  expect(ergebnis.fehler).toBe('');
  if (!('paddingLinks' in ergebnis)) {
    return;
  }
  expect(ergebnis.paddingLinks).toBe(16);
  expect(ergebnis.paddingRechts).toBe(16);
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
  await page.screenshot({ path: `tmp-test/blatt-rand/${testInfo.project.name}.png` });
  await investition.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
  const wahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
  await expect(wahl.getByRole('option', { name: 'Nichts', exact: true })).toBeVisible();
  await rechterInnenrand(wahl, eng);
  await wahl.getByRole('button', { name: 'Schließen' }).click();
  await expect(wahl).toBeHidden();
  await investition.getByRole('button', { name: 'Schließen' }).click();
  await expect(investition).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(eintrag.getByRole('button', { name: 'Schließen' })).toBeVisible();
  await rechterInnenrand(eintrag, eng);
});
