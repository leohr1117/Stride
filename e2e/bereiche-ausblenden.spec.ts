import { expect, test, type Page } from './uhr.ts';
import { anmelden } from './helfer.ts';
import { TEST_URL } from './testdaten.ts';

const ALT_IDS = [
  'funktion-basis',
  'funktion-chronik',
  'funktion-rueckblick',
  'funktion-statistiken',
  'funktion-vorbilder',
  'funktion-handbuch',
  'funktion-koennen',
  'funktion-status',
  'funktion-faehigkeiten',
  'funktion-ausruestung',
  'ziel-visionen',
  'ziel-organisationen',
  'ziel-projekte',
  'ziel-vorhaben',
  'funktion-bossAngriffe',
  'funktion-verfallKoennen',
  'funktion-verfallHaben',
] as const;

const HINWEIS_FRAGE = 'Benachrichtigungen einschalten?';

interface Stufe {
  schluessel: string;
  name: string;
  erreichtAm: string | null;
}

interface ErfolgeAntwort {
  titel: string | null;
  kategorien: { stufen: Stufe[] }[];
}

interface EinstellungenStand {
  funktionen: Record<string, boolean>;
}

function identitaet(seite: Page) {
  return seite.locator('.identitaets-flaeche p.text-leise').first();
}

async function setzeFunktionen(seite: Page, funktionen: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen } });
  expect(antwort.ok()).toBe(true);
}

async function setzeTitel(seite: Page, schluessel: string | null): Promise<void> {
  const antwort = await seite.request.put('/api/titel', { data: { schluessel } });
  expect(antwort.ok()).toBe(true);
}

