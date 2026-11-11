import fs from 'node:fs';
import type { ChronikSeite } from '../shared/api/eintraege.ts';
import { basisXp } from '../shared/spiel/xp.ts';
import { anmelden, meilensteineAus, ohneSeitlichenUeberlauf } from './helfer.ts';
import { expect, test, type Locator, type Page } from './uhr.ts';

const BILD = 'tmp-test/eintrag-dauer';
const DAUER_NAMEN = ['15 Min', '30 Min', '1 Std', '2 Std', 'Eigene'] as const;

interface Kasten {
  name: string;
  x: number;
  y: number;
  rechts: number;
  breite: number;
  hoehe: number;
  beschnitten: boolean;
}

interface ZeileMasse {
  umbruch: string;
  richtung: string;
  ueberlauf: string;
  beruehrung: string;
  scroll: number;
  sicht: number;
  x: number;
  rechts: number;
  dialog: { x: number; rechts: number; breite: number; hoehe: number };
  kaesten: Kasten[];
  fenster: { breite: number; hoehe: number };
}

async function taetigkeitWaehlen(page: Page, dialog: Locator): Promise<void> {
  const antwort = await page.request.get('/api/vorlagen');
  expect(antwort.ok()).toBe(true);
  const vorlagen = (await antwort.json()) as { name: string; archiviert: boolean }[];
  const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
  expect(vorlage).toBeTruthy();
  if (!vorlage) {
    return;
  }
  await dialog.locator('.eintrag-chips').getByRole('button', { name: vorlage.name, exact: true }).click();
}

async function chronik(page: Page): Promise<ChronikSeite['eintraege']> {
  const eintraege: ChronikSeite['eintraege'] = [];
  let cursor: string | null = null;
  const gesehen = new Set<string>();
  for (;;) {
    const parameter = new URLSearchParams({ limit: '100' });
    if (cursor !== null) {
      parameter.set('cursor', cursor);
    }
    const antwort = await page.request.get(`/api/eintraege?${parameter.toString()}`);
    expect(antwort.ok()).toBe(true);
    const daten = (await antwort.json()) as ChronikSeite;
    eintraege.push(...daten.eintraege);
    if (daten.naechsterCursor === null || gesehen.has(daten.naechsterCursor)) {
      return eintraege;
    }
    gesehen.add(daten.naechsterCursor);
    cursor = daten.naechsterCursor;
  }
}

async function entfernen(page: Page, notiz: string): Promise<void> {
  const eintraege = await chronik(page);
  for (const zeile of eintraege) {
    if (zeile.typ === 'eintrag' && zeile.eintrag.notiz === notiz) {
      await page.request.delete(`/api/eintraege/${zeile.eintrag.id}`);
    }
  }
}

async function eintragStunden(page: Page, notiz: string): Promise<number | null | undefined> {
  const treffer = (await chronik(page)).find((zeile) => zeile.typ === 'eintrag' && zeile.eintrag.notiz === notiz);
  return treffer?.typ === 'eintrag' ? treffer.eintrag.stunden : undefined;
}

