import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

const SEITEN = [
  ['/chronik', 'verlauf'],
  ['/vorbilder', 'vorbilder'],
  ['/mehr/inhalte/verbindungen', 'verbindungen'],
] as const;

interface Bericht {
  koepfe: number;
  flaechen: number;
  probleme: string[];
}

function pruefeSeite(): Bericht {
  const probleme: string[] = [];
  const merke = (text: string) => {
    if (!probleme.includes(text) && probleme.length < 12) probleme.push(text);
  };
  const breite = document.documentElement.clientWidth;
  const mobil = breite < 768;
  const probe = document.createElement('span');
  probe.style.color = 'var(--leise)';
  document.body.append(probe);
  const leise = getComputedStyle(probe).color;
  probe.remove();

  const koepfe = [...document.querySelectorAll('main .abschnitt-kopf')];
  if (koepfe.length === 0) merke('kein AbschnittKopf');
  for (const kopf of koepfe) {
    const stil = getComputedStyle(kopf);
    const name = kopf.querySelector('h2')?.textContent?.trim() ?? '?';
    if (stil.marginTop !== '24px') merke(`${name}: oben ${stil.marginTop}`);
    if (stil.marginBottom !== '8px') merke(`${name}: unten ${stil.marginBottom}`);
    const h2 = kopf.querySelector('h2');
    if (!h2) {
      merke(`${name}: ohne Überschrift`);
      continue;
    }
    const schrift = getComputedStyle(h2);
    if (schrift.fontSize !== '13px') merke(`${name}: Schrift ${schrift.fontSize}`);
    if (schrift.fontWeight !== '600') merke(`${name}: Gewicht ${schrift.fontWeight}`);
    if (schrift.textTransform !== 'none') merke(`${name}: Schreibung ${schrift.textTransform}`);
    const sperrung = schrift.letterSpacing;
    if (sperrung !== 'normal' && parseFloat(sperrung) !== 0) merke(`${name}: Sperrung ${sperrung}`);
    if (schrift.color !== leise) merke(`${name}: Farbe weicht ab`);
    if (/\buppercase\b|\btracking-wide\b/.test(h2.className)) merke(`${name}: Versalien in der Klasse`);
    const flaeche = kopf.closest('section')?.querySelector('[data-flaeche]');
    if (!flaeche) {
      merke(`${name}: ohne Fläche`);
      continue;
    }
    const abstand = Math.round(flaeche.getBoundingClientRect().top - kopf.getBoundingClientRect().bottom);
    if (abstand !== 8) merke(`${name}: ${abstand} px bis zur Fläche`);
  }

  const flaechen = [...document.querySelectorAll('main [data-flaeche]')];
  if (flaechen.length === 0) merke('keine Fläche');
  for (const flaeche of flaechen) {
    const stil = getComputedStyle(flaeche);
    const kasten = flaeche.getBoundingClientRect();
    const radius = parseFloat(stil.borderTopLeftRadius);
    const rand = parseFloat(stil.borderTopWidth);
    if (mobil) {
      if (radius !== 0) merke(`Radius auf dem Handy ${radius}`);
      if (rand !== 0) merke(`Rand auf dem Handy ${rand}`);
      if (kasten.x > 1) merke(`Fläche beginnt bei ${Math.round(kasten.x)}`);
      if (kasten.right < breite - 1) merke(`Fläche endet bei ${Math.round(kasten.right)} von ${breite}`);
    } else if (radius !== 8 || rand !== 1 || kasten.width > 720) {
      merke(`Fläche am PC: Radius ${radius}, Rand ${rand}, Breite ${Math.round(kasten.width)}`);
    }
  }

  const abschnitte = [...document.querySelectorAll('main section')].filter((teil) => teil.querySelector('.abschnitt-kopf'));
  for (let index = 1; index < abschnitte.length; index += 1) {
    const vorher = abschnitte[index - 1];
    const aktuell = abschnitte[index];
    if (!vorher || !aktuell || aktuell.previousElementSibling !== vorher) continue;
    const flaeche = [...vorher.querySelectorAll('[data-flaeche]')].at(-1);
    const kopf = aktuell.querySelector('.abschnitt-kopf');
    if (!flaeche || !kopf) continue;
    const abstand = Math.round(kopf.getBoundingClientRect().top - flaeche.getBoundingClientRect().bottom);
    if (abstand !== 24) {
      const name = kopf.querySelector('h2')?.textContent?.trim() ?? '?';
      merke(`${name}: ${abstand} px nach der vorigen Fläche`);
    }
  }

  return { koepfe: koepfe.length, flaechen: flaechen.length, probleme };
}

async function pruefe(seite: Page, name: string): Promise<void> {
  await seite.locator('main .abschnitt-kopf').first().waitFor();
  await seite.screenshot({ path: `tmp-test/abschnitte/${name}.png`, fullPage: true });
  const bericht = await seite.evaluate(pruefeSeite);
  expect(bericht.koepfe, name).toBeGreaterThan(0);
  expect(bericht.flaechen, name).toBeGreaterThan(0);
  expect(bericht.probleme, name).toEqual([]);
}

test('Abschnitte auf Verlauf, Verbindungen und Vorbilder', async ({ page }, info) => {
  test.setTimeout(90_000);
  fs.mkdirSync('tmp-test/abschnitte', { recursive: true });
  await anmelden(page);
  for (const [pfad, name] of SEITEN) {
    await page.goto(pfad);
    await pruefe(page, `${info.project.name}-${name}`);
  }
});
