import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ORIGINAL: string[] = ['/', '/laufend', '/chronik', '/mehr'];

async function leseLeiste(seite: Page): Promise<string[]> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { mobilLeiste: string[] };
  return daten.mobilLeiste;
}

async function setzeLeiste(seite: Page, pfade: string[]): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { mobilLeiste: pfade } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await setzeLeiste(page, ORIGINAL);
});

test('Untere Leiste: gespeicherte Plätze, Standard, Mehr fest, Profil wählbar', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/leiste/${testInfo.project.name}-${name}.png` });

  expect(await leseLeiste(page)).toEqual(ORIGINAL);

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await ohneSeitlichenUeberlauf(page);

  if (handy) {
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Heute', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Verlauf', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toHaveCount(0);
    await expect(leiste.getByRole('link', { name: 'Tätigkeiten', exact: true })).toHaveCount(0);

    const breiten = await leiste.locator('a').evaluateAll((liste) => liste.map((element) => element.getBoundingClientRect().width));
    expect(breiten).toHaveLength(4);
    expect(Math.max(...breiten) - Math.min(...breiten)).toBeLessThan(2);
    const treffer = await leiste.locator('a').first().evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      return { breite: kasten.width, hoehe: kasten.height };
    });
    expect(treffer.breite).toBeGreaterThanOrEqual(48);
    expect(treffer.hoehe).toBeGreaterThanOrEqual(48);

    const aktiv = leiste.locator('a[aria-current="page"]');
    await expect(aktiv).toHaveCSS('font-weight', '600');
    const strich = await aktiv.locator('svg').evaluate((element) => getComputedStyle(element).strokeWidth);
    expect(Number.parseFloat(strich)).toBeCloseTo(2.25, 1);
    await bild('uebersicht');
  }

  await page.goto('/mehr/darstellung/leiste');
  await expect(page.locator('main h1')).toHaveText('Leiste');
  if (!handy) {
    await expect(page.getByText('Gilt nur auf dem Handy.')).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'In der Leiste' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weitere Seiten' })).toBeVisible();
  const profilWahl = page.getByRole('button').filter({ hasText: 'Profil' }).filter({ hasText: 'Hinzufügen' });
  const taetigkeitenWahl = page.getByRole('button').filter({ hasText: 'Tätigkeiten' }).filter({ hasText: 'Hinzufügen' });
  await expect(page.getByRole('button', { name: 'Mehr entfernen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mehr nach oben' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mehr nach unten' })).toHaveCount(0);
  await expect(profilWahl).toBeVisible();
  await expect(taetigkeitenWahl).toBeVisible();
  await expect(profilWahl).toBeDisabled();
  await expect(profilWahl).toHaveAttribute('aria-disabled', 'true');
  await expect(taetigkeitenWahl).toHaveAttribute('aria-disabled', 'true');
  const sperrhinweis = page.getByText('Alle Plätze sind belegt.', { exact: true });
  await expect(sperrhinweis).toHaveCount(1);
  const weitereKopf = page.getByRole('heading', { name: 'Weitere Seiten' });
  const weitere = page.locator('section').filter({ has: weitereKopf });
  const form = await weitere.evaluate((abschnitt) => {
    const kopf = abschnitt.querySelector('h2');
    const hinweis = [...abschnitt.children].find(
      (kind) => kind instanceof HTMLElement && kind.tagName === 'P' && kind.textContent === 'Alle Plätze sind belegt.',
    );
    const knoepfe = [...abschnitt.querySelectorAll(':scope > button')];
    if (!(kopf instanceof HTMLElement) || !(hinweis instanceof HTMLElement) || knoepfe.length < 2) {
      return null;
    }
    const kopfKasten = kopf.getBoundingClientRect();
    const hinweisKasten = hinweis.getBoundingClientRect();
    const zeilen = knoepfe.map((knopf) => {
      const kasten = knopf.getBoundingClientRect();
      const kinder = [...knopf.children].filter((kind) => kind instanceof HTMLElement);
      const symbol = kinder[0] ?? null;
      const name = kinder[1] ?? null;
      const aktion = kinder[2] ?? null;
      const symbolKasten = symbol?.getBoundingClientRect() ?? null;
      const nameKasten = name?.getBoundingClientRect() ?? null;
      const aktionKasten = aktion?.getBoundingClientRect() ?? null;
      const mitte = (kasten: DOMRect) => kasten.top + kasten.height / 2;
      return {
        hoehe: kasten.height,
        links: kasten.left,
        rechts: kasten.right,
        oben: kasten.top,
        unten: kasten.bottom,
        mitte: mitte(kasten),
        kinder: kinder.length,
        symbolLinks: symbolKasten?.left ?? null,
        symbolRechts: symbolKasten?.right ?? null,
        symbolMitte: symbolKasten ? mitte(symbolKasten) : null,
        nameLinks: nameKasten?.left ?? null,
        nameRechts: nameKasten?.right ?? null,
        nameMitte: nameKasten ? mitte(nameKasten) : null,
        aktionLinks: aktionKasten?.left ?? null,
        aktionRechts: aktionKasten?.right ?? null,
        aktionMitte: aktionKasten ? mitte(aktionKasten) : null,
        aktionText: aktion?.textContent ?? '',
        hatHinweis: (knopf.textContent ?? '').includes('Alle Plätze sind belegt.'),
        hatSymbol: symbol?.querySelector('svg') instanceof SVGElement,
      };
    });
    return {
      kopfUnten: kopfKasten.bottom,
      hinweisOben: hinweisKasten.top,
      hinweisUnten: hinweisKasten.bottom,
      hinweisHoehe: hinweisKasten.height,
      hinweisLinks: hinweisKasten.left,
      kopfLinks: kopfKasten.left,
      zeilen,
    };
  });
  expect(form).not.toBeNull();
  if (!form) {
    throw new Error('Weitere Seiten fehlt');
  }
  expect(form.hinweisOben).toBeGreaterThanOrEqual(form.kopfUnten - 1);
  expect(form.hinweisHoehe).toBeGreaterThan(0);
  expect(form.hinweisHoehe).toBeLessThanOrEqual(24);
  expect(Math.abs(form.hinweisLinks - form.kopfLinks)).toBeLessThanOrEqual(1);
  expect(form.zeilen[0]?.oben ?? 0).toBeGreaterThanOrEqual(form.hinweisUnten - 1);
  for (let index = 0; index < form.zeilen.length; index += 1) {
    const zeile = form.zeilen[index];
    if (!zeile) {
      throw new Error('Zeile fehlt');
    }
    expect(Math.abs(zeile.hoehe - 48)).toBeLessThanOrEqual(1);
    expect(zeile.hatHinweis).toBe(false);
    expect(zeile.kinder).toBe(3);
    expect(zeile.hatSymbol).toBe(true);
    expect(zeile.aktionText).toBe('Hinzufügen');
    expect(zeile.symbolLinks).not.toBeNull();
    expect(zeile.nameLinks).not.toBeNull();
    expect(zeile.nameRechts).not.toBeNull();
    expect(zeile.aktionLinks).not.toBeNull();
    expect(zeile.aktionRechts).not.toBeNull();
    expect(zeile.symbolMitte).not.toBeNull();
    expect(zeile.nameMitte).not.toBeNull();
    expect(zeile.aktionMitte).not.toBeNull();
    expect(zeile.symbolLinks ?? 0).toBeGreaterThanOrEqual(zeile.links - 1);
    expect(zeile.symbolRechts ?? 0).toBeLessThanOrEqual(zeile.nameLinks ?? 0);
    expect(zeile.nameLinks ?? 0).toBeLessThan(zeile.aktionLinks ?? 0);
    expect(zeile.nameRechts ?? 0).toBeLessThanOrEqual(zeile.aktionLinks ?? 0);
    expect(zeile.aktionRechts ?? 0).toBeLessThanOrEqual(zeile.rechts + 1);
    expect(Math.abs((zeile.symbolMitte ?? 0) - zeile.mitte)).toBeLessThanOrEqual(1);
    expect(Math.abs((zeile.nameMitte ?? 0) - (zeile.aktionMitte ?? 0))).toBeLessThanOrEqual(2);
    const davor = form.zeilen[index - 1];
    if (davor) {
      expect(zeile.oben).toBeGreaterThanOrEqual(davor.unten - 1);
      expect(Math.abs(zeile.links - davor.links)).toBeLessThanOrEqual(1);
      expect(Math.abs(zeile.rechts - davor.rechts)).toBeLessThanOrEqual(1);
    }
  }
  await ohneSeitlichenUeberlauf(page);
  if (handy) {
    const ursprung = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await bild('sperrhinweis');
    if (ursprung) {
      await page.setViewportSize(ursprung);
    }
  }
  await bild('editor');

  const entfernt = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('button', { name: 'Laufend entfernen' }).click();
  await entfernt;
  await expect(profilWahl).toBeEnabled();
  await expect(page.getByText('Alle Plätze sind belegt.', { exact: true })).toHaveCount(0);
  await expect(profilWahl).not.toHaveAttribute('aria-disabled', 'true');
  const profil = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await profilWahl.click();
  await profil;
  expect(await leseLeiste(page)).toEqual(['/', '/chronik', '/charakter', '/mehr']);

  if (handy) {
    await page.goto('/');
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Profil', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toHaveCount(0);
    await bild('mit-profil');
    await page.goto('/mehr/darstellung/leiste');
  }

  const standard = page.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await page.getByRole('button', { name: 'Standard' }).click();
  await standard;
  expect(await leseLeiste(page)).toEqual(['/', '/ziele', '/chronik', '/mehr']);

  if (handy) {
    await page.goto('/');
    const leiste = page.locator('nav.mobilleiste');
    await expect(leiste.getByRole('link', { name: 'Heute', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Ziele' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Verlauf', exact: true })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Mehr' })).toBeVisible();
    await expect(leiste.getByRole('link', { name: 'Laufend' })).toHaveCount(0);
    await bild('standard');
  }
});
