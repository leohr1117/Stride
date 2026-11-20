import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const HELL = { primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };
const DUNKEL = { primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };
const C =
  'Dieses Google-Konto ist mit keinem Stride-Konto verknüpft. Melde dich mit Passwort an und verknüpfe es unter Mehr → Konto.';
const D = 'Anmeldung mit Google hat nicht geklappt. Versuche es erneut oder melde dich mit Passwort an.';

function rgb(hex: string): string {
  const wert = hex.replace('#', '');
  const rot = Number.parseInt(wert.slice(0, 2), 16);
  const gruen = Number.parseInt(wert.slice(2, 4), 16);
  const blau = Number.parseInt(wert.slice(4, 6), 16);
  return `rgb(${rot}, ${gruen}, ${blau})`;
}

async function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate((schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim().toLowerCase(), name);
}

async function setzePalette(seite: Page, farben: { primaer: string; akzent: string; hintergrund: string }): Promise<void> {
  await seite.evaluate((werte) => {
    localStorage.setItem('stride.stil', 'standard');
    localStorage.setItem('stride.primaer', werte.primaer);
    localStorage.setItem('stride.akzent', werte.akzent);
    localStorage.setItem('stride.hintergrund', werte.hintergrund);
    localStorage.setItem('stride.glimmen', 'an');
  }, farben);
}

