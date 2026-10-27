import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helfer.ts';

interface Fund {
  art: string;
  text?: string;
  links?: number;
  rechts?: number;
  scroll?: number;
  fenster?: number;
}

const FEST = [
  '/',
  '/laufend',
  '/basis',
  '/ziele',
  '/chronik',
  '/rueckblick',
  '/statistiken',
  '/charakter',
  '/vorbilder',
  '/vorbilder/ronaldo',
  '/vorbilder/durchschnitt',
  '/handbuch',
  '/mehr',
  '/mehr/profil',
  '/mehr/profil/name',
  '/mehr/profil/titel',
  '/mehr/profil/jahr',
  '/mehr/profil/ziel',
  '/mehr/profil/fokus',
  '/mehr/profil/benutzer',
  '/mehr/profil/passwort',
  '/mehr/profil/accounts',
  '/mehr/inhalte',
  '/mehr/inhalte/verbindungen',
  '/mehr/darstellung',
  '/mehr/darstellung/leiste',
  '/mehr/uebersicht',
  '/mehr/funktionen',
  '/mehr/daten',
];

function ordner(): void {
  fs.mkdirSync('tmp-bau/b3', { recursive: true });
}

async function pfade(seite: Page): Promise<string[]> {
  const extra = await seite.evaluate(async () => {
    const ziele = (await fetch('/api/ziele').then((antwort) => antwort.json())) as { projekte: { id: number }[] };
    const faehigkeiten = (await fetch('/api/faehigkeiten').then((antwort) => antwort.json())) as { id: number }[];
    const liste: string[] = [];
    const projekt = ziele.projekte[0];
    if (projekt) {
      liste.push(`/projekte/${projekt.id}`);
    }
    const faehigkeit = faehigkeiten[0];
    if (faehigkeit) {
      liste.push(`/faehigkeiten/${faehigkeit.id}`);
    }
    return liste;
  });
  return [...FEST, ...extra];
}

async function oeffneAbschnitte(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    for (const knopf of document.querySelectorAll('button[aria-expanded="false"][aria-labelledby]')) {
      if (knopf instanceof HTMLButtonElement) {
        knopf.click();
      }
    }
  });
}

