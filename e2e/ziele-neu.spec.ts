import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { kontrast } from '../shared/spiel/farben.ts';
import { anmelden } from './helfer.ts';

const TOLERANZ = 0.5;

/** Lage von Titel und Zurück in der 56 px hohen Kopfzeile bei 390 px. */
const VORHER = {
  zurueck: { x: 16, y: 4, breite: 48, hoehe: 48 },
  titel: { x: 64, y: 14 },
} as const;

interface Farben {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
}

interface Ort {
  name: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

interface KnopfMass {
  hoehe: number;
  radius: number;
  schrift: number;
  gewicht: string;
  knopf: string;
  leiste: string;
  plusBreite: number;
  plusHoehe: number;
  plusZuerst: boolean;
  buendig: number;
  zeilenHoehe: number;
  orte: Ort[];
}

function nahe(ist: number, soll: number, name: string): void {
  expect(Math.abs(ist - soll), `${name}: ${ist} statt ${soll}`).toBeLessThanOrEqual(TOLERANZ);
}

async function farben(seite: Page): Promise<Farben> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as Farben;
}

async function stelleFarben(seite: Page, daten: Farben, zurueck: boolean): Promise<void> {
  const koerper = zurueck
    ? { stil: daten.stil, glimmen: daten.glimmen, farbenZuruecksetzen: true }
    : {
        stil: daten.stil,
        primaer: daten.primaer,
        akzent: daten.akzent,
        hintergrund: daten.hintergrund,
        glimmen: daten.glimmen,
      };
  const antwort = await seite.request.patch('/api/einstellungen', { data: koerper });
  expect(antwort.ok()).toBe(true);
}

async function mass(seite: Page): Promise<KnopfMass> {
  return seite.locator('header.mobilkopf').evaluate((kopf) => {
    const leer: KnopfMass = {
      hoehe: 0,
      radius: 0,
      schrift: 0,
      gewicht: '',
      knopf: '',
      leiste: '',
      plusBreite: 0,
      plusHoehe: 0,
      plusZuerst: false,
      buendig: 99,
      zeilenHoehe: 0,
      orte: [],
    };
    const innen = kopf.querySelector(':scope > div');
    const knopf = kopf.querySelector('[data-kopf-aktion] button');
    const plus = knopf?.querySelector('svg');
    if (!innen || !knopf || !plus) {
      return leer;
    }
    const stil = getComputedStyle(knopf);
    const kasten = knopf.getBoundingClientRect();
    const plusKasten = plus.getBoundingClientRect();
    const innenKasten = innen.getBoundingClientRect();
    const polster = Number.parseFloat(getComputedStyle(innen).paddingRight);
    const orte: Ort[] = [];
    const merke = (name: string, element: Element) => {
      const box = element.getBoundingClientRect();
      orte.push({ name, x: box.x, y: box.y, breite: box.width, hoehe: box.height });
    };
    const zurueck = kopf.querySelector('[data-zurueck]');
    const titel = kopf.querySelector('h1');
    if (zurueck) {
      merke('zurueck', zurueck);
    }
    if (titel) {
      merke('titel', titel);
    }
    for (const kind of Array.from(innen.children)) {
      if (kind.hasAttribute('data-kopf-aktion')) {
        continue;
      }
      if ((zurueck && kind.contains(zurueck)) || (titel && kind.contains(titel))) {
        continue;
      }
      merke(kind.getAttribute('aria-label') ?? kind.tagName.toLowerCase(), kind);
    }
    return {
      hoehe: kasten.height,
      radius: Number.parseFloat(stil.borderTopLeftRadius),
      schrift: Number.parseFloat(stil.fontSize),
      gewicht: stil.fontWeight,
      knopf: stil.backgroundColor,
      leiste: getComputedStyle(kopf).backgroundColor,
      plusBreite: plusKasten.width,
      plusHoehe: plusKasten.height,
      plusZuerst: knopf.firstElementChild === plus,
      buendig: Math.abs(kasten.right - (innenKasten.right - polster)),
      zeilenHoehe: innenKasten.height,
      orte,
    };
  });
}

