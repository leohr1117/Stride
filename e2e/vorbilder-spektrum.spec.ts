import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';

interface AttributZeile {
  id: number;
  kennung: string | null;
  typ: string;
  archiviert: boolean;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

function bild(info: TestInfo, name: string): string {
  return `tmp-screens/81-${info.project.name}-${name}.png`;
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueber = await seite.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(ueber).toBe(false);
}

test('Vorbilder zeigen Prozent, aktive Level und das Spektrum', async ({ page }, info) => {
  await anmelden(page);

  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  const karten = page.locator('a[href^="/vorbilder/"]');
  await expect(karten.first()).toBeVisible();
  await expect(karten.first()).toContainText(/%/);
  await expect(page.getByRole('button', { name: /^Alle/ })).toContainText(/%/);
  await page.screenshot({ path: bild(info, 'liste') });
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/vorbilder/davinci');
  await expect(page.getByRole('heading', { name: 'Leonardo da Vinci', exact: true })).toBeVisible();
  const kopf = page.locator('.profil-name').locator('xpath=ancestor::section[1]');
  await expect(kopf).toContainText('7.917');
  const aehnlichkeit = page.locator('[data-aehnlichkeit]');
  await expect(aehnlichkeit).toBeVisible();
  await expect(aehnlichkeit).toContainText(/%\s*ähnlich/);
  await expect(page.locator('[data-kennung]')).toHaveCount(20);
  await expect(page.locator('[data-kennung="koerper"]')).toBeVisible();
  const achse = Number(await page.locator('[data-vergleich]').getAttribute('data-achsen-max'));
  const eigene = await page.locator('[data-du]').evaluateAll((knoten) => knoten.map((knoten) => Number(knoten.getAttribute('data-du'))));
  expect(achse).toBeGreaterThan(500);
  expect(Math.max(...eigene) / achse).toBeLessThan(0.05);
  const radar = page.locator('[data-radar="vergleich"]');
  await expect(radar).toBeVisible();
  await radar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: bild(info, 'detail') });
  await kopf.screenshot({ path: bild(info, 'prozent') });
  await radar.screenshot({ path: bild(info, 'radar') });
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/charakter');
  const spektrum = page.locator('[data-spektrum="attribut"]');
  await expect(spektrum).toBeVisible();
  const werte = (await spektrum.getAttribute('data-werte'))?.split(',').map(Number) ?? [];
  const spektrumMax = Number(await spektrum.getAttribute('data-achsen-max'));
  expect(werte.length).toBeGreaterThanOrEqual(3);
  expect(spektrumMax).toBeCloseTo(Math.max(...werte), 5);
  expect(Math.min(...werte) / spektrumMax).toBeLessThan(0.15);
  await spektrum.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: bild(info, 'spektrum') });
  await page.getByRole('button', { name: 'Können', exact: true }).click();
  await expect(spektrum).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Körper', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Können', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Körper', exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  const liste = await page.request.get('/api/attribute');
  expect(liste.ok()).toBe(true);
  const attribute = (await liste.json()) as AttributZeile[];
  const behalten = new Set(['disziplin', 'intellekt']);
  const archivieren = attribute.filter((eintrag) => eintrag.typ === 'attribut' && eintrag.kennung && !behalten.has(eintrag.kennung) && !eintrag.archiviert);
  try {
    const statusAus = await page.request.patch('/api/einstellungen', { data: { funktionen: { status: false } } });
    expect(statusAus.ok()).toBe(true);
    for (const eintrag of archivieren) {
      const antwort = await page.request.patch(`/api/attribute/${eintrag.id}`, { data: { archiviert: true } });
      expect(antwort.ok()).toBe(true);
    }
    await page.goto('/vorbilder/davinci');
    await expect(page.locator('[data-aehnlichkeit]')).toBeVisible();
    await expect(page.locator('[data-radar="vergleich"]')).toHaveCount(0);
    await expect(page.locator('[data-kennung]')).toHaveCount(2);
    await expect(page.locator('[data-kennung="disziplin"]')).toBeVisible();
    await expect(page.locator('[data-kennung="intellekt"]')).toBeVisible();
    await expect(page.locator('[data-kennung="koerper"]')).toHaveCount(0);
    await expect(page.locator('[data-kennung="ressourcen"]')).toHaveCount(0);
    await page.locator('[data-vergleich]').screenshot({ path: bild(info, 'balken') });
    await ohneSeitlichenUeberlauf(page);

    await page.goto('/charakter');
    await expect(page.locator('[data-spektrum="attribut"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Disziplin', exact: true })).toBeVisible();
    await page.screenshot({ path: bild(info, 'wenig') });
  } finally {
    for (const eintrag of archivieren) {
      await page.request.patch(`/api/attribute/${eintrag.id}`, { data: { archiviert: false } });
    }
    await page.request.patch('/api/einstellungen', { data: { funktionen: { status: true } } });
  }
});
