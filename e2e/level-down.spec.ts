import { expect, test, type Page } from './uhr.ts';
import { anmelden } from './helfer.ts';
import { levelWeg, levelWegStrich } from '../shared/spiel/effekte.ts';

test.use({ uhrLaeuft: true });

type Stufe = 'voll' | 'reduziert' | 'aus';
type Bewegung = 'reduce' | 'no-preference';

type Ziel = {
  level: number;
  fortschritt: number;
  attribut: number;
};

test('Level geht grau zurück und zeigt den Weg nach oben', async ({ page }) => {
  test.setTimeout(120_000);
  await anmelden(page);
  const effektAntwort = await page.request.get('/api/einstellungen');
  expect(effektAntwort.ok()).toBe(true);
  const effektDaten = (await effektAntwort.json()) as { effekte?: string };
  const effektVorher = effektDaten.effekte === 'reduziert' || effektDaten.effekte === 'aus' ? effektDaten.effekte : 'voll';
  let ziel: Ziel = { level: 6, fortschritt: 0.5, attribut: 4 };

  await page.route('**/api/uebersicht', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/uebersicht') {
      await route.continue();
      return;
    }
    const antwort = await route.fetch();
    const daten = (await antwort.json()) as {
      level?: { level: number; fortschritt: number };
      attribute?: { level?: { level: number } }[];
    };
    if (daten.level) {
      daten.level.level = ziel.level;
      daten.level.fortschritt = ziel.fortschritt;
    }
    const erstes = daten.attribute?.[0];
    if (erstes?.level) {
      erstes.level.level = ziel.attribut;
    }
    await route.fulfill({
      status: antwort.status(),
      contentType: 'application/json',
      body: JSON.stringify(daten),
    });
  });

  const zeig = async (stand: Ziel, stufe: Stufe, bewegung: Bewegung) => {
    ziel = stand;
    await page.emulateMedia({ reducedMotion: bewegung });
    await setzeEffekte(page, stufe);
    await page.evaluate(() => {
      localStorage.setItem('stride.eingeklappt.uebersicht-werte', '0');
    });
    await page.reload();
    await expect.poll(async () => ringZahl(page)).toBe(String(stand.level));
    await expect(page.locator('[data-level-abstieg]')).toHaveCount(0);
    await expect(page.locator('[data-level-weg]')).toHaveCount(0);
  };

  // staleTime in client/src/main.tsx ist 30s. Die Testuhr geht nicht von allein weiter.
  // Vorspulen, solange der Stand noch der alte ist. Danach nicht noch einmal, der Moment endet nach 2s.
  const senke = async (nach: Ziel) => {
    await page.clock.fastForward(31_000);
    ziel = nach;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
  };

  try {
    await zeig({ level: 6, fortschritt: 0.5, attribut: 4 }, 'voll', 'no-preference');
    await senke({ level: 5, fortschritt: 0.25, attribut: 3 });
    await expect.poll(async () => ringZahl(page)).toBe('5');
    const ring = page.locator('main [data-levelring]').first();
    const zahl = ring.locator('[data-level-abstieg]');
    await expect(zahl).toHaveCount(1);
    await expect(zahl).toHaveText('5');
    const bewegung = await zahl.evaluate((element) => {
      const stil = getComputedStyle(element);
      return {
        name: stil.animationName.replaceAll('"', ''),
        dauer: stil.animationDuration,
        wiederholung: stil.animationIterationCount,
        takt: stil.animationTimingFunction,
        lage: stil.position,
      };
    });
    expect(bewegung.name).toBe('level-zurueck');
    expect(bewegung.dauer === '0.8s' || bewegung.dauer === '800ms').toBe(true);
    expect(bewegung.wiederholung).toBe('1');
    expect(bewegung.takt === 'ease-out' || bewegung.takt.startsWith('cubic-bezier')).toBe(true);
    expect(bewegung.lage).not.toBe('fixed');
    const rahmen = await keyframes(page);
    expect(rahmen).toContain('@keyframes level-zurueck');
    expect(rahmen).toContain('translateY(-0.28em)');
    expect(rahmen).toMatch(/translateY\(0(px)?\)/);

    const wegErwartet = levelWeg(0.25);
    const strich = wegErwartet ? levelWegStrich(wegErwartet, 42) : null;
    expect(strich?.drehung).toBe(0);
    const kreis = ring.locator('[data-level-weg] circle');
    await expect(kreis).toHaveAttribute('data-level-weg-start', '90');
    await expect(kreis).toHaveAttribute('data-level-weg-ende', '360');
    await expect(kreis).toHaveAttribute('fill', 'none');
    await expect(kreis).toHaveAttribute('stroke', 'var(--leise)');
    await expect(kreis).toHaveAttribute('stroke-linecap', 'butt');
    await expect(kreis).toHaveAttribute('transform', 'rotate(0 50 50)');
    const dash = await kreis.getAttribute('stroke-dasharray');
    const teile = (dash ?? '').split(/[\s,]+/).map(Number);
    expect(teile.length).toBeGreaterThanOrEqual(2);
    expect(teile[0] ?? 0).toBeGreaterThan(teile[1] ?? 0);

    const farben = await farbvergleich(page);
    expect(farben.zahl).toBe(farben.leise);
    expect(farben.zahl).not.toBe(farben.gefahr);
    expect(farben.pfeil).toBe(farben.leise);
    expect(farben.pfeil).not.toBe(farben.gefahr);

    const pfeil = page.locator('[data-attribut] [data-level-weg]');
    await expect(pfeil).toHaveCount(1);
    await expect(pfeil).toHaveAttribute('aria-label', 'Zurück nach oben');
    await expect(page.locator('[data-attribut] [data-level-abstieg]')).toHaveCount(1);
    await expect(page.locator('[data-attribut] [data-level-abstieg]')).toContainText('Lvl 3');
    const lage = await effektLage(page);
    expect(lage.ringFest).toBe(false);
    expect(lage.wegFest).toBe(false);
    expect(lage.pfeilFest).toBe(false);
    expect(lage.ringOben).toBe(true);
    expect(lage.ringUeberdeckt).toBe(false);
    expect(lage.pfeilUeberdeckt).toBe(false);
    expect(lage.partikel).toBe(0);

    await zeig({ level: 6, fortschritt: 0.5, attribut: 4 }, 'reduziert', 'reduce');
    await senke({ level: 5, fortschritt: 0.25, attribut: 3 });
    await expect.poll(async () => ringZahl(page)).toBe('5');
    const ruhig = page.locator('main [data-levelring] [data-level-abstieg]');
    await expect(ruhig).toHaveCount(1);
    const ruhigName = await ruhig.evaluate((element) => getComputedStyle(element).animationName.replaceAll('"', ''));
    expect(ruhigName).toBe('none');
    await expect(page.locator('main [data-levelring] [data-level-weg]')).toHaveCount(1);
    const ruhigFarbe = await farbvergleich(page);
    expect(ruhigFarbe.zahl).toBe(ruhigFarbe.leise);
    expect(ruhigFarbe.zahl).not.toBe(ruhigFarbe.gefahr);
    expect(await effektLage(page)).toMatchObject({ partikel: 0, ringUeberdeckt: false });

    await zeig({ level: 6, fortschritt: 0.5, attribut: 4 }, 'aus', 'no-preference');
    await senke({ level: 5, fortschritt: 0.25, attribut: 3 });
    await bleibtStill(page, '5');
  } finally {
    await page.unroute('**/api/uebersicht').catch(() => undefined);
    await page.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => undefined);
    await setzeEffekte(page, effektVorher).catch(() => undefined);
  }
});

