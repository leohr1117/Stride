import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';

async function merkbild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/einfuehrung', { recursive: true });
  await seite.screenshot({ path: `tmp-test/einfuehrung/${test.info().project.name}-${name}.png`, fullPage: true });
}

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

function knopf(seite: Page, sprache: Sprache, name: string) {
  return seite.getByRole('button', { name: zeige(name, sprache), exact: true });
}

async function alteAngeboteWeg(seite: Page): Promise<void> {
  await expect(seite.getByText('Annehmen', { exact: true })).toHaveCount(0);
  await expect(seite.getByText('Vorbild', { exact: true })).toHaveCount(0);
  await expect(seite.getByText('Erster Boss', { exact: true })).toHaveCount(0);
  await expect(seite.getByText('Zum Handbuch', { exact: true })).toHaveCount(0);
}

async function sprachwahlSichtbar(seite: Page, sprache: Sprache): Promise<void> {
  await expect(seite.getByRole('heading', { name: zeige('Sprache', sprache), exact: true })).toBeVisible();
  await expect(seite.getByRole('radio', { name: SPRACH_NAME[sprache], exact: true })).toBeChecked();
  await expect(seite.getByRole('heading', { name: zeige('Wie heißt du in Stride?', sprache), exact: true })).toHaveCount(0);
  const breite = seite.viewportSize()?.width ?? 0;
  for (const code of SPRACHEN) {
    const wahl = seite.getByRole('radio', { name: SPRACH_NAME[code], exact: true });
    const kasten = await wahl.boundingBox();
    expect(kasten).not.toBeNull();
    expect(kasten!.x).toBeGreaterThanOrEqual(-1);
    expect(kasten!.x + kasten!.width).toBeLessThanOrEqual(breite + 1);
  }
  await ohneSeitlichenUeberhang(seite);
}

async function nameWeiter(seite: Page, sprache: Sprache): Promise<void> {
  await expect(seite.locator('input[name="nickname"]')).toHaveValue('testteil');
  await knopf(seite, sprache, 'Weiter').click();
}

async function sportWaehlen(seite: Page, sprache: Sprache): Promise<void> {
  await seite.getByRole('button', { name: zeige('Sport', sprache) }).click();
  await expect(seite.getByRole('button', { name: zeige('Sport', sprache) })).toHaveAttribute('aria-pressed', 'true');
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

function anfragenMerken(seite: Page): string[] {
  const koerper: string[] = [];
  seite.on('request', (anfrage) => {
    if (anfrage.method() === 'PATCH' && anfrage.url().includes('/api/einstellungen')) {
      koerper.push(anfrage.postData() ?? '');
    }
  });
  return koerper;
}

test('Weg A legt ein Projekt an und Fertig öffnet Heute', async ({ page }) => {
  test.setTimeout(120_000);
  const koerper = anfragenMerken(page);
  let aktionen = 0;
  await anmelden(page);
  await onboarding(page);
  await sprachwahlSichtbar(page, 'de');
  await alteAngeboteWeg(page);
  await merkbild(page, 'a-sprache');
  aktionen += 1;
  await knopf(page, 'de', 'Weiter').click();

  await expect(page.getByRole('heading', { name: 'Wie heißt du in Stride?', exact: true })).toBeVisible();
  await expect(page.getByText('Halte fest, was du tust. Daraus werden Level und Streak.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Geburtsjahr', exact: true })).toHaveCount(0);
  await ohneSeitlichenUeberhang(page);
  await merkbild(page, 'a-name');
  aktionen += 1;
  await nameWeiter(page, 'de');

  await expect(page.getByRole('heading', { name: 'Worin willst du wachsen?', exact: true })).toBeVisible();
  aktionen += 1;
  await sportWaehlen(page, 'de');
  await expect(page.getByText('Tätigkeiten:')).toBeVisible();
  await ohneSeitlichenUeberhang(page);
  await merkbild(page, 'a-fokus');
  aktionen += 1;
  await knopf(page, 'de', 'Weiter').click();

  await expect(page.getByRole('heading', { name: 'Was willst du erreichen?', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Projekte umsetzen' })).toBeChecked();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
  await expect(page.getByRole('progressbar').locator('span')).toHaveCount(5);
  await merkbild(page, 'a-ziel');
  aktionen += 1;
  await knopf(page, 'de', 'Weiter').click();

  await expect(page.getByRole('heading', { name: 'Dein erstes Projekt', exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(page);
  await merkbild(page, 'a-projekt');
  await page.locator('input[name="zielname"]').pressSequentially('Test');
  aktionen += 4;
  aktionen += 1;
  await knopf(page, 'de', 'Jetzt anlegen').click();

  await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
  await expect(page.getByText('testteil', { exact: true })).toBeVisible();
  await expect(page.getByText('Training, Laufen, Dehnen')).toBeVisible();
  await expect(page.getByText('Projekte, Vorhaben', { exact: true })).toBeVisible();
  await expect(page.getByText('Projekt', { exact: true })).toBeVisible();
  await expect(page.getByText('Test', { exact: true })).toBeVisible();
  await expect(page.getByText('Alles änderst du unter Mehr.')).toBeVisible();
  await alteAngeboteWeg(page);
  await ohneSeitlichenUeberhang(page);
  await merkbild(page, 'a-abschluss');
  aktionen += 1;
  await knopf(page, 'de', 'Fertig').click();
  expect(aktionen).toBeLessThanOrEqual(12);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dein erstes Projekt', exact: true })).toHaveCount(0);
  await merkbild(page, 'a-heute');

  await page.goto('/ziele');
  await expect(page.getByText('Test', { exact: true })).toBeVisible();
  const namen = await vorlagenNamen(page);
  expect(namen).toEqual(expect.arrayContaining(['Training', 'Laufen', 'Dehnen']));
  expect(namen).not.toContain('Running');
  expect(await gespeicherteSprache(page)).toBe('de');
  const text = koerper.join('\n');
  expect(text).not.toContain('startVorbild');
  expect(text).not.toContain('startBoss');
  expect(text).toContain('startZiel');

  const vorbilderAn = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funktionen: { vorbilder: true } }),
    });
    return antwort.ok;
  });
  expect(vorbilderAn).toBe(true);
  await page.goto('/vorbilder/kipchoge');
  await expect(page.getByRole('heading', { name: 'Lebensweg', exact: true })).toBeVisible();
  await expect(page.getByText('Jahr eintragen', { exact: true })).toBeVisible();
  await merkbild(page, 'a-jahr');
  await page.getByRole('link', { name: 'Geburtsjahr', exact: true }).evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/\/mehr\/profil\/jahr$/);
});