test('Neu auf Ziele ist ein gefüllter Knopf mit Plus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'handy', 'Die Maße gelten bei 390 px.');
  test.setTimeout(120_000);
  await anmelden(page);
  expect(page.viewportSize()?.width).toBe(390);
  const original = await farben(page);
  let farbenGeaendert = false;
  fs.mkdirSync('tmp-test/ziele-neu', { recursive: true });

  const pruefe = async () => {
    const stand = await mass(page);
    expect(stand.plusZuerst, 'Plus steht vor dem Text').toBe(true);
    expect(Math.abs(stand.hoehe - 36), `Höhe ${stand.hoehe}`).toBeLessThanOrEqual(1);
    expect(stand.radius, `Radius ${stand.radius}`).toBeGreaterThanOrEqual(18);
    expect(Math.abs(stand.schrift - 14), `Schrift ${stand.schrift}`).toBeLessThanOrEqual(TOLERANZ);
    expect(stand.gewicht).toBe('500');
    expect(Math.abs(stand.plusBreite - 16), `Plus-Breite ${stand.plusBreite}`).toBeLessThanOrEqual(TOLERANZ);
    expect(Math.abs(stand.plusHoehe - 16), `Plus-Höhe ${stand.plusHoehe}`).toBeLessThanOrEqual(TOLERANZ);
    expect(kontrast(stand.knopf, stand.leiste), `${stand.knopf} auf ${stand.leiste}`).toBeGreaterThanOrEqual(3);
    nahe(stand.zeilenHoehe, 56, 'Kopfzeile');
    nahe(stand.buendig, 0, 'rechte Kante an der Leiste');
    expect(stand.orte.map((ort) => ort.name), JSON.stringify(stand.orte)).toEqual(['zurueck', 'titel']);
    const zurueck = stand.orte[0];
    const titel = stand.orte[1];
    if (!zurueck || !titel) {
      return;
    }
    nahe(zurueck.x, VORHER.zurueck.x, 'Zurück x');
    nahe(zurueck.y, VORHER.zurueck.y, 'Zurück y');
    nahe(zurueck.breite, VORHER.zurueck.breite, 'Zurück Breite');
    nahe(zurueck.hoehe, VORHER.zurueck.hoehe, 'Zurück Höhe');
    nahe(titel.x, VORHER.titel.x, 'Titel x');
    nahe(titel.y, VORHER.titel.y, 'Titel y');
  };

  try {
    const aufnahme = async (name: string, breite: number, dunkel: boolean) => {
      await page.setViewportSize({ width: breite, height: 844 });
      await page.emulateMedia({ colorScheme: dunkel ? 'dark' : 'light' });
      if (original.eigeneFarben || original.stil !== 'standard') {
        await stelleFarben(page, { ...original, stil: 'standard' }, true);
        farbenGeaendert = true;
      }
      await page.goto('/ziele');
      await expect(page.locator('html')).toHaveAttribute('data-schema', dunkel ? 'dark' : 'light');
      await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      const knopf = page.locator('header.mobilkopf').getByRole('button', { name: 'Neu', exact: true });
      await expect(knopf).toBeVisible();
      await expect(knopf.locator('svg.lucide-plus')).toBeVisible();
      if (breite === 390) {
        await pruefe();
      }
      await page.screenshot({ path: `tmp-test/ziele-neu/${name}.png` });
      if (name === '390-hell') {
        await knopf.click();
        const menue = page.getByRole('menu', { name: 'Neu' });
        await expect(menue.getByRole('menuitem', { name: 'Vision', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menue).toBeHidden();
      }
    };
    await aufnahme('390-hell', 390, false);
    await aufnahme('390-dunkel', 390, true);
    await aufnahme('360-hell', 360, false);
    await aufnahme('360-dunkel', 360, true);
  } finally {
    if (farbenGeaendert) {
      await stelleFarben(page, original, !original.eigeneFarben);
    }
  }
});