async function setzeEffekte(seite: Page, stufe: Stufe): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { effekte: stufe } });
  expect(antwort.ok()).toBe(true);
  await seite.evaluate((wert) => {
    localStorage.setItem('stride.effekte', wert);
  }, stufe);
}

async function ringZahl(seite: Page): Promise<string> {
  const text = await seite.locator('main [data-levelring]').first().locator('.zahl').innerText();
  return text.replace(/\s+/g, '');
}

async function bleibtStill(seite: Page, zahl: string): Promise<void> {
  let gesehen = 0;
  await expect
    .poll(
      async () => {
        const steht = (await ringZahl(seite)) === zahl;
        const marken = await seite.locator('[data-level-abstieg], [data-level-weg]').count();
        if (steht && marken === 0) {
          gesehen += 1;
        } else {
          gesehen = 0;
        }
        return gesehen;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(4);
}

async function keyframes(seite: Page): Promise<string> {
  return seite.evaluate(async () => {
    const teile: string[] = [];
    for (const blatt of document.styleSheets) {
      try {
        teile.push([...blatt.cssRules].map((regel) => regel.cssText).join('\n'));
      } catch {
        if (blatt.href) {
          const antwort = await fetch(blatt.href);
          if (antwort.ok) {
            teile.push(await antwort.text());
          }
        }
      }
    }
    return teile.join('\n');
  });
}

async function farbvergleich(seite: Page): Promise<{ zahl: string; pfeil: string; leise: string; gefahr: string }> {
  return seite.evaluate(() => {
    const lies = (selektor: string) => {
      const element = document.querySelector(selektor);
      return element ? getComputedStyle(element).color : '';
    };
    const probe = (token: string) => {
      const element = document.createElement('span');
      element.style.color = token;
      document.body.appendChild(element);
      const farbe = getComputedStyle(element).color;
      element.remove();
      return farbe;
    };
    return {
      zahl: lies('main [data-levelring] [data-level-abstieg]'),
      pfeil: lies('[data-attribut] [data-level-weg]'),
      leise: probe('var(--leise)'),
      gefahr: probe('var(--gefahr)'),
    };
  });
}

async function effektLage(seite: Page): Promise<{
  ringFest: boolean;
  wegFest: boolean;
  pfeilFest: boolean;
  ringOben: boolean;
  ringUeberdeckt: boolean;
  pfeilUeberdeckt: boolean;
  partikel: number;
}> {
  return seite.evaluate(() => {
    const kasten = (element: Element | null) => element?.getBoundingClientRect() ?? null;
    const fest = (element: Element | null) => (element ? getComputedStyle(element).position === 'fixed' : false);
    const snack = document.querySelector('[data-snackbar]')?.getBoundingClientRect() ?? null;
    const schneidet = (bereich: DOMRect | null) =>
      Boolean(
        bereich &&
          snack &&
          bereich.bottom > snack.top &&
          bereich.top < snack.bottom &&
          bereich.right > snack.left &&
          bereich.left < snack.right,
      );
    const ring = document.querySelector('main [data-levelring] [data-level-abstieg]');
    const weg = document.querySelector('main [data-levelring] [data-level-weg]');
    const pfeil = document.querySelector('[data-attribut] [data-level-weg]');
    const ringBereich = kasten(ring);
    const wurzel = document.querySelector('main [data-levelring]');
    const zeile = document.querySelector('[data-attribut] [data-level-abstieg]');
    const partikel =
      (wurzel?.querySelectorAll('canvas, [data-partikel], [data-konfetti]').length ?? 0) +
      (zeile?.querySelectorAll('canvas, [data-partikel], [data-konfetti]').length ?? 0);
    return {
      ringFest: fest(ring),
      wegFest: fest(weg),
      pfeilFest: fest(pfeil),
      ringOben: Boolean(ringBereich && ringBereich.bottom < window.innerHeight - 120),
      ringUeberdeckt: schneidet(ringBereich),
      pfeilUeberdeckt: schneidet(kasten(pfeil)),
      partikel,
    };
  });
}
