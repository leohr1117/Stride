import { expect, test, type Page } from '@playwright/test';
import { bedeutungsfarben } from '../shared/features/darstellung/bedeutung.ts';
import { wacheKontrast } from '../shared/features/darstellung/kontrastWaechter.ts';
import { erscheinungAus, type Farbtrio } from '../shared/features/darstellung/paletten.ts';
import type { Stil } from '../shared/features/darstellung/stile.ts';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface Darstellung {
  stil: Stil;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  ansichtFarben: Partial<Record<Stil, Farbtrio>>;
}

const ANSICHTEN: { stil: Stil; name: string; radius: string }[] = [
  { stil: 'minimal', name: 'Minimal', radius: '16px' },
  { stil: 'jade', name: 'Jade', radius: '14px' },
  { stil: 'holo', name: 'Hologramm', radius: '6px' },
  { stil: 'antik', name: 'Antik', radius: '2px' },
];

const HELL: Farbtrio = { primaer: '#f4f4f4', akzent: '#fbfbfb', hintergrund: '#fefefe' };
const WEISSER_AKZENT: Farbtrio = { primaer: '#141414', akzent: '#f8f8f8', hintergrund: '#141414' };

async function lese(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      glimmen: daten.glimmen,
      ansichtFarben: daten.ansichtFarben ?? {},
    };
  });
}

