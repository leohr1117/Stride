import { expect, test, type Page } from './uhr.ts';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';
import { TEST_PASSWORT } from './testdaten.ts';

test.use({ locale: 'en-US' });

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: /Sign in|Anmelden/ }).click();
  await seite.getByRole('button', { name: /Log entry|Eintrag loggen/ }).waitFor();
}

async function gespeicherteSprache(seite: Page): Promise<Sprache | null> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error(`einstellungen ${antwort.status}`);
    }
    const daten = (await antwort.json()) as { sprache: Sprache | null };
    return daten.sprache;
  });
}

async function setzeSprache(seite: Page, wert: Sprache): Promise<void> {
  await seite.evaluate(async (sprache) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache }),
    });
    if (!antwort.ok) {
      throw new Error(`sprache ${antwort.status}`);
    }
  }, wert);
  await seite.goto('/');
  await seite.getByRole('button', { name: zeige('Eintrag loggen', wert) }).waitFor();
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

test('Englisch bleibt bei 390 und 1440 lesbar', async ({ page }) => {
  await anmelden(page);
  const vorher = await gespeicherteSprache(page);
  if (vorher === 'de') {
    await setzeSprache(page, 'en');
  }
  try {
    const name = await page.evaluate(async () => {
      const antwort = await fetch('/api/einstellungen');
      const daten = (await antwort.json()) as { charakterName: string };
      return daten.charakterName;
    });
    await expect(page.locator('main').getByText(name, { exact: true }).locator('visible=true')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log entry' })).toBeVisible();
    await ohneSeitlichenUeberhang(page);

    for (const ziel of [
      { pfad: '/laufend', text: 'Active' },
      { pfad: '/ziele', text: 'Goals' },
      { pfad: '/vorbilder', text: 'Role models' },
      { pfad: '/handbuch', text: 'Guide' },
      { pfad: '/mehr', text: 'More' },
      { pfad: '/mehr/darstellung', text: 'Appearance' },
    ]) {
      await page.goto(ziel.pfad);
      await expect(page.getByRole('heading', { name: ziel.text, exact: true })).toBeVisible();
      await ohneSeitlichenUeberhang(page);
    }

    await expect(page.getByText('Language', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Language,/ }).click();
    await expect(page.getByRole('radio', { name: 'Deutsch', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English', exact: true })).toBeVisible();
  } finally {
    if (vorher === 'de') {
      await setzeSprache(page, 'de');
    }
  }
});

test('jede Sprache bleibt auf 390 px vollständig sichtbar', async ({ page }, info) => {
  test.setTimeout(180_000);
  test.skip(info.project.name !== 'handy', 'Stichprobe nur auf 390 px');
  await anmelden(page);
  const vorher = await gespeicherteSprache(page);
  try {
    for (const code of SPRACHEN) {
      await setzeSprache(page, code);
      await expect(page.getByRole('link', { name: zeige('Heute', code), exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: zeige('Eintrag loggen', code) })).toBeVisible();
      await ohneSeitlichenUeberhang(page);
      for (const ziel of [
        { pfad: '/ziele', text: zeige('Ziele', code) },
        { pfad: '/handbuch', text: zeige('Handbuch', code) },
        { pfad: '/mehr', text: zeige('Mehr', code) },
        { pfad: '/mehr/darstellung', text: zeige('Darstellung', code) },
      ]) {
        await page.goto(ziel.pfad);
        await expect(page.getByRole('heading', { name: ziel.text, exact: true })).toBeVisible();
        await ohneSeitlichenUeberhang(page);
      }
      await page.getByRole('button', { name: new RegExp(`^${zeige('Sprache', code)},`) }).click();
      const liste = page.getByRole('radiogroup', { name: zeige('Sprache', code) });
      for (const name of SPRACHEN) {
        const knopf = liste.getByRole('radio', { name: SPRACH_NAME[name], exact: true });
        await expect(knopf).toBeVisible();
        const kasten = await knopf.boundingBox();
        expect(kasten).not.toBeNull();
        expect(kasten!.x).toBeGreaterThanOrEqual(-1);
        expect(kasten!.x + kasten!.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 390);
      }
      await page.keyboard.press('Escape');
      const schrift = await page.evaluate(() => ({
        familie: getComputedStyle(document.body).fontFamily,
        stil: document.documentElement.dataset.stil ?? '',
      }));
      if (code === 'ru') {
        expect(schrift.familie).toContain(schrift.stil === 'standard' ? 'Segoe UI' : 'Exo 2');
      }
      if (code === 'zh') {
        expect(schrift.familie).toMatch(/YaHei|PingFang|Noto Sans SC|Hiragino Sans GB/);
      }
      if (code === 'ja') {
        expect(schrift.familie).toMatch(/Yu Gothic|Hiragino|Meiryo|Noto Sans JP/);
      }
    }
  } finally {
    await setzeSprache(page, vorher ?? 'de');
  }
});
