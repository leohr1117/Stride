import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';

const FOLIEN = [
  'Fortschritt und Ziele werden als Level sichtbar.',
  'Auch große Ziele starten mit einem Schritt.',
  'Dranbleiben zählt als Serie.',
  'Einträge festhalten reicht.',
] as const;

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testteil');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.locator('button[type="submit"]').click();
  await seite.waitForFunction(async () => {
    const antwort = await fetch('/api/einstellungen');
    return antwort.ok;
  });
}

async function onboarding(seite: Page): Promise<void> {
  await seite.evaluate(async () => {
    const antwort = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!antwort.ok) {
      throw new Error(`zuruecksetzen ${antwort.status}`);
    }
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
  });
  await seite.goto('/');
}

async function ohneSeitlichenUeberhang(seite: Page): Promise<void> {
  const treffer = await seite.evaluate(() => {
    const wurzel = document.documentElement;
    const liste: string[] = [];
    if (wurzel.scrollWidth > wurzel.clientWidth + 1) {
      liste.push(`page ${wurzel.scrollWidth}>${wurzel.clientWidth}`);
    }
    for (const el of document.querySelectorAll('a, button, h1, h2, nav span')) {
      if (!(el instanceof HTMLElement) || el.classList.contains('truncate')) {
        continue;
      }
      const stil = getComputedStyle(el);
      if (
        (stil.overflowX === 'hidden' || stil.textOverflow === 'ellipsis') &&
        el.scrollWidth > el.clientWidth + 2 &&
        (el.textContent ?? '').trim()
      ) {
        liste.push((el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80));
      }
    }
    return liste;
  });
  expect(treffer).toEqual([]);
}

async function sprachwahlSichtbar(seite: Page, sprache: Sprache): Promise<void> {
  await expect(seite.getByRole('heading', { name: zeige('Sprache', sprache), exact: true })).toBeVisible();
  await expect(seite.getByRole('radio', { name: SPRACH_NAME[sprache], exact: true })).toBeChecked();
  await expect(seite.getByText(zeige(FOLIEN[0], sprache))).toHaveCount(0);
  await expect(seite.getByRole('heading', { name: zeige('Profilname', sprache), exact: true })).toHaveCount(0);
  const breite = seite.viewportSize()?.width ?? 0;
  for (const code of SPRACHEN) {
    const knopf = seite.getByRole('radio', { name: SPRACH_NAME[code], exact: true });
    await knopf.scrollIntoViewIfNeeded();
    const kasten = await knopf.boundingBox();
    expect(kasten).not.toBeNull();
    expect(kasten!.x).toBeGreaterThanOrEqual(-1);
    expect(kasten!.x + kasten!.width).toBeLessThanOrEqual(breite + 1);
  }
  await ohneSeitlichenUeberhang(seite);
}

async function einfuehrung(seite: Page, sprache: Sprache): Promise<void> {
  await seite.getByRole('button', { name: zeige('Weiter', sprache), exact: true }).click();
  for (let index = 0; index < FOLIEN.length; index += 1) {
    await expect(seite.getByText(zeige(FOLIEN[index], sprache))).toBeVisible();
    const letzter = index === FOLIEN.length - 1;
    await seite.getByRole('button', { name: zeige(letzter ? 'Zu den Fragen' : 'Weiter', sprache), exact: true }).click();
  }
  await expect(seite.getByRole('heading', { name: zeige('Profilname', sprache), exact: true })).toBeVisible();
  await expect(seite.getByRole('heading', { name: zeige('Geburtsjahr', sprache), exact: true })).toHaveCount(0);
  await seite.locator('input[name="nickname"]').fill('Lauf76');
  await seite.getByRole('button', { name: zeige('Weiter', sprache), exact: true }).click();

  await expect(seite.getByRole('heading', { name: zeige('Geburtsjahr', sprache), exact: true })).toBeVisible();
  await expect(seite.getByRole('heading', { name: zeige('Was willst du erreichen?', sprache), exact: true })).toHaveCount(0);
  await seite.locator('input[name="bday-year"]').fill('1994');
  await seite.getByRole('button', { name: zeige('Weiter', sprache), exact: true }).click();

  await expect(seite.getByRole('heading', { name: zeige('Was willst du erreichen?', sprache), exact: true })).toBeVisible();
  await seite.getByRole('radio', { name: zeige('Ein Lebensziel', sprache) }).click();
  await seite.getByRole('button', { name: zeige('Weiter', sprache), exact: true }).click();

  await expect(seite.getByRole('heading', { name: zeige('Fokus', sprache), exact: true })).toBeVisible();
  await seite.getByRole('button', { name: zeige('Sport', sprache) }).click();
  await seite.getByRole('button', { name: zeige('Zum Handbuch', sprache), exact: true }).click();
  await expect(seite.getByRole('heading', { name: zeige('Handbuch', sprache), exact: true })).toBeVisible();
}