async function speichere(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

async function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate((schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim(), name);
}

async function waehleAnsicht(seite: Page, name: string, stil: Stil): Promise<void> {
  const gespeichert = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await seite.locator('button.rounded-xl').filter({ hasText: name }).click();
  await gespeichert;
  await expect.poll(async () => seite.locator('html').getAttribute('data-stil')).toBe(stil);
}

async function pruefeBedeutungen(seite: Page, trio: Farbtrio): Promise<void> {
  const bild = erscheinungAus(trio);
  const fest = bedeutungsfarben(bild.flaechen.schema);
  const wache = wacheKontrast(bild, fest);
  await expect.poll(() => variable(seite, '--streak')).toBe(wache.streak);
  await expect.poll(() => variable(seite, '--fortschritt')).toBe(wache.fortschritt);
  await expect.poll(() => variable(seite, '--gefahr')).toBe(wache.gefahr);
  await expect.poll(() => variable(seite, '--erfolg')).toBe(fest.erfolg);
  await expect.poll(() => variable(seite, '--schalter-an')).toBe(wache.schalterAn);
  await expect.poll(() => variable(seite, '--schalter-knopf-an')).toBe(wache.schalterKnopfAn);
  await expect.poll(() => variable(seite, '--schalter-aus')).toBe(wache.schalterAus);
  await expect.poll(() => variable(seite, '--schalter-knopf-aus')).toBe(wache.schalterKnopfAus);
  const grund = await variable(seite, '--grund');
  const flaeche = await variable(seite, '--flaeche');
  const flaeche2 = await variable(seite, '--flaeche-2');
  for (const farbe of [wache.haupt, wache.leise, wache.gefahr, wache.streak, wache.fortschritt]) {
    expect(kontrast(farbe, grund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(farbe, flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(farbe, flaeche2)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  }
  expect(kontrast(wache.schalterKnopfAn, wache.schalterAn)).toBeGreaterThanOrEqual(3);
  expect(kontrast(wache.schalterAn, flaeche)).toBeGreaterThanOrEqual(3);
  expect(kontrast(wache.fortschritt, flaeche2)).toBeGreaterThanOrEqual(3);
  expect(kontrast(wache.fokus, grund)).toBeGreaterThanOrEqual(3);
}

async function ringKontrast(seite: Page): Promise<number> {
  const farben = await seite.evaluate(() => {
    const strich = document.querySelector('[data-kopfring]');
    const bahn = strich?.closest('span')?.querySelector('circle');
    if (!(strich instanceof Element) || !(bahn instanceof Element) || strich === bahn) {
      return null;
    }
    return { strich: getComputedStyle(strich).stroke, bahn: getComputedStyle(bahn).stroke };
  });
  expect(farben).not.toBeNull();
  return kontrast(farben?.strich ?? '#000000', farben?.bahn ?? '#000000');
}

test('Jede Ansicht hat eine eigene Form und feste Bedeutungsfarben', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await anmelden(page);
  const original = await lese(page);
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-test/ansichten/${projekt}-${name}.png`, fullPage: true });

  try {
    const radien = new Set<string>();
    for (const ansicht of ANSICHTEN) {
      await page.goto('/mehr/darstellung');
      await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
      await waehleAnsicht(page, ansicht.name, ansicht.stil);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
      await expect(page.getByText('Lädt …')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('data-stil', ansicht.stil);
      const daten = await lese(page);
      await pruefeBedeutungen(page, { primaer: daten.primaer, akzent: daten.akzent, hintergrund: daten.hintergrund });
      const radius = await page.locator('.karte').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
      expect(radius).toBe(ansicht.radius);
      radien.add(radius);
      const schrift = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily.toLowerCase());
      const titel = await page.locator('.mobilkopf h1').evaluate((element) => getComputedStyle(element).textTransform);
      if (ansicht.stil === 'holo') {
        expect(schrift).toContain('exo');
        expect(titel).toBe('uppercase');
      }
      if (ansicht.stil === 'antik') {
        expect(schrift).toContain('barlow');
        expect(titel).toBe('uppercase');
        const kopf = await page.locator('[data-kopf] .klassenbild').evaluate((element) => {
          const stil = getComputedStyle(element);
          return { radius: stil.borderTopLeftRadius, schatten: stil.boxShadow, hintergrund: stil.backgroundColor };
        });
        expect(kopf.radius).toBe('9999px');
        expect(kopf.schatten).toBe('none');
        expect(kopf.hintergrund).not.toBe('rgba(0, 0, 0, 0)');
        const liste = await page.locator('.seitenleiste .klassenbild').evaluate((element) => {
          const stil = getComputedStyle(element);
          return { radius: stil.borderTopLeftRadius, schatten: stil.boxShadow };
        });
        expect(liste.radius).toBe('2px');
        expect(liste.schatten).not.toBe('none');
      }
      if (ansicht.stil === 'minimal' || ansicht.stil === 'jade') {
        expect(titel).toBe('none');
      }
      expect(await ringKontrast(page)).toBeGreaterThanOrEqual(3);
      await ohneSeitlichenUeberlauf(page);
      await bild(ansicht.stil);
    }
    expect(radien.size).toBe(ANSICHTEN.length);

    await speichere(page, { stil: 'jade', ...HELL });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'jade');
    await pruefeBedeutungen(page, HELL);
    expect(await ringKontrast(page)).toBeGreaterThanOrEqual(3);
    const ueberschrift = await page.locator('.mobilkopf h1').evaluate((element) => getComputedStyle(element).color);
    const grund = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(kontrast(ueberschrift, grund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await expect(dialog).toBeVisible();
    const schalter = dialog.getByRole('switch', { name: 'Meilenstein' });
    const knopf = schalter.locator('xpath=..').locator('.schalter-knopf');
    const bahn = schalter.locator('xpath=..').locator('.schalter-bahn');
    const farbeVon = async (ziel: typeof knopf) => ziel.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(kontrast(await farbeVon(knopf), await farbeVon(bahn))).toBeGreaterThanOrEqual(3);
    const linksAus = await knopf.evaluate((element) => element.getBoundingClientRect().left);
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    expect(kontrast(await farbeVon(knopf), await farbeVon(bahn))).toBeGreaterThanOrEqual(3);
    await expect.poll(() => knopf.evaluate((element) => element.getBoundingClientRect().left)).toBeGreaterThan(linksAus);
    await ohneSeitlichenUeberlauf(page);
    await bild('hell');
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(frage).toBeVisible();
    await frage.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(dialog).toBeHidden();

    await speichere(page, { stil: 'holo', ...WEISSER_AKZENT });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'holo');
    await pruefeBedeutungen(page, WEISSER_AKZENT);
    expect(await variable(page, '--streak')).not.toBe(WEISSER_AKZENT.akzent);
    expect(await variable(page, '--fortschritt')).not.toBe(WEISSER_AKZENT.akzent);
    expect(await variable(page, '--schalter-an')).not.toBe(WEISSER_AKZENT.akzent);
    expect(await ringKontrast(page)).toBeGreaterThanOrEqual(3);
    await ohneSeitlichenUeberlauf(page);
    await bild('akzent');
  } finally {
    for (const stil of ['jade', 'holo'] as const) {
      const alt = original.ansichtFarben[stil];
      if (alt) {
        await speichere(page, { stil, ...alt });
      } else {
        await speichere(page, { stil, farbenZuruecksetzen: true });
      }
    }
    await speichere(page, { stil: original.stil, glimmen: original.glimmen });
  }
});
