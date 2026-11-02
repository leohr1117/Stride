import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function funktionen(seite: Page, werte: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen: werte } });
  expect(antwort.ok()).toBe(true);
}

test('Verlauf, Rückblick, Statistik und Basis', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/rueckschau-aufbau', { recursive: true });
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-test/rueckschau-aufbau/${testInfo.project.name}-${name}.png` });
  await anmelden(page);
  const vorher = await page.request.get('/api/einstellungen');
  expect(vorher.ok()).toBe(true);
  const stand = (await vorher.json()) as { funktionen: Record<string, boolean> };
  const herkunft = {
    rueckblick: stand.funktionen.rueckblick,
    statistiken: stand.funktionen.statistiken,
    basis: stand.funktionen.basis,
  };

  try {
    await funktionen(page, { rueckblick: false, statistiken: false, basis: true });
    await page.goto('/chronik');
    await expect(page.locator('main h1')).toHaveText('Verlauf');
    const inhalt = page.locator('main');
    await expect(inhalt.getByRole('link', { name: 'Rückblick', exact: true })).toHaveCount(0);
    await expect(inhalt.getByRole('link', { name: 'Statistik', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-filter-punkt]')).toBeVisible();

    await funktionen(page, { rueckblick: true, statistiken: true, basis: true });
    await page.reload();
    await expect(inhalt.getByRole('link', { name: 'Rückblick', exact: true })).toBeVisible();
    await expect(inhalt.getByRole('link', { name: 'Statistik', exact: true })).toBeVisible();

    const zeile = page.locator('[data-schnell]').first();
    await expect(zeile).toBeVisible();
    await expect(zeile.locator('.zahl')).toBeVisible();
    await expect(zeile.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await zeile.getByRole('button', { name: /Aktionen für/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    const protokoll = page.locator('[data-protokoll]').first();
    if ((await protokoll.count()) > 0) {
      await expect(protokoll.locator('button')).toHaveCount(0);
      await protokoll.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('verlauf');

    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const blatt = page.getByRole('dialog', { name: 'Filter' });
    const schalter = blatt.getByRole('switch', { name: 'Nur Meilensteine' });
    await expect(schalter).toBeChecked();
    await schalter.click();
    await blatt.getByRole('button', { name: 'Schließen' }).click();
    await expect(blatt).toBeHidden();
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(blatt.getByRole('switch', { name: 'Nur Meilensteine' })).toBeChecked();
    await expect(blatt.getByRole('button', { name: 'Anwenden' })).toBeVisible();
    await expect(blatt.getByRole('button', { name: 'Zurücksetzen' })).toBeVisible();
    await expect(blatt.locator('.chip-reihe')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('filter');
    await blatt.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/rueckblick');
    await expect(page.locator('main h1')).toHaveText('Rückblick');
    await expect(page.getByRole('button', { name: 'Vorherige Woche' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nächste Woche' })).toBeVisible();
    const woche = page.locator('main p.zahl').first();
    const titel = await woche.innerText();
    await page.getByRole('button', { name: 'Vorherige Woche' }).click();
    await expect(woche).not.toHaveText(titel);
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await expect(woche).toHaveText(titel);
    const abschnitte = (await page.locator('main h2').allInnerTexts()).map((text) => text.trim());
    const zahlen = abschnitte.indexOf('Zahlen');
    const reflexion = abschnitte.indexOf('Reflexion');
    expect(zahlen).toBeGreaterThanOrEqual(0);
    expect(reflexion).toBeGreaterThan(zahlen);
    for (const name of ['Höhepunkte', 'Gewachsen']) {
      const index = abschnitte.indexOf(name);
      if (index >= 0) {
        expect(index).toBeLessThan(zahlen);
      }
    }
    await expect(page.getByText('Was lief gut?')).toBeVisible();
    await expect(page.getByText('Was nehme ich mit?')).toBeVisible();
    await expect(page.getByText('Worauf konzentriere ich mich nächste Woche?')).toBeVisible();
    await expect(page.getByRole('button', { name: /Speichern/ })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('rueckblick');

    await page.goto('/statistiken');
    await expect(page.locator('main h1')).toHaveText('Statistik');
    await expect(page.getByRole('button', { name: '3 Monate', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '12 Monate', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gesamt', exact: true })).toBeVisible();
    const kennzahlen = page.locator('[data-kennzahl]');
    if ((await kennzahlen.count()) === 0) {
      await expect(page.getByText('Noch keine Einträge.', { exact: true })).toBeVisible();
    } else {
      expect(await kennzahlen.count()).toBeGreaterThanOrEqual(5);
      const klasse = (await kennzahlen.first().getAttribute('class')) ?? '';
      expect(klasse).not.toContain('rounded');
      expect(klasse).not.toContain('border');
      await expect(page.getByRole('heading', { name: /XP pro (Woche|Monat)/ })).toBeVisible();
      await page.getByRole('button', { name: '12 Monate', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'XP pro Monat' })).toBeVisible();
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('statistik');

    await page.goto('/basis');
    await expect(page.locator('main h1')).toHaveText('Basis');
    const anlegen = page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true });
    const leer = page.getByRole('button', { name: 'Basis-Aufgabe anlegen', exact: true });
    await expect(anlegen.or(leer)).toBeVisible();
    if ((await anlegen.count()) > 0) {
      const haken = page.locator('main').getByRole('button', { name: 'Erledigt', exact: true });
      const rueck = page.locator('main').getByRole('button', { name: 'Rückgängig', exact: true });
      const knopf = (await haken.count()) > 0 ? haken.first() : rueck.first();
      const kasten = await knopf.boundingBox();
      expect(kasten).not.toBeNull();
      expect(kasten!.width).toBeGreaterThanOrEqual(48);
      expect(kasten!.height).toBeGreaterThanOrEqual(48);
      const erste = page.locator('main [data-schnell]').first();
      await erste.getByRole('button', { name: /Aktionen für/ }).click();
      await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Basis-Aufgabe' })).toBeVisible();
      await page.keyboard.press('Escape');
      await anlegen.click();
    } else {
      await expect(page.getByText('Noch keine Basis-Aufgaben.', { exact: true })).toBeVisible();
      await leer.click();
    }
    const dialog = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(dialog.getByText('Symbol', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Tätigkeit', exact: true })).toBeVisible();
    await expect(dialog.getByText('Dauer', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('basis');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  } finally {
    await page.request.patch('/api/einstellungen', { data: { funktionen: herkunft } }).catch(() => undefined);
  }
});
