import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function platzLink(seite: Page, pfad: string) {
  return seite.locator(`nav.mobilleiste a[href="${pfad}"], aside.seitenleiste a[href="${pfad}"]`).locator('visible=true').first();
}

async function leiste(seite: Page): Promise<string[]> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { mobilLeiste: string[] };
    return daten.mobilLeiste;
  });
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Vorbilder ohne Leistenplatz führt nach Mehr, mit Leistenplatz hat keinen Pfeil', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/zurueck-stapel/${testInfo.project.name}-${name}.png`, fullPage: true });
  const pc = (page.viewportSize()?.width ?? 0) >= 768;
  const inDerLeiste = (await leiste(page)).includes('/vorbilder');
  await page.goto('/mehr');
  await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/vorbilder';
    link.textContent = 'Zu den Vorbildern';
    document.querySelector('main')?.append(link);
    link.click();
  });
  await expect(page).toHaveURL(/\/vorbilder$/);
  if (pc || inDerLeiste) {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
    await expect(platzLink(page, '/vorbilder')).toHaveAttribute('aria-current', 'page');
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(1);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
    await bild('vorbilder');
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr$/);
  }
  await ohneSeitlichenUeberlauf(page);

  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/vorbilder');
  if (pc || inDerLeiste) {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    await page.goBack();
    await expect(page).toHaveURL(/\/mehr$/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('vorbilder-direkt');
});

test('Heute behält den Boss und Ziele behält Archiv und Scrollstand', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/zurueck-stapel/${testInfo.project.name}-${name}.png`, fullPage: true });
  await page.goto('/');
  const boss = page.locator('section', { has: page.getByRole('heading', { name: 'Bosse greifen an' }) }).locator('a[href^="/projekte/"]').first();
  await expect(boss).toBeVisible();
  await boss.click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  await expect(platzLink(page, '/')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(1);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/');
  await ohneSeitlichenUeberlauf(page);
  await bild('boss');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);

  await page.goto('/');
  await page.locator('section', { has: page.getByRole('heading', { name: 'Bosse greifen an' }) }).locator('a[href^="/projekte/"]').first().click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  const archivProjekt = await page.evaluate(async () => {
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert && eintrag.projektId === null);
    if (!vorlage) {
      return null;
    }
    const angelegt = await fetch('/api/projekte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Archiv-Rueckweg',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlage.id,
        abschlussVorlageId: null,
      }),
    });
    if (!angelegt.ok) {
      return null;
    }
    const projekt = (await angelegt.json()) as { id: number };
    const archiv = await fetch(`/api/projekte/${projekt.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archiviert: true }),
    });
    return archiv.ok ? projekt.id : null;
  });
  expect(archivProjekt).not.toBeNull();
  try {
  await page.evaluate(() => {
    localStorage.removeItem('stride.eingeklappt.ziele-archiv');
    localStorage.removeItem('ascend.eingeklappt.ziele-archiv');
  });
  await page.goto('/ziele');
  const archiv = page.getByRole('button', { name: 'Archiv', exact: true });
  await expect(archiv).toBeVisible();
  await expect(archiv).toHaveAttribute('aria-expanded', 'false');
  await archiv.click();
  await expect(archiv).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => {
    const haupt = document.querySelector('main');
    if (haupt) haupt.style.minHeight = '2400px';
    window.scrollTo(0, 640);
    document.querySelector('a[href^="/projekte/"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    );
  });
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/ziele');
  await bild('projekt');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/ziele$/);
  await expect(page.getByRole('button', { name: 'Archiv', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  await ohneSeitlichenUeberlauf(page);
  await bild('ziele-archiv');
  } finally {
    if (archivProjekt !== null) {
      await page.evaluate(async (id) => {
        await fetch(`/api/projekte/${id}`, { method: 'DELETE' });
      }, archivProjekt);
    }
  }
});

test('Ein Platz merkt sich die letzte Seite und der Tipp kehrt an den Anfang', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/zurueck-stapel/${testInfo.project.name}-${name}.png`, fullPage: true });
  const vorher = await leiste(page);
  await page.evaluate(async () => {
    await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mobilLeiste: ['/', '/ziele', '/chronik', '/mehr'] }),
    });
  });
  try {
    await page.reload();
    await page.goto('/ziele');
    const projekt = page.locator('a[href^="/projekte/"]').first();
    await projekt.click();
    const adresse = page.url();
    await expect(page).toHaveURL(/\/projekte\/\d+$/);
    await platzLink(page, '/').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(platzLink(page, '/')).toHaveAttribute('aria-current', 'page');
    await platzLink(page, '/ziele').click();
    await expect(page).toHaveURL(adresse);
    await expect(platzLink(page, '/ziele')).toHaveAttribute('aria-current', 'page');
    await ohneSeitlichenUeberlauf(page);
    await bild('platz');
    await platzLink(page, '/ziele').click();
    await expect(page).toHaveURL(/\/ziele$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/projekte\/\d+$/);
  } finally {
    await page.evaluate(async (mobilLeiste) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobilLeiste }),
      });
    }, vorher);
  }
});

test('Tätigkeiten ist am PC ein Leistenplatz und führt sonst nach Mehr', async ({ page }, testInfo) => {
  const pc = (page.viewportSize()?.width ?? 0) >= 768;
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/mehr/inhalte');
  await expect(page.locator('main h1')).toHaveText('Tätigkeiten');
  if (pc) {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
    await expect(page.locator('aside.seitenleiste a[href="/mehr"]')).not.toHaveAttribute('aria-current', 'page');
  } else {
    await expect(page.locator('a[data-zurueck]')).toHaveCount(1);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
    await expect(page.locator('nav.mobilleiste a[href="/mehr"]')).toHaveAttribute('aria-current', 'page');
  }
  await page.screenshot({ path: `tmp-test/zurueck-stapel/${testInfo.project.name}-taetigkeiten.png`, fullPage: true });
  await ohneSeitlichenUeberlauf(page);

  if (pc) {
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    return;
  }

  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/mehr$/);
  await page.locator('main a[href="/mehr/inhalte"]').click();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await page.goBack();
  await expect(page).toHaveURL(/\/mehr$/);
});

test('Direktaufruf eines Projekts führt nach Ziele', async ({ page }) => {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/projekte/5');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(1);
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/ziele');
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Ziele');
  await page.locator('a[data-zurueck]').click();
  await expect(page).toHaveURL(/\/ziele$/);
  await ohneSeitlichenUeberlauf(page);
});