test('Anmeldung zeigt Google nur als eigenen Weg', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const netz: string[] = [];
  page.on('request', (anfrage) => {
    netz.push(anfrage.url());
  });
  fs.mkdirSync('tmp-test/google-anmeldung', { recursive: true });
  const projekt = testInfo.project.name;
  await page.addInitScript((werte) => {
    if (localStorage.getItem('stride.primaer')) {
      return;
    }
    localStorage.setItem('stride.stil', 'standard');
    localStorage.setItem('stride.primaer', werte.primaer);
    localStorage.setItem('stride.akzent', werte.akzent);
    localStorage.setItem('stride.hintergrund', werte.hintergrund);
    localStorage.setItem('stride.glimmen', 'an');
  }, HELL);

  await page.goto('/');
  await expect.poll(() => variable(page, '--flaeche')).toBe('#ffffff');
  await expect.poll(() => variable(page, '--gefahr')).toBe('#c62828');
  await page.waitForTimeout(400);
  const knopf = page.getByRole('link', { name: 'Über Google anmelden', exact: true });
  await expect(knopf).toBeVisible();
  await expect(page.getByText('oder', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toHaveCount(1);
  await expect(knopf.locator('svg')).toHaveCount(1);
  const masse = await knopf.evaluate((element) => {
    const stil = getComputedStyle(element);
    return {
      hoehe: element.getBoundingClientRect().height,
      flaeche: stil.backgroundColor,
      rand: stil.borderTopColor,
      schrift: stil.color,
      familie: stil.fontFamily,
      groesse: stil.fontSize,
      zeile: stil.lineHeight,
      gewicht: stil.fontWeight,
    };
  });
  expect(masse.hoehe).toBeGreaterThanOrEqual(44);
  expect(masse.flaeche).toBe(rgb('#FFFFFF'));
  expect(masse.rand).toBe(rgb('#747775'));
  expect(masse.schrift).toBe(rgb('#1F1F1F'));
  expect(masse.familie.toLowerCase()).toContain('roboto');
  const schrift = await page.evaluate(async () => {
    await document.fonts.ready;
    const rein = (familie: string) => familie.replaceAll('"', '').replaceAll("'", '');
    const faces = Array.from(document.fonts)
      .filter((face) => rein(face.family) === 'Stride Roboto')
      .map((face) => ({ gewicht: String(face.weight), anzeige: face.display, status: face.status }));
    const adressen = performance.getEntriesByType('resource').map((eintrag) => eintrag.name);
    return { faces, adressen, body: getComputedStyle(document.body).fontFamily };
  });
  expect(schrift.faces).toEqual([{ gewicht: '500', anzeige: 'swap', status: 'loaded' }]);
  expect(schrift.body).not.toContain('Stride Roboto');
  const herkunft = new URL(page.url()).origin;
  const geladen = [...new Set([...schrift.adressen, ...netz])].filter(
    (adresse) => adresse.toLowerCase().includes('roboto') && (adresse.split('?')[0] ?? '').endsWith('.woff2'),
  );
  expect(geladen.length).toBeGreaterThan(0);
  for (const adresse of geladen) {
    expect(new URL(adresse).origin).toBe(herkunft);
  }
  for (const adresse of [...schrift.adressen, ...netz]) {
    expect(adresse).not.toContain('fonts.googleapis.com');
    expect(adresse).not.toContain('fonts.gstatic.com');
  }
  expect(masse.groesse).toBe('14px');
  expect(masse.zeile).toBe('20px');
  expect(String(masse.gewicht)).toBe('500');
  await expect(page.getByText('Noch kein Konto?', { exact: true })).toBeVisible();
  const lage = await page.evaluate(() => {
    const kasten = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      const box = element.getBoundingClientRect();
      return { y: box.top, unten: box.bottom, hoehe: box.height, breite: box.width };
    };
    const karte = document.querySelector('[data-flaeche]');
    const spalte = document.querySelector('[data-anmelde-spalte]');
    const fuss = document.querySelector('.formular-fuss');
    const nav = document.querySelector('nav[aria-label="Rechtliches"]');
    const konto = document.querySelector('[data-konto-knopf]');
    const frage = document.querySelector('[data-konto-frage]');
    const felder = [...document.querySelectorAll('form .formular-felder .feld')];
    const passwort = document.querySelector('#current-password')?.closest('.feld') ?? null;
    const oder = [...document.querySelectorAll('p')].find((element) => element.textContent?.trim() === 'oder') ?? null;
    const googleWeg = document.querySelector('a[href="/api/zugang/google/start?zweck=anmelden"]');
    const anmeldenKnopf = document.querySelector('button[type="submit"]');
    const main = document.querySelector('main');
    const mainStil = main ? getComputedStyle(main) : null;
    const mainInnen = main && mainStil ? main.clientWidth - Number.parseFloat(mainStil.paddingLeft) - Number.parseFloat(mainStil.paddingRight) : 0;
    const karteStil = karte ? getComputedStyle(karte) : null;
    const inhalt = karte && karteStil ? karte.clientWidth - Number.parseFloat(karteStil.paddingLeft) - Number.parseFloat(karteStil.paddingRight) : 0;
    const kontoStil = konto ? getComputedStyle(konto) : null;
    const spaltenBox = spalte?.getBoundingClientRect();
    return {
      anmelden: kasten(anmeldenKnopf),
      oder: kasten(oder),
      google: kasten(googleWeg),
      konto: kasten(konto),
      passwort: kasten(passwort),
      karte: kasten(karte),
      nav: kasten(nav),
      feldAbstand:
        felder[0] instanceof HTMLElement && felder[1] instanceof HTMLElement
          ? felder[1].getBoundingClientRect().top - felder[0].getBoundingClientRect().bottom
          : -1,
      fussGrund: fuss ? getComputedStyle(fuss).backgroundColor : '',
      fussInKarte: Boolean(fuss && karte?.contains(fuss)),
      linksInKarte: Boolean(karte?.querySelector('nav, [data-absender]')),
      pad: karteStil?.paddingBottom ?? '',
      karteBreite: karte?.getBoundingClientRect().width ?? 0,
      mainInnen,
      inhalt,
      knopfGleich: anmeldenKnopf instanceof HTMLElement ? Math.abs(anmeldenKnopf.getBoundingClientRect().width - inhalt) <= 1 : false,
      googleGleich:
        anmeldenKnopf instanceof HTMLElement && googleWeg instanceof HTMLElement
          ? Math.abs(anmeldenKnopf.getBoundingClientRect().width - googleWeg.getBoundingClientRect().width) <= 1
          : false,
      gewicht: kontoStil?.fontWeight ?? '',
      dekor: kontoStil?.textDecorationLine ?? '',
      knopfFarbe: kontoStil?.color ?? '',
      frageFarbe: frage ? getComputedStyle(frage).color : '',
      textFarbe: getComputedStyle(document.body).color,
      nowrap: kontoStil?.whiteSpace ?? '',
      frageNowrap: frage ? getComputedStyle(frage).whiteSpace : '',
      spalteLinks: spaltenBox?.left ?? -1,
      spalteBreite: spaltenBox?.width ?? -1,
      fenster: window.innerWidth,
    };
  });
  const luecke = (oben: { unten: number } | null, unten: { y: number } | null) => (oben && unten ? unten.y - oben.unten : -1);
  const nahe = (wert: number, ziel: number) => Math.abs(wert - ziel) <= 1;
  expect(nahe(lage.feldAbstand, 16)).toBe(true);
  expect(nahe(luecke(lage.passwort, lage.anmelden), 24)).toBe(true);
  expect(nahe(luecke(lage.anmelden, lage.oder), 20)).toBe(true);
  expect(nahe(luecke(lage.oder, lage.google), 20)).toBe(true);
  expect(nahe(luecke(lage.google, lage.konto), 24)).toBe(true);
  expect(lage.anmelden?.hoehe).toBeGreaterThanOrEqual(48);
  expect(lage.google?.hoehe).toBeGreaterThanOrEqual(48);
  expect(lage.konto?.hoehe).toBeGreaterThanOrEqual(48);
  expect(lage.pad).toBe('24px');
  expect(nahe(luecke(lage.karte, lage.nav), 24)).toBe(true);
  expect(lage.fussGrund === 'rgba(0, 0, 0, 0)' || lage.fussGrund === 'transparent').toBe(true);
  expect(lage.fussInKarte).toBe(true);
  expect(lage.linksInKarte).toBe(false);
  expect(lage.knopfGleich).toBe(true);
  expect(lage.googleGleich).toBe(true);
  expect(lage.knopfFarbe).toBe(lage.textFarbe);
  expect(lage.frageFarbe).not.toBe(lage.textFarbe);
  expect(Number(lage.gewicht)).toBeGreaterThanOrEqual(700);
  expect(lage.dekor).toContain('underline');
  expect(lage.nowrap).toBe('nowrap');
  expect(lage.frageNowrap).toBe('nowrap');
  expect(lage.anmelden && lage.oder && lage.google && lage.konto && lage.anmelden.y < lage.oder.y && lage.oder.y < lage.google.y && lage.google.y < lage.konto.y).toBe(true);
  expect(Math.abs(lage.spalteLinks - (lage.fenster - lage.spalteLinks - lage.spalteBreite))).toBeLessThanOrEqual(1);
  if (projekt === 'desktop') {
    expect(Math.round(lage.karteBreite)).toBe(400);
  }
  if (projekt === 'handy') {
    expect(Math.abs(lage.karteBreite - lage.mainInnen)).toBeLessThanOrEqual(1);
  }
  if (projekt === 'handy') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/handy-anmelden-google.png', fullPage: true });
  }
  if (projekt === 'desktop') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/desktop-anmelden-google.png', fullPage: true });
  }
  if (projekt === 'handy') {
    await page.evaluate(() => localStorage.setItem('stride-sprache', 'ja'));
    await page.reload();
    const frage = page.locator('[data-konto-frage]');
    const kontoKnopf = page.locator('[data-konto-knopf]');
    await expect(frage).toBeVisible();
    await expect(kontoKnopf).toBeVisible();
    const schrift = await kontoKnopf.evaluate((element) => {
      const frageElement = element.parentElement?.querySelector('[data-konto-frage]');
      const frageKasten = frageElement?.getBoundingClientRect();
      const kasten = element.getBoundingClientRect();
      return {
        nowrap: getComputedStyle(element).whiteSpace,
        innen: element.scrollWidth <= element.clientWidth + 1,
        frageNowrap: frageElement ? getComputedStyle(frageElement).whiteSpace : '',
        frageInnen: frageElement instanceof HTMLElement ? frageElement.scrollWidth <= frageElement.clientWidth + 1 : false,
        gleicheZeile: frageKasten ? Math.abs(frageKasten.top - kasten.top) < 2 : false,
        darunter: frageKasten ? kasten.top >= frageKasten.bottom - 1 : false,
      };
    });
    expect(schrift.nowrap).toBe('nowrap');
    expect(schrift.frageNowrap).toBe('nowrap');
    expect(schrift.innen).toBe(true);
    expect(schrift.frageInnen).toBe(true);
    expect(schrift.gleicheZeile || schrift.darunter).toBe(true);
    await ohneSeitlichenUeberlauf(page);
    await page.evaluate(() => localStorage.setItem('stride-sprache', 'de'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
  }

  await setzePalette(page, DUNKEL);
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.schema)).toBe('dark');
  const dunkel = await knopf.evaluate((element) => {
    const stil = getComputedStyle(element);
    return { flaeche: stil.backgroundColor, rand: stil.borderTopColor, schrift: stil.color };
  });
  expect(dunkel.flaeche).toBe(rgb('#131314'));
  expect(dunkel.rand).toBe(rgb('#8E918F'));
  expect(dunkel.schrift).toBe(rgb('#E3E3E3'));
  if (projekt === 'handy') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/handy-anmelden-google-dunkel.png', fullPage: true });
  }

  const start = await page.request.get('/api/zugang/google/start?zweck=anmelden', { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  expect(start.headers().location ?? '').toContain('https://accounts.google.com/');

  await page.goto('/?google=c');
  const hinweis = page.getByRole('status');
  await expect(hinweis).toHaveText(C);
  await expect.poll(() => page.url()).not.toContain('google=');
  await page.locator('#username').fill('x');
  await expect(hinweis).toHaveCount(0);
  await page.goto('/?google=d');
  await expect(page.getByRole('status')).toHaveText(D);
  await expect.poll(() => page.url()).not.toContain('google=');

  await anmelden(page);
  const ok = await page.evaluate(async (werte) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'standard', primaer: werte.primaer, akzent: werte.akzent, hintergrund: werte.hintergrund, glimmen: true }),
    });
    return antwort.ok;
  }, HELL);
  expect(ok).toBe(true);
  await page.goto('/mehr/profil');
  await expect.poll(() => variable(page, '--flaeche')).toBe('#ffffff');
  await expect.poll(() => variable(page, '--gefahr')).toBe('#c62828');
  await page.waitForTimeout(400);
  const anmeldung = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Anmeldung', exact: true, level: 2 }) });
  await expect(anmeldung.getByRole('button', { name: 'Mit Google verknüpfen', exact: true })).toBeVisible();
  expect(await anmeldung.locator('a, button').evaluateAll((elemente) => elemente.map((element) => element.getAttribute('aria-label')))).toEqual([
    'Passwort',
    'Mit Google verknüpfen',
    'Accounts',
    'Abmelden',
  ]);
  if (projekt === 'handy') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/handy-konto-google.png', fullPage: true });
  }
});