test('Bereiche zeigt Erfolge und Hinweise zuletzt, Ausblenden lässt den Titel weg', async ({ page }) => {
  await anmelden(page);
  const einstellungenAntwort = await page.request.get('/api/einstellungen');
  expect(einstellungenAntwort.ok()).toBe(true);
  const stand = (await einstellungenAntwort.json()) as EinstellungenStand;
  const erfolgeAntwort = await page.request.get('/api/erfolge');
  expect(erfolgeAntwort.ok()).toBe(true);
  const erfolge = (await erfolgeAntwort.json()) as ErfolgeAntwort;
  const stufe = erfolge.kategorien.flatMap((kategorie) => kategorie.stufen).find((eintrag) => eintrag.erreichtAm !== null);
  expect(stufe).toBeTruthy();
  if (!stufe) {
    return;
  }

  try {
    await page.goto('/mehr/funktionen');
    await expect(page.locator('main h1')).toHaveText('Bereiche');
    const gruppen = page.locator('main h2');
    await expect(gruppen).toHaveText(['Seiten', 'Seiten im Profil', 'Auf Ziele', 'Regeln', 'Funktionen']);
    const schalter = page.locator('[data-zeile="schalter"]');
    await expect(schalter).toHaveCount(ALT_IDS.length + 3);
    const ids = await schalter.evaluateAll((zeilen) => zeilen.map((zeile) => zeile.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ALT_IDS, 'funktion-streak', 'funktion-erfolge', 'geraet-hinweise']);
    const streakSchalter = page.locator('#funktion-streak').getByRole('switch', { name: 'Streak', exact: true });
    await expect(streakSchalter).toHaveAttribute('aria-checked', 'true');
    await expect(streakSchalter).toBeEnabled();
    await expect(page.locator('#funktion-streak')).toContainText('Aus pausiert die Kette. Momentum bleibt solange bei 1,0.');
    await expect(page.locator('#funktion-streak .lucide-flame')).toHaveCount(1);
    const erfolgeSchalter = page.locator('#funktion-erfolge').getByRole('switch', { name: 'Erfolge und Titel', exact: true });
    const hinweiseSchalter = page.locator('#geraet-hinweise').getByRole('switch', { name: 'Hinweise auf Heute', exact: true });
    await expect(erfolgeSchalter).toHaveAttribute('aria-checked', 'true');
    await expect(hinweiseSchalter).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#geraet-hinweise')).toContainText('Gilt nur auf diesem Gerät.');
    await expect(page.locator('#funktion-erfolge')).not.toContainText('Gilt nur auf diesem Gerät.');
    for (const id of ALT_IDS) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }

    await setzeTitel(page, stufe.schluessel);
    await page.goto('/');
    const zeile = identitaet(page);
    await expect(zeile).toContainText(` · ${stufe.name}`);
    const voll = ((await zeile.innerText()) ?? '').trim();
    const klasse = voll.slice(0, voll.lastIndexOf(` · ${stufe.name}`));
    expect(klasse.length).toBeGreaterThan(0);

    await page.goto('/mehr/funktionen');
    await erfolgeSchalter.click();
    await expect(erfolgeSchalter).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('status')).toHaveCount(0);

    await page.goto('/');
    await expect(identitaet(page)).toHaveText(klasse);
    await expect(identitaet(page)).not.toContainText(stufe.name);
    await expect(identitaet(page)).not.toContainText('·');
    await expect(page.getByText('Erfolg:')).toHaveCount(0);

    await page.goto('/mehr/profil');
    await expect(page.getByRole('heading', { name: 'Konto', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Titel', exact: true })).toHaveCount(0);
    await page.goto('/mehr/profil/titel');
    await expect(page).toHaveURL(/\/mehr\/profil$/);
    await expect(page.getByRole('heading', { name: 'Konto', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Titel', exact: true })).toHaveCount(0);

    await page.goto('/charakter');
    const klassen = page.getByRole('button', { name: 'Klassen', exact: true });
    await expect(klassen).toBeVisible();
    await expect(page.getByRole('button', { name: 'Klassen und Titel', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Titel', exact: true })).toHaveCount(0);
    await klassen.click();
    const dialog = page.getByRole('dialog', { name: 'Klassen', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('section').getByRole('heading', { name: 'Klassen', exact: true })).toBeVisible();
    await expect(dialog.locator('section').getByRole('heading', { name: 'Titel', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await setzeFunktionen(page, { koennen: false, erfolge: true });
    await page.goto('/charakter');
    const titelZeile = page.getByRole('button', { name: 'Titel', exact: true });
    await expect(titelZeile).toBeVisible();
    await expect(page.getByRole('button', { name: 'Klassen', exact: true })).toHaveCount(0);
    await titelZeile.click();
    const titelDialog = page.getByRole('dialog', { name: 'Titel', exact: true });
    await expect(titelDialog).toBeVisible();
    await expect(titelDialog.locator('section').getByRole('heading', { name: 'Titel', exact: true })).toBeVisible();
    await expect(titelDialog.locator('section').getByRole('heading', { name: 'Klassen', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(titelDialog).toHaveCount(0);

    await setzeFunktionen(page, { koennen: false, erfolge: false });
    await page.goto('/charakter');
    await expect(page.getByRole('button', { name: 'Klassen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Titel', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Klassen und Titel', exact: true })).toHaveCount(0);

    await setzeFunktionen(page, { koennen: true, erfolge: true });
    await page.goto('/');
    await expect(identitaet(page)).toHaveText(voll);
    await expect(page.getByText('Erfolg:')).toHaveCount(0);
    await page.goto('/charakter');
    await expect(page.getByRole('button', { name: 'Klassen und Titel', exact: true })).toBeVisible();
    await page.goto('/mehr/profil');
    await expect(page.getByRole('link', { name: 'Titel', exact: true })).toBeVisible();
  } finally {
    await setzeFunktionen(page, stand.funktionen);
    await setzeTitel(page, erfolge.titel);
  }
});

test('Hinweise auf Heute gelten nur für dieses Gerät', async ({ page, browser }, testInfo) => {
  await anmelden(page);
  await page.goto('/mehr/funktionen');
  const hinweise = page.locator('#geraet-hinweise').getByRole('switch', { name: 'Hinweise auf Heute', exact: true });
  await expect(hinweise).toHaveAttribute('aria-checked', 'true');
  const patches: string[] = [];
  page.on('request', (anfrage) => {
    if (anfrage.method() === 'PATCH' && anfrage.url().includes('/api/einstellungen')) {
      patches.push(anfrage.postData() ?? '');
    }
  });
  await hinweise.click();
  await expect(hinweise).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('stride.hinweiseAus'))).toBe('1');
  expect(patches).toEqual([]);
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.evaluate(() => sessionStorage.setItem('stride.hinweisAngebot', '1'));
  await page.goto('/');
  const platz = page.locator('[data-hinweis-platz]');
  await expect(platz).toHaveCount(1);
  await expect(platz.getByRole('region')).toHaveCount(0);

  await page.goto('/mehr');
  await page.evaluate(() => {
    const ereignis = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(ereignis, {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
    });
    window.dispatchEvent(ereignis);
  });
  await expect(page.getByRole('button', { name: 'Als App installieren', exact: true })).toBeVisible();

  await page.goto('/mehr/funktionen');
  const wiederAn = page.locator('#geraet-hinweise').getByRole('switch', { name: 'Hinweise auf Heute', exact: true });
  const vorher = patches.length;
  await wiederAn.click();
  await expect(wiederAn).toHaveAttribute('aria-checked', 'true');
  expect(patches.slice(vorher)).toEqual([]);
  expect(patches.some((körper) => körper.includes('hinweise'))).toBe(false);
  await expect(page.getByRole('status')).toContainText('Hinweise auf Heute an');
  await page.goto('/');
  await expect(page.locator('[data-hinweis-platz]').getByRole('region', { name: HINWEIS_FRAGE, exact: true })).toBeVisible();

  const sicht = testInfo.project.use.viewport ?? { width: 390, height: 844 };
  const kontext = await browser.newContext({
    baseURL: TEST_URL,
    viewport: sicht,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block',
  });
  await kontext.addInitScript(() => {
    sessionStorage.setItem('stride.hinweisAngebot', '1');
  });
  const andere = await kontext.newPage();
  try {
    await anmelden(andere);
    await andere.goto('/');
    await expect(andere.locator('[data-hinweis-platz]').getByRole('region', { name: HINWEIS_FRAGE, exact: true })).toBeVisible();
    expect(await andere.evaluate(() => localStorage.getItem('stride.hinweiseAus'))).toBeNull();
  } finally {
    await kontext.close();
  }
});
