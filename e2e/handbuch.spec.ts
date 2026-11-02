import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

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
  await expect(sprung.getByRole('link', { name: 'Einträge', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Streak', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Level', exact: true })).toBeVisible();
  await expect(sprung.getByRole('link', { name: 'Visionen', exact: true })).toHaveCount(stand.visionen ? 1 : 0);
  await expect(sprung.getByRole('link', { name: 'Vorbilder', exact: true })).toHaveCount(stand.vorbilder ? 1 : 0);

  await expect(page.getByRole('heading', { name: 'Einträge', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Streak', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Level', level: 2 })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Dauer', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'XP ohne Boni', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Beute', exact: true })).toHaveCount(0);
  await expect(page.getByText('Empfohlen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nach Vorliebe', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nachschlagen', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Schalten', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Öffnen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Info' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hinweis zu den Werten' })).toHaveCount(0);

  const dauer = page.getByRole('columnheader', { name: 'Dauer', exact: true });
  const xp = page.getByRole('columnheader', { name: 'XP ohne Boni', exact: true });
  const kopfSchrift = await dauer.evaluate((element) => getComputedStyle(element).fontSize);
  expect(kopfSchrift).toBe('13px');
  await expect(dauer).toHaveCSS('text-align', 'left');
  await expect(xp).toHaveCSS('text-align', 'right');
  const ziffern = await xp.evaluate((element) => getComputedStyle(element).fontVariantNumeric);
  expect(ziffern).toContain('tabular-nums');

  const kaesten = page.locator('main section.karte').filter({ has: page.locator('table') });
  const masse = await kaesten.evaluateAll((liste) =>
    liste.map((element) => ({
      overflow: getComputedStyle(element).overflowX,
      scroll: element.scrollWidth,
      client: element.clientWidth,
    })),
  );
  expect(masse.length).toBeGreaterThanOrEqual(3);
  for (const kasten of masse) {
    expect(kasten.overflow === 'auto' || kasten.overflow === 'scroll').toBe(true);
  }
  if (handy) {
    expect(masse.some((kasten) => kasten.scroll > kasten.client + 1)).toBe(true);
  }
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/handbuch/${projekt}-oben.png` });
  await page.locator('#visionen').screenshot({ path: `tmp-test/handbuch/${projekt}-visionen.png` });
  await page.locator('#vorbilder').screenshot({ path: `tmp-test/handbuch/${projekt}-vorbilder.png` });

  await sprung.getByRole('link', { name: 'Level', exact: true }).click();
  await expect(page).toHaveURL(/#level$/);
  const lage = await page.evaluate(() => {
    const titel = document.querySelector('#level h2');
    const kopf = document.querySelector('[data-kopf]');
    if (!titel || !kopf) {
      return null;
    }
    return { oben: titel.getBoundingClientRect().top, kopf: kopf.getBoundingClientRect().bottom };
  });
  expect(lage).not.toBeNull();
  expect(lage?.oben ?? 0).toBeGreaterThanOrEqual((lage?.kopf ?? 0) - 2);
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
