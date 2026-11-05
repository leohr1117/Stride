import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { warteAufRuhe } from './pruefaufnahme.ts';

const HELL = { stil: 'standard', primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2', glimmen: true };
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414', glimmen: true };

interface Paar {
  name: string;
  vordergrund: string;
  hintergrund: string;
  mindest: number;
}

interface Bericht {
  paare: Paar[];
  verlauf: string[];
  balken: string;
  fortschritt: string;
  ring: string;
}

interface FaehigkeitZeile {
  id: number;
  name: string;
  knoten: { titel: string; freigeschaltetAm: string | null }[];
}

async function speichere(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

interface Darstellung {
  stil: string;
  glimmen: boolean;
  primaer: string;
  akzent: string;
  hintergrund: string;
  eigeneFarben?: boolean;
}

async function lese(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      glimmen: daten.glimmen,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      eigeneFarben: daten.eigeneFarben,
    };
  });
}

async function faehigkeit(seite: Page, name: string): Promise<FaehigkeitZeile> {
  const liste = await seite.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error('Fähigkeiten nicht geladen');
    }
    return (await antwort.json()) as FaehigkeitZeile[];
  });
  const fund = liste.find((eintrag) => eintrag.name === name);
  expect(fund).toBeTruthy();
  if (!fund) {
    throw new Error(name);
  }
  return fund;
}

function berichtVon(wurzel: string): string {
  return `(() => {
    const wurzel = document.querySelector(${JSON.stringify(wurzel)});
    if (!wurzel) {
      return { paare: [], verlauf: ['fehlt'], balken: '', fortschritt: '', ring: '' };
    }
    const berechne = (farbe) => {
      const probe = document.createElement('span');
      probe.style.color = farbe;
      document.body.append(probe);
      const wert = getComputedStyle(probe).color;
      probe.remove();
      return wert;
    };
    const grundVon = (element) => {
      let knoten = element;
      while (knoten) {
        const farbe = getComputedStyle(knoten).backgroundColor;
        if (farbe !== 'rgba(0, 0, 0, 0)' && farbe !== 'transparent') {
          return farbe;
        }
        knoten = knoten.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const paare = [];
    const schiebe = (name, element, vordergrund, hintergrund, mindest) => {
      if (!(element instanceof Element) || element.getClientRects().length === 0) {
        return;
      }
      paare.push({ name, vordergrund, hintergrund, mindest });
    };
    const ringStrich = wurzel.querySelector('.skill-ring-strich');
    const ringBahn = wurzel.querySelector('.skill-ring-bahn');
    if (ringStrich && ringBahn) {
      schiebe('ring', ringStrich, getComputedStyle(ringStrich).stroke, getComputedStyle(ringBahn).stroke, 3);
    }
    for (const symbol of wurzel.querySelectorAll('[data-symbol]')) {
      schiebe('symbol', symbol, getComputedStyle(symbol).color, grundVon(symbol), 3);
    }
    const balken = wurzel.querySelector('.balken-fuellung');
    if (balken) {
      schiebe('balken', balken, getComputedStyle(balken).backgroundColor, grundVon(balken.parentElement || balken), 3);
    }
    for (const kasten of wurzel.querySelectorAll('[data-rang="erreicht"]')) {
      const stil = getComputedStyle(kasten);
      schiebe('rang', kasten, stil.color, stil.backgroundColor, 4.5);
    }
    const rangname = wurzel.querySelector('.rang-name');
    if (rangname) {
      schiebe('rangname', rangname, getComputedStyle(rangname).color, grundVon(rangname), 4.5);
    }
    for (const kreis of wurzel.querySelectorAll('.baum-knoten')) {
      const stil = getComputedStyle(kreis);
      if (stil.borderTopColor !== 'rgba(0, 0, 0, 0)' && stil.borderTopColor !== 'transparent') {
        schiebe('knotenrand', kreis, stil.borderTopColor, stil.backgroundColor, 3);
      }
      const zahl = kreis.querySelector('.zahl');
      if (zahl) {
        schiebe('knotenzahl', zahl, getComputedStyle(zahl).color, stil.backgroundColor, 4.5);
      }
      const haken = kreis.querySelector('[data-haken]');
      if (haken) {
        schiebe('haken', haken, getComputedStyle(haken).color, stil.backgroundColor, 3);
      }
      const titel = kreis.parentElement?.querySelector(':scope > span:last-child');
      if (titel) {
        schiebe('titel', titel, getComputedStyle(titel).color, grundVon(titel), 4.5);
      }
    }
    for (const text of wurzel.querySelectorAll('p, button, .rang-name')) {
      if (!(text instanceof HTMLElement) || text.closest('[data-rang]') || text.innerText.trim() === '') {
        continue;
      }
      schiebe('text', text, getComputedStyle(text).color, grundVon(text), 4.5);
    }
    const verlauf = [...wurzel.querySelectorAll('*')]
      .filter((element) => {
        if (element.closest('.balken, .mobilkopf, .mobilleiste, .seitenleiste')) {
          return false;
        }
        const stil = getComputedStyle(element);
        return stil.backgroundImage.includes('gradient') || stil.filter.includes('blur') || stil.backdropFilter.includes('blur');
      })
      .map((element) => String(element.className).slice(0, 80));
    return {
      paare,
      verlauf,
      balken: balken ? getComputedStyle(balken).backgroundColor : '',
      fortschritt: berechne('var(--fortschritt)'),
      ring: ringStrich ? getComputedStyle(ringStrich).stroke : '',
    };
  })()`;
}

