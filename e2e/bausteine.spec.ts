import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function speichern(seite: Page, koerper: Record<string, unknown>): Promise<void> {
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

test('Listen, Glühen und Menü folgen den Bausteinen', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/bausteine', { recursive: true });
  await anmelden(page);
  const original = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as {
      stil: string;
      glimmen: boolean;
    };
    return { stil: daten.stil, glimmen: daten.glimmen };
  });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/bausteine/${testInfo.project.name}-${name}.png` });

  try {
    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
    if ((await page.locator('html').getAttribute('data-stil')) !== 'standard') {
      const gespeichert = page.waitForResponse(
        (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
      );
      await page.locator('button.rounded-xl').filter({ hasText: 'Standard' }).click();
      await gespeichert;
    }
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');

    await page.goto('/mehr/profil');
    await expect(page.getByRole('heading', { name: 'Konto', exact: true })).toBeVisible();
    const zeile = page.locator('.zeile').first();
    await expect(zeile).toBeVisible();
    expect(await zeile.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
    const liste = page.locator('.liste').first();
    await expect(liste).toBeVisible();
    const kasten = await liste.boundingBox();
    const breite = page.viewportSize()?.width ?? 0;
    expect(kasten).not.toBeNull();
    if (kasten && breite < 768) {
      expect(kasten.x).toBeLessThanOrEqual(1);
      expect(kasten.x + kasten.width).toBeGreaterThanOrEqual(breite - 20);
    }
    const radius = await liste.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    expect(parseFloat(radius)).toBe(breite < 768 ? 0 : 8);
    if (breite >= 768 && kasten) {
      expect(kasten.width).toBeLessThanOrEqual(720);
    }
    const linie = await page.locator('.liste .zeile').nth(1).evaluate((element) => getComputedStyle(element, '::before').borderTopWidth);
    expect(linie).toBe('1px');
    const schrift = await page.locator('h2.ueberschrift').first().evaluate((element) => getComputedStyle(element).textTransform);
    expect(schrift).toBe('none');
    await ohneSeitlichenUeberlauf(page);
    await bild('profil');

    await page.goto('/mehr/darstellung');
    const sprache = page.getByRole('radiogroup', { name: 'Sprache' });
    await expect(sprache.getByRole('radio')).toHaveCount(7);
    await expect(sprache.getByRole('radio', { name: 'Deutsch', exact: true })).toBeChecked();
    await bild('sprache');
    const gluehen = page.getByRole('switch', { name: 'Glühen', exact: true });
    await expect(gluehen).toBeVisible();
    await gluehen.scrollIntoViewIfNeeded();
    await bild('darstellung');
    if ((await gluehen.getAttribute('aria-checked')) !== 'true') {
      const an = page.waitForResponse(
        (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
      );
      await gluehen.click();
      await an;
    }
    await expect(page.locator('html')).not.toHaveAttribute('data-glimmen', 'aus');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glimm').trim())).toBe('1');

    await page.goto('/');
    await expect(page.locator('.levelring').first()).toBeVisible();
    const schein = page.locator('.levelring-spitze-schein').first();
    await expect(schein).toBeVisible();
    const ringHtml = await page.locator('.levelring').first().innerHTML();
    expect(ringHtml).toContain('feGaussianBlur');
    expect(ringHtml).toContain('--fortschritt');
    expect(ringHtml.toLowerCase()).not.toContain('fill="white"');
    expect(ringHtml).not.toContain('--akzent');
    expect(ringHtml).not.toContain('--haupt');
    await bild('ring-an');

    await page.goto('/mehr/darstellung');
    const aus = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.getByRole('switch', { name: 'Glühen', exact: true }).click();
    await aus;
    await expect(page.locator('html')).toHaveAttribute('data-glimmen', 'aus');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glimm').trim())).toBe('0');
    await page.goto('/');
    await expect(page.locator('.levelring-spitze-schein').first()).toBeAttached();
    const versteckt = await page.locator('.levelring-spitze-schein').first().evaluate((element) => getComputedStyle(element).display);
    expect(versteckt).toBe('none');
    await bild('ring-aus');

    await page.goto('/chronik');
    await expect(page.getByRole('heading', { name: 'Verlauf', exact: true })).toBeVisible();
    const karte = page.locator('[data-schnell]').first();
    await expect(karte).toBeVisible();
    await karte.getByRole('button', { name: /Aktionen für/ }).click();
    const loeschen = page.getByRole('menuitem', { name: 'Löschen', exact: true });
    await expect(loeschen).toBeVisible();
    const farben = await loeschen.evaluate((element) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--gefahr)';
      document.body.append(probe);
      const gefahr = getComputedStyle(probe).color;
      probe.remove();
      return { text: getComputedStyle(element).color, gefahr };
    });
    expect(farben.text).toBe(farben.gefahr);
    await bild('menue');
    await page.keyboard.press('Escape');
    await ohneSeitlichenUeberlauf(page);
  } finally {
    await speichern(page, original);
  }
});
