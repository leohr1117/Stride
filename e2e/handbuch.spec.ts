import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function ohneTabellenUeberlauf(seite: Page): Promise<void> {
  const ueber = await seite.evaluate(() => {
    const knoten = [
      ...document.querySelectorAll(
        'main table, main th, main td, #vorbilder .zeile-titel, #vorbilder .zeile-neben, #vorbilder .zeile-wert, #level p',
      ),
    ];
    return knoten
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => (element.textContent ?? '').trim());
  });
  expect(ueber).toEqual([]);
}

async function spracheSetzen(seite: Page, sprache: string): Promise<void> {
  const ok = await seite.evaluate(async (code) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache: code }),
    });
    return antwort.ok;
  }, sprache);
  expect(ok).toBe(true);
}

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/handbuch', { recursive: true });
  await seite.screenshot({ path: `tmp-test/handbuch/${name}.png`, fullPage: true });
}

test('Handbuch ist eine offene Scrollseite', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const handy = projekt === 'handy';
  await anmelden(page);
  const stand = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as {
      mobilLeiste: string[];
      ebenen: { visionen: boolean };
      funktionen: { vorbilder: boolean };
    };
    return {
      leiste: daten.mobilLeiste.includes('/handbuch'),
      visionen: daten.ebenen.visionen,
      vorbilder: daten.funktionen.vorbilder,
    };
  });

  await page.goto('/handbuch');
  await expect(page.locator('main h1')).toHaveText('Handbuch');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(!handy || stand.leiste ? 0 : 1);
  if (handy && !stand.leiste) {
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
  }

  const sprung = page.locator('main nav');
  await expect(sprung).not.toContainText('·');
  await expect(sprung.getByRole('link', { name: 'Einträge', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Streak', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Level', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Visionen', exact: true })).toHaveCount(stand.visionen ? 1 : 0);
  await expect(sprung.getByRole('link', { name: 'Vorbilder', exact: true })).toHaveCount(stand.vorbilder ? 1 : 0);

  expect(await sprung.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
  const reiheUeberlauf = await sprung.locator('> div').evaluate((element) => getComputedStyle(element).overflowX);
  expect(reiheUeberlauf === 'auto' || reiheUeberlauf === 'scroll').toBe(true);
  const eintraege = sprung.getByRole('link', { name: 'Einträge', exact: true });
  expect(await eintraege.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  await expect(eintraege).toHaveAttribute('aria-current', 'true');
  await expect(sprung.locator('[aria-current="true"]')).toHaveCount(1);
  const fuellung = await eintraege.locator('.chip-flaeche').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fuellung).not.toBe('rgba(0, 0, 0, 0)');

  await expect(page.getByRole('heading', { name: 'Einträge', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Streak', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Level', level: 2 })).toBeVisible();
  const eintraegeAbschnitt = page.locator('#eintraege');
  await expect(eintraegeAbschnitt.getByRole('columnheader', { name: 'Dauer', exact: true })).toBeVisible();
  await expect(eintraegeAbschnitt.getByRole('columnheader', { name: 'XP ohne Boni', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Beute', exact: true })).toHaveCount(0);
  await expect(page.getByText('Empfohlen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nach Vorliebe', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nachschlagen', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Schalten', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Öffnen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Info zu / })).toHaveCount(0);

  const dauer = eintraegeAbschnitt.getByRole('columnheader', { name: 'Dauer', exact: true });
  const xp = eintraegeAbschnitt.getByRole('columnheader', { name: 'XP ohne Boni', exact: true });
  const kopfSchrift = await dauer.evaluate((element) => getComputedStyle(element).fontSize);
  expect(kopfSchrift).toBe('13px');
  await expect(dauer).toHaveCSS('text-align', 'left');
  await expect(xp).toHaveCSS('text-align', 'right');
  const ziffern = await xp.evaluate((element) => getComputedStyle(element).fontVariantNumeric);
  expect(ziffern).toContain('tabular-nums');

  const level = page.locator('#level');
  await expect(level.getByRole('columnheader', { name: 'Level', exact: true })).toBeVisible();
  await expect(level.getByRole('columnheader', { name: 'XP', exact: true })).toBeVisible();
  await expect(level.getByRole('columnheader', { name: 'Dauer', exact: true })).toBeVisible();
  await expect(level.getByRole('columnheader', { name: 'XP gesamt', exact: true })).toHaveCount(0);
  const hinweis = level.locator('p');
  await expect(hinweis).toHaveText(/Dauer bei \S+ XP am Tag/);
  const levelZelle = level.locator('tbody td').first();
  const levelSchrift = await levelZelle.evaluate((element) => {
    const stil = getComputedStyle(element);
    return { groesse: stil.fontSize, ziffern: stil.fontVariantNumeric, abstand: stil.paddingLeft };
  });
  expect(levelSchrift.groesse).toBe('15px');
  expect(levelSchrift.ziffern).toContain('tabular-nums');
  expect(levelSchrift.abstand).toBe('12px');
  const levelKopf = level.getByRole('columnheader', { name: 'XP', exact: true });
  expect(await levelKopf.evaluate((element) => getComputedStyle(element).fontSize)).toBe('13px');

  await expect(page.locator('main table')).toHaveCount(stand.visionen ? 4 : 3);
  await ohneTabellenUeberlauf(page);
  if (stand.vorbilder) {
    const vorbildZeilen = page.locator('#vorbilder .zeile');
    await expect(vorbildZeilen.first()).toBeVisible();
    const hoehen = await vorbildZeilen.evaluateAll((liste) =>
      liste.map((element) => ({
        hoehe: element.getBoundingClientRect().height,
        zeilen: element.getAttribute('data-zeilen'),
      })),
    );
    expect(hoehen.length).toBeGreaterThan(0);
    for (const zeile of hoehen) {
      expect(zeile.zeilen).toBe('2');
      expect(Math.abs(zeile.hoehe - 64)).toBeLessThanOrEqual(1);
    }
  }
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/handbuch/${projekt}-oben.png` });
  await page.locator('#visionen').screenshot({ path: `tmp-test/handbuch/${projekt}-visionen.png` });
  await page.locator('#vorbilder').screenshot({ path: `tmp-test/handbuch/${projekt}-vorbilder.png` });

  await sprung.getByRole('link', { name: 'Level', exact: true }).click();
  await expect(page).toHaveURL(/#level$/);
  await expect(sprung.getByRole('link', { name: 'Level', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(sprung.getByRole('link', { name: 'Einträge', exact: true })).not.toHaveAttribute('aria-current', /.+/);
  const lage = await page.evaluate(() => {
    const titel = document.querySelector('#level h2');
    const kopf = document.querySelector('[data-kopf]');
    const bar = document.querySelector('.handbuch-leiste');
    if (!titel || !kopf || !bar) {
      return null;
    }
    return {
      oben: titel.getBoundingClientRect().top,
      kopf: kopf.getBoundingClientRect().bottom,
      leiste: bar.getBoundingClientRect().bottom,
      rand: Number.parseFloat(getComputedStyle(titel).scrollMarginTop),
      hoehe: bar.getBoundingClientRect().height,
    };
  });
  expect(lage).not.toBeNull();
  expect(lage?.oben ?? 0).toBeGreaterThanOrEqual((lage?.kopf ?? 0) - 2);
  expect(lage?.oben ?? 0).toBeGreaterThanOrEqual((lage?.leiste ?? 0) - 2);
  expect(Math.abs((lage?.rand ?? 0) - (lage?.hoehe ?? 0))).toBeLessThanOrEqual(1);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-offen`);

  await page.request.patch('/api/einstellungen', { data: { ebenen: { visionen: false }, funktionen: { vorbilder: false } } });
  try {
    await page.goto('/handbuch');
    await expect(page.getByRole('heading', { name: 'Visionen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Visionen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Vorbilder', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Einträge', level: 2 })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild(page, `${projekt}-ohne`);
  } finally {
    await page.request.patch('/api/einstellungen', {
      data: { ebenen: { visionen: stand.visionen }, funktionen: { vorbilder: stand.vorbilder } },
    });
  }
});

test('Handbuch-Tabellen bleiben in Russisch und Japanisch in der Breite', async ({ page }) => {
  await anmelden(page);
  try {
    for (const sprache of ['ru', 'ja'] as const) {
      await spracheSetzen(page, sprache);
      await page.goto('/handbuch');
      await expect(page.locator('#level p')).toBeVisible();
      await expect(page.locator('#level p')).not.toHaveText(/Dauer bei/);
      await ohneTabellenUeberlauf(page);
      await ohneSeitlichenUeberlauf(page);
    }
  } finally {
    await spracheSetzen(page, 'de');
  }
});
