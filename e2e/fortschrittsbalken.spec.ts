import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

interface Darstellung {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben?: boolean;
}

async function leseDarstellung(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      glimmen: daten.glimmen,
      eigeneFarben: daten.eigeneFarben,
    };
  });
}

async function speichereDarstellung(seite: Page, daten: Darstellung): Promise<void> {
  const ok = await seite.evaluate(async (körper) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        körper.eigeneFarben
          ? {
              stil: körper.stil,
              primaer: körper.primaer,
              akzent: körper.akzent,
              hintergrund: körper.hintergrund,
              glimmen: körper.glimmen,
            }
          : { stil: körper.stil, farbenZuruecksetzen: true, glimmen: körper.glimmen },
      ),
    });
    return antwort.ok;
  }, daten);
  expect(ok).toBe(true);
}

function koennenKarte(seite: Page) {
  return seite.locator('[data-werte="koennen"]');
}

async function stelleAnsicht(seite: Page, stil: string): Promise<void> {
  const ok = await seite.evaluate(async (ziel) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: ziel, glimmen: true, farbenZuruecksetzen: true }),
    });
    return antwort.ok;
  }, stil);
  expect(ok).toBe(true);
  await seite.goto('/');
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
  await expect(seite.locator('html')).toHaveAttribute('data-stil', stil);
  const werte = seite.getByRole('button', { name: /Werte/ });
  if ((await werte.getAttribute('aria-expanded')) !== 'true') {
    await werte.click();
  }
  await expect(koennenKarte(seite)).toBeVisible();
}

