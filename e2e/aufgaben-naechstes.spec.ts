import { expect, test } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte } from './aufgabenHelfer.ts';

function plusTage(iso: string, tage: number): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  const datum = new Date(jahr ?? 0, (monat ?? 1) - 1, tag ?? 1);
  datum.setDate(datum.getDate() + tage);
  const monatText = String(datum.getMonth() + 1).padStart(2, '0');
  const tagText = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monatText}-${tagText}`;
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Als Nächstes und der Satz unter Mehr', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/aufgaben-110/${projekt}-${name}.png` });
  const namen = {
    heute: `Bau Heute ${projekt}`,
    ohne: `Bau Ohne ${projekt}`,
    alt: `Bau Alt ${projekt}`,
    nah: `Bau Nah ${projekt}`,
    rand: `Bau Rand ${projekt}`,
    fern: `Bau Fern ${projekt}`,
  };

  await page.goto('/mehr/funktionen');
  await schalte(page, true);
  await raeumeBau(page);

  const vorlagenAntwort = await page.request.get('/api/vorlagen');
  expect(vorlagenAntwort.ok()).toBe(true);
  const vorlagen = (await vorlagenAntwort.json()) as { id: number; name: string; archiviert: boolean }[];
  const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
  expect(vorlage).toBeTruthy();
  const heute = await heuteDerWelt(page);
  const basis = {
    icon: 'clipboard-list',
    projektId: null,
    organisationId: null,
    visionId: null,
    vorlageId: vorlage?.id,
    stunden: null,
    faelligUm: null,
    wiederholung: 'keine',
    wochentage: [],
    prioritaet: null,
    nurHeute: false,
    meilenstein: false,
    gegner: false,
    boss: false,
    deadline: null,
  };
  const termine: Record<keyof typeof namen, string | null> = {
    heute,
    ohne: null,
    alt: plusTage(heute, -2),
    nah: plusTage(heute, 1),
    rand: plusTage(heute, 7),
    fern: plusTage(heute, 8),
  };
  for (const schluessel of Object.keys(namen) as (keyof typeof namen)[]) {
    const angelegt = await page.request.post('/api/aufgaben', {
      data: { ...basis, name: namen[schluessel], faelligAm: termine[schluessel] },
    });
    expect(angelegt.ok()).toBe(true);
  }

  try {
    await page.goto('/aufgaben');
    const abschnitt = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Als Nächstes', exact: true }),
    });
    const kopf = abschnitt.getByRole('button', { name: 'Als Nächstes', exact: true });
    await expect(kopf).toHaveAttribute('aria-expanded', 'false');
    for (const name of [namen.nah, namen.rand]) {
      await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
    }
    for (const name of [namen.heute, namen.ohne, namen.alt, namen.fern]) {
      const zeile = page.getByRole('listitem').filter({ hasText: name });
      await expect(zeile).toBeVisible();
      await expect(abschnitt.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
    }
    await expect(page.getByText('Noch keine Aufgaben.')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');
    await kopf.scrollIntoViewIfNeeded();
    await bild('zu');

    await kopf.click();
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    for (const name of [namen.nah, namen.rand]) {
      const zeile = abschnitt.getByRole('listitem').filter({ hasText: name });
      await expect(zeile).toBeVisible();
      await expect(zeile.locator('input')).toHaveCount(0);
    }
    await expect(abschnitt.getByRole('listitem').filter({ hasText: namen.fern })).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: namen.fern })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await abschnitt.getByRole('listitem').filter({ hasText: namen.nah }).scrollIntoViewIfNeeded();
    await bild('auf');

    const nah = abschnitt.getByRole('listitem').filter({ hasText: namen.nah });
    await nah.getByRole('button', { name: 'Erledigt', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(abschnitt.getByRole('listitem').filter({ hasText: namen.nah })).toHaveCount(0);
    const erledigt = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Erledigt', exact: true }),
    });
    await expect(erledigt.getByRole('listitem').filter({ hasText: namen.nah })).toBeVisible();
    await expect(abschnitt.getByRole('listitem').filter({ hasText: namen.rand })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await erledigt.scrollIntoViewIfNeeded();
    await bild('kreis');

    await page.goto('/mehr/funktionen');
    const demnaechst = page.locator('#demnaechst');
    await demnaechst.scrollIntoViewIfNeeded();
    const demKopf = demnaechst.getByRole('button', { name: 'Demnächst', exact: true });
    if ((await demKopf.getAttribute('aria-expanded')) !== 'true') {
      await demKopf.click();
    }
    await expect(demnaechst.getByText('Training, Lernen', { exact: true })).toBeVisible();
    await expect(demnaechst.getByText('Training, Lernen, Aufgaben')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('mehr');
  } finally {
    await raeumeBau(page);
  }
});
