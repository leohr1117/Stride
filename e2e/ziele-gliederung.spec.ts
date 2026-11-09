import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function nah(wert: number, ziel: number): boolean {
  return Math.abs(wert - ziel) <= 1;
}

function spanne(werte: number[]): number {
  return Math.max(...werte) - Math.min(...werte);
}

async function kante(ziel: Locator): Promise<{ x: number; right: number; height: number }> {
  const kasten = await ziel.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return { x: 0, right: 0, height: 0 };
  }
  return { x: kasten.x, right: kasten.x + kasten.width, height: kasten.height };
}

interface Farben {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
}

async function farben(seite: Page): Promise<Farben> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as Farben;
}

async function stelleFarben(seite: Page, daten: Farben, zurueck: boolean): Promise<void> {
  const koerper = zurueck
    ? { stil: daten.stil, glimmen: daten.glimmen, farbenZuruecksetzen: true }
    : {
        stil: daten.stil,
        primaer: daten.primaer,
        akzent: daten.akzent,
        hintergrund: daten.hintergrund,
        glimmen: daten.glimmen,
      };
  const antwort = await seite.request.patch('/api/einstellungen', { data: koerper });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Namen unter einer Vision rücken 16 px und 32 px ein, Level und Menü bleiben rechts', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/ziele-gliederung', { recursive: true });
  const original = await farben(page);
  let farbenGeaendert = false;
  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();

  const fit = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Fit und belastbar', level: 2 }) });
  const visionZeile = fit.locator('[data-zeile]').first();
  const org = fit.locator('[data-ast="organisation"]').filter({ has: page.getByRole('heading', { name: 'Lauftreff', level: 3 }) });
  const orgZeile = org.locator('.organisation-kopf');
  const projekt = org.locator('> .liste [data-zeile]').first();
  const direkt = fit.locator('[data-ast="vision"] [data-zeile]').first();
  await expect(orgZeile).toBeVisible();
  await expect(projekt).toBeVisible();
  await expect(direkt).toBeVisible();

  const vision = await kante(visionZeile);
  const organisation = await kante(orgZeile);
  const unter = await kante(projekt);
  const eben = await kante(direkt);
  const visionName = await kante(visionZeile.locator('h2'));
  const direktName = await kante(direkt.locator('.zeile-titel'));
  const orgName = await kante(orgZeile.locator('h3'));
  const projektName = await kante(projekt.locator('.zeile-titel'));
  expect(nah(organisation.height, 40)).toBe(true);
  expect(nah(eben.x, vision.x)).toBe(true);
  expect(nah(organisation.x, vision.x)).toBe(true);
  expect(nah(unter.x, organisation.x)).toBe(true);
  expect(nah(direktName.x - visionName.x, 16)).toBe(true);
  expect(nah(orgName.x - visionName.x, 16)).toBe(true);
  expect(nah(projektName.x - visionName.x, 32)).toBe(true);

  const visionen = page.locator('main section').filter({ has: page.locator('[data-zeile] h2') });
  const letzte = visionen.last();
  await expect(letzte.locator('[data-zeile] h2')).toBeVisible();
  const letzteLvl = await kante(letzte.locator('[data-zeile-wert]').filter({ hasText: /^Lvl \d+$/ }).last());
  const letzteMenue = await kante(letzte.locator('.zeile-menue > button').last());
  const lvlRechts = [
    (await kante(visionZeile.locator('[data-zeile-wert]'))).right,
    (await kante(direkt.locator('[data-zeile-wert]'))).right,
    (await kante(projekt.locator('[data-zeile-wert]'))).right,
    letzteLvl.right,
  ];
  const menueRechts = [
    (await kante(orgZeile.locator('.zeile-menue > button'))).right,
    (await kante(direkt.locator('.zeile-menue > button'))).right,
    (await kante(projekt.locator('.zeile-menue > button'))).right,
    letzteMenue.right,
  ];
  expect(spanne(lvlRechts)).toBeLessThanOrEqual(0.5);
  expect(spanne(menueRechts)).toBeLessThanOrEqual(0.5);

  const frei = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Organisationen ohne Vision', exact: true, level: 2 }),
  });
  const freiProjekt = frei.locator('.organisation-einzug [data-zeile]').first();
  await expect(freiProjekt).toBeVisible();
  expect(nah((await kante(freiProjekt)).x - (await kante(frei.locator('.organisation-kopf'))).x, 16)).toBe(true);

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
    const koerper = (await antwort.json()) as {
      projekte: { id: number; name: string; geschafftAm: string | null; standardVorlageId: number | null }[];
    };
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

  const vorlageId = projekte.find((zeile) => zeile.standardVorlageId !== null)?.standardVorlageId;
  expect(vorlageId).toBeTruthy();
  const lose = await page.request.post('/api/projekte', {
    data: {
      name: 'Lose ohne Vision',
      beschreibung: '',
      visionId: null,
      organisationId: null,
      standardVorlageId: vorlageId,
    },
  });
  expect(lose.ok()).toBe(true);
  const loseId = ((await lose.json()) as { id: number }).id;
  try {
    await page.goto('/ziele');
    const ohne = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Ohne Vision', exact: true, level: 2 }),
    });
    const loseZeile = ohne.locator('[data-zeile]').filter({ hasText: 'Lose ohne Vision' });
    await expect(loseZeile).toBeVisible();
    const polster = await loseZeile
      .locator('.zeilen-text')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingInlineStart));
    expect(polster).toBe(0);
    expect(nah((await kante(loseZeile.locator('.zeile-titel'))).x, visionName.x)).toBe(true);
  } finally {
    await page.request.delete(`/api/projekte/${loseId}`);
  }

  const breite = testInfo.project.name === 'handy' ? '390' : '1440';
  const aufnahme = async (name: string, dunkel: boolean) => {
    await page.emulateMedia({ colorScheme: dunkel ? 'dark' : 'light' });
    if (original.eigeneFarben || original.stil !== 'standard') {
      await stelleFarben(page, { ...original, stil: 'standard' }, true);
      farbenGeaendert = true;
    }
    await page.goto('/ziele');
    await expect(page.locator('html')).toHaveAttribute('data-schema', dunkel ? 'dark' : 'light');
    await expect(page.getByRole('heading', { name: 'Fit und belastbar', level: 2 })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--flaeche').trim().toLowerCase()),
      )
      .toBe(dunkel ? '#202020' : '#ffffff');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `tmp-test/ziele-gliederung/${name}-oben.png` });
    const ziel = page.locator('main section').filter({ has: page.locator('[data-zeile] h2') }).last();
    await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.screenshot({ path: `tmp-test/ziele-gliederung/${name}-vision.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `tmp-test/ziele-gliederung/${name}.png`, fullPage: true });
  };
  try {
    await aufnahme(`${breite}-hell`, false);
    await aufnahme(`${breite}-dunkel`, true);
  } finally {
    if (farbenGeaendert) {
      await stelleFarben(page, original, !original.eigeneFarben);
    }
  }
});
