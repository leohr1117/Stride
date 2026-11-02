import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

function tab(seite: Page, name: string) {
  const inDerLeiste = seite.locator('nav').locator('a:visible', { hasText: new RegExp(`^${name}$`) });
  return inDerLeiste.or(seite.locator('a:visible', { hasText: new RegExp(`^${name}$`) })).first();
}

async function iconLage(seite: Page, wurzel: string): Promise<{ abstand: number; delta: number | null }> {
  return seite.locator(wurzel).locator('button[aria-label^="Info"]').evaluate((knopf) => {
    const kasten = knopf.getBoundingClientRect();
    const huelle = knopf.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : 0;
    const zeile = knopf.closest('h1, h2, h3, [data-zeile]') ?? knopf.parentElement?.parentElement;
    const titel = zeile?.querySelector(':scope > .text-base, :scope > h1, :scope > h2, :scope > h3, .text-base');
    const titelKasten = titel?.getBoundingClientRect();
    const delta = titelKasten ? kasten.top + kasten.height / 2 - (titelKasten.top + titelKasten.height / 2) : null;
    return { abstand, delta };
  });
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Info-Icon sitzt nah und mittig an der Labelzeile', async ({ page }, testInfo) => {
  await page.goto('/mehr/funktionen');
  const basis = page.locator('#funktion-basis');
  await basis.scrollIntoViewIfNeeded();
  await expect(basis).toBeVisible();
  const funktion = await iconLage(page, '#funktion-basis');
  expect(funktion.abstand).toBeGreaterThanOrEqual(5);
  expect(funktion.abstand).toBeLessThanOrEqual(8);
  expect(Math.abs(funktion.delta ?? 99)).toBeLessThanOrEqual(4);
  await basis.getByRole('button', { name: /^Info/ }).click();
  await expect(page.getByRole('tooltip')).toHaveText('Tägliche Aufgaben zum Abhaken.');
  await page.screenshot({ path: `tmp-test/info-vorbilder-zurueck/${testInfo.project.name}-basis.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const investition = page.locator('#funktion-ausruestung');
  await expect(investition).toBeVisible();
  await expect(investition.getByRole('button', { name: /^Info/ })).toHaveCount(0);

  await page.goto('/investitionen');
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  const kopf = page.locator('[data-kopf]').getByRole('heading', { name: 'Investitionen', exact: true });
  await kopf.scrollIntoViewIfNeeded();
  const lage = await page.getByRole('heading', { name: 'Investitionen', exact: true }).evaluate((titel) => {
    const knopf = titel.parentElement?.querySelector('button[aria-label^="Info"]');
    if (!(knopf instanceof HTMLElement)) {
      return { abstand: -1, delta: null };
    }
    const kasten = knopf.getBoundingClientRect();
    const huelle = knopf.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : 0;
    const text = titel.getBoundingClientRect();
    return { abstand, delta: kasten.top + kasten.height / 2 - (text.top + text.height / 2) };
  });
  expect(lage.abstand).toBeGreaterThanOrEqual(5);
  expect(lage.abstand).toBeLessThanOrEqual(8);
  expect(Math.abs(lage.delta ?? 99)).toBeLessThanOrEqual(4);
  await page.locator('[data-kopf]').getByRole('button', { name: /^Info/ }).click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.screenshot({ path: `tmp-test/info-vorbilder-zurueck/${testInfo.project.name}-investitionen.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('Vorbilder zeigen die Ähnlichkeit und behalten den Filter', async ({ page }) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  const zeilen = page.locator('[data-zeile]').filter({ has: page.locator('a[href^="/vorbilder/"]') });
  await expect(zeilen.first()).toBeVisible();
  const anzahl = await zeilen.count();
  expect(anzahl).toBeGreaterThan(10);
  for (let index = 0; index < Math.min(anzahl, 8); index += 1) {
    await expect(zeilen.nth(index)).toContainText(/%/);
  }

  const wettkampf = page.getByRole('button', { name: /^Wettkampf/ });
  await expect(wettkampf).toContainText(/%/);
  await wettkampf.click();
  await expect(wettkampf).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/richtung=Wettkampf/);
  await expect(page.getByRole('link', { name: /Elon Musk/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Cristiano Ronaldo/ })).toBeVisible();

  await page.getByRole('link', { name: /Cristiano Ronaldo/ }).click();
  await expect(page).toHaveURL(/\/vorbilder\/ronaldo$/);
  await expect(page.getByRole('heading', { name: 'Cristiano Ronaldo', exact: true })).toBeVisible();
  await expect(page.getByText(/\d+\s*%\s*ähnlich/)).toHaveCount(1);
  await expect(page.getByText(/\d+\s*%\s*ähnlich/)).toBeVisible();
  await page.locator('[data-zurueck]').click();
  await expect(page).toHaveURL(/\/vorbilder\?richtung=Wettkampf/);
  await expect(wettkampf).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: /Lionel Messi/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Elon Musk/ })).toHaveCount(0);

  await page.getByRole('link', { name: /Cristiano Ronaldo/ }).click();
  await page.goBack();
  await expect(page).toHaveURL(/richtung=Wettkampf/);
  await expect(wettkampf).toHaveAttribute('aria-pressed', 'true');
});

test('Zurück folgt der Elternseite und ein Tab setzt den Verlauf zurück', async ({ page }) => {
  await page.goto('/mehr');
  await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
  await expect(page.locator('[data-zurueck]')).toHaveCount(0);

  await page.getByRole('link', { name: /^Darstellung/ }).click();
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await expect(page.locator('[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
  await page.goto('/mehr/darstellung/ansicht');
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await expect(page.getByRole('link', { name: 'Ansicht', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');

  await page.goto('/mehr');
  await page.getByRole('link', { name: /^Darstellung/ }).click();
  await page.getByRole('link', { name: 'Leiste', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/darstellung\/leiste$/);
  await expect(page.locator('[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Darstellung');

  const frisch = await page.context().newPage();
  await frisch.goto('/');
  await frisch.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
  await tab(frisch, 'Mehr').click();
  await frisch.getByRole('link', { name: /^Darstellung/ }).click();
  await frisch.getByRole('link', { name: 'Leiste', exact: true }).click();
  await expect(frisch).toHaveURL(/\/mehr\/darstellung\/leiste$/);
  await tab(frisch, 'Übersicht').click();
  await expect(frisch).toHaveURL(/\/$/);
  await expect(frisch.locator('[data-zurueck]')).toHaveCount(0);
  await frisch.goBack().catch(() => undefined);
  await expect(frisch).not.toHaveURL(/darstellung/);
  await frisch.close();

  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/');
  await tab(page, 'Mehr').click();
  await expect(page.locator('[data-zurueck]')).toHaveCount(0);
  await page.getByRole('link', { name: /^Darstellung/ }).click();
  await page.getByRole('link', { name: 'Leiste', exact: true }).click();
  await page.locator('[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await expect(page.locator('[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
  await page.locator('[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);
  await expect(page.locator('[data-zurueck]')).toHaveCount(0);

  await page.getByRole('link', { name: /^Darstellung/ }).click();
  await page.getByRole('link', { name: 'Leiste', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/mehr\/darstellung$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/mehr$/);
  await expect(page.locator('[data-zurueck]')).toHaveCount(0);
});
