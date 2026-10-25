import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte } from './aufgabenHelfer.ts';

function plusTage(iso: string, tage: number): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  const datum = new Date(jahr ?? 0, (monat ?? 1) - 1, tag ?? 1);
  datum.setDate(datum.getDate() + tage);
  const monatText = String(datum.getMonth() + 1).padStart(2, '0');
  const tagText = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monatText}-${tagText}`;
}

function labelSpan(dialog: Locator, label: string): Locator {
  return dialog.locator('span.text-sm').filter({ hasText: new RegExp(`^${label}$`) });
}

async function infoAbstand(dialog: Locator, label: string): Promise<{ abstand: number; delta: number }> {
  return labelSpan(dialog, label).evaluate((knoten) => {
    const info = knoten.parentElement?.querySelector('button[aria-label="Info"]');
    const huelle = info?.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : -1;
    const name = knoten.getBoundingClientRect();
    const knopf = info?.getBoundingClientRect();
    const delta = knopf ? knopf.top + knopf.height / 2 - (name.top + name.height / 2) : 99;
    return { abstand, delta };
  });
}

function infoKnopf(dialog: Locator, label: string): Locator {
  return labelSpan(dialog, label).locator('xpath=..').getByRole('button', { name: 'Info' });
}

async function oeffneHinweis(dialog: Locator, page: Page, label: string, text: string): Promise<void> {
  const knopf = infoKnopf(dialog, label);
  await knopf.click();
  const hinweis = page.getByRole('tooltip');
  await expect(hinweis).toHaveText(text);
  const lage = await hinweis.evaluate((knoten) => {
    const stil = getComputedStyle(knoten);
    return { z: Number.parseFloat(stil.zIndex), sichtbar: stil.visibility };
  });
  expect(lage.z).toBeGreaterThan(90);
  expect(lage.sichtbar).toBe('visible');
  const ring = await knopf.evaluate((knoten) => getComputedStyle(knoten).outlineStyle);
  expect(ring).toBe('none');
}

async function sichtbareMarke(zeile: Locator, klasse: string, text: string): Promise<number> {
  return zeile.locator(`span.${klasse}`).evaluateAll((knoten, gesucht) => {
    const sichtbar = (eintrag: Element) => {
      let aktuell: Element | null = eintrag;
      while (aktuell) {
        const stil = getComputedStyle(aktuell);
        if (stil.display === 'none' || stil.visibility === 'hidden') {
          return false;
        }
        aktuell = aktuell.parentElement;
      }
      return true;
    };
    return knoten.filter((eintrag) => sichtbar(eintrag) && eintrag.textContent === gesucht).length;
  }, text);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Weiteres, Marken und Uhrzeit', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/aufgaben-k1/${projekt}-${name}.png` });
  const name = `Bau Marke ${projekt}`;
  const spaet = `Bau Spaet ${projekt}`;
  const frueh = `Bau Frueh ${projekt}`;

  await page.goto('/mehr/funktionen');
  await schalte(page, true);
  await raeumeBau(page);

  try {
    await page.goto('/aufgaben');
    await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const nameInfo = await infoAbstand(dialog, 'Name');
    expect(nameInfo.abstand).toBeGreaterThanOrEqual(5);
    expect(nameInfo.abstand).toBeLessThanOrEqual(8);
    expect(Math.abs(nameInfo.delta)).toBeLessThanOrEqual(4);
    await dialog.getByRole('button', { name: 'Info', exact: true }).click();
    await expect(page.getByRole('tooltip')).toContainText('p1 bis p4');
    await page.keyboard.press('Escape');

    await dialog.getByLabel('Name').fill(name);
    const chip = dialog.getByRole('group', { name: 'Tätigkeit' }).getByRole('button').first();
    await chip.click();
    const heute = await heuteDerWelt(page);
    await dialog.getByLabel('Datum').fill(heute);
    await dialog.getByLabel('Uhrzeit').fill('09:00');
    await dialog.getByRole('button', { name: 'Weiteres', exact: true }).click();
    await dialog.getByRole('button', { name: 'p1', exact: true }).click();
    await expect(dialog.getByRole('switch', { name: 'Nur heute', exact: true })).toHaveCount(0);
    const meilenstein = await infoAbstand(dialog, 'Meilenstein');
    expect(meilenstein.abstand).toBeGreaterThanOrEqual(5);
    expect(meilenstein.abstand).toBeLessThanOrEqual(8);
    expect(Math.abs(meilenstein.delta)).toBeLessThanOrEqual(4);
    const gegner = dialog.getByRole('switch', { name: 'Gegner', exact: true });
    await expect(gegner).toHaveAttribute('aria-checked', 'false');
    await expect(dialog.getByRole('switch', { name: 'Boss', exact: true })).toHaveCount(0);
    await oeffneHinweis(
      dialog,
      page,
      'Meilenstein',
      'Ein großes Ereignis: ein Ziel erreicht, ein neuer Rekord oder etwas zum ersten Mal geschafft. Dafür gibt es mehr XP.',
    );
    await expect(dialog.getByRole('switch', { name: 'Meilenstein', exact: true })).toHaveAttribute('aria-checked', 'false');
    await bild('dialog-info-meilenstein');
    await page.keyboard.press('Escape');
    await oeffneHinweis(dialog, page, 'Gegner', 'Ein Gegner zahlt weniger als ein Boss.');
    await expect(gegner).toHaveAttribute('aria-checked', 'false');
    await bild('dialog-info-gegner');
    await page.keyboard.press('Escape');
    await dialog.getByRole('switch', { name: 'Meilenstein', exact: true }).scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await bild('dialog-mehr');

    await dialog.getByLabel('Datum').fill('');
    await dialog.getByLabel('Uhrzeit').fill('09:00');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await expect(dialog.getByText('Die Uhrzeit braucht ein Datum.')).toBeVisible();
    await dialog.getByLabel('Datum').fill(heute);
    await dialog.getByRole('button', { name: 'Wöchentlich', exact: true }).click();
    await dialog.getByRole('button', { name: 'Mo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Mi', exact: true }).click();
    await expect(dialog.getByRole('switch', { name: 'Gegner', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect(dialog.getByLabel('Deadline')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Weiteres', exact: true }).click();
    await expect(dialog.getByText('Priorität', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Mo', exact: true }).scrollIntoViewIfNeeded();
    await bild('dialog-woche');
    await dialog.getByRole('button', { name: 'Einmal', exact: true }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);

    const zeile = page.getByRole('listitem').filter({ hasText: name });
    await expect(zeile).toBeVisible();
    expect(await sichtbareMarke(zeile, 'prio-farbe', 'p1')).toBe(1);
    await expect(zeile).toContainText('09:00');
    await expect(zeile.locator('.size-9')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('aufgaben-marken');

    await zeile.getByRole('button', { name, exact: true }).click();
    const bearbeiten = page.getByRole('dialog');
    await expect(bearbeiten.getByRole('button', { name: 'p1', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await bearbeiten.getByRole('switch', { name: 'Gegner', exact: true }).click();
    await expect(bearbeiten.getByRole('button', { name: 'Einmal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await bearbeiten.getByLabel('Deadline').fill(plusTage(heute, 7));
    await expect(bearbeiten.locator('span.size-9')).toBeVisible();
    await expect(bearbeiten.getByRole('switch', { name: 'Boss', exact: true })).toHaveCount(0);
    const deadlineInfo = await infoAbstand(bearbeiten, 'Deadline');
    expect(deadlineInfo.abstand).toBeGreaterThanOrEqual(5);
    expect(deadlineInfo.abstand).toBeLessThanOrEqual(8);
    await bearbeiten.getByLabel('Deadline').scrollIntoViewIfNeeded();
    await bild('dialog-gegner');
    await bearbeiten.getByRole('button', { name: 'Speichern' }).click();
    await expect(bearbeiten).toHaveCount(0);
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);
    await expect.poll(() => sichtbareMarke(zeile, 'text-gefahr', 'Gegner')).toBe(1);
    await expect(zeile.locator('.size-9')).toHaveCount(0);
    await bild('liste-gegner');

    await zeile.getByRole('button', { name, exact: true }).click();
    const bossDialog = page.getByRole('dialog');
    await bossDialog.getByRole('switch', { name: 'Meilenstein', exact: true }).click();
    await expect(bossDialog.getByRole('switch', { name: 'Gegner', exact: true })).toHaveCount(0);
    await expect(bossDialog.getByLabel('Deadline')).toHaveCount(0);
    await bossDialog.getByRole('switch', { name: 'Boss', exact: true }).click();
    await oeffneHinweis(bossDialog, page, 'Boss', 'Volle Boss-Belohnung.');
    await page.keyboard.press('Escape');
    await bossDialog.getByLabel('Deadline').fill(plusTage(heute, 10));
    await expect(bossDialog.locator('span.size-9')).toBeVisible();
    await bossDialog.getByLabel('Deadline').scrollIntoViewIfNeeded();
    await bild('dialog-boss');
    await bossDialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(bossDialog).toHaveCount(0);
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);
    await expect.poll(() => sichtbareMarke(zeile, 'text-gefahr', 'Boss')).toBe(1);
    expect(await sichtbareMarke(zeile, 'text-gefahr', 'Gegner')).toBe(0);

    const vorlagen = (await (await page.request.get('/api/vorlagen')).json()) as { id: number; name: string; archiviert: boolean }[];
    const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
    expect(vorlage).toBeTruthy();
    const basis = {
      icon: 'clipboard-list',
      projektId: null,
      organisationId: null,
      visionId: null,
      vorlageId: vorlage?.id,
      stunden: null,
      wiederholung: 'keine',
      wochentage: [],
      nurHeute: false,
      meilenstein: false,
      gegner: false,
      boss: false,
      deadline: null,
    };
    const angelegt = await page.request.post('/api/aufgaben', {
      data: { ...basis, name: frueh, faelligAm: heute, faelligUm: '08:00', prioritaet: null },
    });
    expect(angelegt.ok()).toBe(true);
    const ohneZeit = await page.request.post('/api/aufgaben', {
      data: { ...basis, name: spaet, faelligAm: heute, faelligUm: null, prioritaet: 1 },
    });
    expect(ohneZeit.ok()).toBe(true);

    await page.goto('/');
    const heuteListe = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Heute', exact: true }) });
    await heuteListe.scrollIntoViewIfNeeded();
    const namen = await heuteListe.getByRole('listitem').evaluateAll((knoten) =>
      knoten.map((eintrag) => {
        const knoepfe = [...eintrag.querySelectorAll('button[aria-label]')];
        const nameKnopf = knoepfe.find((knopf) => {
          const label = knopf.getAttribute('aria-label');
          return label !== 'Erledigt' && label !== 'Rückgängig';
        });
        return nameKnopf?.getAttribute('aria-label') ?? '';
      }),
    );
    const bau = namen.filter((eintrag) => eintrag.startsWith('Bau '));
    expect(bau.indexOf(frueh)).toBeLessThan(bau.indexOf(name));
    expect(bau.indexOf(name)).toBeLessThan(bau.indexOf(spaet));
    await ohneSeitlichenUeberlauf(page);
    await bild('uebersicht-zeit');
  } finally {
    await raeumeBau(page);
  }
});
