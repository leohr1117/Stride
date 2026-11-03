import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const SEITEN = [
  { pfad: '/mehr', name: 'mehr' },
  { pfad: '/mehr/profil', name: 'konto' },
  { pfad: '/vorbilder', name: 'vorbilder' },
  { pfad: '/mehr/profil/accounts', name: 'accounts' },
  { pfad: '/chronik', name: 'verlauf' },
  { pfad: '/ziele', name: 'ziele' },
] as const;

function nah(wert: number, ziel: number): boolean {
  return Math.abs(wert - ziel) <= 1;
}

async function zeilenMasse(page: Page): Promise<{ zeilen: string | null; hoehe: number }[]> {
  return page.locator('main [data-zeile]').evaluateAll((knoten) =>
    knoten.map((knoten) => ({
      zeilen: knoten.getAttribute('data-zeilen'),
      hoehe: knoten.getBoundingClientRect().height,
    })),
  );
}

test('Zeilen auf Mehr, Konto, Vorbilder, Accounts, Verlauf und Ziele sind 48 oder 64 px', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/zeile', { recursive: true });
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-test/zeile/${testInfo.project.name}-${name}.png`, fullPage: true });
  await anmelden(page);

  const mass = await page.evaluate(() => {
    const eins = document.createElement('div');
    eins.className = 'zeile';
    eins.dataset.zeilen = '1';
    const zwei = document.createElement('div');
    zwei.className = 'zeile';
    zwei.dataset.zeilen = '2';
    const mit = document.createElement('div');
    mit.className = 'liste';
    mit.innerHTML =
      '<div class="zeile" data-hat-menue=""><span class="zeile-menue"></span></div><div class="zeile"><span class="zeile-menue"></span></div>';
    const ohne = document.createElement('div');
    ohne.className = 'liste';
    ohne.innerHTML = '<div class="zeile"><span class="zeile-menue"></span></div>';
    document.body.append(eins, zwei, mit, ohne);
    const breite = (wurzel: HTMLElement) =>
      [...wurzel.querySelectorAll('.zeile-menue')].map((slot) => Math.round(slot.getBoundingClientRect().width));
    const ergebnis = {
      eins: getComputedStyle(eins).height,
      zwei: getComputedStyle(zwei).height,
      mit: breite(mit),
      ohne: breite(ohne),
    };
    eins.remove();
    zwei.remove();
    mit.remove();
    ohne.remove();
    return ergebnis;
  });
  expect(mass.eins).toBe('48px');
  expect(mass.zwei).toBe('64px');
  expect(mass.mit).toEqual([48, 48]);
  expect(mass.ohne).toEqual([0]);

  for (const seite of SEITEN) {
    await page.goto(seite.pfad);
    await expect(page.locator('main [data-zeile]').first()).toBeVisible();
    if (seite.name === 'verlauf') {
      await expect(page.locator('main [data-zeile-wert]').first()).toBeVisible({ timeout: 20_000 });
    }
    const zeilen = await zeilenMasse(page);
    expect(zeilen.length).toBeGreaterThan(0);
    for (const zeile of zeilen) {
      const ziel = zeile.zeilen === '2' ? 64 : 48;
      expect(nah(zeile.hoehe, ziel)).toBe(true);
    }
    if (seite.name === 'mehr') {
      const werte = page.locator('[data-abschnitt="einstellungen"] [data-zeile-wert]');
      const kanten = await werte.evaluateAll((knoten) => {
        const probe = document.createElement('span');
        probe.className = 'text-leise';
        document.body.append(probe);
        const leise = getComputedStyle(probe).color;
        probe.remove();
        return knoten.map((knoten) => {
          const stil = getComputedStyle(knoten);
          return {
            rechts: Math.round(knoten.getBoundingClientRect().right),
            leise: stil.color === leise,
            zahlen: stil.fontVariantNumeric.includes('tabular-nums'),
          };
        });
      });
      expect(kanten.length).toBeGreaterThan(1);
      expect(new Set(kanten.map((eintrag) => eintrag.rechts)).size).toBe(1);
      for (const eintrag of kanten) {
        expect(eintrag.leise).toBe(true);
        expect(eintrag.zahlen).toBe(true);
      }
    }
    if (seite.name === 'verlauf') {
      const xp = await page.locator('main [data-zeile-wert]').evaluateAll((knoten) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--leise)';
        document.body.append(probe);
        const leise = getComputedStyle(probe).color;
        probe.remove();
        return knoten.map((knoten) => {
          const stil = getComputedStyle(knoten);
          return {
            rechts: Math.round(knoten.getBoundingClientRect().right),
            leise: stil.color === leise,
            zahlen: stil.fontVariantNumeric.includes('tabular-nums'),
          };
        });
      });
      expect(xp.length).toBeGreaterThan(1);
      const kante = xp[0]?.rechts ?? 0;
      for (const eintrag of xp) {
        expect(Math.abs(eintrag.rechts - kante)).toBeLessThanOrEqual(1);
        expect(eintrag.leise).toBe(true);
        expect(eintrag.zahlen).toBe(true);
      }
    }
    await ohneSeitlichenUeberlauf(page);
    await bild(seite.name);
  }

  await page.goto('/koennen');
  const koennenZeile = page.locator('.attributzeile').first();
  await expect(koennenZeile).toBeVisible();
  const koennen = await koennenZeile.boundingBox();
  expect(nah(koennen?.height ?? 0, 86)).toBe(true);
  expect(await koennenZeile.locator('[data-zeile]').getAttribute('data-zeilen')).toBeNull();

  await page.goto('/investitionen');
  const bank = page.locator('[data-schnell="Trainingsbank"] [data-zeile]');
  await expect(bank).toBeVisible();
  const bankKasten = await bank.boundingBox();
  expect(nah(bankKasten?.height ?? 0, 68)).toBe(true);
  expect(await bank.getAttribute('data-zeilen')).toBeNull();

  await page.goto('/vorbilder');
  const abstand = async (selektor: string) =>
    page.locator(selektor).first().evaluate((zeile) => {
      const wert = zeile.querySelector('[data-zeile-wert]');
      if (!wert) {
        return -1;
      }
      return Math.round(zeile.getBoundingClientRect().right - wert.getBoundingClientRect().right);
    });
  const mitMenue = page.locator('[data-hat-menue]').first();
  await expect(mitMenue).toBeVisible();
  const knopf = await mitMenue.locator('.zeile-menue > button').boundingBox();
  expect(knopf).not.toBeNull();
  expect(nah(knopf?.width ?? 0, 48)).toBe(true);
  expect(nah(knopf?.height ?? 0, 48)).toBe(true);
  const person = await abstand('[data-hat-menue]');
  const massstab = await abstand('[data-zeile]:not([data-hat-menue])');
  expect(person - massstab).toBeGreaterThan(50);
  expect(person - massstab).toBeLessThan(70);

  const listen = await page.locator('main .liste').evaluateAll((knoten) =>
    knoten.map((liste) => {
      const hat = Boolean(liste.querySelector('[data-hat-menue]'));
      const breiten = [...liste.querySelectorAll('.zeile-menue')].map((slot) => Math.round(slot.getBoundingClientRect().width));
      return { hat, breiten };
    }),
  );
  expect(listen.some((liste) => liste.hat && liste.breiten.length > 0)).toBe(true);
  expect(listen.some((liste) => !liste.hat && liste.breiten.length > 0)).toBe(true);
  for (const liste of listen) {
    for (const breite of liste.breiten) {
      expect(nah(breite, liste.hat ? 48 : 0)).toBe(true);
    }
  }
});
