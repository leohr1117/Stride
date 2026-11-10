import { expect, test, type Page } from './uhr.ts';
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

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Vorbilder: Liste ohne Radar, Prozent in der Zeile und Richtung', async ({ page }) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  const du = page.locator('[data-flaeche] [data-zeile="lesen"]').filter({ hasText: 'Du · Level' });
  await expect(du).toBeVisible();
  const duHoehe = await du.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(duHoehe - 48)).toBeLessThanOrEqual(1);
  await expect(du.getByRole('link')).toHaveCount(0);
  await expect(du.getByRole('button')).toHaveCount(0);
  await expect(page.locator('.recharts-wrapper')).toHaveCount(0);

  const zeilen = page.locator('[data-zeile]').filter({ has: page.locator('a[href^="/vorbilder/"]') });
  const massstab = zeilen.filter({ has: page.locator('a[href="/vorbilder/durchschnitt"]') });
  await expect(massstab).toContainText('Durchschnittsmensch');
  await expect(massstab).toContainText(/%/);
  const anzahl = await zeilen.count();
  expect(anzahl).toBeGreaterThan(10);
  for (let index = 0; index < anzahl; index += 1) {
    await expect(zeilen.nth(index)).toContainText(/%/);
  }

  const breite = page.viewportSize()?.width ?? 0;
  const erste = await zeilen.nth(0).boundingBox();
  const zweite = await zeilen.nth(1).boundingBox();
  expect(erste && zweite).toBeTruthy();
  if (erste && zweite) {
    expect(Math.abs(zweite.x - erste.x)).toBeLessThan(2);
    expect(zweite.y).toBeGreaterThan(erste.y + 20);
  }

  const richtungen = [
    'Körper',
    'Wettkampf',
    'Strategie',
    'Esports/Gaming',
    'Kunst',
    'Content/Creator',
    'Innovation/Technik',
    'Business/Unternehmertum',
    'Finanzen/Investing/Crypto',
    'Wissenschaft/Genies',
    'Führung/Wandel',
  ];
  const kaesten: { x: number; y: number; width: number; height: number }[] = [];
  for (const name of ['Alle', ...richtungen]) {
    const chip = page.getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(chip).toBeVisible();
    const gequetscht = await chip.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(gequetscht, name).toBe(false);
    const kasten = await chip.boundingBox();
    expect(kasten, name).toBeTruthy();
    if (kasten) {
      kaesten.push(kasten);
    }
  }
  const rolle = page.locator('div.overflow-x-auto').filter({ has: page.getByRole('button', { name: /^Alle/ }) });
  const rollKasten = await rolle.boundingBox();
  expect(rollKasten).toBeTruthy();
  if (rollKasten) {
    expect(rollKasten.x).toBeGreaterThanOrEqual(-1);
    expect(rollKasten.x + rollKasten.width).toBeLessThanOrEqual(breite + 1);
  }
  const chipY = kaesten.map((kasten) => kasten.y);
  expect(Math.max(...chipY) - Math.min(...chipY)).toBeLessThan(8);
  expect(Math.abs(kaesten[1].x - (kaesten[0].x + kaesten[0].width) - 8)).toBeLessThanOrEqual(1);
  const rand = await rolle.evaluate((scroller) => {
    const innen = scroller.firstElementChild;
    const knoepfe = [...scroller.querySelectorAll('button.chip')];
    const erster = knoepfe[0];
    const letzter = knoepfe[knoepfe.length - 1];
    const flaeche = erster?.querySelector('.chip-flaeche');
    if (!(innen instanceof HTMLElement) || !erster || !letzter || !flaeche) {
      return null;
    }
    const stil = getComputedStyle(innen);
    scroller.scrollLeft = 0;
    const start = erster.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    scroller.scrollLeft = scroller.scrollWidth;
    const ende = scroller.getBoundingClientRect().right - letzter.getBoundingClientRect().right;
    scroller.scrollLeft = 0;
    return {
      links: Math.round(parseFloat(stil.paddingLeft)),
      rechts: Math.round(parseFloat(stil.paddingRight)),
      start: Math.round(start),
      ende: Math.round(ende),
      flaeche: Math.round(flaeche.getBoundingClientRect().height),
    };
  });
  expect(rand).not.toBeNull();
  expect(rand?.links).toBe(16);
  expect(rand?.rechts).toBe(16);
  expect(Math.abs((rand?.start ?? 99) - 16)).toBeLessThanOrEqual(1);
  expect(Math.abs((rand?.ende ?? 99) - 16)).toBeLessThanOrEqual(1);
  expect(rand?.flaeche).toBe(36);
  for (let links = 0; links < kaesten.length; links += 1) {
    for (let rechts = links + 1; rechts < kaesten.length; rechts += 1) {
      const a = kaesten[links];
      const b = kaesten[rechts];
      const ueberX = a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1;
      const ueberY = a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
      expect(ueberX && ueberY, `${links} ${rechts}`).toBe(false);
    }
  }
  await expect(page.locator('body')).not.toContainText('°');
  await ohneSeitlichenUeberlauf(page);

  const hinweis = page.getByRole('button', { name: /^Info zu / });
  const kasten = await hinweis.boundingBox();
  expect(kasten).toBeTruthy();
  if (kasten) {
    expect(kasten.width).toBeGreaterThanOrEqual(14);
    expect(kasten.width).toBeLessThanOrEqual(20);
    expect(kasten.height).toBeGreaterThanOrEqual(14);
    expect(kasten.height).toBeLessThanOrEqual(20);
  }
  const deltaListe = await page.getByRole('heading', { name: 'Ähnlich', exact: true }).evaluate((titel) => {
    const knopf = titel.parentElement?.querySelector('button');
    if (!knopf) {
      return null;
    }
    const icon = knopf.getBoundingClientRect();
    const schrift = titel.getBoundingClientRect();
    return Math.abs(icon.top + icon.height / 2 - (schrift.top + schrift.height / 2));
  });
  expect(deltaListe).not.toBeNull();
  expect(deltaListe ?? 99).toBeLessThanOrEqual(4);
  await hinweis.click();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.',
  );

  const alle = page.getByRole('button', { name: /^Alle/ });
  await expect(alle).toHaveAttribute('aria-pressed', 'true');
  await expect(alle.locator('svg')).toHaveCount(1);
  const beste = Number((await alle.innerText()).match(/(\d+)\s*%/)?.[1]);
  expect(beste).toBeGreaterThanOrEqual(40);
  const wettkampf = page.getByRole('button', { name: /^Wettkampf/ });
  await expect(wettkampf).toContainText(/%/);
  const chipZahl = (await wettkampf.innerText()).match(/(\d+)\s*%/)?.[1];
  expect(chipZahl).toBeTruthy();
  await wettkampf.click();
  await expect(wettkampf.locator('svg')).toHaveCount(1);
  await expect(alle.locator('svg')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Elon Musk/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Cristiano Ronaldo/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lionel Messi/ })).toBeVisible();
  const aehnlich = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ähnlich', exact: true }) });
  const ersteZeile = aehnlich.locator('[data-zeile]').first();
  await expect(ersteZeile).toContainText(`${chipZahl} %`);
  const zeileLaeuftUeber = await ersteZeile.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(zeileLaeuftUeber).toBe(false);
  await ohneSeitlichenUeberlauf(page);

  await page.getByRole('button', { name: /^Content/ }).click();
  await expect(page.getByRole('link', { name: /MrBeast/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Khaby Lame/ })).toBeVisible();

  await page.getByRole('button', { name: /^Wissenschaft/ }).click();
  await expect(page.getByRole('link', { name: /Albert Einstein/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Leonardo da Vinci/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cristiano Ronaldo/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);

  await page.getByRole('button', { name: /^Führung/ }).click();
  await expect(page.getByRole('link', { name: /Nelson Mandela/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Barack Obama/ })).toBeVisible();

  await page.getByRole('button', { name: /^Alle/ }).click();
  await page.getByRole('link', { name: /Cristiano Ronaldo/ }).click();
  await expect(page.getByRole('heading', { name: 'Cristiano Ronaldo', exact: true })).toBeVisible();
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  const prozentZeile = page.locator('[data-aehnlichkeit]');
  await expect(prozentZeile).toContainText(/%\s*ähnlich/);
  const nameHinweis = page.getByRole('button', { name: /^Info zu / });
  await expect(nameHinweis).toBeVisible();
  const deltaName = await page.getByRole('heading', { name: 'Profil im Vergleich', exact: true }).evaluate((titel) => {
    const knopf = titel.parentElement?.querySelector('button');
    if (!knopf) {
      return null;
    }
    const icon = knopf.getBoundingClientRect();
    const schrift = titel.getBoundingClientRect();
    return Math.abs(icon.top + icon.height / 2 - (schrift.top + schrift.height / 2));
  });
  expect(deltaName).not.toBeNull();
  expect(deltaName ?? 99).toBeLessThanOrEqual(4);
  await expect(page.locator('body')).not.toContainText('°');
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/vorbilder/einstein');
  await expect(page.getByRole('heading', { name: 'Albert Einstein', exact: true })).toBeVisible();
  await expect(page.getByText('1879 bis 1955')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Info zu / })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  await page.goto('/handbuch');
  const liste = page.locator('#vorbilder');
  await expect(liste.getByRole('columnheader')).toHaveCount(0);
  const zeile = liste.locator('.zeile').filter({ hasText: 'Cristiano Ronaldo' });
  await expect(zeile.locator('.zeile-neben')).toHaveText('Wettkampf');
  await expect(zeile.locator('.zeile-wert')).toContainText('Lvl');
  const nebenTexte = await liste.locator('.zeile-neben').allTextContents();
  expect(nebenTexte.filter((text) => text === 'Körper')).toHaveLength(2);
  expect(nebenTexte.filter((text) => text === 'Wissenschaft/Genies')).toHaveLength(2);
  expect(nebenTexte.filter((text) => text === 'Finanzen/Investing/Crypto')).toHaveLength(1);
  expect(nebenTexte.filter((text) => text === 'Führung/Wandel')).toHaveLength(2);
  await expect(liste.locator('.zeile-titel', { hasText: 'Albert Einstein' })).toBeVisible();
  await expect(liste.getByText('Graham Stephan', { exact: true })).toHaveCount(0);
  await expect(liste.getByText('donk', { exact: true })).toHaveCount(0);
  const langeRichtung = liste.locator('.zeile').filter({ hasText: 'Warren Buffett' }).locator('.zeile-neben');
  const langGequetscht = await langeRichtung.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(langGequetscht).toBe(false);
  await ohneSeitlichenUeberlauf(page);
});