async function vorlagenNamen(seite: Page): Promise<string[]> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/vorlagen');
    if (!antwort.ok) {
      throw new Error(`vorlagen ${antwort.status}`);
    }
    const daten = (await antwort.json()) as { name: string }[];
    return daten.map((eintrag) => eintrag.name);
  });
}

async function gespeicherteSprache(seite: Page): Promise<string | null> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error(`einstellungen ${antwort.status}`);
    }
    const daten = (await antwort.json()) as { sprache: string | null };
    return daten.sprache;
  });
}

test('Deutsch: Sprache, Folien, Name, Jahr, dann die übrigen Fragen', async ({ page }, info) => {
  test.skip(info.project.name !== 'handy', 'Reihenfolge und 390 px nur auf dem Handy');
  await anmelden(page);
  await onboarding(page);
  await sprachwahlSichtbar(page, 'de');
  await expect(page.getByText('Gilt für die ganze App und für die Start-Tätigkeiten.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toContainText('Gilt für die ganze App und für die Start-Tätigkeiten.');
  await page.keyboard.press('Escape');
  await einfuehrung(page, 'de');
  const namen = await vorlagenNamen(page);
  expect(namen).toEqual(expect.arrayContaining(['Training', 'Laufen', 'Dehnen']));
  expect(namen).not.toContain('Running');
  expect(namen).not.toContain('Courir');
  expect(await gespeicherteSprache(page)).toBe('de');
});

test.describe('Englisch', () => {
  test.use({ locale: 'en-US' });

  test('wirkt sofort und speichert die Start-Tätigkeiten auf Englisch', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Englisch auf 1440 px');
    await anmelden(page);
    await onboarding(page);
    await sprachwahlSichtbar(page, 'en');
    await page.getByRole('radio', { name: 'Deutsch', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sprache', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeVisible();
    await expect(page.getByText('Progress and goals show up as levels.')).toHaveCount(0);
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await sprachwahlSichtbar(page, 'en');
    await einfuehrung(page, 'en');
    const namen = await vorlagenNamen(page);
    expect(namen).toEqual(expect.arrayContaining(['Training', 'Running', 'Stretching']));
    expect(namen).not.toContain('Laufen');
    expect(namen).not.toContain('Dehnen');
    expect(await gespeicherteSprache(page)).toBe('en');
  });
});

test.describe('Französisch', () => {
  test.use({ locale: 'fr-FR' });

  test('speichert die Start-Tätigkeiten auf Französisch', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Französisch auf 1440 px');
    await anmelden(page);
    await onboarding(page);
    await sprachwahlSichtbar(page, 'fr');
    await einfuehrung(page, 'fr');
    const namen = await vorlagenNamen(page);
    expect(namen).toEqual(expect.arrayContaining(['Entraînement', 'Courir', 'Étirements']));
    expect(namen).not.toContain('Laufen');
    expect(namen).not.toContain('Training');
    expect(await gespeicherteSprache(page)).toBe('fr');
    await page.evaluate(() => localStorage.removeItem('ascend-sprache'));
    await page.reload();
    await expect(page.getByRole('navigation').getByRole('link', { name: zeige('Übersicht', 'fr'), exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveCount(0);
  });
});
