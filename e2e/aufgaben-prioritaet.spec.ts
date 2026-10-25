import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte } from './aufgabenHelfer.ts';

type Farbart = 'rot' | 'orange' | 'blau' | 'neutral';

function kanaele(farbe: string): [number, number, number] {
  const rgb = farbe.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const srgb = farbe.match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);
  if (srgb) {
    return [Math.round(Number(srgb[1]) * 255), Math.round(Number(srgb[2]) * 255), Math.round(Number(srgb[3]) * 255)];
  }
  throw new Error(farbe);
}

function farbart(farbe: string): Farbart {
  const [r, g, b] = kanaele(farbe);
  const spanne = Math.max(r, g, b) - Math.min(r, g, b);
  if (spanne < 45) {
    return 'neutral';
  }
  if (b > r && b > g && b > 140) {
    return 'blau';
  }
  if (r > 180 && g > 80 && g < 200 && b < 90 && r > g) {
    return 'orange';
  }
  if (r > 160 && r > g + 30 && r > b + 30 && g < 150) {
    return 'rot';
  }
  return 'neutral';
}

async function stilFarbe(knoten: Locator, eigenschaft: 'color' | 'backgroundColor' | 'borderTopColor'): Promise<string> {
  return knoten.evaluate((element, name) => {
    element.style.transition = 'none';
    return getComputedStyle(element)[name];
  }, eigenschaft);
}

async function erwarteFarbe(
  knoten: Locator,
  eigenschaft: 'color' | 'backgroundColor' | 'borderTopColor',
  art: Farbart,
): Promise<void> {
  await expect.poll(async () => farbart(await stilFarbe(knoten, eigenschaft))).toBe(art);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Priorität farbig in Dialog, Liste und Heute', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/korrektur-k/${projekt}-${name}.png` });
  const namen = {
    1: `Bau Rot ${projekt}`,
    2: `Bau Orange ${projekt}`,
    3: `Bau Blau ${projekt}`,
    4: `Bau Ruhig ${projekt}`,
  } as const;

  await page.goto('/mehr/funktionen');
  await schalte(page, true);
  await raeumeBau(page);

  try {
    await page.goto('/aufgaben');
    await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(namen[1]);
    await dialog.getByRole('group', { name: 'Tätigkeit' }).getByRole('button').first().click();
    await dialog.getByRole('button', { name: 'Weiteres', exact: true }).click();
    const chips = [1, 2, 3, 4].map((wert) => dialog.getByRole('button', { name: `p${wert}`, exact: true }));
    for (const chip of chips) {
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
    }
    expect(farbart(await stilFarbe(chips[0].locator('.prio-punkt'), 'backgroundColor'))).toBe('rot');
    expect(farbart(await stilFarbe(chips[1].locator('.prio-punkt'), 'backgroundColor'))).toBe('orange');
    expect(farbart(await stilFarbe(chips[2].locator('.prio-punkt'), 'backgroundColor'))).toBe('blau');
    expect(farbart(await stilFarbe(chips[3].locator('.prio-punkt'), 'backgroundColor'))).toBe('neutral');
    await chips[0].scrollIntoViewIfNeeded();
    await bild('dialog-aus');

    await chips[0].click();
    await expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    await erwarteFarbe(chips[0], 'color', 'rot');
    await chips[1].click();
    await expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
    await erwarteFarbe(chips[1], 'color', 'orange');
    await chips[2].click();
    await erwarteFarbe(chips[2], 'color', 'blau');
    await chips[3].click();
    await expect(chips[2]).toHaveAttribute('aria-pressed', 'false');
    await erwarteFarbe(chips[3], 'color', 'neutral');
    await erwarteFarbe(chips[3].locator('.prio-punkt'), 'backgroundColor', 'neutral');
    expect(kanaele(await stilFarbe(chips[3].locator('.prio-punkt'), 'backgroundColor'))[0]).toBeGreaterThan(40);
    await chips[3].click();
    await expect(chips[3]).toHaveAttribute('aria-pressed', 'false');
    await chips[0].click();
    await chips[0].scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await dialog.screenshot({ path: `tmp-bau/korrektur-k/${projekt}-dialog-p1.png` });
    await bild('dialog-p1');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);

    const vorlagen = (await (await page.request.get('/api/vorlagen')).json()) as { id: number; archiviert: boolean }[];
    const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
    expect(vorlage).toBeTruthy();
    const heute = await heuteDerWelt(page);
    const basis = {
      icon: 'clipboard-list',
      projektId: null,
      organisationId: null,
      visionId: null,
      vorlageId: vorlage?.id,
      stunden: null,
      wiederholung: 'keine',
      wochentage: [],
      nurHeute: false,
      meilenstein: false,
      gegner: false,
      boss: false,
      deadline: null,
    };
    const zeiten = { 2: '06:15', 3: '06:30', 4: '06:45' } as const;
    for (const wert of [2, 3, 4] as const) {
      const angelegt = await page.request.post('/api/aufgaben', {
        data: { ...basis, name: namen[wert], faelligAm: heute, faelligUm: zeiten[wert], prioritaet: wert },
      });
      expect(angelegt.ok()).toBe(true);
    }
    const frueh = await page.request.patch(`/api/aufgaben/${await aufgabeId(page, namen[1])}`, {
      data: { ...basis, name: namen[1], faelligAm: heute, faelligUm: '06:00', prioritaet: 1 },
    });
    expect(frueh.ok()).toBe(true);

    await page.goto('/aufgaben');
    const erwartet: Record<number, Farbart> = { 1: 'rot', 2: 'orange', 3: 'blau', 4: 'neutral' };
    for (const wert of [1, 2, 3, 4] as const) {
      const zeile = page.getByRole('listitem').filter({ hasText: namen[wert] });
      await expect(zeile).toBeVisible();
      const marke = zeile.locator('span.prio-farbe').filter({ visible: true });
      await expect(marke).toHaveCount(1);
      await erwarteFarbe(marke, 'color', erwartet[wert]);
      await erwarteFarbe(zeile.locator('.aufgaben-kreis'), 'borderTopColor', erwartet[wert]);
    }
    await page.getByRole('listitem').filter({ hasText: namen[1] }).scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await page.goto('/');
    const heuteListe = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Heute', exact: true }) });
    await heuteListe.scrollIntoViewIfNeeded();
    for (const wert of [1, 2, 3, 4] as const) {
      const zeile = heuteListe.getByRole('listitem').filter({ hasText: namen[wert] });
      await expect(zeile).toBeVisible();
      await erwarteFarbe(zeile.locator('.aufgaben-kreis'), 'borderTopColor', erwartet[wert]);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('uebersicht');

    await page.goto('/mehr');
    await page.getByRole('button', { name: 'Version 3.7.1' }).click();
    await expect(page.getByLabel('Version 3.7.1')).toContainText('Priorität ist farbig');
    await expect(page.getByLabel('Version 3.7.1')).toContainText('Nur heute');
    await page.getByRole('button', { name: 'Version 3.7.1' }).scrollIntoViewIfNeeded();
    await bild('version');
  } finally {
    await raeumeBau(page);
  }
});

async function aufgabeId(page: Page, name: string): Promise<number> {
  const liste = (await (await page.request.get('/api/aufgaben')).json()) as { id: number; name: string }[];
  const fund = liste.find((eintrag) => eintrag.name === name);
  if (!fund) {
    throw new Error(name);
  }
  return fund.id;
}
