import { expect, test, type Page, type TestInfo } from './uhr.ts';
import { TEST_PASSWORT } from './testdaten.ts';

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

function bild(info: TestInfo, name: string): string {
  return `tmp-test/vorbilder-favoriten/${info.project.name}-${name}.png`;
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function leeren(seite: Page): Promise<void> {
  const stand = await seite.request.get('/api/einstellungen');
  if (!stand.ok()) {
    throw new Error(`Favoriten ließen sich nicht lesen: ${stand.status()}`);
  }
  const favoriten = ((await stand.json()) as { vorbildFavoriten: string[] }).vorbildFavoriten;
  for (const schluessel of favoriten) {
    const antwort = await seite.request.patch('/api/einstellungen', {
      data: { vorbildFavoritWeg: schluessel, funktionen: { vorbilder: true } },
    });
    if (!antwort.ok()) {
      throw new Error(`Favorit ließ sich nicht entfernen: ${antwort.status()}`);
    }
  }
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
  await leeren(page);
});

test.afterEach(async ({ page }) => {
  await leeren(page);
});

test('Vorbilder lassen sich als Favorit merken und wieder entfernen', async ({ page }, testInfo) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Durchschnittsmensch' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ähnlich', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Favoriten', exact: true })).toHaveCount(0);
  const massstab = page.locator('[data-zeile]').filter({ has: page.locator('a[href="/vorbilder/durchschnitt"]') });
  await expect(massstab.getByRole('button')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(testInfo, 'ohne'), fullPage: true });

  await page.goto('/vorbilder/durchschnitt');
  await expect(page.getByRole('button', { name: 'Zu Favoriten' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aus Favoriten entfernen' })).toHaveCount(0);

  await page.goto('/vorbilder/einstein');
  await expect(page.getByRole('heading', { name: 'Albert Einstein', exact: true })).toBeVisible();
  const stern = page.getByRole('button', { name: 'Zu Favoriten' });
  await expect(stern).toBeVisible();
  await page.getByRole('link', { name: 'Zurück zu Vorbilder' }).focus();
  await page.keyboard.press('Tab');
  await expect(stern).toBeFocused();
  await expect(stern).toHaveAttribute('aria-pressed', 'false');
  await expect(stern.locator('svg')).toHaveAttribute('fill', 'none');
  const treffer = await stern.boundingBox();
  expect(treffer?.width).toBeGreaterThanOrEqual(48);
  expect(treffer?.height).toBeGreaterThanOrEqual(48);
  await page.keyboard.press('Enter');
  const gefuellt = page.getByRole('button', { name: 'Aus Favoriten entfernen' });
  await expect(gefuellt).toHaveAttribute('aria-pressed', 'true');
  await expect(gefuellt.locator('svg')).toHaveAttribute('fill', 'currentColor');
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(testInfo, 'stern'), fullPage: true });

  await page.getByRole('link', { name: 'Zurück zu Vorbilder' }).click();
  await expect(page).toHaveURL(/\/vorbilder$/);
  const favoriten = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Favoriten', exact: true }) });
  const aehnlich = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ähnlich', exact: true }) });
  await expect(favoriten.getByRole('link', { name: 'Albert Einstein' })).toBeVisible();
  await expect(aehnlich.getByRole('link', { name: 'Albert Einstein' })).toHaveCount(0);
  const reihenfolge = await page.evaluate(() => {
    const y = (name: string) => {
      const titel = [...document.querySelectorAll('h2')].find((knoten) => knoten.textContent?.trim() === name);
      return titel?.getBoundingClientRect().top ?? 0;
    };
    const massstabY = document.querySelector('a[href="/vorbilder/durchschnitt"]')?.getBoundingClientRect().top ?? 0;
    const chip = [...document.querySelectorAll('button')].find((knoten) => knoten.textContent?.trim().startsWith('Alle'));
    return {
      favoriten: y('Favoriten'),
      massstab: massstabY,
      chip: chip?.getBoundingClientRect().top ?? 0,
      aehnlich: y('Ähnlich'),
    };
  });
  expect(reihenfolge.favoriten).toBeLessThan(reihenfolge.massstab);
  expect(reihenfolge.massstab).toBeLessThan(reihenfolge.chip);
  expect(reihenfolge.chip).toBeLessThan(reihenfolge.aehnlich);

  await page.getByRole('button', { name: /^Wettkampf/ }).click();
  await expect(favoriten.getByRole('link', { name: 'Albert Einstein' })).toBeVisible();
  await expect(aehnlich.getByRole('link', { name: 'Albert Einstein' })).toHaveCount(0);
  await expect(aehnlich.getByRole('link', { name: /Cristiano Ronaldo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Wettkampf/ })).toContainText(/%/);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(testInfo, 'liste'), fullPage: true });

  await favoriten.getByRole('button', { name: 'Aktionen für Albert Einstein' }).click();
  await page.getByRole('menuitem', { name: 'Aus Favoriten entfernen' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Aus Favoriten entfernt' });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Favoriten', exact: true })).toHaveCount(0);
  await page.screenshot({ path: bild(testInfo, 'toast'), fullPage: false });
  await toast.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(favoriten.getByRole('link', { name: 'Albert Einstein' })).toBeVisible();
  await expect(aehnlich.getByRole('link', { name: 'Albert Einstein' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Favoriten', exact: true })).toBeVisible();
  await expect(favoriten.getByRole('link', { name: 'Albert Einstein' })).toBeVisible();

  const aus = await page.request.patch('/api/einstellungen', { data: { funktionen: { vorbilder: false } } });
  expect(aus.ok()).toBeTruthy();
  const gespeichert = await (await page.request.get('/api/einstellungen')).json();
  expect(gespeichert.vorbildFavoriten).toEqual(['einstein']);
  await page.goto('/vorbilder');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('heading', { name: 'Favoriten', exact: true })).toHaveCount(0);
  const an = await page.request.patch('/api/einstellungen', { data: { funktionen: { vorbilder: true } } });
  expect(an.ok()).toBeTruthy();
  await page.goto('/vorbilder');
  await expect(favoriten.getByRole('link', { name: 'Albert Einstein' })).toBeVisible();

  await page.goto('/vorbilder/einstein');
  const zurueck = page.getByRole('button', { name: 'Aus Favoriten entfernen' });
  await zurueck.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Zu Favoriten' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('status').filter({ hasText: 'Aus Favoriten entfernt' }).getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: 'Aus Favoriten entfernen' })).toHaveAttribute('aria-pressed', 'true');
});
