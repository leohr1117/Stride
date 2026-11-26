import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function warteHinweisStabil(seite: Page): Promise<void> {
  await seite.evaluate(() => document.fonts.ready);
  let vorher: string | null = null;
  await expect.poll(async () => {
    const text = await seite.locator('[data-zustand="zu-niedrig"]').evaluateAll((liste) =>
      liste.map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim()).join('|'),
    );
    const stabil = vorher !== null && text === vorher;
    vorher = text;
    return stabil;
  }).toBe(true);
}

async function setzeFunktion(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Profilzeilen öffnen Können, Haben, Fähigkeiten und Investitionen', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-test/profil-seiten/${testInfo.project.name}-${name}.png`, fullPage: true });
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
  await expect(page.locator('main h1')).toHaveText('Profil');
  await expect(page.getByRole('button', { name: 'Erfolge', exact: true })).toHaveCount(0);
  const profil = page.locator('main');
  for (const [pfad, anzahl] of Object.entries(zahlen)) {
    const zeile = profil.locator('[data-zeile]').filter({ has: page.locator(`a[href="${pfad}"]`) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText(String(anzahl));
    await expect(zeile.getByRole('link')).toHaveAttribute('aria-label', /^(Können|Haben|Fähigkeiten|Investitionen)$/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('profil');

  await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
  const blatt = page.getByRole('dialog', { name: 'Klassen und Titel' });
  await expect(blatt.locator('table')).toBeVisible();
  await expect(blatt.getByRole('columnheader', { name: 'Können', exact: true })).toBeVisible();
  await expect(blatt.getByRole('columnheader', { name: 'Archetyp', exact: true })).toBeVisible();
  await expect(blatt.getByRole('columnheader', { name: 'Beiname', exact: true })).toBeVisible();
  await expect(blatt.getByText('Fett ist dein stärkstes Können. Der Beiname folgt dem zweitstärksten.', { exact: true })).toBeVisible();
  await expect(blatt.getByText(/bis Level/)).toBeVisible();
  await expect(blatt.getByText('Allrounder', { exact: false }).first()).toBeVisible();
  await expect(blatt.getByRole('heading', { name: 'Titel', exact: true })).toBeVisible();
  const tabelleKasten = await blatt.locator('table').boundingBox();
  const satz = blatt.getByText('Fett ist dein stärkstes Können. Der Beiname folgt dem zweitstärksten.', { exact: true });
  const satzKasten = await satz.boundingBox();
  expect(tabelleKasten && satzKasten).toBeTruthy();
  if (tabelleKasten && satzKasten) {
    expect(tabelleKasten.y + tabelleKasten.height).toBeLessThanOrEqual(satzKasten.y + 1);
  }
  await blatt.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(blatt).toBeHidden();

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
  await warteHinweisStabil(page);
  await bild('koennen');

  await page.goto('/haben');
  await expect(page.locator('main h1')).toHaveText('Haben');
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  await expect(page.locator('[data-spektrum="status"]')).toBeVisible();
  await expect(page.locator('[data-abzug="allgemein"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Attribut hinzufügen', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Archiv anzeigen/ })).toBeVisible();
  const habenZeile = page.locator('main .attributzeile').first();
  const habenIcon = habenZeile.locator('svg').first();
  const habenMenue = habenZeile.getByRole('button', { name: /Aktionen für/ });
  await expect(habenMenue).toBeVisible();
  const iconKasten = await habenIcon.boundingBox();
  const menueKasten = await habenMenue.boundingBox();
  expect(iconKasten && menueKasten).toBeTruthy();
  if (iconKasten && menueKasten) {
    expect(iconKasten.x + iconKasten.width).toBeLessThanOrEqual(menueKasten.x);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('haben');

  await page.goto('/faehigkeiten');
  await expect(page.locator('main h1')).toHaveText('Fähigkeiten');
  await expect(page.getByText('Lädt …')).toHaveCount(0);
  const skillZeile = page.locator('main [data-zeile="navigation"]').first();
  await expect(skillZeile).toBeVisible();
  const ring = skillZeile.locator('[data-levelring]');
  await expect(ring).toBeVisible();
  const ringBreite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(ringBreite).toBe(56);
  const skillName = await skillZeile.getByRole('link').getAttribute('aria-label');
  expect(skillName).toBeTruthy();
  const nameKasten = await skillZeile.getByText(skillName ?? '', { exact: true }).boundingBox();
  const ringKasten = await ring.boundingBox();
  expect(nameKasten && ringKasten).toBeTruthy();
  if (nameKasten && ringKasten) {
    expect(ringKasten.x + ringKasten.width).toBeLessThanOrEqual(nameKasten.x + 2);
  }
  await expect(skillZeile).not.toContainText(/Lvl \d/);
  const skillMenue = skillZeile.getByRole('button', { name: /Aktionen für/ });
  const skillPfeil = skillZeile.locator('.zeile-pfeil');
  await expect(skillMenue).toBeVisible();
  await expect(skillPfeil).toBeVisible();
  const skillMenueKasten = await skillMenue.boundingBox();
  const pfeilKasten = await skillPfeil.boundingBox();
  expect(skillMenueKasten && pfeilKasten).toBeTruthy();
  if (skillMenueKasten && pfeilKasten) {
    expect(skillMenueKasten.x + skillMenueKasten.width).toBeLessThanOrEqual(pfeilKasten.x + 2);
  }
  await expect(page.getByRole('button', { name: '+ Fähigkeit anlegen', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Neu', exact: true })).toHaveCount(0);
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
  await page.locator('[data-kopf]').getByRole('button', { name: /^Info/ }).click();
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
  await warteHinweisStabil(page);
  await bild('heute-koennen');

  try {
    await setzeFunktion(page, { koennen: false });
    await page.goto('/charakter');
    await expect(page.locator('main a[href="/koennen"]')).toHaveCount(0);
    await expect(page.locator('main a[href="/haben"]')).toBeVisible();
    await expect(page.locator('main a[href="/faehigkeiten"]')).toBeVisible();
    await expect(page.locator('main a[href="/investitionen"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Erfolge', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Titel', exact: true })).toBeVisible();
    await page.goto('/mehr');
    await expect(page.locator('[data-seitenliste] a[href="/koennen"]')).toHaveCount(0);
    if (!handy) {
      await expect(page.locator('aside.seitenleiste a[href="/koennen"]')).toHaveCount(0);
    }
    await page.goto('/koennen');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main h1')).toHaveText('Heute');
  } finally {
    await setzeFunktion(page, { koennen: true });
  }
});
