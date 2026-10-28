import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

async function anmelden(seite: Page): Promise<void> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(wert);
  await seite.getByRole('button', { name: /Anmelden|Sign in/i }).click();
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/i }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

async function lage(seite: Page) {
  return seite.evaluate(() => {
    const knopf = document.querySelector('a[data-zurueck]');
    const kopf = document.querySelector('header.mobilkopf');
    const knopfKasten = knopf?.getBoundingClientRect();
    const kopfKasten = kopf?.getBoundingClientRect();
    const stil = knopf ? getComputedStyle(knopf) : null;
    const kopfSichtbar = kopf ? getComputedStyle(kopf).display !== 'none' : false;
    return {
      anzahl: document.querySelectorAll('a[data-zurueck]').length,
      href: knopf?.getAttribute('href') ?? null,
      knopf: knopfKasten
        ? { top: knopfKasten.top, bottom: knopfKasten.bottom, height: knopfKasten.height, width: knopfKasten.width }
        : null,
      kopf: kopfKasten && kopfSichtbar ? { top: kopfKasten.top, bottom: kopfKasten.bottom, height: kopfKasten.height } : null,
      opacity: stil?.opacity ?? null,
      visibility: stil?.visibility ?? null,
      scrollY: window.scrollY,
    };
  });
}

async function pfeilImKopf(seite: Page): Promise<void> {
  await expect.poll(async () => {
    const stand = await lage(seite);
    if (stand.anzahl !== 1 || !stand.knopf || !stand.kopf || stand.opacity !== '1' || stand.visibility !== 'visible') {
      return false;
    }
    return (
      stand.knopf.top >= stand.kopf.top - 1 &&
      stand.knopf.bottom <= stand.kopf.bottom + 1 &&
      stand.knopf.height >= 48 &&
      stand.knopf.width >= 48
    );
  }).toBe(true);
}

test('Zurück-Pfeil sitzt im Kopf', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/a1/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr');
  await expect(page).toHaveURL(/\/mehr$/);
  await expect(page.locator('a[href="/mehr/darstellung"]')).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 80));
  await page.locator('a[href="/mehr/darstellung"]').click();
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await expect(page.locator('main h1')).toBeVisible();
  await pfeilImKopf(page);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await expect(page.locator('a[data-zurueck]')).toBeInViewport();
  await bild('darstellung');

  if (handy) {
    await page.evaluate(() => window.scrollTo(0, 280));
    await pfeilImKopf(page);
    await expect(page.locator('a[data-zurueck]')).toBeInViewport();
    await bild('darstellung-scroll');
  }

  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);

  await page.locator('a[href="/mehr/darstellung"]').click();
  await page.locator('a[href="/mehr/darstellung/leiste"]').click();
  await expect(page).toHaveURL(/\/mehr\/darstellung\/leiste$/);
  await expect(page.locator('main h1')).toBeVisible();
  await pfeilImKopf(page);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/darstellung');
  await bild('leiste');

  await page.goto('/mehr/funktionen');
  await expect(page).toHaveURL(/\/mehr\/funktionen$/);
  await expect(page.locator('main h1')).toBeVisible();
  await pfeilImKopf(page);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await bild('funktionen');

  await page.goto('/charakter');
  await expect(page).toHaveURL(/\/charakter$/);
  await expect(page.locator('main h1')).toBeVisible();
  if (handy) {
    await pfeilImKopf(page);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/');
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  }
  await bild('charakter');
});
