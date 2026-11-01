import { expect, test, type Page } from '@playwright/test';
import { bedeutungsfarben } from '../shared/features/darstellung/bedeutung.ts';
import { wacheKontrast } from '../shared/features/darstellung/kontrastWaechter.ts';
import { erscheinungAus } from '../shared/features/darstellung/paletten.ts';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface Darstellung {
  stil: string;
  glimmen: boolean;
  primaer: string;
  akzent: string;
  hintergrund: string;
  ansichtFarben: Partial<Record<string, { primaer: string; akzent: string; hintergrund: string }>>;
}

const HELL = { primaer: '#f4f4f4', akzent: '#fbfbfb', hintergrund: '#fefefe' };
const GRAU = { primaer: '#3355ff', akzent: '#cc8800', hintergrund: '#808080' };

async function leseDarstellung(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      glimmen: daten.glimmen,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
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

async function pruefeVariablen(seite: Page, trio: { primaer: string; akzent: string; hintergrund: string }): Promise<void> {
  const bild = erscheinungAus(trio);
  const wache = wacheKontrast(bild, bedeutungsfarben(bild.flaechen.schema));
  await expect.poll(() => variable(seite, '--haupt')).toBe(wache.haupt);
  await expect.poll(() => variable(seite, '--leise')).toBe(wache.leise);
  await expect.poll(() => variable(seite, '--streak')).toBe(wache.streak);
  await expect.poll(() => variable(seite, '--fortschritt')).toBe(wache.fortschritt);
  await expect.poll(() => variable(seite, '--gefahr')).toBe(wache.gefahr);
  await expect.poll(() => variable(seite, '--fokus')).toBe(wache.fokus);
  await expect.poll(() => variable(seite, '--schalter-an')).toBe(wache.schalterAn);
  await expect.poll(() => variable(seite, '--schalter-knopf-an')).toBe(wache.schalterKnopfAn);
  await expect.poll(() => variable(seite, '--schalter-aus')).toBe(wache.schalterAus);
  await expect.poll(() => variable(seite, '--schalter-knopf-aus')).toBe(wache.schalterKnopfAus);
  await expect.poll(() => variable(seite, '--feldrand')).toBe(wache.feldrand);
  const grund = await variable(seite, '--grund');
  const flaeche = await variable(seite, '--flaeche');
  const flaeche2 = await variable(seite, '--flaeche-2');
  for (const farbe of [wache.haupt, wache.leise, wache.gefahr, wache.streak, wache.fortschritt]) {
    expect(kontrast(farbe, grund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(farbe, flaeche)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    expect(kontrast(farbe, flaeche2)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  }
  expect(kontrast(wache.fortschritt, flaeche2)).toBeGreaterThanOrEqual(3);
  expect(kontrast(wache.fokus, grund)).toBeGreaterThanOrEqual(3);
}

test('Kontrastwächter bei eigenen Farben', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await anmelden(page);
  const original = await leseDarstellung(page);
  const standardFarben = original.ansichtFarben.standard;
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u9/${projekt}-${name}.png`, fullPage: true });

  try {
    await speichere(page, { stil: 'standard', ...HELL });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await pruefeVariablen(page, HELL);
    const ring = await page.evaluate(() => {
      const strich = document.querySelector('[data-kopfring]');
      const bahn = strich?.closest('span')?.querySelector('circle');
      if (!(strich instanceof Element) || !(bahn instanceof Element) || strich === bahn) {
        return null;
      }
      return { strich: getComputedStyle(strich).stroke, bahn: getComputedStyle(bahn).stroke };
    });
    expect(ring).not.toBeNull();
    if (ring) {
      expect(kontrast(ring.strich, ring.bahn)).toBeGreaterThanOrEqual(3);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('heute-hell');

    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await expect(dialog).toBeVisible();
    const schalter = dialog.getByRole('switch', { name: 'Meilenstein' });
    await expect(schalter).toBeVisible();
    const zeile = schalter.locator('xpath=..');
    const knopf = zeile.locator('.schalter-knopf');
    const bahn = zeile.locator('.schalter-bahn');
    const farbeVon = async (ziel: typeof knopf) =>
      ziel.evaluate((element) => getComputedStyle(element).backgroundColor);
    const knopfAus = await farbeVon(knopf);
    const bahnAus = await farbeVon(bahn);
    expect(kontrast(knopfAus, bahnAus)).toBeGreaterThanOrEqual(3);
    const linksAus = await knopf.evaluate((element) => element.getBoundingClientRect().left);
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    const knopfAn = await farbeVon(knopf);
    const bahnAn = await farbeVon(bahn);
    expect(kontrast(knopfAn, bahnAn)).toBeGreaterThanOrEqual(3);
    await expect.poll(() => knopf.evaluate((element) => element.getBoundingClientRect().left)).toBeGreaterThan(linksAus);
    await ohneSeitlichenUeberlauf(page);
    await bild('schalter-hell');
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(frage).toBeVisible();
    await frage.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(dialog).toBeHidden();

    await speichere(page, { stil: 'standard', ...GRAU });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    const fest = bedeutungsfarben(erscheinungAus(GRAU).flaechen.schema);
    await pruefeVariablen(page, GRAU);
    expect(await variable(page, '--streak')).not.toBe(fest.streak);
    const flamme = page.locator('[data-wochenwert="Streak"] .lucide-flame');
    await expect(flamme).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('heute-grau');
  } finally {
    if (standardFarben) {
      await speichere(page, { stil: 'standard', ...standardFarben });
    } else {
      await speichere(page, { stil: 'standard', farbenZuruecksetzen: true });
    }
    await speichere(page, {
      stil: original.stil,
      glimmen: original.glimmen,
      primaer: original.primaer,
      akzent: original.akzent,
      hintergrund: original.hintergrund,
    });
  }
});
