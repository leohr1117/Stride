import fs from 'node:fs';
import type { Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';
import { anmelden } from './helfer.ts';
import { TEST_PASSWORT } from './testdaten.ts';
import { expect, test, type Page, type TestInfo } from './uhr.ts';

const ORDNER = 'tmp-test/infoseite';
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };
const VISION = 'Fit und belastbar';
const BAUM_KNOTEN = 'Kniebeuge sauber';

interface EinstellungenStand {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
  sprache: Sprache | null;
}

function sollBreite(info: TestInfo): number {
  if (info.project.name === 'handy') {
    return 390;
  }
  if (info.project.name === 'desktop') {
    return 1440;
  }
  throw new Error(`Unbekanntes Projekt ${info.project.name}`);
}

function bild(info: TestInfo, fassung: string, ansicht: string): string {
  fs.mkdirSync(ORDNER, { recursive: true });
  return `${ORDNER}/${info.project.name}-${sollBreite(info)}-${fassung}-${ansicht}.png`;
}

async function speichere(seite: Page, daten: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (koerper) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return antwort.ok;
  }, daten);
  expect(ok).toBe(true);
}

async function liesStand(seite: Page): Promise<EinstellungenStand> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error(`einstellungen ${antwort.status}`);
    }
    return (await antwort.json()) as EinstellungenStand;
  });
}

function wiederherstellung(stand: EinstellungenStand): Record<string, unknown> {
  const farben = stand.eigeneFarben
    ? {
        stil: stand.stil,
        glimmen: stand.glimmen,
        primaer: stand.primaer,
        akzent: stand.akzent,
        hintergrund: stand.hintergrund,
      }
    : { stil: stand.stil, glimmen: stand.glimmen, farbenZuruecksetzen: true };
  return { ...farben, sprache: stand.sprache ?? 'de' };
}

async function oeffne(seite: Page, sprache: Sprache): Promise<void> {
  if (sprache === 'de') {
    await anmelden(seite);
    return;
  }
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(TEST_PASSWORT);
  await seite.getByRole('button', { name: /Sign in|Anmelden/ }).click();
  await seite.getByRole('button', { name: /Log entry|Eintrag loggen/ }).waitFor();
}

async function ohneTestreste(seite: Page): Promise<void> {
  const text = await seite.evaluate(() => {
    const teile: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let knoten = walker.nextNode();
    while (knoten) {
      const inhalt = knoten.textContent ?? '';
      const eltern = knoten.parentElement;
      const aktuell = knoten;
      knoten = walker.nextNode();
      if (!eltern || inhalt.trim() === '' || eltern.closest('[inert]')) {
        continue;
      }
      const stil = getComputedStyle(eltern);
      if (stil.display === 'none' || stil.visibility === 'hidden') {
        continue;
      }
      const bereich = document.createRange();
      bereich.selectNodeContents(aktuell);
      const kasten = bereich.getBoundingClientRect();
      const trifft =
        kasten.width > 0 &&
        kasten.height > 0 &&
        kasten.bottom > 0 &&
        kasten.right > 0 &&
        kasten.top < window.innerHeight &&
        kasten.left < window.innerWidth;
      if (trifft) {
        teile.push(inhalt);
      }
    }
    return teile.join('\n');
  });
  expect(text.includes('Lauf80'), text).toBe(false);
  expect(text.includes('Lvl 4242'), text).toBe(false);
}

async function aufnahme(seite: Page, pfad: string): Promise<void> {
  await ohneTestreste(seite);
  await seite.screenshot({ path: pfad, fullPage: false, scale: 'css' });
  expect(fs.existsSync(pfad), pfad).toBe(true);
}

async function kopfFrei(seite: Page, ziel: string): Promise<void> {
  await seite.locator(ziel).evaluate((element) => {
    const kopf = document.querySelector('header[data-kopf]');
    const hoehe = kopf instanceof HTMLElement ? kopf.getBoundingClientRect().height : 0;
    const oben = element.getBoundingClientRect().top + window.scrollY - hoehe - 12;
    window.scrollTo(0, Math.max(0, oben));
  });
}