test('Weg B überspringt bis auf die Sprache', async ({ page }) => {
  test.setTimeout(90_000);
  await anmelden(page);
  await onboarding(page);
  await knopf(page, 'de', 'Weiter').click();
  await expect(page.locator('input[name="nickname"]')).toHaveValue('testteil');
  await knopf(page, 'de', 'Überspringen').click();
  await expect(page.getByRole('heading', { name: 'Worin willst du wachsen?', exact: true })).toBeVisible();
  await knopf(page, 'de', 'Überspringen').click();
  await expect(page.getByRole('radio', { name: 'Projekte umsetzen' })).toBeChecked();
  await knopf(page, 'de', 'Überspringen').click();
  await expect(page.getByRole('heading', { name: 'Dein erstes Projekt', exact: true })).toBeVisible();
  await knopf(page, 'de', 'Überspringen').click();
  await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
  await expect(page.getByText('testteil', { exact: true })).toBeVisible();
  await expect(page.getByText('Projekte, Vorhaben', { exact: true })).toBeVisible();
  await expect(page.getByText('—', { exact: true })).toBeVisible();
  await expect(page.getByText('Test', { exact: true })).toHaveCount(0);
  await alteAngeboteWeg(page);
  await merkbild(page, 'b-abschluss');
  await knopf(page, 'de', 'Fertig').click();
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  const namen = await vorlagenNamen(page);
  expect(namen).toEqual([]);
});

test('Weg C legt eine Fähigkeit an', async ({ page }) => {
  test.setTimeout(90_000);
  await anmelden(page);
  await onboarding(page);
  await knopf(page, 'de', 'Weiter').click();
  await nameWeiter(page, 'de');
  await sportWaehlen(page, 'de');
  await knopf(page, 'de', 'Weiter').click();
  await page.getByRole('radio', { name: 'In etwas besser werden' }).click();
  await knopf(page, 'de', 'Weiter').click();
  await expect(page.getByRole('heading', { name: 'Worin zuerst?', exact: true })).toBeVisible();
  await page.locator('input[name="zielname"]').fill('Gitarre');
  await knopf(page, 'de', 'Jetzt anlegen').click();
  await expect(page.getByText('Fähigkeit', { exact: true })).toBeVisible();
  await expect(page.getByText('Gitarre', { exact: true })).toBeVisible();
  await knopf(page, 'de', 'Fertig').click();
  await page.goto('/faehigkeiten');
  await expect(page.getByText('Gitarre', { exact: true })).toBeVisible();
});

