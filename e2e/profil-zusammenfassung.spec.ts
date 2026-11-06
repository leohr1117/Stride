import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function bild(info: TestInfo, name: string): string {
  return `tmp-test/profil-zusammenfassung/${info.project.name}-${name}.png`;
}

async function kastenMitteY(seite: Page, selektor: string): Promise<number[]> {
  return seite.locator(selektor).evaluateAll((knoten) =>
    knoten.map((knoten) => {
      const kasten = knoten.getBoundingClientRect();
      return kasten.y + kasten.height / 2;
    }),
  );
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Profil fasst Level, Kennzahlen, Blätter und Spektren zusammen', async ({ page }, info) => {
  await page.goto('/charakter');
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(page.locator('main [data-levelring]')).toBeVisible();
  const ringBreite = await page.locator('main [data-levelring]').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(ringBreite).toBe(104);
  await expect(page.locator('main .kopfblock-name')).toHaveClass(/text-2xl/);

  const kennzahlen = page.locator('[data-kennzahlen]');
  await expect(kennzahlen.getByText('Einträge', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Meilensteine', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Kleine Ziele geschafft', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Aktive Tage', { exact: true })).toBeVisible();
  const mitten = await kastenMitteY(page, '[data-kennzahlen] p.zahl');
  expect(mitten.length).toBe(4);
  expect(Math.max(...mitten) - Math.min(...mitten)).toBeLessThan(6);

  const koennen = page.locator('[data-spektrum="attribut"]');
  const haben = page.locator('[data-spektrum="status"]');
  await expect(koennen).toBeVisible();
  await expect(haben).toBeVisible();
  const koennenKasten = await koennen.boundingBox();
  const habenKasten = await haben.boundingBox();
  expect(koennenKasten && habenKasten).toBeTruthy();
  if (koennenKasten && habenKasten) {
    expect(Math.abs(koennenKasten.y - habenKasten.y)).toBeLessThan(12);
    expect(habenKasten.x).toBeGreaterThan(koennenKasten.x + 40);
  }
  await expect(page.getByRole('button', { name: 'Attribut hinzufügen', exact: true })).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: 'Können', exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'profil'), fullPage: true });

  await page.getByRole('button', { name: 'Erfolge', exact: true }).click();
  const erfolge = page.getByRole('dialog', { name: 'Erfolge' });
  await expect(erfolge).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(erfolge).toHaveCount(0);

  await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
  const klassen = page.getByRole('dialog', { name: 'Klassen und Titel' });
  await expect(klassen).toBeVisible();
  const zeichen = klassen.locator('.klassenbild');
  await expect(zeichen).not.toHaveClass(/profilbild/);
  const liste = await zeichen.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--flaeche-2)';
    document.body.append(probe);
    const flaeche = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(element).backgroundColor === flaeche;
  });
  expect(liste).toBe(false);
  await klassen.screenshot({ path: bild(info, 'klassen') });
  await page.keyboard.press('Escape');
  await expect(klassen).toHaveCount(0);

  await page.getByRole('link', { name: 'Profil bearbeiten', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/profil$/);
  await expect(page.locator('main').getByRole('link', { name: 'Profilname', exact: true })).toBeVisible();
  const zurueck = page.locator('a[data-zurueck]');
  await expect(zurueck).toHaveAttribute('aria-label', 'Zurück zu Profil');
  await zurueck.click();
  await expect(page).toHaveURL(/\/charakter$/);
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
});

test('An einer Fähigkeit liegt das Menü im Kopf', async ({ page }, info) => {
  const faehigkeit = await page.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error('Fähigkeiten nicht geladen');
    }
    const liste = (await antwort.json()) as { id: number; name: string; archiviert: boolean; knoten: unknown[] }[];
    return liste.find((eintrag) => eintrag.name === 'Programmieren' && !eintrag.archiviert) ?? liste.find((eintrag) => !eintrag.archiviert) ?? null;
  });
  expect(faehigkeit).toBeTruthy();
  if (!faehigkeit) {
    return;
  }

  await page.goto(`/faehigkeiten/${faehigkeit.id}`);
  await expect(page.getByRole('heading', { name: faehigkeit.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fähigkeit bearbeiten', exact: true })).toHaveCount(0);
  await expect(page.locator('.baum-karte')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'faehigkeit'), fullPage: true });

  await page.getByRole('button', { name: `Aktionen für ${faehigkeit.name}`, exact: true }).click();
  const menue = page.getByRole('menu');
  await expect(menue.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
  expect(await menue.getByRole('menuitem').count()).toBeGreaterThan(1);
  await page.screenshot({ path: bild(info, 'faehigkeit-menue'), fullPage: true });
  await menue.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Fähigkeit', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Vorbilder sind eine Liste mit seitlichen Richtungen', async ({ page }, info) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ähnlich', exact: true })).toBeVisible();
  const hinweis = page.getByRole('button', { name: /^Info zu / });
  await hinweis.click();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.',
  );
  await page.keyboard.press('Escape');

  const alle = page.getByRole('button', { name: /^Alle/ });
  await expect(alle).toHaveAttribute('aria-pressed', 'true');
  await expect(alle.locator('svg')).toHaveCount(1);
  await page.getByRole('button', { name: /^Wettkampf/ }).click();
  await expect(page).toHaveURL(/richtung=Wettkampf/);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'vorbilder'), fullPage: true });

  await page.getByRole('link', { name: 'Cristiano Ronaldo', exact: true }).click();
  await expect(page).toHaveURL(/\/vorbilder\/ronaldo$/);
  await expect(page.getByRole('heading', { name: 'Cristiano Ronaldo', exact: true })).toBeVisible();
  const kopf = page.locator('.vorbild-kopf');
  await expect(kopf).toBeVisible();
  await expect(kopf.locator('[data-vorbild-herkunft]')).toBeVisible();
  await expect(kopf.locator('[data-vorbild-stand]')).toContainText('Lvl');
  await expect(kopf.getByText('Cristiano Ronaldo', { exact: true })).toHaveCount(0);
  await expect(page.locator('.profil-name')).toHaveCount(0);
  await expect(page.locator('main .karte')).toHaveCount(0);
  const vergleich = page.getByRole('heading', { name: 'Profil im Vergleich', exact: true });
  await expect(vergleich).toBeVisible();
  await page.getByRole('button', { name: /^Info zu / }).click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'vorbild'), fullPage: true });
});