async function dialogOeffnen(page: Page): Promise<Locator> {
  await anmelden(page);
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function masseDerZeile(zeile: Locator): Promise<ZeileMasse> {
  return zeile.evaluate((element) => {
    const stil = getComputedStyle(element);
    const dialog = element.closest('[role="dialog"]');
    const dialogKasten = dialog instanceof HTMLElement ? dialog.getBoundingClientRect() : element.getBoundingClientRect();
    const zeileKasten = element.getBoundingClientRect();
    const kaesten = [...element.querySelectorAll('button')].map((knopf) => {
      const kasten = knopf.getBoundingClientRect();
      return {
        name: knopf.getAttribute('aria-label') ?? '',
        x: kasten.x,
        y: kasten.y,
        rechts: kasten.right,
        breite: kasten.width,
        hoehe: kasten.height,
        beschnitten: knopf.scrollWidth - knopf.clientWidth > 1,
      };
    });
    return {
      umbruch: stil.flexWrap,
      richtung: stil.flexDirection,
      ueberlauf: stil.overflowX,
      beruehrung: stil.touchAction,
      scroll: element.scrollWidth,
      sicht: element.clientWidth,
      x: zeileKasten.x,
      rechts: zeileKasten.right,
      dialog: { x: dialogKasten.x, rechts: dialogKasten.right, breite: dialogKasten.width, hoehe: dialogKasten.height },
      kaesten,
      fenster: { breite: window.innerWidth, hoehe: window.innerHeight },
    };
  });
}

function zeileForm(masse: ZeileMasse, projekt: string, gewaehlt = false): void {
  expect(masse.umbruch).toBe('nowrap');
  expect(masse.richtung).toBe('row');
  expect(masse.ueberlauf === 'auto' || masse.ueberlauf === 'scroll').toBe(false);
  expect(masse.beruehrung).toBe('pan-y');
  expect(masse.scroll).toBeLessThanOrEqual(masse.sicht + 1);
  expect(masse.kaesten.map((kasten) => kasten.name)).toEqual([...DAUER_NAMEN]);
  const erste = masse.kaesten[0];
  const letzte = masse.kaesten[masse.kaesten.length - 1];
  expect(erste).toBeTruthy();
  expect(letzte).toBeTruthy();
  if (!erste || !letzte) {
    return;
  }
  expect(Math.abs(erste.x - (masse.dialog.x + 16))).toBeLessThanOrEqual(2);
  expect(letzte.rechts).toBeLessThanOrEqual(masse.dialog.rechts + 1);
  expect(letzte.rechts).toBeLessThan(masse.rechts - (gewaehlt ? 1 : 8));
  for (const kasten of masse.kaesten) {
    expect(kasten.hoehe).toBeGreaterThanOrEqual(48);
    expect(kasten.beschnitten).toBe(false);
    expect(Math.abs(kasten.y - erste.y)).toBeLessThanOrEqual(1);
    expect(kasten.x).toBeGreaterThanOrEqual(-1);
    expect(kasten.rechts).toBeLessThanOrEqual(masse.fenster.breite + 1);
    expect(kasten.y).toBeGreaterThanOrEqual(-1);
    expect(kasten.y + kasten.hoehe).toBeLessThanOrEqual(masse.fenster.hoehe + 1);
  }
  for (let index = 1; index < masse.kaesten.length; index += 1) {
    const vorher = masse.kaesten[index - 1];
    const aktuell = masse.kaesten[index];
    if (!vorher || !aktuell) {
      continue;
    }
    expect(aktuell.x).toBeGreaterThan(vorher.x);
    expect(Math.abs(aktuell.x - vorher.rechts - 8)).toBeLessThanOrEqual(1);
  }
  if (projekt === 'desktop') {
    expect(Math.abs(masse.dialog.breite - 560)).toBeLessThanOrEqual(1);
    expect(letzte.rechts).toBeLessThan(masse.dialog.rechts - 80);
  }
}

test.beforeAll(() => {
  fs.mkdirSync(BILD, { recursive: true });
});

test('Die Dauer steht in einer festen Zeile und 15 Minuten lässt sich wählen', async ({ page }, testInfo) => {
  const notiz = `Dauerzeile ${testInfo.project.name}`;
  const xpLeer = String(basisXp(null));
  const xpKurz = String(basisXp(0.25));
  try {
    const dialog = await dialogOeffnen(page);
    const gruppe = dialog.getByRole('group', { name: 'Dauer', exact: true });
    const zeile = dialog.locator('[data-dauer-zeile]');
    await expect(zeile).toBeVisible();
    await expect(zeile).not.toHaveClass(/eintrag-chips|chip-reihe/);
    await zeile.scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    zeileForm(await masseDerZeile(zeile), testInfo.project.name);
    await expect(gruppe.getByRole('button', { name: 'Keine Angabe', exact: true })).toHaveCount(0);
    await expect(gruppe.getByRole('button', { name: '4 Std', exact: true })).toHaveCount(0);
    await expect(gruppe.getByRole('button', { name: 'Ganzer Tag', exact: true })).toHaveCount(0);
    await expect(gruppe.getByRole('textbox')).toHaveCount(0);
    for (const name of DAUER_NAMEN) {
      await expect(zeile.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(dialog.getByRole('button', { name: `Eintragen · ca. +${xpLeer} XP`, exact: true })).toBeVisible();
    await page.screenshot({ path: `${BILD}/${testInfo.project.name}-dialog.png` });

    for (const name of DAUER_NAMEN) {
      const chip = zeile.getByRole('button', { name, exact: true });
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      zeileForm(await masseDerZeile(zeile), testInfo.project.name, true);
    }

    const viertel = zeile.getByRole('button', { name: '15 Min', exact: true });
    await viertel.click();
    await expect(viertel).toHaveAttribute('aria-pressed', 'true');
    zeileForm(await masseDerZeile(zeile), testInfo.project.name, true);
    await expect(viertel).toBeFocused();
    await expect(gruppe.getByRole('textbox')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: `Eintragen · ca. +${xpKurz} XP`, exact: true })).toBeVisible();
    await viertel.click();
    await expect(viertel).toHaveAttribute('aria-pressed', 'false');
    await expect(viertel).toBeFocused();
    await expect(dialog.getByRole('button', { name: `Eintragen · ca. +${xpLeer} XP`, exact: true })).toBeVisible();
    await viertel.click();
    await expect(viertel).toHaveAttribute('aria-pressed', 'true');
    zeileForm(await masseDerZeile(zeile), testInfo.project.name, true);

    await taetigkeitWaehlen(page, dialog);
    await dialog.getByRole('textbox', { name: 'Notiz', exact: true }).fill(notiz);
    await dialog.getByRole('button', { name: `Eintragen · ca. +${xpKurz} XP`, exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.goto('/chronik');
    await expect(page).toHaveURL(/\/chronik$/);
    await meilensteineAus(page);
    await expect(page.locator(`[data-schnell="${notiz}"]`)).toContainText('15 Min');
    expect(await eintragStunden(page, notiz)).toBe(0.25);
  } finally {
    await entfernen(page, notiz).catch(() => undefined);
  }
});

test('Eine eigene Dauer bleibt in der Schreibweise und landet im Verlauf', async ({ page }, testInfo) => {
  const notiz = `Eigene Dauer ${testInfo.project.name}`;
  try {
    const dialog = await dialogOeffnen(page);
    const zeile = dialog.locator('[data-dauer-zeile]');
    await zeile.scrollIntoViewIfNeeded();
    const viertel = zeile.getByRole('button', { name: '15 Min', exact: true });
    const eigene = zeile.getByRole('button', { name: 'Eigene', exact: true });
    await viertel.click();
    await eigene.click();
    const feld = dialog.getByRole('textbox', { name: 'Dauer in Std', exact: true });
    await expect(feld).toBeVisible();
    await expect(feld).toHaveValue('');
    await expect(feld).toHaveAttribute('inputmode', 'decimal');
    await expect(feld).toBeFocused();
    await expect(eigene).toHaveAttribute('aria-pressed', 'true');
    await expect(viertel).toHaveAttribute('aria-pressed', 'false');
    zeileForm(await masseDerZeile(zeile), testInfo.project.name, true);
    await page.screenshot({ path: `${BILD}/${testInfo.project.name}-eigene.png` });
    await eigene.focus();
    await page.keyboard.press('Tab');
    await expect(feld).toBeFocused();
    await feld.fill('1,5');
    await expect(feld).toHaveValue('1,5');
    await expect(dialog.getByRole('alert')).toHaveCount(0);

    await taetigkeitWaehlen(page, dialog);
    await dialog.getByRole('textbox', { name: 'Notiz', exact: true }).fill(notiz);
    await dialog.getByRole('button', { name: /Eintragen · ca\. \+/ }).click();
    await expect(dialog).toBeHidden();
    await page.goto('/chronik');
    await meilensteineAus(page);
    const karte = page.locator(`[data-schnell="${notiz}"]`);
    await expect(karte).toContainText('1,5 Std');
    expect(await eintragStunden(page, notiz)).toBe(1.5);
  } finally {
    await entfernen(page, notiz).catch(() => undefined);
  }
});

test('Eine zu kurze eigene Dauer wird abgewiesen und erzeugt keinen Eintrag', async ({ page }, testInfo) => {
  const notiz = `Dauer zu kurz ${testInfo.project.name}`;
  try {
    const dialog = await dialogOeffnen(page);
    await taetigkeitWaehlen(page, dialog);
    const zeile = dialog.locator('[data-dauer-zeile]');
    await zeile.scrollIntoViewIfNeeded();
    await zeile.getByRole('button', { name: 'Eigene', exact: true }).click();
    const feld = dialog.getByRole('textbox', { name: 'Dauer in Std', exact: true });
    await feld.fill('0,1');
    await expect(feld).toHaveValue('0,1');
    await expect(dialog.getByRole('group', { name: 'Dauer', exact: true }).getByRole('alert')).toContainText(
      'Die Dauer muss mindestens 0.25 Stunden sein.',
    );
    await dialog.getByRole('textbox', { name: 'Notiz', exact: true }).fill(notiz);
    await dialog.getByRole('button', { name: /Eintragen · ca\. \+/ }).click();
    await expect(dialog).toBeVisible();
    await expect(feld).toBeFocused();
    await expect(page).not.toHaveURL(/\/chronik/);
    expect(await eintragStunden(page, notiz)).toBeUndefined();
  } finally {
    await entfernen(page, notiz).catch(() => undefined);
  }
});
