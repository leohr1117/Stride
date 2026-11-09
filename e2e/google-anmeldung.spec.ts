import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

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
  expect(masse.groesse).toBe('14px');
  expect(masse.zeile).toBe('20px');
  expect(String(masse.gewicht)).toBe('500');
  const knopfKasten = await knopf.boundingBox();
  const kontoKasten = await page.getByRole('button', { name: 'Konto erstellen', exact: true }).boundingBox();
  const anmeldeKasten = await page.getByRole('button', { name: 'Anmelden', exact: true }).boundingBox();
  expect(knopfKasten && kontoKasten && anmeldeKasten && anmeldeKasten.y < kontoKasten.y && kontoKasten.y < knopfKasten.y).toBe(true);
  if (projekt === 'handy') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/handy-anmelden-google.png', fullPage: true });
  }
  if (projekt === 'desktop') {
    await page.screenshot({ path: 'tmp-test/google-anmeldung/desktop-anmelden-google.png', fullPage: true });
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
