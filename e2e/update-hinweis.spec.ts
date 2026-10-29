import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { AKTUELLE_VERSION } from '../shared/versionen.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test('eine Snackbar bei verpassten Versionen, keine beim aktuellen Stand, Punkt weg nach dem Changelog', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-bau/u18a', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u18a/${testInfo.project.name}-${name}.png`, fullPage: false });
  const setzen = async (stand: { benachrichtigt: string; gesehen: string }) => {
    const antwort = await page.request.patch('/api/version-hinweis', { data: stand });
    expect(antwort.ok()).toBeTruthy();
  };

  await anmelden(page);
  await expect(page.locator('[data-update-hinweis]')).toHaveCount(0);

  try {
    await setzen({ benachrichtigt: '3.33.0', gesehen: '3.33.0' });
    await page.reload();
    await page.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
    await expect(page.getByText('Test Voll').filter({ visible: true })).toBeVisible();
    const hinweis = page.locator('[data-update-hinweis]');
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toContainText('Stride wurde aktualisiert.');
    await expect(hinweis).not.toContainText(/\d+\.\d+\.\d+/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(hinweis).toHaveAttribute('data-dauer', '10000');
    const punkt =
      testInfo.project.name === 'handy'
        ? page.locator('nav.mobilleiste [data-neu-punkt]')
        : page.locator('aside.seitenleiste [data-neu-punkt]');
    await expect(punkt).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    const masse = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) {
          return null;
        }
        const r = el.getBoundingClientRect();
        return { links: Math.round(r.left), rechts: Math.round(r.right), breite: Math.round(r.width) };
      };
      const lage = document.querySelector('.toast-lage');
      return {
        fab: document.documentElement.dataset.fab ?? '',
        polster: lage ? getComputedStyle(lage).paddingRight : '',
        lage: box(lage),
        karte: box(document.getElementById('update-hinweis')),
        plus: box(document.querySelector('.eintrag-fab')),
      };
    });
    if (masse.plus && masse.karte) {
      expect(masse.karte.rechts).toBeLessThanOrEqual(masse.plus.links - 8);
    }
    await bild('snackbar');

    await hinweis.hover();
    await page.waitForTimeout(11_000);
    await expect(hinweis).toBeVisible();

    await hinweis.getByRole('button', { name: 'Neuigkeiten' }).click();
    await expect(page).toHaveURL(/\/mehr\/neu$/);
    await expect(page.getByRole('heading', { name: 'Was ist neu', level: 1 })).toBeVisible();
    const neu = page.locator('[data-neu-seit]');
    await expect(neu).toContainText('Neu seit deinem letzten Besuch');
    await expect(neu).toContainText('3.35.3');
    await expect(neu).toContainText('3.34.0');
    await expect(neu.getByRole('region', { name: 'Version 3.33.0' })).toHaveCount(0);
    await expect(page.locator('[data-neu-punkt]')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('changelog');
    const alt = page.locator('[data-version-rest]').getByRole('region', { name: 'Version 3.33.0' });
    await alt.scrollIntoViewIfNeeded();
    await expect(alt).toBeVisible();

    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-update-hinweis]')).toHaveCount(0);

    await page.goto('/mehr');
    const zeile = page.getByRole('link', { name: 'Was ist neu' });
    await zeile.scrollIntoViewIfNeeded();
    await expect(zeile).toBeVisible();
    await expect(page.locator('[data-version] [data-neu]')).toHaveCount(0);
    await expect(page.locator('[data-neu-punkt]')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('mehr');
  } finally {
    await setzen({ benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION });
  }
});