async function miss(seite: Page): Promise<Fund[]> {
  return seite.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const tol = 2;
    const funde: Fund[] = [];
    if (document.documentElement.scrollWidth > vw + tol) {
      funde.push({ art: 'seite', scroll: document.documentElement.scrollWidth, fenster: vw });
    }
    const textVon = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 70);
    const unsichtbar = (el: Element) => {
      const stil = getComputedStyle(el);
      return stil.display === 'none' || stil.visibility === 'hidden' || Number(stil.opacity) === 0;
    };
    const ausgenommen = (el: Element) => Boolean(el.closest('[data-schnell-streifen], .glimm-fleck'));
    const ellipsis = (el: Element) => {
      const stil = getComputedStyle(el);
      return el.classList.contains('truncate') || stil.textOverflow === 'ellipsis';
    };

    for (const el of document.querySelectorAll('h1, h2, h3, p, button, a, label, th, td, li, span, text')) {
      if (funde.length > 12 || unsichtbar(el) || ausgenommen(el) || ellipsis(el)) {
        continue;
      }
      const kasten = el.getBoundingClientRect();
      if (kasten.width < 8 || kasten.height < 4) {
        continue;
      }
      let links = kasten.left;
      let rechts = kasten.right;
      let scrollt = false;
      let schnitt = false;
      let vorfahr = el.parentElement;
      while (vorfahr && vorfahr !== document.documentElement) {
        const overflow = getComputedStyle(vorfahr).overflowX;
        if (overflow === 'hidden' || overflow === 'clip' || overflow === 'auto' || overflow === 'scroll') {
          const rand = vorfahr.getBoundingClientRect();
          const vorher = rechts - links;
          links = Math.max(links, rand.left);
          rechts = Math.min(rechts, rand.right);
          if (rechts - links < vorher - 4) {
            schnitt = true;
            if (overflow === 'auto' || overflow === 'scroll') {
              scrollt = true;
            }
          }
        }
        vorfahr = vorfahr.parentElement;
      }
      const text = textVon(el);
      if (!text) {
        continue;
      }
      if (rechts - links > 1 && (links < -tol || rechts > vw + tol)) {
        funde.push({ art: 'sichtbar', text, links: Math.round(links), rechts: Math.round(rechts) });
        continue;
      }
      if (schnitt && !scrollt && kasten.width > rechts - links + 8 && rechts > links) {
        funde.push({ art: 'abgeschnitten', text, links: Math.round(kasten.left), rechts: Math.round(kasten.right) });
      }
    }

    for (const text of document.querySelectorAll('.recharts-surface text')) {
      if (funde.length > 16 || unsichtbar(text)) {
        continue;
      }
      const kasten = text.getBoundingClientRect();
      const karte = text.closest('.karte')?.getBoundingClientRect();
      if (!karte || kasten.width < 1) {
        continue;
      }
      if (kasten.left < karte.left - tol || kasten.right > karte.right + tol) {
        funde.push({ art: 'diagramm', text: textVon(text), links: Math.round(kasten.left), rechts: Math.round(kasten.right) });
      }
    }

    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const kasten = dialog.getBoundingClientRect();
      if (kasten.left < -tol || kasten.right > vw + tol || kasten.top < -tol || kasten.bottom > vh + tol) {
        funde.push({
          art: 'dialog',
          text: dialog.getAttribute('aria-label') ?? '',
          links: Math.round(kasten.left),
          rechts: Math.round(kasten.right),
          fenster: vh,
        });
      }
    }

    // Die Vorschau im Leisten-Editor nutzt dieselbe Klasse, ist aber im Fluss.
    const leiste = document.querySelector('nav.mobilleiste');
    if (leiste && getComputedStyle(leiste).display !== 'none') {
      const stand = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      const rand = leiste.getBoundingClientRect();
      let oben = rand.top;
      for (const kind of leiste.querySelectorAll('button, a')) {
        oben = Math.min(oben, kind.getBoundingClientRect().top);
      }
      let treffer = '';
      for (const el of document.querySelectorAll('main a, main button, main input, main textarea')) {
        if (unsichtbar(el) || ausgenommen(el) || el.closest('.mobilleiste')) {
          continue;
        }
        const kasten = el.getBoundingClientRect();
        if (kasten.width < 8 || kasten.height < 8 || kasten.bottom < oben + 8) {
          continue;
        }
        if (kasten.top < rand.bottom - 8) {
          treffer = textVon(el);
          break;
        }
      }
      window.scrollTo(0, stand);
      if (treffer) {
        funde.push({ art: 'leiste', text: treffer });
      }
    }
    return funde;
  });
}

test('Ansichten bleiben bei 390 und 1440 im Bild', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  ordner();
  const projekt = testInfo.project.name;
  const berichte: { name: string; funde: Fund[] }[] = [];

  await page.goto('/');
  await page.locator('input[name="username"]').waitFor();
  const anmeldung = await miss(page);
  if (anmeldung.length > 0) {
    berichte.push({ name: 'anmeldung', funde: anmeldung });
  }

  await anmelden(page);
  for (const pfad of await pfade(page)) {
    await page.goto(pfad);
    await page.getByRole('heading').first().waitFor();
    await oeffneAbschnitte(page);
    if (pfad === '/charakter' || pfad.includes('vorbild') || pfad === '/statistiken' || pfad === '/rueckblick') {
      await page.locator('.recharts-surface').first().waitFor({ timeout: 2500 }).catch(() => undefined);
    }
    const funde = await miss(page);
    if (funde.length > 0) {
      berichte.push({ name: pfad, funde });
      await page.screenshot({ path: `tmp-bau/b3/${projekt}-fehler.png` });
    }
  }

  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  await expect(page.getByRole('dialog', { name: 'Was hast du getan?' })).toBeVisible();
  const eintrag = await miss(page);
  if (eintrag.length > 0) {
    berichte.push({ name: 'dialog-eintrag', funde: eintrag });
  }
  await page.keyboard.press('Escape');

  await page.goto('/mehr/inhalte');
  await page.getByRole('heading', { name: 'Tätigkeiten' }).waitFor();
  await page.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
  await expect(page.getByRole('dialog', { name: 'Tätigkeit anlegen' })).toBeVisible();
  const taetigkeit = await miss(page);
  if (taetigkeit.length > 0) {
    berichte.push({ name: 'dialog-taetigkeit', funde: taetigkeit });
  }

  fs.writeFileSync(`tmp-bau/b3/${projekt}.json`, JSON.stringify(berichte, null, 2));
  expect(berichte).toEqual([]);
});