async function bericht(seite: Page, wurzel: string): Promise<Bericht> {
  return seite.evaluate(berichtVon(wurzel));
}

function maengel(daten: Bericht): string[] {
  const liste: string[] = [];
  for (const paar of daten.paare) {
    if (paar.name === 'ring' || paar.name === 'balken') {
      continue;
    }
    const wert = kontrast(paar.vordergrund, paar.hintergrund);
    if (!Number.isFinite(wert) || wert < paar.mindest) {
      liste.push(`${paar.name} ${Number.isFinite(wert) ? wert.toFixed(2) : 'nan'} ${paar.vordergrund} auf ${paar.hintergrund}`);
    }
  }
  return liste;
}

test('Fähigkeit und Knoten halten den Kontrast in Hell und Dunkel', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await anmelden(page);
  const original = await lese(page);
  fs.mkdirSync('tmp-test/faehigkeit-farben', { recursive: true });
  const projekt = testInfo.project.name;

  try {
    for (const [schema, koerper] of [
      ['hell', HELL],
      ['dunkel', DUNKEL],
    ] as const) {
      await speichere(page, koerper);
      const kraft = await faehigkeit(page, 'Kraft');
      await page.goto(`/faehigkeiten/${kraft.id}`);
      await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
      await expect(page.locator('html')).toHaveAttribute('data-schema', schema === 'hell' ? 'light' : 'dark');
      await expect(page.locator('.baum-wurzel')).toBeVisible();
      await warteAufRuhe(page);
      await expect.poll(async () => maengel(await bericht(page, 'main')).join('\n')).toBe('');
      const form = await page.locator('.skill-ring').evaluate((element) => {
        const bogen = element.querySelector('.skill-ring-bogen');
        const balken = document.querySelector('.balken-fuellung');
        const probe = document.createElement('span');
        probe.style.backgroundColor = getComputedStyle(element).getPropertyValue('--skillfarbe');
        document.body.append(probe);
        const soll = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          breite: Math.round(element.getBoundingClientRect().width),
          verlauf: bogen ? getComputedStyle(bogen).backgroundImage.includes('gradient') : false,
          balken: balken ? getComputedStyle(balken).backgroundColor === soll : false,
          schein: document.querySelector('.glimm-fleck') !== null,
        };
      });
      expect(form.breite).toBe(76);
      expect(form.verlauf).toBe(true);
      expect(form.balken).toBe(true);
      expect(form.schein).toBe(true);
      expect(kontrast('#f87171', '#ffffff')).toBeLessThan(MINDEST_KONTRAST);
      await ohneSeitlichenUeberlauf(page);
      await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-s10-${schema}.png`, fullPage: true });

      await page.getByRole('button', { name: /Kniebeuge sauber/ }).click();
      const offen = page.getByRole('dialog', { name: 'Kniebeuge sauber', exact: true });
      await expect(offen).toBeVisible();
      await expect.poll(async () => maengel(await bericht(page, '[role="dialog"]')).join('\n')).toBe('');
      await offen.getByRole('button', { name: 'Schließen', exact: true }).click();

      const code = await faehigkeit(page, 'Programmieren');
      expect(code.knoten.some((knoten) => knoten.titel === 'Release bauen' && knoten.freigeschaltetAm === null)).toBe(true);
      await page.goto(`/faehigkeiten/${code.id}`);
      await expect(page.locator('.baum-wurzel')).toBeVisible();
      await page.getByRole('button', { name: /Release bauen/ }).click();
      const knoten = page.getByRole('dialog', { name: 'Release bauen', exact: true });
      await expect(knoten.getByRole('button', { name: /Freischalten/ })).toBeVisible();
      await warteAufRuhe(page);
      await expect.poll(async () => maengel(await bericht(page, '[role="dialog"]')).join('\n')).toBe('');
      await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-d17-${schema}.png`, fullPage: false });
      await knoten.getByRole('button', { name: 'Schließen', exact: true }).click();
    }

    const stamm = await faehigkeit(page, 'Programmieren');
    await speichere(page, { ...DUNKEL, glimmen: false });
    await page.goto(`/faehigkeiten/${stamm.id}`);
    await expect(page.locator('html')).toHaveAttribute('data-glimmen', 'aus');
    await expect(page.locator('.baum-frei').first()).toBeVisible();
    const ohneSchein = await page.locator('.baum-frei').first().evaluate((element) => {
      const stil = getComputedStyle(element);
      return { bild: stil.backgroundImage, schatten: stil.boxShadow };
    });
    expect(ohneSchein.bild).toContain('gradient');
    expect(ohneSchein.schatten).not.toContain('10px');
    await expect(page.locator('.glimm-fleck')).toBeVisible();
    const pulsAus = await page.locator('.baum-puls').first().evaluate((element) => getComputedStyle(element).filter);
    expect(pulsAus).toBe('none');
    const punktAus = page.locator('.skill-ring-punkt');
    if ((await punktAus.count()) > 0) {
      expect(await punktAus.first().evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none');
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await speichere(page, { ...DUNKEL, glimmen: true });
    await page.goto(`/faehigkeiten/${stamm.id}`);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glimm').trim()))
      .toBe('1');
    const pulsAn = await page.locator('.baum-puls').first().evaluate((element) => ({
      name: getComputedStyle(element).animationName,
      filter: getComputedStyle(element).filter,
    }));
    expect(pulsAn.name).toBe('none');
    expect(pulsAn.filter).not.toBe('none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    if (projekt === 'handy') {
      for (const stil of ['holo', 'antik'] as const) {
        await speichere(page, { stil, glimmen: true, farbenZuruecksetzen: true });
        await page.goto(`/faehigkeiten/${stamm.id}`);
        await expect(page.locator('html')).toHaveAttribute('data-stil', stil);
        await expect(page.locator('.baum-wurzel')).toBeVisible();
        await warteAufRuhe(page);
        await expect.poll(async () => maengel(await bericht(page, 'main')).join('\n')).toBe('');
        await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-s10-${stil}.png`, fullPage: false });
      }
    }
  } finally {
    await speichere(
      page,
      original.eigeneFarben
        ? {
            stil: original.stil,
            glimmen: original.glimmen,
            primaer: original.primaer,
            akzent: original.akzent,
            hintergrund: original.hintergrund,
          }
        : { stil: original.stil, glimmen: original.glimmen, farbenZuruecksetzen: true },
    );
  }
});
