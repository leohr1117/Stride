import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const SEITEN = [
  ['mehr', '/mehr'],
  ['konto', '/mehr/profil'],
  ['ziele', '/ziele'],
  ['taetigkeiten', '/mehr/inhalte'],
  ['darstellung', '/mehr/darstellung'],
  ['heute', '/'],
  ['fokus', '/mehr/profil/fokus'],
  ['passwort', '/mehr/profil/passwort'],
  ['leiste', '/mehr/darstellung/leiste'],
  ['vorbilder', '/vorbilder'],
] as const;

const BILDER = new Set(['mehr', 'ziele', 'heute', 'vorbilder', 'fokus', 'passwort', 'leiste', 'taetigkeiten']);

interface Kante {
  links: number;
  rechts: number;
  kopfLinks: number;
  kopfRechts: number;
  aktionRechts: number | null;
  breite: number;
  flaechen: number;
  flaecheGleich: boolean;
  formularGleich: boolean;
  ueberstand: string | null;
}

function kanteGleich(ist: number, soll: number): boolean {
  return Math.abs(ist - soll) <= 1;
}

async function oeffne(seite: Page, pfad: string): Promise<void> {
  await seite.goto(pfad);
  await expect(seite.locator('main h1').first()).toBeVisible();
  await expect(seite.getByText('Lädt …')).toHaveCount(0);
}

async function missKante(seite: Page): Promise<Kante> {
  return seite.evaluate(() => {
    const inhalt = document.querySelector('[data-inhalt]');
    const kopf = document.querySelector('[data-kopf] > div');
    if (!(inhalt instanceof HTMLElement) || !(kopf instanceof HTMLElement)) {
      return {
        links: -1,
        rechts: -1,
        kopfLinks: -1,
        kopfRechts: -1,
        aktionRechts: null,
        breite: -1,
        flaechen: 0,
        flaecheGleich: false,
        formularGleich: false,
        ueberstand: 'Spalte fehlt',
      };
    }
    const inhaltKasten = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      const stil = getComputedStyle(element);
      return {
        links: box.left + parseFloat(stil.paddingLeft) + parseFloat(stil.borderLeftWidth),
        rechts: box.right - parseFloat(stil.paddingRight) - parseFloat(stil.borderRightWidth),
      };
    };
    const spalte = inhaltKasten(inhalt);
    const kopfKante = inhaltKasten(kopf);
    const nah = (wert: number, soll: number) => Math.abs(wert - soll) <= 1;
    const flaechen = [...inhalt.querySelectorAll('[data-flaeche]')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    });
    const formulare = [...inhalt.querySelectorAll('form')].filter((element) => element.getBoundingClientRect().width > 1);
    const aktion = document.querySelector('[data-kopf] a.profilziel');
    let ueberstand: string | null = null;
    for (const element of inhalt.querySelectorAll('*')) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      const box = element.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) {
        continue;
      }
      let clip = false;
      let vater = element.parentElement;
      while (vater && vater !== inhalt) {
        const lauf = getComputedStyle(vater).overflowX;
        if (lauf === 'auto' || lauf === 'scroll' || lauf === 'hidden' || lauf === 'clip') {
          clip = true;
          break;
        }
        vater = vater.parentElement;
      }
      if (clip) {
        continue;
      }
      if (box.right > spalte.rechts + 1 || box.left < spalte.links - 1) {
        const klasse = typeof element.className === 'string' ? element.className.slice(0, 48) : '';
        ueberstand = `${element.tagName}${klasse ? `.${klasse}` : ''}`;
        break;
      }
    }
    return {
      links: spalte.links,
      rechts: spalte.rechts,
      kopfLinks: kopfKante.links,
      kopfRechts: kopfKante.rechts,
      aktionRechts: aktion instanceof HTMLElement ? aktion.getBoundingClientRect().right : null,
      breite: spalte.rechts - spalte.links,
      flaechen: flaechen.length,
      flaecheGleich: flaechen.every((element) => {
        const box = element.getBoundingClientRect();
        return nah(box.left, spalte.links) && nah(box.right, spalte.rechts);
      }),
      formularGleich: formulare.every((element) => {
        const box = element.getBoundingClientRect();
        return nah(box.left, spalte.links) && nah(box.right, spalte.rechts);
      }),
      ueberstand,
    };
  });
}

test('am PC haben alle Seiten dieselbe Inhaltskante', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur 1440');
  await page.setViewportSize({ width: 1440, height: 900 });
  await anmelden(page);
  const kanten: { name: string; kante: Kante }[] = [];
  for (const [name, pfad] of SEITEN) {
    await oeffne(page, pfad);
    await ohneSeitlichenUeberlauf(page);
    const kante = await missKante(page);
    kanten.push({ name, kante });
    if (BILDER.has(name)) {
      await page.screenshot({ path: `tmp-test/inhaltsbreite/nachher-1440-${name}.png` });
    }
  }
  const bezug = kanten[0]?.kante;
  expect(bezug, 'Mehr').toBeTruthy();
  if (!bezug) {
    return;
  }
  expect(kanteGleich(bezug.breite, 720), `Mehr ist ${bezug.breite} px`).toBe(true);
  for (const { name, kante } of kanten) {
    expect(kante.ueberstand, name).toBeNull();
    expect(kanteGleich(kante.links, bezug.links), `${name} links ${kante.links}`).toBe(true);
    expect(kanteGleich(kante.rechts, bezug.rechts), `${name} rechts ${kante.rechts}`).toBe(true);
    expect(kanteGleich(kante.kopfLinks, kante.links), `${name} Kopf links`).toBe(true);
    expect(kanteGleich(kante.kopfRechts, kante.rechts), `${name} Kopf rechts`).toBe(true);
    if (kante.aktionRechts !== null) {
      expect(kanteGleich(kante.aktionRechts, kante.rechts), `${name} Aktion ${kante.aktionRechts}`).toBe(true);
    }
    if (kante.flaechen > 0) {
      expect(kante.flaecheGleich, name).toBe(true);
    }
    expect(kante.formularGleich, name).toBe(true);
  }
});

test('auf dem Handy bleibt die Inhaltsbreite am Rand', async ({ page }, info) => {
  test.skip(info.project.name !== 'handy', 'nur 390');
  await page.setViewportSize({ width: 390, height: 844 });
  await anmelden(page);
  for (const pfad of ['/mehr', '/', '/mehr/profil/passwort']) {
    await oeffne(page, pfad);
    await ohneSeitlichenUeberlauf(page);
    const kante = await missKante(page);
    const fenster = await page.evaluate(() => document.documentElement.clientWidth);
    expect(kante.ueberstand, pfad).toBeNull();
    expect(kanteGleich(kante.links, 16), pfad).toBe(true);
    expect(kanteGleich(kante.rechts, fenster - 16), pfad).toBe(true);
    expect(kanteGleich(kante.kopfRechts, kante.rechts), pfad).toBe(true);
    if (kante.flaechen > 0) {
      expect(kante.flaecheGleich, pfad).toBe(true);
    }
  }
});
