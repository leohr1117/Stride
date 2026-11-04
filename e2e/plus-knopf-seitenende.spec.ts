import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { hatEintragFab, LEISTEN_SEITEN } from '../shared/spiel/leiste.ts';
import { anmelden } from './helfer.ts';

const BREITE = 390;
const HOEHE = 844;
const SCHNITT = 1;

fs.mkdirSync('tmp-test/plus-knopf-seitenende', { recursive: true });

type Kasten = { links: number; oben: number; rechts: number; unten: number };

type Messung = {
  amEnde: boolean;
  fab: boolean;
  zeile: Kasten | null;
  knopf: Kasten | null;
  ueberX: number;
  ueberY: number;
  hatKreis: boolean;
  hatMenue: boolean;
};

function dateiName(pfad: string): string {
  if (pfad === '/') {
    return 'heute';
  }
  return pfad.slice(1).replaceAll('/', '-');
}

function adresse(pfad: string): RegExp {
  if (pfad === '/') {
    return /\/$/;
  }
  return new RegExp(`${pfad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

function textFuer(pfad: string, lage: Messung): string {
  if (!lage.zeile || !lage.knopf) {
    return pfad;
  }
  return [
    pfad,
    `Zeile unten ${lage.zeile.unten.toFixed(1)}`,
    `Knopf oben ${lage.knopf.oben.toFixed(1)}`,
    `Überlappung ${lage.ueberX.toFixed(1)} mal ${lage.ueberY.toFixed(1)}`,
    lage.hatKreis ? 'mit Abhakkreis' : 'ohne Abhakkreis',
    lage.hatMenue ? 'mit Menü' : 'ohne Menü',
  ].join(', ');
}

async function messen(seite: Page): Promise<Messung> {
  return seite.evaluate(async () => {
    const bilder = [...document.images].filter((bild) => !bild.complete);
    await Promise.race([
      Promise.all(
        bilder.map(
          (bild) =>
            new Promise<void>((fertig) => {
              bild.addEventListener('load', () => fertig(), { once: true });
              bild.addEventListener('error', () => fertig(), { once: true });
            }),
        ),
      ),
      new Promise<void>((fertig) => {
        setTimeout(fertig, 2000);
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

    const kastenVon = (element) => {
      const kasten = element.getBoundingClientRect();
      return { links: kasten.left, oben: kasten.top, rechts: kasten.right, unten: kasten.bottom };
    };
    const sichtbar = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const stil = getComputedStyle(element);
      if (stil.display === 'none' || stil.visibility === 'hidden') {
        return false;
      }
      const kasten = element.getBoundingClientRect();
      return kasten.width > 1 && kasten.height > 1;
    };
    const vereine = (bisher, dazu) => ({
      links: Math.min(bisher.links, dazu.links),
      oben: Math.min(bisher.oben, dazu.oben),
      rechts: Math.max(bisher.rechts, dazu.rechts),
      unten: Math.max(bisher.unten, dazu.unten),
    });

    let letzte = null;
    let boden = Number.NEGATIVE_INFINITY;
    for (const element of document.querySelectorAll('main .zeile, main [data-schnell]')) {
      if (!sichtbar(element) || !(element instanceof HTMLElement)) {
        continue;
      }
      const unten = element.getBoundingClientRect().bottom;
      if (unten > boden + 0.5) {
        boden = unten;
        letzte = element;
      }
    }

    const knopfElement = document.querySelector('.eintrag-fab');
    const fabSichtbar =
      knopfElement instanceof HTMLElement &&
      getComputedStyle(knopfElement).display !== 'none' &&
      sichtbar(knopfElement);
    const knopf = fabSichtbar && knopfElement instanceof HTMLElement ? kastenVon(knopfElement) : null;

    let zeile = null;
    let hatKreis = false;
    let hatMenue = false;
    if (letzte) {
      zeile = kastenVon(letzte);
      for (const element of letzte.querySelectorAll('[role="checkbox"], [data-schnell-menue], .zeile-menue button')) {
        if (!sichtbar(element)) {
          continue;
        }
        if (element.getAttribute('role') === 'checkbox') {
          hatKreis = true;
        }
        if (element.hasAttribute('data-schnell-menue') || element.closest('.zeile-menue')) {
          hatMenue = true;
        }
        zeile = vereine(zeile, kastenVon(element));
      }
    }

    const ueber = (anfangA, endeA, anfangB, endeB) => Math.min(endeA, endeB) - Math.max(anfangA, anfangB);

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

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'handy', 'Nur bei 390 mal 844');
  await page.setViewportSize({ width: BREITE, height: HOEHE });
  await anmelden(page);
});

test('Plus-Knopf lässt die letzte Zeile am Seitenende frei', async ({ page }) => {
  test.setTimeout(240_000);
  const fenster = await page.evaluate(() => ({ breite: window.innerWidth, hoehe: window.innerHeight }));
  expect(fenster).toEqual({ breite: BREITE, hoehe: HOEHE });

  for (const eintrag of LEISTEN_SEITEN) {
    await page.goto(eintrag.pfad);
    await expect(page).toHaveURL(adresse(eintrag.pfad));
    await expect(page.locator('main h1')).toHaveText(eintrag.label);
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    const lage = await messen(page);
    expect.soft(lage.amEnde, `${eintrag.pfad} nicht am Seitenende`).toBe(true);
    expect.soft(lage.fab, `${eintrag.pfad} Plus-Knopf`).toBe(hatEintragFab(eintrag.pfad));
    if (lage.fab && lage.zeile && lage.knopf) {
      const schneidet = lage.ueberX > SCHNITT && lage.ueberY > SCHNITT;
      expect.soft(schneidet, textFuer(eintrag.pfad, lage)).toBe(false);
    }
    test.info().annotations.push({
      type: eintrag.pfad,
      description: lage.zeile
        ? `Überlappung ${lage.ueberX.toFixed(1)} mal ${lage.ueberY.toFixed(1)}`
        : 'keine Zeile',
    });
    await page.screenshot({ path: `tmp-test/plus-knopf-seitenende/${dateiName(eintrag.pfad)}.png` });
  }
});
