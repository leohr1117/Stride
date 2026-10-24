import { expect, test } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte } from './aufgabenHelfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Schalter Aufgaben sitzt hinter Basis und blendet die Navigation', async ({ page }, testInfo) => {
  const breit = testInfo.project.name === 'desktop';
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-bau/aufgaben-schalter/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr/funktionen');
  const zeile = page.locator('#funktion-aufgaben');
  const schalter = zeile.getByRole('switch', { name: 'Aufgaben', exact: true });
  await expect(schalter).toBeVisible();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');

  const reihenfolge = await page.locator('[id^="funktion-"]').evaluateAll((knoten) => knoten.map((knoten) => knoten.id));
  const basis = reihenfolge.indexOf('funktion-basis');
  expect(reihenfolge[basis + 1]).toBe('funktion-aufgaben');

  const lage = await zeile.locator('button[aria-label="Info"]').evaluate((knopf) => {
    const kasten = knopf.getBoundingClientRect();
    const huelle = knopf.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : 0;
    const titel = knopf.closest('#funktion-aufgaben')?.querySelector('.text-sm');
    const titelKasten = titel?.getBoundingClientRect();
    const delta = titelKasten ? kasten.top + kasten.height / 2 - (titelKasten.top + titelKasten.height / 2) : null;
    return { abstand, delta };
  });
  expect(lage.abstand).toBeGreaterThanOrEqual(5);
  expect(lage.abstand).toBeLessThanOrEqual(8);
  expect(Math.abs(lage.delta ?? 99)).toBeLessThanOrEqual(4);

  const seitenleiste = page.locator('aside.seitenleiste nav');
  const leiste = page.locator('nav.mobilleiste');
  if (breit) {
    await expect(seitenleiste.getByRole('link', { name: 'Aufgaben', exact: true })).toHaveCount(0);
    await expect(seitenleiste.getByRole('link', { name: 'Basis', exact: true })).toBeVisible();
  } else {
    await expect(leiste.getByRole('link', { name: 'Aufgaben', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('aus');

  await zeile.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toHaveText('Eine Erledigung wird ein Eintrag.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await schalte(page, true);
  await expect(schalter).toHaveAttribute('aria-checked', 'true');

  if (breit) {
    const link = seitenleiste.getByRole('link', { name: 'Aufgaben', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/aufgaben');
    const texte = (await seitenleiste.locator('a').allInnerTexts()).map((text) => text.trim());
    const basisIndex = texte.indexOf('Basis');
    expect(texte[basisIndex + 1]).toBe('Aufgaben');
  } else {
    await expect(leiste.getByRole('link', { name: 'Aufgaben', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('an');

  if (!breit) {
    await page.goto('/mehr');
    const sprung = page.getByRole('link', { name: 'Aufgaben', exact: true });
    await expect(sprung).toBeVisible();
    await expect(sprung).toHaveAttribute('href', '/aufgaben');
    await expect(leiste.getByRole('link', { name: 'Aufgaben', exact: true })).toHaveCount(0);
  }
});

test('Aufgaben: Kreis, Dialog und Heute', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const breit = projekt === 'desktop';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/aufgaben-16/${projekt}-${name}.png` });
  const name = `Bau ${projekt} ${Date.now()}`;

  await page.goto('/mehr/funktionen');
  await schalte(page, true);
  await raeumeBau(page);

  try {
    await page.goto('/aufgaben');
    await expect(page.getByRole('heading', { name: 'Aufgaben', exact: true })).toBeVisible();
    await expect(page.locator('[data-zurueck]')).toHaveCount(0);
    await expect(page.getByText('Noch keine Aufgaben.')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('leer');

    await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Neue Aufgabe' })).toBeVisible();
    await expect(dialog.getByText('Weiteres', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Uhrzeit')).toBeVisible();
    await expect(dialog.getByText('Priorität', { exact: true })).toHaveCount(0);
    await expect(dialog.locator('input[placeholder="Optional"]')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Einmal', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Täglich', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Wöchentlich', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Monatlich', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await page.waitForTimeout(250);
    await bild('dialog');

    const chip = dialog.getByRole('group', { name: 'Tätigkeit' }).getByRole('button').first();
    await expect(chip).toBeVisible();
    const taetigkeit = (await chip.innerText()).trim();
    expect(taetigkeit.length).toBeGreaterThan(0);
    await dialog.getByLabel('Name').fill(name);
    await chip.click();
    await dialog.locator('input[type="date"]').fill(await heuteDerWelt(page));
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);

    const zeile = page.getByRole('listitem').filter({ hasText: name });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText(taetigkeit);
    await expect(zeile.getByRole('button', { name: 'Archivieren' })).toHaveCount(0);
    await expect(zeile.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
    const kreis = await zeile.locator('.aufgaben-kreis').boundingBox();
    const nameKasten = await zeile.getByRole('button', { name, exact: true }).boundingBox();
    expect(kreis && nameKasten && kreis.x < nameKasten.x).toBe(true);
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await zeile.getByRole('button', { name, exact: true }).click();
    const bearbeiten = page.getByRole('dialog');
    await expect(bearbeiten.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();
    await expect(bearbeiten.getByRole('button', { name: 'Löschen' })).toBeVisible();
    await expect(bearbeiten.getByRole('button', { name: 'Archivieren' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(bearbeiten).toHaveCount(0);

    await page.goto('/');
    const heuteZeile = page.getByRole('listitem').filter({ hasText: name });
    await heuteZeile.scrollIntoViewIfNeeded();
    await expect(heuteZeile.getByRole('button', { name: 'Erledigt', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('uebersicht');
    await heuteZeile.getByRole('button', { name: 'Erledigt', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(heuteZeile.getByRole('button', { name: 'Rückgängig', exact: true })).toBeVisible();
    await heuteZeile.getByRole('button', { name, exact: true }).click();
    const nachErledigt = page.getByRole('dialog');
    await expect(nachErledigt.getByRole('button', { name: 'Archivieren' })).toBeVisible();
    await expect(nachErledigt.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(nachErledigt).toHaveCount(0);
    await heuteZeile.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(heuteZeile.getByRole('button', { name: 'Erledigt', exact: true })).toBeVisible();

    const vorlagenAntwort = await page.request.get('/api/vorlagen');
    expect(vorlagenAntwort.ok()).toBe(true);
    const vorlagen = (await vorlagenAntwort.json()) as { id: number; name: string; archiviert: boolean }[];
    const vorlage = vorlagen.find((eintrag) => eintrag.name === taetigkeit && !eintrag.archiviert);
    expect(vorlage).toBeTruthy();
    const heute = await heuteDerWelt(page);
    for (let index = 1; index <= 5; index += 1) {
      const angelegt = await page.request.post('/api/aufgaben', {
        data: {
          name: `Bau ${projekt} ${Date.now()} ${index}`,
          icon: 'clipboard-list',
          projektId: null,
          organisationId: null,
          visionId: null,
          vorlageId: vorlage?.id,
          stunden: null,
          faelligAm: heute,
          faelligUm: null,
          wiederholung: 'keine',
          wochentage: [],
          prioritaet: null,
          nurHeute: false,
          meilenstein: false,
          gegner: false,
          boss: false,
          deadline: null,
        },
      });
      expect(angelegt.ok()).toBe(true);
    }

    await page.goto('/');
    const alle = page.getByRole('link', { name: 'Alle', exact: true });
    await alle.scrollIntoViewIfNeeded();
    await bild('alle');
    await alle.click();
    await expect(page).toHaveURL('/aufgaben');
    const zurueck = page.locator('[data-zurueck]');
    await expect(zurueck).toBeVisible();
    await expect(zurueck).toHaveText('Übersicht');
    await ohneSeitlichenUeberlauf(page);

    if (breit) {
      const nav = page.locator('aside.seitenleiste nav');
      await nav.getByRole('link', { name: 'Übersicht', exact: true }).click();
      await nav.getByRole('link', { name: 'Aufgaben', exact: true }).click();
    } else {
      await page.goto('/mehr');
      await page.getByRole('link', { name: 'Aufgaben', exact: true }).click();
    }
    await expect(page).toHaveURL('/aufgaben');
    await expect(page.locator('[data-zurueck]')).toHaveCount(0);

    await page.goto('/');
    const basis = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Basis', exact: true }) });
    await basis.scrollIntoViewIfNeeded();
    await expect(basis.locator('button.size-8').first()).toBeVisible();
    await expect(basis.locator('.aufgaben-kreis')).toHaveCount(0);
  } finally {
    await raeumeBau(page);
  }
});
