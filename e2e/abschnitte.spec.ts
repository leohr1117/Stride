import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden } from './helfer.ts';

const SEITEN = [
  ['/chronik', 'verlauf', true],
  ['/vorbilder', 'vorbilder', true],
  ['/vorbilder/einstein', 'vorbild', true],
  ['/mehr/inhalte/verbindungen', 'verbindungen', false],
  ['/mehr/inhalte/verbindungen/todoist', 'verbindungen-todoist', true],
  ['/mehr/inhalte/verbindungen/kalender', 'verbindungen-kalender', true],
  ['/rueckblick', 'rueckblick', true],
  ['/statistiken', 'statistik', true],
  ['/basis', 'basis', true],
  ['/handbuch', 'handbuch', true],
  ['/mehr', 'mehr', true],
  ['/mehr/profil', 'konto', true],
  ['/ziele', 'ziele', false],
  ['/koennen', 'koennen', false],
  ['/haben', 'haben', false],
  ['/mehr/profil/accounts', 'accounts', false],
] as const;

interface Bericht {
  koepfe: number;
  flaechen: number;
  probleme: string[];
}

function pruefeSeite(kopfPflicht: boolean): Bericht {
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
  if (koepfe.length === 0 && kopfPflicht) merke('kein AbschnittKopf');
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
    if (mobil && Math.abs(h2.getBoundingClientRect().x - 32) > 1) {
      merke(`${name}: Text bei ${Math.round(h2.getBoundingClientRect().x)}`);
    }
    if (/\buppercase\b|\btracking-wide\b/.test(h2.className)) merke(`${name}: Versalien in der Klasse`);
    const hinweis = [...kopf.children].find((kind) => kind.tagName === 'P');
    const textUnten = hinweis instanceof HTMLElement ? hinweis.getBoundingClientRect().bottom : h2.getBoundingClientRect().bottom;
    const textOben = h2.getBoundingClientRect().top;
    const kopfHoehe = Math.round(kopf.getBoundingClientRect().height);
    const textHoehe = Math.round(textUnten - textOben);
    if (Math.abs(kopfHoehe - textHoehe) > 1) merke(`${name}: Kopf ${kopfHoehe} px, Text ${textHoehe} px`);
    const flaeche = kopf.closest('section')?.querySelector('[data-flaeche]');
    if (!flaeche) {
      const zu = kopf.querySelector(':scope > button[aria-expanded="false"]');
      if (!zu) merke(`${name}: ohne Fläche`);
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
    const radien = [
      stil.borderTopLeftRadius,
      stil.borderTopRightRadius,
      stil.borderBottomRightRadius,
      stil.borderBottomLeftRadius,
    ].map((wert) => parseFloat(wert));
    const rand = parseFloat(stil.borderTopWidth);
    if (mobil) {
      if (radien.some((wert) => Math.abs(wert - 12) > 0.5)) merke(`Radius auf dem Handy ${radien.join(' ')}`);
      if (rand !== 0) merke(`Rand auf dem Handy ${rand}`);
      if (Math.abs(kasten.x - 16) > 1) merke(`Fläche beginnt bei ${Math.round(kasten.x)}`);
      const zielRechts = breite - 16;
      if (Math.abs(kasten.right - zielRechts) > 1) merke(`Fläche endet bei ${Math.round(kasten.right)} von ${breite}`);
    } else if (radien.some((wert) => wert !== 8) || rand !== 1 || kasten.width > 720) {
      merke(`Fläche am PC: Radius ${radien.join(' ')}, Rand ${rand}, Breite ${Math.round(kasten.width)}`);
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
    const kopfKasten = kopf.getBoundingClientRect();
    const flaecheKasten = flaeche.getBoundingClientRect();
    if (kopfKasten.top < flaecheKasten.top) continue;
    const abstand = Math.round(kopfKasten.top - flaecheKasten.bottom);
    if (abstand !== 24) {
      const name = kopf.querySelector('h2')?.textContent?.trim() ?? '?';
      merke(`${name}: ${abstand} px nach der vorigen Fläche`);
    }
  }

  const farbProbe = document.createElement('span');
  farbProbe.style.borderTop = '1px solid var(--rand)';
  document.body.append(farbProbe);
  const randFarbe = getComputedStyle(farbProbe).borderTopColor;
  farbProbe.remove();
  const listen = [...document.querySelectorAll('main .liste')].filter((liste) => liste.closest('[data-flaeche]'));
  for (const liste of listen) {
    const kinder = [...liste.children].filter((kind) => kind instanceof HTMLElement && kind.getBoundingClientRect().height > 0);
    if (kinder.length === 0) continue;
    const letzte = kinder[kinder.length - 1];
    if (!letzte) continue;
    const unten = parseFloat(getComputedStyle(letzte).borderBottomWidth) || 0;
    if (unten > 0) merke('Letzte Zeile hat eine Linie');
    for (let index = 0; index < kinder.length; index += 1) {
      const kind = kinder[index];
      if (!(kind instanceof HTMLElement)) continue;
      const linie = getComputedStyle(kind, '::before');
      const dicke = parseFloat(linie.borderTopWidth) || 0;
      if (index === 0) {
        if (dicke > 0) merke('Erste Zeile hat eine Linie');
        continue;
      }
      if (dicke !== 1) {
        merke('Trennlinie fehlt');
        continue;
      }
      const soll = parseFloat(getComputedStyle(kind).getPropertyValue('--liste-einzug')) || 16;
      const ist = parseFloat(linie.insetInlineStart);
      const links = parseFloat(linie.left);
      const gemessen = Number.isNaN(ist) ? links : ist;
      if (Number.isNaN(gemessen) || Math.abs(gemessen - soll) > 1) merke(`Trennlinie bei ${linie.insetInlineStart} statt ${soll}`);
      if (linie.borderTopColor !== randFarbe) merke('Trennlinie nicht in der Randfarbe');
    }
  }

  return { koepfe: koepfe.length, flaechen: flaechen.length, probleme };
}

async function pruefe(seite: Page, name: string, kopfPflicht: boolean): Promise<void> {
  if (kopfPflicht) {
    await seite.locator('main .abschnitt-kopf').first().waitFor();
  } else {
    await seite.locator('main [data-flaeche]').first().waitFor();
  }
  await seite.screenshot({ path: `tmp-test/abschnitte/${name}.png`, fullPage: true });
  const bericht = await seite.evaluate(pruefeSeite, kopfPflicht);
  if (kopfPflicht) {
    expect(bericht.koepfe, name).toBeGreaterThan(0);
  }
  expect(bericht.flaechen, name).toBeGreaterThan(0);
  expect(bericht.probleme, name).toEqual([]);
}

test('Abschnitte und Flächen auf den Seiten', async ({ page }, info) => {
  test.setTimeout(180_000);
  fs.mkdirSync('tmp-test/abschnitte', { recursive: true });
  await anmelden(page);
  for (const [pfad, name, kopfPflicht] of SEITEN) {
    await page.goto(pfad);
    await pruefe(page, `${info.project.name}-${name}`, kopfPflicht);
  }
});