async function nimmAnsichten(seite: Page, info: TestInfo, fassung: string, sprache: Sprache): Promise<void> {
  expect(seite.viewportSize()?.width).toBe(sollBreite(info));
  const xp = sprache === 'en' ? /about \+/ : /ca\. \+/;

  await seite.goto('/');
  await expect(seite.getByRole('heading', { name: zeige('Heute', sprache), exact: true })).toBeVisible();
  await expect(seite.locator('[data-levelring]').first()).toBeVisible();
  await expect(seite.getByText(zeige('Streak', sprache), { exact: true }).first()).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  if (fassung === 'hell') {
    await seite.waitForFunction(() => {
      const stil = getComputedStyle(document.documentElement);
      return (
        stil.getPropertyValue('--flaeche').trim().toLowerCase() === '#ffffff' &&
        stil.getPropertyValue('--gefahr').trim().toLowerCase() === '#c62828'
      );
    });
  }
  await expect(seite.locator('html')).toHaveAttribute('data-schema', fassung === 'hell' ? 'light' : 'dark');
  await expect(seite.locator('[data-levelring]').first()).toBeInViewport();
  await expect(seite.getByText(zeige('Streak', sprache), { exact: true }).first()).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'heute'));

  await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).click();
  const dialogName = zeige('Was hast du getan?', sprache);
  const dialog = seite.getByRole('dialog', { name: dialogName });
  const vorschau = dialog.getByRole('button', { name: xp });
  await expect(dialog.getByRole('heading', { name: dialogName, exact: true })).toBeVisible();
  await expect(vorschau).toBeVisible();
  await expect(vorschau).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'eintrag'));
  await dialog.getByRole('button', { name: zeige('Schließen', sprache), exact: true }).click();
  await expect(dialog).toBeHidden();

  await seite.goto('/laufend');
  const bosse = seite.getByRole('heading', { name: zeige('Bosse', sprache), exact: true });
  const vorhaben = seite.getByRole('heading', { name: zeige('Vorhaben', sprache), exact: true });
  await expect(seite.getByRole('heading', { name: zeige('Laufend', sprache), exact: true })).toBeVisible();
  await expect(bosse).toBeVisible();
  await expect(vorhaben).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await vorhaben.evaluate((element) => element.scrollIntoView({ block: 'nearest' }));
  await expect(bosse).toBeInViewport();
  await expect(vorhaben).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'laufend'));

  await seite.goto('/charakter');
  const spektren = seite.locator('[data-spektren]');
  await expect(seite.getByRole('heading', { name: zeige('Profil', sprache), exact: true })).toBeVisible();
  await expect(spektren.getByText(zeige('Können', sprache), { exact: true })).toBeVisible();
  await expect(spektren.getByText(zeige('Haben', sprache), { exact: true })).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(spektren).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'profil'));

  const liste = await seite.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error(`faehigkeiten ${antwort.status}`);
    }
    return (await antwort.json()) as { id: number; name: string; archiviert: boolean }[];
  });
  const kraft = liste.find((eintrag) => eintrag.name === 'Kraft' && !eintrag.archiviert);
  expect(kraft, 'Fähigkeit Kraft').toBeTruthy();
  await seite.goto(`/faehigkeiten/${kraft?.id}`);
  await expect(seite.getByRole('heading', { name: 'Kraft', exact: true })).toBeVisible();
  const baumName = zeige('Baum', sprache);
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeVisible();
  await kopfFrei(seite, 'section:has(.baum-karte)');
  await expect(seite.getByRole('heading', { name: baumName, exact: true })).toBeInViewport();
  await expect(seite.locator('.baum-karte')).toBeInViewport();
  await expect(seite.getByText(BAUM_KNOTEN, { exact: true })).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'faehigkeiten'));

  await seite.goto('/charakter');
  await seite.getByRole('button', { name: zeige('Klassen und Titel', sprache), exact: true }).click();
  const klassenName = zeige('Klassen und Titel', sprache);
  const klassen = seite.getByRole('dialog', { name: klassenName });
  await expect(klassen).toBeVisible();
  await expect(klassen.getByRole('heading', { name: zeige('Klassen', sprache), exact: true })).toBeInViewport();
  await expect(klassen.getByRole('heading', { name: zeige('Titel', sprache), exact: true })).toBeVisible();
  await aufnahme(seite, bild(info, fassung, 'klassen'));
  await klassen.getByRole('button', { name: zeige('Schließen', sprache), exact: true }).click();
  await expect(klassen).toBeHidden();

  await seite.goto('/ziele');
  await expect(seite.getByRole('heading', { name: zeige('Ziele', sprache), exact: true })).toBeVisible();
  const vision = seite.getByRole('heading', { name: VISION, exact: true });
  await expect(vision).toBeVisible();
  await seite.evaluate(() => window.scrollTo(0, 0));
  await expect(vision).toBeInViewport();
  await aufnahme(seite, bild(info, fassung, 'ziele'));
}

async function nimmFassung(seite: Page, info: TestInfo, fassung: string, sprache: Sprache): Promise<void> {
  await oeffne(seite, sprache);
  const original = await liesStand(seite);
  const koerper =
    fassung === 'hell'
      ? { stil: 'standard', farbenZuruecksetzen: true, sprache: 'de' }
      : { ...DUNKEL, sprache };
  try {
    await speichere(seite, koerper);
    await seite.reload();
    await seite.getByRole('button', { name: zeige('Eintrag loggen', sprache) }).waitFor();
    await nimmAnsichten(seite, info, fassung, sprache);
  } finally {
    await speichere(seite, wiederherstellung(original));
  }
}

test('Helle Hauptansichten für die Infoseite', async ({ page }, info) => {
  await nimmFassung(page, info, 'hell', 'de');
});

test('Dunkle Hauptansichten für die Infoseite', async ({ page }, info) => {
  await nimmFassung(page, info, 'dunkel', 'de');
});

test.describe('englisch', () => {
  test.use({ locale: 'en-US' });

  test('Englische dunkle Hauptansichten für die Infoseite', async ({ page }, info) => {
    await nimmFassung(page, info, 'en-dunkel', 'en');
  });
});
