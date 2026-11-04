import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function bild(seite: Page, name: string, volleSeite = true): Promise<void> {
  fs.mkdirSync('tmp-test/heute-aufbau', { recursive: true });
  await seite.screenshot({ path: `tmp-test/heute-aufbau/${name}.png`, fullPage: volleSeite });
}

test('Heute behält Maß und folgt der Reihenfolge', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  await anmelden(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toHaveCount(0);
  await expect(page.locator('main .space-y-6')).toHaveCount(1);

  const ring = page.locator('main [data-levelring]').first();
  const ringBreite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(ringBreite).toBe(64);
  await expect(ring.locator('.uppercase')).toHaveCount(0);
  const label = ring.locator('span').first();
  expect(await label.evaluate((element) => getComputedStyle(element).fontSize)).toBe('12px');
  expect(await label.evaluate((element) => getComputedStyle(element).textTransform)).toBe('none');
  await expect(label).toHaveText('Level');
  const zahlSchrift = await ring.locator('span.zahl').evaluate((element) => {
    const stil = getComputedStyle(element);
    return { groesse: stil.fontSize, gewicht: stil.fontWeight, hoehe: stil.lineHeight };
  });
  expect(zahlSchrift).toEqual({ groesse: '20px', gewicht: '600', hoehe: '24px' });
  const xpZeile = page.locator('main [data-xp-zeile]');
  await expect(xpZeile).toBeVisible();
  const xpZeilen = await xpZeile.evaluate((element) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(element);
    return bereich.getClientRects().length;
  });
  expect(xpZeilen).toBe(1);
  const name = page.locator('main .kopfblock-name').locator('visible=true').first();
  await expect(name).toHaveClass(/text-2xl/);
  const schrift = await name.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const stil = await page.evaluate(() => document.documentElement.dataset.stil ?? '');
  if (stil === 'standard') {
    expect(schrift).toBe(17);
  } else {
    expect(schrift).toBeGreaterThan(20);
  }

  const flaeche = page.locator('main [data-flaeche]').filter({ has: page.locator('[data-levelring]') });
  await expect(flaeche).toHaveClass(/\bp-4\b/);
  const polster = await flaeche.evaluate((element) => getComputedStyle(element).paddingTop);
  expect(polster).toBe('16px');
  const masse = await flaeche.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    return {
      x: Math.round(kasten.x),
      rechts: Math.round(kasten.right),
      breite: document.documentElement.clientWidth,
      radius: Number.parseFloat(stil.borderTopLeftRadius),
      rand: Number.parseFloat(stil.borderTopWidth),
      flaechenBreite: Math.round(kasten.width),
    };
  });
  if (projekt === 'handy') {
    expect(masse.x).toBeLessThanOrEqual(1);
    expect(masse.rechts).toBeGreaterThanOrEqual(masse.breite - 1);
    expect(masse.radius).toBe(0);
    expect(masse.rand).toBe(0);
  } else {
    expect(masse.radius).toBe(8);
    expect(masse.rand).toBe(1);
    expect(masse.flaechenBreite).toBeLessThanOrEqual(720);
  }
  await expect(page.getByRole('heading', { name: 'Basis', exact: true })).toHaveCount(1);
  const ketteStand = await page.request.get('/api/kette/heute');
  expect(ketteStand.ok()).toBe(true);
  const lauf = (await ketteStand.json()) as {
    schutz: boolean;
    schutzLaenge: number | null;
    rueckkehr: unknown;
    serie: { laenge: number };
    heuteErfasst: boolean;
  };
  expect(lauf.heuteErfasst).toBe(true);
  expect(lauf.serie.laenge).toBeGreaterThan(0);
  expect(lauf.rueckkehr).toBeNull();
  expect(lauf.schutz).toBe(false);
  expect(lauf.schutzLaenge).toBeNull();
  await expect(page.getByRole('heading', { name: 'Streak', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-heute]')).toHaveCount(0);
  const kennzahl = page.locator('[data-wochenwert="Streak"] .zahl');
  await expect(kennzahl).toBeVisible();
  await expect(kennzahl).toContainText(String(lauf.serie.laenge));
  for (const name of ['Bosse greifen an', 'Basis']) {
    const schrift = await page.getByRole('heading', { name, exact: true }).evaluate((element) => {
      const stil = getComputedStyle(element);
      return { groesse: stil.fontSize, gewicht: stil.fontWeight, transform: stil.textTransform };
    });
    expect(schrift).toEqual({ groesse: '13px', gewicht: '600', transform: 'none' });
  }
  await expect(page.locator('[data-heute] .knopf-primaer')).toHaveCount(0);
  const angriff = page.locator('section', { has: page.getByRole('heading', { name: 'Bosse greifen an', exact: true }) });
  await expect(angriff.locator('.rounded-2xl, section.karte')).toHaveCount(0);
  const bossZeile = angriff.locator('.zeile[data-zeilen="2"]').first();
  await expect(bossZeile).toBeVisible();
  expect(await bossZeile.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(64);
  expect(await bossZeile.locator('svg').first().evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(20);
  await expect(bossZeile).toContainText(/seit /);
  await expect(bossZeile).not.toContainText('Erwacht');
  await expect(bossZeile.locator('.text-gefahr')).toContainText('Disziplin');

  const zeile = await page.locator('[data-wochenwert]').evaluateAll((knoten) =>
    knoten.map((knoten) => {
      const kasten = knoten.getBoundingClientRect();
      const stil = getComputedStyle(knoten);
      return { top: kasten.top, left: kasten.left, rand: stil.borderRightWidth };
    }),
  );
  expect(zeile).toHaveLength(3);
  expect(Math.abs((zeile[0]?.top ?? 0) - (zeile[1]?.top ?? 0))).toBeLessThan(2);
  expect(Math.abs((zeile[1]?.top ?? 0) - (zeile[2]?.top ?? 0))).toBeLessThan(2);
  expect(zeile[1]?.left ?? 0).toBeGreaterThan(zeile[0]?.left ?? 0);
  expect(zeile[0]?.rand).toBe('1px');
  expect(zeile[2]?.rand).toBe('0px');

  const info = page.locator('[data-wochenwert="Streak"]').getByRole('button', { name: /^Info/ });
  await info.click();
  await expect(page.getByRole('tooltip')).toHaveText('Ein Tag Pause ist frei. Danach ist der Streak angeschlagen.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const kette = await page.request.get('/api/kette/heute');
  expect(kette.ok()).toBe(true);
  const rueckkehrDaten = (await kette.json()) as { rueckkehr: { fristAm: string } | null };
  const rueckkehr = page.locator('[data-kette="rueckkehr"]');
  if (rueckkehrDaten.rueckkehr) {
    await expect(rueckkehr).toBeVisible();
    await rueckkehr.getByRole('button', { name: /^Info/ }).click();
    await expect(page.getByRole('tooltip')).toContainText('Ein Eintrag in sieben Tagen');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  } else {
    await expect(rueckkehr).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Werte', exact: true }).click();
  const koennen = page.locator('main a[href="/koennen"]');
  const haben = page.locator('main a[href="/haben"]');
  await expect(koennen).toBeVisible();
  await expect(koennen.locator('svg')).toHaveCount(1);
  await expect(haben.locator('svg')).toHaveCount(1);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-werte`);

  await koennen.click();
  await expect(page).toHaveURL(/\/koennen$/);
  await expect(page.locator('main h1')).toHaveText('Können');
  await page.goto('/');

  const basisSchalter = page.getByRole('button', { name: 'Basis', exact: true });
  await basisSchalter.click();
  await expect(page.getByText('Kurz dehnen')).toHaveCount(0);
  await basisSchalter.click();
  await expect(page.getByText('Kurz dehnen')).toBeVisible();
  const basisLinks = page.locator('main a[href="/basis"]');
  await expect(basisLinks).toHaveCount(1);
  const basisZeile = basisLinks.locator('xpath=ancestor::*[@data-zeile][1]');
  await expect(basisZeile).toContainText('Alle Basis-Aufgaben');
  await expect(basisZeile.locator('svg')).toHaveCount(1);
  expect(await basisZeile.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(48);
  const basisFlaeche = page.locator('section', { has: page.getByRole('heading', { name: 'Basis', exact: true }) }).locator('[data-flaeche]');
  await expect(basisFlaeche).not.toHaveClass(/\bp-4\b/);
  const pfeileGetrennt = await page.evaluate(() => {
    const knoepfe = [...document.querySelectorAll('button[aria-expanded]')];
    const kopfVon = (name: string) =>
      knoepfe.find((knopf) => {
        const id = knopf.getAttribute('aria-labelledby');
        return id !== null && document.getElementById(id)?.textContent === name;
      });
    const kopfFrei = (name: string) => {
      const knopf = kopfVon(name);
      const zeile = knopf?.parentElement;
      return zeile instanceof HTMLElement && zeile.querySelectorAll('svg').length === 1 && zeile.querySelectorAll('a').length === 0;
    };
    const ueberschriften = [...document.querySelectorAll('main h1, main h2, main h3')].filter((element) =>
      (element.textContent ?? '').includes('Basis'),
    );
    const links = [...document.querySelectorAll('main a[href="/basis"]')];
    const link = links[0];
    const basisKopf = kopfVon('Basis');
    if (!(basisKopf instanceof HTMLElement) || !(link instanceof HTMLElement)) {
      return false;
    }
    const flaeche = link.closest('[data-flaeche]');
    const zeile = link.closest('.zeile');
    if (!(flaeche instanceof HTMLElement) || !(zeile instanceof HTMLElement)) {
      return false;
    }
    const bossKopf = [...document.querySelectorAll('h2')].find((element) => element.textContent?.trim() === 'Bosse greifen an');
    const bossSymbol = bossKopf?.closest('section')?.querySelector('.zeile svg');
    const basisSymbol = flaeche.querySelector('ul svg');
    if (!(bossSymbol instanceof Element) || !(basisSymbol instanceof Element)) {
      return false;
    }
    const delta = Math.abs(bossSymbol.getBoundingClientRect().left - basisSymbol.getBoundingClientRect().left);
    const titel = zeile.querySelector('.zeile-titel');
    const probe = document.createElement('span');
    probe.className = 'text-leise';
    document.body.append(probe);
    const leise = titel instanceof HTMLElement && getComputedStyle(titel).color === getComputedStyle(probe).color;
    probe.remove();
    return (
      ueberschriften.length === 1 &&
      ueberschriften[0]?.textContent?.trim() === 'Basis' &&
      links.length === 1 &&
      basisKopf.closest('[data-flaeche]') === null &&
      flaeche.contains(link) &&
      flaeche.lastElementChild === zeile &&
      Math.round(zeile.getBoundingClientRect().height) === 48 &&
      zeile.querySelectorAll('svg').length === 1 &&
      !flaeche.classList.contains('p-4') &&
      leise &&
      delta <= 1 &&
      kopfFrei('Basis') &&
      kopfFrei('Werte') &&
      kopfFrei('Aktivität')
    );
  });
  expect(pfeileGetrennt).toBe(true);
  await basisLinks.click();
  await expect(page).toHaveURL(/\/basis$/);
  await expect(page.locator('main h1')).toHaveText('Basis');
  await page.goto('/');

  const laufend = page.locator('main a[href="/laufend"]');
  await expect(laufend).toBeVisible();
  await expect(laufend).toContainText('Laufend');
  await laufend.click();
  await expect(page).toHaveURL(/\/laufend$/);
  await page.goto('/');
  const projektLink = page.locator('main a[href^="/projekte/"]').first();
  await expect(projektLink).toBeVisible();
  await projektLink.click();
  await expect(page).toHaveURL(/\/projekte\/\d+$/);
  await page.goto('/');
  await expect(page.locator('[data-wochenwert]')).toHaveCount(3);
  const aktivitaet = page.getByRole('button', { name: 'Aktivität', exact: true });
  if ((await aktivitaet.getAttribute('aria-expanded')) !== 'true') {
    await aktivitaet.click();
  }
  const aktivBereich = page.locator('#uebersicht-aktivitaet');
  await expect(aktivBereich.locator('[data-flaeche]')).toBeVisible();
  await expect(aktivBereich.locator('section.karte')).toHaveCount(0);
  await expect(aktivBereich.getByText('Weniger', { exact: true })).toBeVisible();
  const ordnung = await page.evaluate(() => {
    const namen = ['Bosse greifen an', 'Zurück aufstehen', 'Basis', 'Werte', 'Aktivität'];
    return namen.flatMap((name) => {
      const kopf = [...document.querySelectorAll('h2')].find((element) => element.textContent?.trim() === name);
      return kopf ? [{ name, top: Math.round(kopf.getBoundingClientRect().top) }] : [];
    });
  });
  for (const name of ['Bosse greifen an', 'Basis', 'Werte', 'Aktivität']) {
    expect(ordnung.some((eintrag) => eintrag.name === name)).toBe(true);
  }
  for (let index = 1; index < ordnung.length; index += 1) {
    expect(ordnung[index]?.top ?? 0).toBeGreaterThan(ordnung[index - 1]?.top ?? 0);
  }
  const identitaetOben = await page.locator('[data-xp-zeile]').evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(identitaetOben).toBeLessThan(ordnung[0]?.top ?? 0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-oben`, false);
  await bild(page, `${projekt}-heute`);

  if (projekt === 'handy') {
    await expect(page.locator('nav.mobilleiste').getByRole('link', { name: 'Heute', exact: true })).toBeVisible();
  } else {
    await expect(page.locator('aside.seitenleiste').getByRole('link', { name: 'Heute', exact: true })).toBeVisible();
  }

  await page.goto('/charakter');
  const profilRing = page.locator('main [data-levelring]').first();
  const profilBreite = await profilRing.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(profilBreite).toBe(104);
  await expect(page.locator('main .kopfblock-name').locator('visible=true').first()).toHaveClass(/text-2xl/);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${projekt}-profil`);
});

async function kreisMass(kreis: Locator): Promise<{ breite: number; hoehe: number; rand: string; haken: boolean; zustand: string | null }> {
  const kasten = await kreis.boundingBox();
  expect(kasten).toBeTruthy();
  expect(Math.round(kasten!.width)).toBe(48);
  expect(Math.round(kasten!.height)).toBe(48);
  return kreis.locator('[data-abhak]').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      breite: Math.round(box.width),
      hoehe: Math.round(box.height),
      rand: getComputedStyle(element).borderTopWidth,
      haken: element.querySelector('svg') !== null,
      zustand: element.getAttribute('data-abhak'),
    };
  });
}

function kreisErwartet(
  mass: { breite: number; hoehe: number; rand: string; haken: boolean; zustand: string | null },
  erledigt: boolean,
): void {
  expect(mass.breite).toBe(24);
  expect(mass.hoehe).toBe(24);
  expect(mass.zustand).toBe(erledigt ? 'erledigt' : 'offen');
  expect(mass.haken).toBe(erledigt);
  expect(mass.rand).toBe(erledigt ? '0px' : '2px');
}

test('Abhakkreis bleibt leer oder zeigt den Haken', async ({ page }) => {
  await anmelden(page);
  await page.goto('/');
  const kreis = page.getByRole('checkbox', { name: 'Kurz dehnen abhaken' });
  await expect(kreis).toBeVisible();
  const anfang = (await kreis.getAttribute('aria-checked')) === 'true';
  kreisErwartet(await kreisMass(kreis), anfang);
  const titel = kreis.locator('xpath=ancestor::div[contains(@class,"items-center")][1]').locator('p').first();
  if (anfang) {
    await expect(titel).toHaveClass(/text-leise/);
  } else {
    await expect(titel).not.toHaveClass(/text-leise/);
  }
  const menueLinks = await kreis.evaluate((element) => {
    const zeile = element.parentElement;
    if (!zeile) {
      return false;
    }
    const knoepfe = [...zeile.querySelectorAll('button')];
    const menu = knoepfe.findIndex((knopf) => (knopf.getAttribute('aria-label') ?? '').startsWith('Aktionen'));
    return menu !== -1 && menu < knoepfe.indexOf(element);
  });
  expect(menueLinks).toBe(true);

  let umgeschaltet = false;
  try {
    await expect(kreis).toBeEnabled();
    await kreis.focus();
    await page.keyboard.press('Space');
    await expect(kreis).toHaveAttribute('aria-checked', anfang ? 'false' : 'true');
    umgeschaltet = true;
    const dialog = page.getByRole('dialog');
    if ((await dialog.count()) > 0) {
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    kreisErwartet(await kreisMass(kreis), !anfang);
    if (anfang) {
      await expect(titel).not.toHaveClass(/text-leise/);
    } else {
      await expect(titel).toHaveClass(/text-leise/);
    }

    await expect(kreis).toBeEnabled();
    await kreis.focus();
    await page.keyboard.press('Space');
    await expect(kreis).toHaveAttribute('aria-checked', anfang ? 'true' : 'false');
    umgeschaltet = false;

    await page.goto('/basis');
    const dort = page.getByRole('checkbox', { name: 'Kurz dehnen abhaken' });
    await expect(dort).toBeVisible();
    kreisErwartet(await kreisMass(dort), anfang);
  } finally {
    if (umgeschaltet) {
      const knopf = page.getByRole('checkbox', { name: 'Kurz dehnen abhaken' }).first();
      if ((await knopf.count()) > 0) {
        await knopf.focus();
        await page.keyboard.press('Space');
        await expect(knopf).toHaveAttribute('aria-checked', anfang ? 'true' : 'false');
      }
    }
  }
});
