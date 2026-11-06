import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import type { Attribut } from '../shared/api/index.ts';
import { findeVorbild, vergleichspunkte } from '../shared/features/vorbilder/vorbilder.ts';
import type { Funktionen } from '../shared/spiel/funktionen.ts';
import { eigenesProfil } from '../client/src/pages/eigenesProfil.ts';

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
  return `tmp-test/vorbilder-spektrum/${info.project.name}-${name}.png`;
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueber = await seite.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(ueber).toBe(false);
}

test('Vorbilder zeigen Prozent, aktive Level und das Spektrum', async ({ page }, info) => {
  await anmelden(page);

  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  const zeilen = page.locator('[data-zeile]').filter({ has: page.locator('a[href^="/vorbilder/"]') });
  await expect(zeilen.first()).toBeVisible();
  await expect(zeilen.first()).toContainText(/%/);
  await expect(page.getByRole('button', { name: /^Alle/ })).toContainText(/%/);
  await page.screenshot({ path: bild(info, 'liste') });
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/vorbilder/davinci');
  await expect(page.getByRole('heading', { name: 'Leonardo da Vinci', exact: true })).toBeVisible();
  const kopf = page.locator('.vorbild-kopf');
  await expect(kopf).toContainText('7.917');
  const aehnlichkeit = page.locator('[data-aehnlichkeit]');
  await expect(aehnlichkeit).toBeVisible();
  await expect(aehnlichkeit).toContainText(/%\s*ähnlich/);
  const attributeAntwort = await page.request.get('/api/attribute');
  expect(attributeAntwort.ok()).toBe(true);
  const profilAttribute = (await attributeAntwort.json()) as Attribut[];
  const einstellungenAntwort = await page.request.get('/api/einstellungen');
  expect(einstellungenAntwort.ok()).toBe(true);
  const funktionen = ((await einstellungenAntwort.json()) as { funktionen: Funktionen }).funktionen;
  const vorbild = findeVorbild('davinci');
  if (!vorbild) {
    throw new Error('Vorbild fehlt.');
  }
  const profil = eigenesProfil(profilAttribute, { koennen: funktionen.koennen, status: funktionen.status });
  const punkte = vergleichspunkte(profil.level, vorbild, profil.kennungen);
  expect(punkte.length).toBeGreaterThan(2);
  const kennungen = page.locator('[data-kennung]');
  await expect(kennungen).toHaveCount(punkte.length);
  expect(await kennungen.evaluateAll((knoten) => knoten.map((knoten) => knoten.getAttribute('data-kennung')))).toEqual(
    punkte.map((punkt) => punkt.kennung),
  );
  await expect(page.locator('[data-kennung="koerper"]')).toBeVisible();
  const achse = Number(await page.locator('[data-vergleich]').getAttribute('data-achsen-max'));
  const eigene = await page.locator('[data-du]').evaluateAll((knoten) => knoten.map((knoten) => Number(knoten.getAttribute('data-du'))));
  expect(achse).toBeGreaterThan(500);
  expect(Math.max(...eigene) / achse).toBeLessThan(0.05);
  const radar = page.locator('[data-radar="vergleich"]');
  await expect(radar).toBeVisible();
  expect(Number(await radar.getAttribute('data-du-ring'))).toBeGreaterThanOrEqual(0.62);
  await radar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const flaechenGroesse = await radar.locator('path.radar-du').evaluate((element) => {
    const flaeche = element.getBoundingClientRect();
    return Math.max(flaeche.width, flaeche.height);
  });
  expect(flaechenGroesse).toBeGreaterThan(48);
  await page.screenshot({ path: bild(info, 'detail') });
  await kopf.screenshot({ path: bild(info, 'prozent') });
  await radar.screenshot({ path: bild(info, 'radar') });
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/koennen');
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
  await expect(spektrum).toBeVisible();
  await expect(page.getByRole('button', { name: 'Körper', exact: true })).toBeVisible();
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

    await page.goto('/koennen');
    await expect(page.locator('[data-spektrum="attribut"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Disziplin', exact: true })).toBeVisible();
    await page.screenshot({ path: bild(info, 'wenig') });
  } finally {
    for (const eintrag of archivieren) {
      await page.request.patch(`/api/attribute/${eintrag.id}`, { data: { archiviert: false } });
    }
    await page.request.patch('/api/einstellungen', { data: { funktionen: { status: true } } });
  }
});
