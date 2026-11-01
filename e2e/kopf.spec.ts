import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function leiste(seite: Page): Promise<string[]> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { mobilLeiste: string[] };
  return daten.mobilLeiste;
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Kopf zeigt Titel, Profilring oder genau einen Pfeil', async ({ page }, testInfo) => {
  const handy = testInfo.project.name === 'handy';
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/u2/${testInfo.project.name}-${name}.png` });
  const profilInLeiste = (await leiste(page)).includes('/charakter');

  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  await expect(page.locator('main').getByText('Test Voll', { exact: true }).locator('visible=true')).toHaveCount(1);
  if (!profilInLeiste) {
    const uebersicht = await page.request.get('/api/uebersicht');
    expect(uebersicht.ok()).toBe(true);
    const level = ((await uebersicht.json()) as { level: { level: number } }).level.level;
    const profil = page.getByRole('link', { name: `Profil, Level ${level}` });
    await expect(profil).toBeVisible();
    const masse = await profil.evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      const bild = element.querySelector('.klassenbild');
      const bildKasten = bild?.getBoundingClientRect();
      return {
        breite: kasten.width,
        hoehe: kasten.height,
        bild: bildKasten ? Math.round(bildKasten.width) : 0,
      };
    });
    expect(masse.breite).toBeGreaterThanOrEqual(48);
    expect(masse.hoehe).toBeGreaterThanOrEqual(48);
    expect(masse.bild).toBeGreaterThanOrEqual(30);
    expect(masse.bild).toBeLessThanOrEqual(34);
  } else {
    await expect(page.locator('header.mobilkopf a[href="/charakter"]')).toHaveCount(0);
  }
  const kopfLage = await page.locator('header.mobilkopf').evaluate((element) => getComputedStyle(element).position);
  expect(kopfLage).toBe(handy ? 'sticky' : 'static');
  await ohneSeitlichenUeberlauf(page);
  await bild('uebersicht');

  await page.goto('/mehr');
  await expect(page.locator('main h1')).toHaveText('Mehr');
  await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
  await bild('mehr');

  await page.goto('/mehr/darstellung');
  const pfeil = page.locator('a[data-zurueck]');
  await expect(pfeil).toHaveCount(1);
  await expect(pfeil).toHaveAttribute('href', '/mehr');
  await expect(pfeil).toHaveAttribute('aria-label', 'Zurück zu Mehr');
  await expect(page.locator('main h1')).toHaveText('Darstellung');
  await expect(page.locator('header.mobilkopf a[data-zurueck]')).toHaveCount(1);
  const kasten = await pfeil.boundingBox();
  const kopf = await page.locator('header.mobilkopf').boundingBox();
  expect(kasten && kopf).toBeTruthy();
  if (kasten && kopf) {
    expect(kasten.width).toBeGreaterThanOrEqual(48);
    expect(kasten.height).toBeGreaterThanOrEqual(48);
    expect(kasten.y).toBeGreaterThanOrEqual(kopf.y - 1);
    expect(kasten.y + kasten.height).toBeLessThanOrEqual(kopf.y + kopf.height + 1);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('darstellung');

  if (handy) {
    await page.evaluate(() => {
      const haupt = document.querySelector('main');
      if (haupt) {
        haupt.style.minHeight = '1600px';
      }
      window.scrollTo(0, 500);
    });
    await expect(pfeil).toBeInViewport();
    await bild('darstellung-scroll');
  }

  await page.goto('/mehr/darstellung');
  await expect(pfeil).toBeVisible();
  let tastaturFokus = false;
  for (let schritt = 0; schritt < 50; schritt += 1) {
    await page.keyboard.press('Tab');
    tastaturFokus = await page.evaluate(
      () => document.activeElement instanceof HTMLAnchorElement && document.activeElement.hasAttribute('data-zurueck'),
    );
    if (tastaturFokus) {
      break;
    }
  }
  expect(tastaturFokus).toBe(true);
  const nachTab = await pfeil.evaluate((element) => ({
    ring: getComputedStyle(element).outlineStyle,
    eingabe: document.documentElement.dataset.eingabe ?? '',
  }));
  expect(nachTab.eingabe).toBe('tastatur');
  expect(nachTab.ring).not.toBe('none');
  await bild('pfeil-tastatur');

  await pfeil.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1 });
  await pfeil.focus();
  await expect(pfeil).toBeFocused();
  const nachTippen = await pfeil.evaluate((element) => ({
    ring: getComputedStyle(element).outlineStyle,
    eingabe: document.documentElement.dataset.eingabe ?? '',
  }));
  expect(nachTippen.eingabe).toBe('zeiger');
  expect(nachTippen.ring).toBe('none');

  const projekte = await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    const daten = (await antwort.json()) as { projekte: { id: number; name: string }[] };
    return daten.projekte;
  });
  const lang = [...projekte].sort((links, rechts) => rechts.name.length - links.name.length)[0];
  expect(lang).toBeTruthy();
  if (!lang) {
    return;
  }
  await page.goto(`/projekte/${lang.id}`);
  const titel = page.locator('main h1');
  await expect(titel).toHaveText(lang.name);
  await expect(titel).toHaveAttribute('title', lang.name);
  const schnitt = await titel.evaluate((element) => ({
    overflow: getComputedStyle(element).overflowX,
    umbruch: getComputedStyle(element).whiteSpace,
    abgeschnitten: element.scrollWidth > element.clientWidth + 1,
  }));
  expect(schnitt.overflow).toBe('hidden');
  expect(schnitt.umbruch).toBe('nowrap');
  if (lang.name.length > 28) {
    expect(schnitt.abgeschnitten).toBe(true);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('projekt');
});
