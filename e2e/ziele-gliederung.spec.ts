import fs from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function nah(wert: number, ziel: number): boolean {
  return Math.abs(wert - ziel) <= 1;
}

async function kante(ziel: Locator): Promise<{ x: number; height: number }> {
  const kasten = await ziel.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return { x: 0, height: 0 };
  }
  return { x: kasten.x, height: kasten.height };
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Organisation ist 40 px hoch und Projekte sind 16 px eingerückt', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/ziele-gliederung', { recursive: true });
  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();

  const fit = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fit und belastbar', level: 2 }) });
  const visionZeile = fit.locator('[data-zeile]').first();
  const org = fit.locator('[data-ast="organisation"]').filter({ has: page.getByRole('heading', { name: 'Lauftreff', level: 3 }) });
  const orgZeile = org.locator('.organisation-kopf');
  const projekt = org.locator('.organisation-einzug [data-zeile]').first();
  const direkt = fit.locator('[data-ast="vision"] [data-zeile]').first();
  await expect(orgZeile).toBeVisible();
  await expect(projekt).toBeVisible();
  await expect(direkt).toBeVisible();

  const vision = await kante(visionZeile);
  const organisation = await kante(orgZeile);
  const unter = await kante(projekt);
  const eben = await kante(direkt);
  expect(nah(organisation.height, 40)).toBe(true);
  expect(nah(unter.x - organisation.x, 16)).toBe(true);
  expect(nah(eben.x, vision.x)).toBe(true);

  const koepfe = await page.locator('main .organisation-kopf').evaluateAll((knoten) =>
    knoten.map((knoten) => knoten.getBoundingClientRect().height),
  );
  expect(koepfe.length).toBeGreaterThan(0);
  for (const hoehe of koepfe) {
    expect(hoehe).toBeLessThanOrEqual(41);
    expect(nah(hoehe, 40)).toBe(true);
  }

  const punkt = org.locator('h3 [data-farbpunkt]');
  const punktKasten = await punkt.boundingBox();
  expect(punktKasten).not.toBeNull();
  expect(Math.round(punktKasten?.width ?? 0)).toBe(8);
  expect(Math.round(punktKasten?.height ?? 0)).toBe(8);

  const name = await org.locator('h3 span').last().evaluate((element) => {
    const stil = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--leise)';
    document.body.append(probe);
    const leise = getComputedStyle(probe).color;
    probe.remove();
    return {
      schrift: stil.fontSize,
      gewicht: stil.fontWeight,
      leise: stil.color === leise,
    };
  });
  expect(name.schrift).toBe('13px');
  expect(name.gewicht).toBe('600');
  expect(name.leise).toBe(true);

  const menue = await orgZeile.locator('.zeile-menue > button').boundingBox();
  expect(menue).not.toBeNull();
  expect(nah(menue?.width ?? 0, 48)).toBe(true);
  expect(nah(menue?.height ?? 0, 40)).toBe(true);

  const level = await page.locator('main [data-zeile-wert]').evaluateAll((knoten) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--leise)';
    document.body.append(probe);
    const leise = getComputedStyle(probe).color;
    probe.remove();
    return knoten
      .filter((knoten) => (knoten.textContent ?? '').includes('Lvl'))
      .map((knoten) => getComputedStyle(knoten).color === leise);
  });
  expect(level.length).toBeGreaterThan(0);
  expect(level.every(Boolean)).toBe(true);

  const adresse = await projekt.locator('a[href^="/projekte/"]').getAttribute('href');
  const projekte = await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    if (!antwort.ok) {
      throw new Error('Ziele nicht geladen');
    }
    const koerper = (await antwort.json()) as { projekte: { id: number; name: string; geschafftAm: string | null }[] };
    return koerper.projekte;
  });
  const eintrag = projekte.find((zeile) => zeile.id === Number(adresse?.split('/').pop()));
  expect(eintrag).toBeTruthy();
  const neben = projekt.locator('.zeile-neben');
  const titel = projekt.locator('.zeile-titel');
  await expect(titel).toHaveText(eintrag?.name ?? '');
  await expect(titel).not.toContainText('Abgeschlossen');
  await expect(neben).toContainText('Einträge');
  if (eintrag?.geschafftAm) {
    await expect(neben).toHaveText(/^(?:\d+ Tage(?: · angeknackst)? · )?Abgeschlossen · .+ Einträge · /);
  } else {
    await expect(neben).not.toContainText('Abgeschlossen');
  }
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({
    path: `tmp-test/ziele-gliederung/${testInfo.project.name}.png`,
    fullPage: true,
  });
});
