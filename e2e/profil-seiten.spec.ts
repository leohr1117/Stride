import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function setzeFunktion(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Profilzeilen öffnen Können, Haben, Fähigkeiten und Investitionen', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u17/${testInfo.project.name}-${name}.png`, fullPage: true });
  const zahlen = await page.evaluate(async () => {
    const charakter = (await fetch('/api/charakter').then((antwort) => antwort.json())) as {
      attribute: unknown[];
      status: unknown[];
    };
    const faehigkeiten = (await fetch('/api/faehigkeiten').then((antwort) => antwort.json())) as { archiviert: boolean }[];
    const investitionen = (await fetch('/api/investitionen').then((antwort) => antwort.json())) as { archiviert: boolean }[];
    return {
      '/koennen': charakter.attribute.length,
      '/haben': charakter.status.length,
      '/faehigkeiten': faehigkeiten.filter((eintrag) => !eintrag.archiviert).length,
      '/investitionen': investitionen.filter((eintrag) => !eintrag.archiviert).length,
    };
  });

  await page.goto('/charakter');
  const profil = page.locator('main');
  for (const [pfad, anzahl] of Object.entries(zahlen)) {
    const zeile = profil.locator('[data-zeile]').filter({ has: page.locator(`a[href="${pfad}"]`) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText(String(anzahl));
    await expect(zeile.getByRole('link')).toHaveAttribute('aria-label', /^(Können|Haben|Fähigkeiten|Investitionen)$/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('profil');

  await profil.locator('a[href="/koennen"]').click();
  await expect(page).toHaveURL(/\/koennen$/);
  await expect(page.locator('main h1')).toHaveText('Können');
  if (handy) {
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Profil');
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  }
  await expect(page.locator('main a[href^="/projekte/"]')).toHaveCount(0);
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  await expect(page.locator('[data-spektrum="attribut"]')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('koennen');

  await page.goto('/haben');
  await expect(page.locator('main h1')).toHaveText('Haben');
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  await expect(page.locator('[data-spektrum="status"]')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('haben');

  await page.goto('/faehigkeiten');
  await expect(page.locator('main h1')).toHaveText('Fähigkeiten');
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  const skill = page.locator('main a[href^="/faehigkeiten/"]');
  if ((await skill.count()) > 0) {
    await skill.first().click();
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Fähigkeiten');
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/faehigkeiten$/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('faehigkeiten');

  await page.goto('/investitionen');
  await expect(page.locator('main h1')).toHaveText('Investitionen');
  await expect(page.locator('main a[href^="/projekte/"]')).toHaveCount(0);
  await page.locator('[data-kopf]').getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await ohneSeitlichenUeberlauf(page);
  await bild('investitionen');

  await page.goto('/');
  const werteKopf = page.getByRole('button', { name: 'Werte', exact: true });
  if ((await werteKopf.getAttribute('aria-expanded')) !== 'true') {
    await werteKopf.click();
  }
  await page.locator('main').getByRole('link', { name: 'Können', exact: true }).click();
  await expect(page).toHaveURL(/\/koennen$/);
  if (handy) {
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Heute');
  }
  await bild('heute-koennen');

  try {
    await setzeFunktion(page, { koennen: false });
    await page.goto('/charakter');
    await expect(page.locator('main a[href="/koennen"]')).toHaveCount(0);
    await page.goto('/mehr');
    await expect(page.locator('[data-seitenliste] a[href="/koennen"]')).toHaveCount(0);
    if (!handy) {
      await expect(page.locator('aside.seitenleiste a[href="/koennen"]')).toHaveCount(0);
    }
    await page.goto('/koennen');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main h1')).toHaveText('Übersicht');
  } finally {
    await setzeFunktion(page, { koennen: true });
  }
});
