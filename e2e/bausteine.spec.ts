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
      expect(Math.abs(kasten.x - 16)).toBeLessThanOrEqual(1);
      expect(Math.abs(kasten.x + kasten.width - (breite - 16))).toBeLessThanOrEqual(1);
    }
    const radius = await liste.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    expect(parseFloat(radius)).toBe(breite < 768 ? 12 : 8);
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
    await page.getByRole('button', { name: /^Sprache/ }).click();
    const sprache = page.getByRole('radiogroup', { name: 'Sprache' });
    await expect(sprache.getByRole('radio')).toHaveCount(7);
    await expect(sprache.getByRole('radio', { name: 'Deutsch', exact: true })).toBeChecked();
    await bild('sprache');
    await page.keyboard.press('Escape');
    await expect(sprache).toHaveCount(0);
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
    const ringHtml = await page.locator('.levelring').first().innerHTML();
    expect(ringHtml).not.toContain('feGaussianBlur');
    expect(ringHtml).not.toContain('conic-gradient');
    expect(ringHtml).not.toContain('levelring-spitze-schein');
    expect(ringHtml.toLowerCase()).not.toContain('fill="white"');
    expect(ringHtml).toContain('stroke="var(--fortschritt)"');
    expect(ringHtml).toContain('stroke="var(--flaeche-2)"');
    expect(ringHtml).toContain('levelring-bogen');
    expect(ringHtml).toContain('levelring-spitze');
    expect(ringHtml).toContain('stroke="var(--balken-spitze)"');
    expect(ringHtml).not.toContain('--akzent');
    await expect(page.locator('.levelring-spitze-schein')).toHaveCount(0);
    const ringAn = await page.locator('.levelring-bogen').first().evaluate((element) => {
      const spitze = element.querySelector('.levelring-spitze');
      const strich = element.querySelector('.levelring-strich');
      return {
        filter: getComputedStyle(element).filter,
        spitze: spitze ? getComputedStyle(spitze).stroke : '',
        strich: strich ? getComputedStyle(strich).stroke : '',
      };
    });
    expect(ringAn.filter).not.toBe('none');
    expect(ringAn.filter).toMatch(/[46]px/);
    expect(ringAn.spitze).not.toBe('rgb(255, 255, 255)');
    expect(ringAn.spitze).not.toBe(ringAn.strich);
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
    const ringAus = await page.locator('.levelring').first().innerHTML();
    expect(ringAus).not.toContain('feGaussianBlur');
    expect(ringAus).toContain('stroke="var(--fortschritt)"');
    expect(ringAus).toContain('levelring-spitze');
    await expect(page.locator('.levelring-spitze-schein')).toHaveCount(0);
    const filterAus = await page.locator('.levelring-bogen').first().evaluate((element) => getComputedStyle(element).filter);
    expect(filterAus === 'none' || /\/\s*0\s*\)|rgba?\([^)]*,\s*0\s*\)/.test(filterAus)).toBe(true);
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
