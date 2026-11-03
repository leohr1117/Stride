import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Stil } from '../shared/features/darstellung/stile.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ANSICHTEN: { stil: Stil; name: string }[] = [
  { stil: 'standard', name: 'Standard' },
  { stil: 'minimal', name: 'Minimal' },
  { stil: 'jade', name: 'Jade' },
  { stil: 'holo', name: 'Hologramm' },
  { stil: 'antik', name: 'Antik' },
];

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

function kreis(radius: string, breite: number): boolean {
  const px = Number.parseFloat(radius);
  return Number.isFinite(px) && px + 0.6 >= breite / 2;
}

async function form(seite: Page, auswahl: string): Promise<{ radius: string; breite: number; ueberlauf: string; schatten: string; hintergrund: string }> {
  const ziel = seite.locator(auswahl);
  await expect(ziel).toBeVisible();
  return ziel.evaluate((element) => {
    const stil = getComputedStyle(element);
    return {
      radius: stil.borderTopLeftRadius,
      breite: element.getBoundingClientRect().width,
      ueberlauf: stil.overflow,
      schatten: stil.boxShadow,
      hintergrund: stil.backgroundColor,
    };
  });
}

test('Profilbild bleibt in jeder Ansicht rund', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await anmelden(page);
  const original = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil: Stil };
    return daten.stil;
  });
  const projekt = testInfo.project.name;
  fs.mkdirSync('tmp-test/profilbild', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/profilbild/${projekt}-${name}.png`, fullPage: true });

  try {
    for (const ansicht of ANSICHTEN) {
      await speichere(page, { stil: ansicht.stil });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-stil', ansicht.stil);
      await expect(page.getByText('Lädt …')).toHaveCount(0);

      const kopf = await form(page, '[data-kopf] [data-profilbild]');
      expect(kreis(kopf.radius, kopf.breite), `${ansicht.name} Kopf ${kopf.radius}`).toBe(true);
      expect(kopf.ueberlauf).toBe('hidden');
      expect(Math.round(kopf.breite)).toBeGreaterThanOrEqual(30);
      expect(Math.round(kopf.breite)).toBeLessThanOrEqual(34);

      if (ansicht.stil === 'antik') {
        expect(kopf.radius).toBe('9999px');
        expect(kopf.schatten).toBe('none');
        expect(kopf.hintergrund).not.toBe('rgba(0, 0, 0, 0)');
        const liste = await page.locator('.seitenleiste .klassenbild').evaluate((element) => {
          const stil = getComputedStyle(element);
          return {
            radius: stil.borderTopLeftRadius,
            schatten: stil.boxShadow,
            profil: element.classList.contains('profilbild'),
          };
        });
        expect(liste.radius).toBe('2px');
        expect(liste.schatten).not.toBe('none');
        expect(liste.profil).toBe(false);
      }

      const link = page.locator('header a.profilziel');
      await expect(link).toBeVisible();
      let taste = false;
      for (let schritt = 0; schritt < 40; schritt += 1) {
        taste = await link.evaluate((element) => element === document.activeElement);
        if (taste) {
          break;
        }
        await page.keyboard.press('Tab');
      }
      expect(taste).toBe(true);
      const fokus = await link.evaluate((element) => {
        const stil = getComputedStyle(element);
        const kasten = element.getBoundingClientRect();
        return {
          radius: stil.borderTopLeftRadius,
          breite: kasten.width,
          hoehe: kasten.height,
          ueberlauf: stil.overflow,
          umriss: stil.outlineStyle,
          eingabe: document.documentElement.dataset.eingabe ?? '',
        };
      });
      expect(fokus.eingabe).toBe('tastatur');
      expect(kreis(fokus.radius, fokus.breite), `${ansicht.name} Fokus ${fokus.radius}`).toBe(true);
      expect(kreis(fokus.radius, fokus.hoehe)).toBe(true);
      expect(fokus.ueberlauf).toBe('hidden');
      expect(fokus.umriss).toBe('solid');
      expect(Math.round(fokus.breite)).toBeGreaterThanOrEqual(48);
      expect(Math.round(fokus.hoehe)).toBeGreaterThanOrEqual(48);

      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-heute`);
      }

      await page.locator('header h1').click();
      await link.evaluate((element) => {
        if (element instanceof HTMLElement) {
          element.focus({ focusVisible: true });
        }
      });
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eingabe ?? '')).toBe('zeiger');
      expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');

      await page.goto('/mehr');
      await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
      await expect(page.getByText('Lädt …')).toHaveCount(0);
      const zeile = await form(page, '[data-abschnitt="seiten"] [data-profilbild]');
      expect(kreis(zeile.radius, zeile.breite), `${ansicht.name} Mehr ${zeile.radius}`).toBe(true);
      expect(zeile.ueberlauf).toBe('hidden');
      expect(Math.round(zeile.breite)).toBe(20);
      await ohneSeitlichenUeberlauf(page);
      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-mehr`);
      }

      await page.locator('[data-abschnitt="seiten"]').getByRole('link', { name: 'Profil', exact: true }).click();
      await expect(page).toHaveURL(/\/charakter$/);
      await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
      await expect(page.getByText('Lädt …')).toHaveCount(0);
      const profil = await form(page, 'main [data-levelring] [data-profilbild]');
      expect(kreis(profil.radius, profil.breite), `${ansicht.name} Profil ${profil.radius}`).toBe(true);
      expect(profil.ueberlauf).toBe('hidden');
      expect(Math.round(profil.breite)).toBe(64);
      const ring = await page.locator('main [data-levelring]').evaluate((element) => Math.round(element.getBoundingClientRect().width));
      expect(ring).toBe(104);
      await expect(page.locator('main [data-levelring] span.uppercase')).toBeVisible();
      await ohneSeitlichenUeberlauf(page);
      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-profil`);
      }
    }
  } finally {
    await speichere(page, { stil: original });
  }
});