test('Weg D hat vier Schritte und kein erstes Ziel', async ({ page }) => {
  test.setTimeout(90_000);
  await anmelden(page);
  await onboarding(page);
  await knopf(page, 'de', 'Weiter').click();
  await nameWeiter(page, 'de');
  await sportWaehlen(page, 'de');
  await knopf(page, 'de', 'Weiter').click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
  await page.getByRole('radio', { name: 'Einfach festhalten' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByRole('progressbar').locator('span')).toHaveCount(4);
  await merkbild(page, 'd-vier');
  await knopf(page, 'de', 'Weiter').click();
  await expect(page.getByRole('heading', { name: 'Dein erstes Projekt', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
  await expect(page.getByText('Nur Einträge', { exact: true })).toBeVisible();
  await knopf(page, 'de', 'Fertig').click();
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
});

test('Zurück auf Schritt 4 behält den Fokus', async ({ page }) => {
  await anmelden(page);
  await onboarding(page);
  await knopf(page, 'de', 'Weiter').click();
  await nameWeiter(page, 'de');
  await sportWaehlen(page, 'de');
  await knopf(page, 'de', 'Weiter').click();
  await expect(page.getByRole('heading', { name: 'Was willst du erreichen?', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Worin willst du wachsen?', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sport' })).toHaveAttribute('aria-pressed', 'true');
  await merkbild(page, 'zurueck-fokus');
});

test.describe('Englisch', () => {
  test.use({ locale: 'en-US' });

  test('wirkt sofort und speichert die Start-Tätigkeiten auf Englisch', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Englisch auf 1440 px');
    test.setTimeout(120_000);
    await anmelden(page);
    await onboarding(page);
    await sprachwahlSichtbar(page, 'en');
    await page.getByRole('radio', { name: 'Deutsch', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sprache', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await sprachwahlSichtbar(page, 'en');
    await knopf(page, 'en', 'Weiter').click();
    await expect(page.getByRole('heading', { name: 'What should Stride call you?', exact: true })).toBeVisible();
    await nameWeiter(page, 'en');
    await sportWaehlen(page, 'en');
    await knopf(page, 'en', 'Weiter').click();
    await knopf(page, 'en', 'Weiter').click();
    await page.locator('input[name="zielname"]').fill('Test');
    await knopf(page, 'en', 'Jetzt anlegen').click();
    await expect(page.getByText('Projects, Task', { exact: true })).toBeVisible();
    await knopf(page, 'en', 'Fertig').click();
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
    test.setTimeout(120_000);
    await anmelden(page);
    await onboarding(page);
    await sprachwahlSichtbar(page, 'fr');
    await knopf(page, 'fr', 'Weiter').click();
    await nameWeiter(page, 'fr');
    await sportWaehlen(page, 'fr');
    await knopf(page, 'fr', 'Weiter').click();
    await knopf(page, 'fr', 'Weiter').click();
    await page.locator('input[name="zielname"]').fill('Test');
    await knopf(page, 'fr', 'Jetzt anlegen').click();
    await knopf(page, 'fr', 'Fertig').click();
    const namen = await vorlagenNamen(page);
    expect(namen).toEqual(expect.arrayContaining(['Entraînement', 'Courir', 'Étirements']));
    expect(namen).not.toContain('Laufen');
    expect(namen).not.toContain('Training');
    expect(await gespeicherteSprache(page)).toBe('fr');
    await page.evaluate(() => localStorage.removeItem('ascend-sprache'));
    await page.reload();
    await expect(page.getByRole('navigation').getByRole('link', { name: zeige('Heute', 'fr'), exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveCount(0);
  });
});

async function wegASprache(seite: Page, sprache: Sprache): Promise<void> {
  await anmelden(seite);
  await onboarding(seite);
  await seite.getByRole('radio', { name: SPRACH_NAME[sprache], exact: true }).click();
  await sprachwahlSichtbar(seite, sprache);
  await merkbild(seite, `${sprache}-sprache`);
  await knopf(seite, sprache, 'Weiter').click();
  await expect(seite.getByRole('heading', { name: zeige('Wie heißt du in Stride?', sprache), exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(seite);
  await merkbild(seite, `${sprache}-name`);
  await nameWeiter(seite, sprache);
  await expect(seite.getByRole('heading', { name: zeige('Worin willst du wachsen?', sprache), exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(seite);
  await sportWaehlen(seite, sprache);
  await knopf(seite, sprache, 'Weiter').click();
  await expect(seite.getByRole('heading', { name: zeige('Was willst du erreichen?', sprache), exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(seite);
  await merkbild(seite, `${sprache}-ziel`);
  await knopf(seite, sprache, 'Weiter').click();
  await expect(seite.getByRole('heading', { name: zeige('Dein erstes Projekt', sprache), exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(seite);
  await seite.locator('input[name="zielname"]').fill('Test');
  await knopf(seite, sprache, 'Jetzt anlegen').click();
  await expect(seite.getByRole('heading', { name: zeige('Eingerichtet', sprache), exact: true })).toBeVisible();
  await expect(seite.getByText(zeige('Projekte, Vorhaben', sprache), { exact: true })).toBeVisible();
  await expect(seite.getByText('Test', { exact: true })).toBeVisible();
  await ohneSeitlichenUeberhang(seite);
  await merkbild(seite, `${sprache}-abschluss`);
  await knopf(seite, sprache, 'Fertig').click();
  await expect(seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) })).toBeVisible();
}

test.describe('Russisch', () => {
  test.use({ locale: 'ru-RU' });

  test('Weg A ohne seitlichen Überhang', async ({ page }) => {
    test.setTimeout(120_000);
    await wegASprache(page, 'ru');
  });
});

test.describe('Japanisch', () => {
  test.use({ locale: 'ja-JP' });

  test('Weg A ohne seitlichen Überhang', async ({ page }) => {
    test.setTimeout(120_000);
    await wegASprache(page, 'ja');
  });
});
