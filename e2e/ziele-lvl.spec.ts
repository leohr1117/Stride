import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

const VISION = 'Freistehend';
const LEVEL = 4242;

interface LvlKante {
  text: string;
  rechts: number;
  vision: boolean;
  projekt: boolean;
  listeOhneMenue: boolean;
}

interface Farben {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
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

async function lvlKanten(seite: Page): Promise<LvlKante[]> {
  return seite.locator('main [data-zeile-wert]').evaluateAll((knoten) =>
    knoten.flatMap((knoten) => {
      const text = (knoten.textContent ?? '').trim();
      if (!/^Lvl \d+$/.test(text)) {
        return [];
      }
      const kasten = knoten.getBoundingClientRect();
      if (kasten.width < 1 || kasten.height < 1) {
        return [];
      }
      const zeile = knoten.closest('[data-zeile]');
      const liste = zeile?.closest('.liste') ?? null;
      return [
        {
          text,
          rechts: kasten.right,
          vision: Boolean(zeile?.querySelector('h2')),
          projekt: Boolean(zeile?.querySelector('a[href^="/projekte/"]')),
          listeOhneMenue: !liste?.querySelector('.zeile-menue > button'),
        },
      ];
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Die rechte Kante aller Level auf Ziele liegt auf einer Linie', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const original = await farben(page);
  let visionId: number | null = null;
  let farbenGeaendert = false;
  try {
    const angelegt = await page.request.post('/api/visionen', {
      data: {
        titel: VISION,
        beschreibung: '',
        farbe: '#cc3366',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: LEVEL,
      },
    });
    expect(angelegt.ok()).toBe(true);
    visionId = ((await angelegt.json()) as { id: number }).id;

    await page.goto('/ziele');
    await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();
    const kopf = page.getByRole('heading', { name: VISION, level: 2 });
    const abschnitt = page.locator('section').filter({ has: kopf });
    await expect(abschnitt).toHaveCount(1);
    await expect(abschnitt.locator('a[href^="/projekte/"]')).toHaveCount(0);
    await expect(page.locator('section').filter({ has: page.locator('a[href^="/projekte/"]') }).first()).toBeVisible();

    if (testInfo.project.name === 'handy') {
      expect(page.viewportSize()?.width).toBe(390);
    }
    const kanten = await lvlKanten(page);
    expect(kanten.some((kante) => kante.text === `Lvl ${LEVEL}` && kante.vision && kante.listeOhneMenue)).toBe(true);
    expect(kanten.some((kante) => kante.vision && !kante.listeOhneMenue)).toBe(true);
    expect(kanten.some((kante) => kante.projekt)).toBe(true);
    const rechte = kanten.map((kante) => kante.rechts);
    const spanne = Math.max(...rechte) - Math.min(...rechte);
    expect(spanne, kanten.map((kante) => `${kante.text} ${kante.rechts.toFixed(2)}`).join(', ')).toBeLessThanOrEqual(0.5);

    if (testInfo.project.name === 'handy') {
      fs.mkdirSync('tmp-test/ziele-lvl', { recursive: true });
      const aufnahme = async (name: string, breite: number, dunkel: boolean) => {
        await page.setViewportSize({ width: breite, height: 844 });
        await page.emulateMedia({ colorScheme: dunkel ? 'dark' : 'light' });
        if (original.eigeneFarben || original.stil !== 'standard') {
          await stelleFarben(page, { ...original, stil: 'standard' }, true);
          farbenGeaendert = true;
        }
        await page.goto('/ziele');
        await expect(page.locator('html')).toHaveAttribute('data-schema', dunkel ? 'dark' : 'light');
        await expect(page.getByRole('heading', { name: VISION, level: 2 })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `tmp-test/ziele-lvl/${name}-oben.png` });
        const ziel = page.getByRole('heading', { name: VISION, level: 2 });
        await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await page.screenshot({ path: `tmp-test/ziele-lvl/${name}-vision.png` });
      };
      await aufnahme('390-hell', 390, false);
      await aufnahme('390-dunkel', 390, true);
      await aufnahme('360-hell', 360, false);
      await aufnahme('360-dunkel', 360, true);
    }
  } finally {
    if (visionId !== null) {
      await page.request.delete(`/api/visionen/${visionId}`);
    }
    if (farbenGeaendert) {
      await stelleFarben(page, original, !original.eigeneFarben);
    }
  }
});
