import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

async function kopfSlot(seite: Page): Promise<{ anzeige: string; breite: number; abstand: number | null; polster: number }> {
  return seite.locator('header.mobilkopf').evaluate((kopf) => {
    const innen = kopf.querySelector(':scope > div');
    const slot = kopf.querySelector('[data-kopf-aktion]');
    const profil = kopf.querySelector('a[href="/charakter"]');
    if (!innen || !slot) {
      return { anzeige: '', breite: -1, abstand: null, polster: -1 };
    }
    const slotKasten = slot.getBoundingClientRect();
    const innenKasten = innen.getBoundingClientRect();
    const polster = parseFloat(getComputedStyle(innen).paddingRight);
    const profilKasten = profil?.getBoundingClientRect();
    return {
      anzeige: getComputedStyle(slot).display,
      breite: slotKasten.width,
      abstand: profilKasten ? innenKasten.right - polster - profilKasten.right : null,
      polster,
    };
  });
}

test('Ziele, Laufend und Projekt folgen der Liste', async ({ page }, testInfo) => {
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-test/ziele-aufbau/${testInfo.project.name}-${name}.png`, fullPage: true });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Heute', level: 1 })).toBeVisible();
  const slot = await kopfSlot(page);
  expect(slot.anzeige).toBe('contents');
  expect(slot.breite).toBe(0);
  expect(slot.abstand).not.toBeNull();
  expect(Math.abs(slot.abstand ?? 99)).toBeLessThanOrEqual(1);
  expect(slot.polster).toBe(testInfo.project.name === 'handy' ? 16 : 32);

  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  const menue = page.getByRole('menu', { name: 'Neu' });
  await expect(menue.getByRole('menuitem')).toHaveText(['Vision', 'Organisation', 'Projekt']);
  await expect(menue.getByRole('menuitem', { name: 'Vorhaben' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /Laufend · \d/ }).click();
  await expect(page).toHaveURL(/\/laufend$/);
  await expect(page.getByRole('heading', { name: 'Laufend', level: 1 })).toBeVisible();
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('laufend');

  await page.goto('/ziele');
  await page.getByRole('button', { name: 'Fit und belastbar', exact: true }).click();
  const vision = page.getByRole('dialog', { name: 'Fit und belastbar' });
  await expect(vision).toBeVisible();
  await vision.getByRole('button', { name: 'Aktionen für Fit und belastbar', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele');

  await page.getByRole('link', { name: /App bauen/ }).click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  await expect(page.getByRole('button', { name: 'Projekt bearbeiten', exact: true })).toHaveCount(0);
  const name = (await page.locator('[data-projektname]').innerText()).trim();
  await page.getByRole('button', { name: `Aktionen für ${name}`, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Archivieren', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByText('Neues Vorhaben', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeVisible();
  const vorhaben = page.locator('main .rounded-2xl').first();
  await vorhaben.getByRole('button', { name: /Aktionen für/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Umbenennen', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Loslassen', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  const nurHier = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nur für dieses Projekt' }) });
  await expect(nurHier.getByRole('button', { name: '+ Tätigkeit nur für dieses Projekt', exact: true })).toBeVisible();
  const basis = page.getByRole('heading', { name: 'Basis', exact: true });
  if (await basis.count()) {
    await expect(page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true })).toBeVisible();
  }
  const investition = page.locator('#projekt-investition');
  if (await investition.count()) {
    await expect(investition).toContainText(/Aus|\+\d+ %/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('projekt');

  const ziel = await page.evaluate(async () => {
    const ziele = (await fetch('/api/ziele').then((antwort) => antwort.json())) as {
      projekte: { id: number; name: string; archiviert: boolean }[];
    };
    return ziele.projekte.find((eintrag) => !eintrag.archiviert) ?? null;
  });
  expect(ziel).not.toBeNull();
  if (!ziel) {
    return;
  }
  try {
    const archiv = await page.request.patch(`/api/projekte/${ziel.id}`, { data: { archiviert: true } });
    expect(archiv.ok()).toBe(true);
    await page.evaluate(() => {
      localStorage.removeItem('stride.eingeklappt.ziele-archiv');
      localStorage.removeItem('ascend.eingeklappt.ziele-archiv');
    });
    await page.goto('/ziele');
    const knopf = page.getByRole('button', { name: 'Archiv', exact: true });
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await knopf.click();
    await expect(page.getByRole('link', { name: ziel.name }).first()).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('archiv');
  } finally {
    await page.request.patch(`/api/projekte/${ziel.id}`, { data: { archiviert: false } });
  }
});
