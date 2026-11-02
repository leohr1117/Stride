import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface FunktionenStand {
  funktionen: Record<string, boolean>;
  ebenen: Record<string, boolean>;
}

async function liesStand(seite: Page): Promise<FunktionenStand> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as FunktionenStand;
}

async function liesFunktionen(seite: Page): Promise<Record<string, boolean>> {
  return (await liesStand(seite)).funktionen;
}

async function setzeFunktionen(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

async function setzeEbenen(seite: Page, ebenen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { ebenen } });
  expect(antwort.ok()).toBe(true);
}

test('Bereiche → Toast Öffnen → Fähigkeiten → Zurück = Bereiche', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/bereiche/${testInfo.project.name}-${name}.png`, fullPage: true });
  await anmelden(page);
  const vorher = await liesStand(page);
  try {
    await page.goto('/mehr/funktionen');
    await expect(page.locator('main h1')).toHaveText('Bereiche');
    await expect(page.getByText('Ausschalten blendet aus. Gelöscht wird nichts.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Funktionen', exact: true })).toHaveCount(0);
    await expect(page.getByText('großes Ziel', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Empfohlen bei Ressourcen', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Seiten', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seiten im Profil', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Auf Ziele', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Regeln', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Abschnitte', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ziel-Stufen', exact: true })).toHaveCount(0);
    await expect(page.getByText('Auf dem Charakter.')).toHaveCount(0);
    await expect(page.locator('#funktion-faehigkeiten')).toBeVisible();
    await expect(page.locator('#funktion-bossAngriffe')).toBeVisible();
    await expect(page.locator('#ziel-visionen')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('bereiche');

    const schalter = page.locator('#funktion-faehigkeiten').getByRole('switch', { name: 'Fähigkeiten' });
    await schalter.scrollIntoViewIfNeeded();
    if ((await schalter.getAttribute('aria-checked')) === 'true') {
      await schalter.click();
      await expect(schalter).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('status')).toHaveCount(0);
    }
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    const toast = page.getByRole('status');
    await expect(toast).toContainText('Fähigkeiten an');
    await expect(toast.getByRole('button', { name: 'Öffnen', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('toast');
    await toast.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect(page).toHaveURL(/\/faehigkeiten$/);
    await expect(page.locator('main h1')).toHaveText('Fähigkeiten');
    if (handy) {
      await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/funktionen');
      await page.locator('a[data-zurueck]').click();
    } else {
      await page.goBack();
    }
    await expect(page).toHaveURL(/\/mehr\/funktionen/);
    await expect(page.locator('main h1')).toHaveText('Bereiche');
    await ohneSeitlichenUeberlauf(page);
    await bild('zurueck');

    const basisInfo = page.locator('#funktion-basis').getByRole('button', { name: 'Info' });
    await basisInfo.click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toContainText('Tägliche Aufgaben zum Abhaken.');
    const kasten = await hinweis.boundingBox();
    const fenster = page.viewportSize();
    expect(kasten).not.toBeNull();
    expect(fenster).not.toBeNull();
    if (kasten && fenster) {
      expect(kasten.x).toBeGreaterThanOrEqual(0);
      expect(kasten.y).toBeGreaterThanOrEqual(0);
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
      expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
    }
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);

    await setzeEbenen(page, { ...vorher.ebenen, vorhaben: false });
    await page.goto('/mehr/funktionen');
    const bosse = page.locator('#funktion-bossAngriffe');
    await expect(bosse).toContainText('Erst Vorhaben einschalten.');
    await expect(bosse.getByRole('button', { name: 'Info' })).toHaveCount(0);
    await expect(bosse.getByRole('switch', { name: 'Bosse' })).toBeDisabled();
    await ohneSeitlichenUeberlauf(page);
    await bild('gesperrt');
    await setzeEbenen(page, vorher.ebenen);

    await page.goto('/mehr');
    await expect(page.locator('[data-seitenliste] a[href="/faehigkeiten"]')).toBeVisible();
    if (!handy) {
      await expect(page.locator('aside.seitenleiste a[href="/faehigkeiten"]')).toBeVisible();
    }

    await setzeFunktionen(page, { ...vorher.funktionen, basis: false, bossAngriffe: false });
    await page.goto('/mehr/uebersicht');
    await expect(page.locator('main h1')).toHaveText('Übersicht');
    await expect(page.getByRole('switch', { name: 'Basis', exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Bosse', exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Identität', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Bereich für / })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('karten');
  } finally {
    await setzeEbenen(page, vorher.ebenen);
    await setzeFunktionen(page, vorher.funktionen);
  }
});
