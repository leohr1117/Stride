import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { warteAufRuhe } from './pruefaufnahme.ts';

const HELL = { stil: 'standard', primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2', glimmen: true };
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414', glimmen: true };

interface FaehigkeitZeile {
  id: number;
  name: string;
  farbe: string;
  icon: string;
  knoten: { titel: string; freigeschaltetAm: string | null }[];
}

interface RingForm {
  breite: number;
  radius: number;
  strich: number;
  kappe: string;
  startX: number;
  startY: number;
  weiterX: number;
  anteil: number;
  offset: number;
  laenge: number;
  endeWinkel: number;
  klasse: string;
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

function winkelAbstand(gemessen: number, erwartet: number): number {
  const delta = Math.abs(gemessen - erwartet) % 360;
  return Math.min(delta, 360 - delta);
}

async function ringForm(seite: Page): Promise<RingForm> {
  return seite.locator('main svg[viewBox="0 0 100 100"]').evaluate((svg) => {
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error('Ring fehlt');
    }
    const kreise = [...svg.querySelectorAll('circle')];
    const spur = kreise[0];
    const bogen = kreise[1];
    if (!(spur instanceof SVGCircleElement) || !(bogen instanceof SVGCircleElement)) {
      throw new Error('Bogen fehlt');
    }
    const laenge = bogen.getTotalLength();
    const radius = Number(bogen.getAttribute('r'));
    const box = svg.getBoundingClientRect();
    const massstab = box.width / 100;
    const roh = bogen.getAttribute('stroke-dashoffset') ?? bogen.style.strokeDashoffset;
    const zahl = Number.parseFloat(roh);
    const offset = Number.isFinite(zahl) ? (zahl > laenge * 1.5 ? zahl / massstab : zahl) : Number.NaN;
    const ctm = bogen.getScreenCTM();
    if (!ctm) {
      throw new Error('Keine Bildmatrix');
    }
    const punkt = (strecke: number) => {
      const ort = bogen.getPointAtLength(strecke);
      const bild = new DOMPoint(ort.x, ort.y).matrixTransform(ctm);
      return { x: bild.x - (box.x + box.width / 2), y: bild.y - (box.y + box.height / 2) };
    };
    const start = punkt(0);
    const weiter = punkt(laenge * 0.08);
    const anteilText = svg.parentElement?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    const frei = Number(anteilText?.[1] ?? 0);
    const gesamt = Number(anteilText?.[2] ?? 0);
    const anteil = gesamt === 0 ? 0 : frei / gesamt;
    const ende = punkt(Math.min(laenge, Math.max(0, laenge - offset)));
    const endeWinkel = (Math.atan2(ende.x, -ende.y) * 180) / Math.PI;
    return {
      breite: box.width,
      radius,
      strich: Number(spur.getAttribute('stroke-width')),
      kappe: bogen.getAttribute('stroke-linecap') ?? '',
      startX: start.x,
      startY: start.y,
      weiterX: weiter.x,
      anteil,
      offset,
      laenge,
      endeWinkel: (endeWinkel + 360) % 360,
      klasse: svg.getAttribute('class') ?? '',
    };
  });
}

test('Der Fähigkeitsring beginnt oben und der Baum leuchtet', async ({ page }, testInfo) => {
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
      await expect(page.locator('.skill-ring')).toHaveCount(0);
      await warteAufRuhe(page);
      const form = await ringForm(page);
      expect(form.klasse).toContain('-rotate-90');
      expect(form.radius).toBe(44);
      expect(form.strich).toBe(7);
      expect(form.kappe).toBe('round');
      expect(form.breite).toBeGreaterThan(90);
      expect(form.breite).toBeLessThan(102);
      expect(Math.abs(form.startX)).toBeLessThan(4);
      expect(form.startY).toBeLessThan(-30);
      expect(form.weiterX).toBeGreaterThan(8);
      expect(Math.abs(form.offset - form.laenge * (1 - form.anteil))).toBeLessThan(2);
      if (form.anteil > 0) {
        const abstand = winkelAbstand(form.endeWinkel, form.anteil * 360);
        expect(abstand).toBeLessThan(12);
      }
      await expect(page.locator('.glimm-fleck')).toBeVisible();
      await expect(page.locator('.baum-frei').first()).toBeVisible();
      const schein = await page.locator('.baum-frei').first().evaluate((element) => getComputedStyle(element).boxShadow);
      expect(schein).toContain('10px');
      await ohneSeitlichenUeberlauf(page);
      await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-kraft-${schema}.png`, fullPage: true });

      await page.getByRole('button', { name: /Kniebeuge sauber/ }).click();
      const offen = page.getByRole('dialog', { name: 'Kniebeuge sauber', exact: true });
      await expect(offen).toBeVisible();
      await offen.getByRole('button', { name: 'Schließen', exact: true }).click();

      const code = await faehigkeit(page, 'Programmieren');
      expect(code.knoten.some((knoten) => knoten.titel === 'Release bauen' && knoten.freigeschaltetAm === null)).toBe(true);
      await page.goto(`/faehigkeiten/${code.id}`);
      await expect(page.locator('.baum-wurzel')).toBeVisible();
      await warteAufRuhe(page);
      const codeRing = await ringForm(page);
      expect(Math.abs(codeRing.startX)).toBeLessThan(4);
      expect(codeRing.startY).toBeLessThan(-30);
      expect(codeRing.weiterX).toBeGreaterThan(8);
      await page.getByRole('button', { name: /Release bauen/ }).click();
      const knoten = page.getByRole('dialog', { name: 'Release bauen', exact: true });
      await expect(knoten.getByRole('button', { name: /Freischalten/ })).toBeVisible();
      await warteAufRuhe(page);
      await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-programmieren-${schema}.png`, fullPage: false });
      await knoten.getByRole('button', { name: 'Schließen', exact: true }).click();
    }

    const stamm = await faehigkeit(page, 'Programmieren');
    await speichere(page, { ...DUNKEL, glimmen: false });
    await page.goto(`/faehigkeiten/${stamm.id}`);
    await expect(page.locator('html')).toHaveAttribute('data-glimmen', 'aus');
    await expect(page.locator('.baum-frei').first()).toBeVisible();
    const ohneSchein = await page.locator('.baum-frei').first().evaluate((element) => getComputedStyle(element).boxShadow);
    expect(ohneSchein).not.toContain('10px');
    const fleck = page.locator('.glimm-fleck');
    await expect(fleck).toHaveCount(1);
    expect(await fleck.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
    const pulsAus = await page.locator('.baum-puls').first().evaluate((element) => getComputedStyle(element).filter);
    expect(pulsAus).toBe('none');
    const leuchtenAus = await page.locator('.skill-leuchten').first().evaluate((element) => getComputedStyle(element).animationName);
    expect(leuchtenAus).toBe('none');

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
    expect(pulsAn.filter).toBe('none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    if (projekt === 'handy') {
      for (const stil of ['holo', 'antik'] as const) {
        await speichere(page, { stil, glimmen: true, farbenZuruecksetzen: true });
        await page.goto(`/faehigkeiten/${stamm.id}`);
        await expect(page.locator('html')).toHaveAttribute('data-stil', stil);
        await expect(page.locator('.baum-wurzel')).toBeVisible();
        await warteAufRuhe(page);
        const stilRing = await ringForm(page);
        expect(Math.abs(stilRing.startX)).toBeLessThan(4);
        expect(stilRing.startY).toBeLessThan(-30);
        await warteAufRuhe(page);
        await page.screenshot({ path: `tmp-test/faehigkeit-farben/${projekt}-programmieren-${stil}.png`, fullPage: false });
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