test('Fortschrittsbalken: Abschluss je Ansicht, 0 % leer, kurze Füllung nur Spitze', async ({ page }) => {
  await anmelden(page);
  const original = await leseDarstellung(page);
  try {
    await stelleAnsicht(page, 'holo');
    const holo = await koennenKarte(page).locator('.balken-fuellung').evaluateAll((knoten) =>
      knoten.map((knoten) => {
        const stil = getComputedStyle(knoten);
        const kasten = knoten.getBoundingClientRect();
        const mass = knoten.querySelector('.balken-mass');
        return {
          breite: kasten.width,
          bild: stil.backgroundImage,
          schatten: stil.boxShadow,
          leer: knoten.hasAttribute('data-leer'),
          mass: mass ? getComputedStyle(mass).display : 'fehlend',
          stilAttr: knoten.getAttribute('style') ?? '',
        };
      }),
    );
    const sichtbar = holo.filter((eintrag) => eintrag.breite > 1);
    const leer = holo.filter((eintrag) => eintrag.breite < 1);
    expect(sichtbar.length).toBeGreaterThan(0);
    expect(leer.length).toBeGreaterThan(0);
    for (const eintrag of sichtbar) {
      expect(eintrag.bild).toBe('linear-gradient(90deg, rgba(0, 0, 0, 0) 40%, rgba(255, 255, 255, 0.35))');
      expect(eintrag.schatten).toBe('color(srgb 0.243137 0.658824 1 / 0.55) 0px 0px 10px 0px');
      expect(eintrag.mass).toBe('none');
      expect(eintrag.leer).toBe(false);
      expect(eintrag.stilAttr).not.toContain('box-shadow');
    }
    for (const eintrag of leer) {
      expect(eintrag.schatten).toBe('none');
      expect(eintrag.bild).toBe('none');
      expect(eintrag.leer).toBe(true);
    }

    await stelleAnsicht(page, 'minimal');
    const schema = await page.locator('html').getAttribute('data-schema');
    const minimal = await koennenKarte(page).locator('.balken-fuellung').evaluateAll((knoten) =>
      knoten.filter((knoten) => knoten.getBoundingClientRect().width > 1).map((knoten) => {
        const spitze = knoten.querySelector('.balken-spitze');
        const verlauf = knoten.querySelector('.balken-verlauf');
        return {
          farbe: getComputedStyle(knoten).backgroundColor,
          schatten: getComputedStyle(knoten).boxShadow,
          spitze: spitze ? getComputedStyle(spitze).backgroundColor : '',
          verlauf: verlauf ? getComputedStyle(verlauf).backgroundImage : '',
        };
      }),
    );
    expect(minimal.length).toBeGreaterThan(1);
    expect(new Set(minimal.map((eintrag) => eintrag.schatten)).size).toBeGreaterThan(1);
    expect(new Set(minimal.map((eintrag) => eintrag.spitze)).size).toBeGreaterThan(1);
    expect(new Set(minimal.map((eintrag) => eintrag.verlauf)).size).toBeGreaterThan(1);
    for (const eintrag of minimal) {
      expect(eintrag.schatten).not.toBe('none');
      expect(eintrag.schatten).toContain(schema === 'light' ? '4px' : '6px');
      expect(eintrag.spitze).not.toBe('rgba(0, 0, 0, 0)');
      expect(eintrag.verlauf).toContain('24px');
    }

    await stelleAnsicht(page, 'antik');
    const antik = await koennenKarte(page).locator('.balken-fuellung').evaluateAll((knoten) =>
      knoten.filter((knoten) => knoten.getBoundingClientRect().width > 1).map((knoten) => getComputedStyle(knoten).boxShadow),
    );
    expect(new Set(antik).size).toBeGreaterThan(1);
    for (const schatten of antik) {
      expect(schatten).toContain('6px');
      expect(schatten).not.toContain('8px');
    }

    const proben = await page.evaluate(() => {
      const wurzel = document.body;
      function baue(breite: string, leer: boolean): { schatten: string; verlauf: string; spitzeRechts: number; spurRechts: number; spitzeAnzeige: string; mass: string } {
        const spur = document.createElement('div');
        spur.className = 'balken relative overflow-hidden rounded-full bg-flaeche-2 h-2';
        spur.style.width = '280px';
        const fuellung = document.createElement('div');
        fuellung.className = 'balken-fuellung relative h-full rounded-full';
        fuellung.style.width = breite;
        fuellung.style.backgroundColor = '#1d4ed8';
        fuellung.style.setProperty('--balken-farbe', '#1d4ed8');
        if (leer) {
          fuellung.setAttribute('data-leer', '');
        }
        const mass = document.createElement('span');
        mass.className = 'balken-mass';
        const verlauf = document.createElement('span');
        verlauf.className = 'balken-verlauf';
        const spitze = document.createElement('span');
        spitze.className = 'balken-spitze';
        mass.append(verlauf, spitze);
        fuellung.append(mass);
        spur.append(fuellung);
        wurzel.append(spur);
        const spurKasten = spur.getBoundingClientRect();
        const spitzeKasten = spitze.getBoundingClientRect();
        const ergebnis = {
          schatten: getComputedStyle(fuellung).boxShadow,
          verlauf: getComputedStyle(verlauf).display,
          spitzeRechts: spitzeKasten.right,
          spurRechts: spurKasten.right,
          spitzeAnzeige: getComputedStyle(spitze).display,
          mass: getComputedStyle(mass).display,
        };
        spur.remove();
        return ergebnis;
      }
      return { kurz: baue('16px', false), voll: baue('100%', false), nullBreite: baue('0px', true) };
    });
    expect(proben.kurz.verlauf).toBe('none');
    expect(proben.kurz.spitzeAnzeige).not.toBe('none');
    expect(proben.kurz.schatten).not.toBe('none');
    expect(proben.voll.spitzeRechts).toBeLessThanOrEqual(proben.voll.spurRechts + 0.5);
    expect(proben.voll.verlauf).not.toBe('none');
    expect(proben.nullBreite.schatten).toBe('none');
    expect(proben.nullBreite.mass).toBe('none');

    await page.emulateMedia({ forcedColors: 'active' });
    const gezwungen = await koennenKarte(page).locator('.balken-fuellung').first().evaluate((knoten) => {
      const mass = knoten.querySelector('.balken-mass');
      return {
        schatten: getComputedStyle(knoten).boxShadow,
        bild: getComputedStyle(knoten).backgroundImage,
        mass: mass ? getComputedStyle(mass).display : 'fehlend',
      };
    });
    expect(gezwungen.schatten).toBe('none');
    expect(gezwungen.bild).toBe('none');
    expect(gezwungen.mass).toBe('none');
  } finally {
    await page.emulateMedia({ forcedColors: 'none' });
    await speichereDarstellung(page, original);
  }
});
