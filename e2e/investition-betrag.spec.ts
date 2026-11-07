import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_PASSWORT, TEST_TEIL_WELT } from './testdaten.ts';

const NAME = 'Betrag Vorschlag';

function vorschlagChips(dialog: Locator): Locator {
  return dialog.getByRole('group', { name: 'Betrag' }).getByRole('button');
}

async function xpWerte(dialog: Locator): Promise<number[]> {
  const chips = vorschlagChips(dialog);
  await expect(chips).toHaveCount(3);
  const namen = await chips.evaluateAll((knoten) => knoten.map((knoten) => knoten.getAttribute('aria-label') ?? ''));
  for (const name of namen) {
    expect(name).not.toMatch(/Woche|Monat/);
  }
  return namen.map((name) => Number(name.match(/^([\d.]+)/)?.[1]?.replaceAll('.', '')));
}

function erwarteSteigend(werte: number[]): void {
  expect(werte).toHaveLength(3);
  expect(werte.every((wert) => Number.isInteger(wert) && wert > 0)).toBe(true);
  expect(new Set(werte).size).toBe(3);
  expect(werte[0]).toBeLessThan(werte[1]!);
  expect(werte[1]!).toBeLessThan(werte[2]!);
}

function betragFeld(dialog: Locator): Locator {
  return dialog.getByRole('textbox', { name: 'Eigener Betrag', exact: true });
}

async function betragZeile(dialog: Locator, eng: boolean): Promise<void> {
  const gruppe = dialog.getByRole('group', { name: 'Betrag' });
  const chips = vorschlagChips(dialog);
  const feld = betragFeld(dialog);
  await expect(feld).toHaveAttribute('placeholder', 'Eigener');
  await expect(dialog.getByText('Eigener', { exact: true })).toHaveCount(0);
  const kaesten = [];
  for (const ziel of [chips.nth(0), chips.nth(1), chips.nth(2), feld]) {
    const kasten = await ziel.boundingBox();
    expect(kasten).not.toBeNull();
    kaesten.push(kasten!);
  }
  const oben = kaesten.map((kasten) => kasten.y);
  expect(Math.max(...oben) - Math.min(...oben)).toBeLessThanOrEqual(1);
  const breiten = kaesten.map((kasten) => kasten.width);
  expect(Math.max(...breiten) - Math.min(...breiten)).toBeLessThanOrEqual(1);
  for (const kasten of kaesten) {
    expect(kasten.height).toBeGreaterThanOrEqual(47);
    expect(kasten.height).toBeLessThanOrEqual(49);
  }
  if (eng) {
    for (const breite of breiten) {
      expect(breite).toBeGreaterThanOrEqual(70);
      expect(breite).toBeLessThanOrEqual(96);
    }
  }
  for (let index = 0; index < kaesten.length - 1; index += 1) {
    const links = kaesten[index]!;
    const rechts = kaesten[index + 1]!;
    const abstand = rechts.x - (links.x + links.width);
    expect(Math.abs(abstand - 8)).toBeLessThanOrEqual(1);
  }
  const dialogKasten = await dialog.boundingBox();
  const gruppenKasten = await gruppe.boundingBox();
  expect(dialogKasten).not.toBeNull();
  expect(gruppenKasten).not.toBeNull();
  expect(gruppenKasten!.x).toBeGreaterThanOrEqual(dialogKasten!.x - 1);
  expect(gruppenKasten!.x + gruppenKasten!.width).toBeLessThanOrEqual(dialogKasten!.x + dialogKasten!.width + 1);
  const lesbar = await gruppe.evaluate((el) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      return 'zeile';
    }
    const knoepfe = [...el.querySelectorAll('button')];
    for (const knopf of knoepfe) {
      const menge = [...knopf.querySelectorAll('span')].filter((span) => !span.classList.contains('sr-only'));
      if (menge.length !== 1 || menge[0]?.textContent?.trim() !== knopf.getAttribute('aria-label')) {
        return 'chip';
      }
      const text = menge[0];
      if (!(text instanceof HTMLElement)) {
        return 'chip';
      }
      const aussen = knopf.getBoundingClientRect();
      const innen = text.getBoundingClientRect();
      if (innen.width <= 0 || innen.left < aussen.left - 1 || innen.right > aussen.right + 1) {
        return 'chip';
      }
      const versteckt = knopf.querySelector('.sr-only');
      if (versteckt instanceof HTMLElement) {
        const kasten = versteckt.getBoundingClientRect();
        if (kasten.width > 2 || kasten.height > 2) {
          return 'hinweis';
        }
      }
    }
    const feld = el.querySelector('input');
    if (!(feld instanceof HTMLInputElement)) {
      return 'feld';
    }
    const stil = getComputedStyle(feld);
    const probe = document.createElement('span');
    const leer = feld.value === '';
    probe.textContent = leer ? feld.placeholder : feld.value;
    probe.style.position = 'absolute';
    probe.style.whiteSpace = 'nowrap';
    probe.style.visibility = 'hidden';
    const schrift = leer ? getComputedStyle(feld, '::placeholder') : stil;
    probe.style.font = schrift.font;
    document.body.appendChild(probe);
    const breite = probe.getBoundingClientRect().width;
    probe.remove();
    const ende = feld.parentElement?.querySelector('span[aria-hidden="true"]');
    const endeKasten = ende?.getBoundingClientRect();
    const feldKasten = feld.getBoundingClientRect();
    const textRechts = feldKasten.left + parseFloat(stil.paddingLeft) + breite;
    if (!endeKasten || endeKasten.right > feldKasten.right + 1 || endeKasten.left < feldKasten.left) {
      return 'ende';
    }
    if (textRechts > endeKasten.left + 1) {
      return 'schnitt';
    }
    return 'ok';
  });
  expect(lesbar).toBe('ok');
}

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

function xpZeile(attributId: number, xp: number, datei = weltDatei()): number {
  const db = new DatabaseSync(datei, { timeout: 5_000 });
  try {
    const zeile = db
      .prepare(`INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`)
      .run(attributId, xp, '2099-06-01T00:00:00.000Z');
    return Number(zeile.lastInsertRowid);
  } finally {
    db.close();
  }
}

function streicheXp(id: number, datei = weltDatei()): void {
  const db = new DatabaseSync(datei, { timeout: 5_000 });
  try {
    const ergebnis = db.prepare('DELETE FROM xp_ereignisse WHERE id = ?').run(id);
    if (Number(ergebnis.changes) !== 1) {
      throw new Error('XP-Zeile blieb stehen.');
    }
  } finally {
    db.close();
  }
}

async function entfernen(page: Page, name: string): Promise<void> {
  await page.evaluate(async (titel) => {
    const liste = (await fetch('/api/investitionen').then((antwort) => antwort.json())) as { id: number; name: string }[];
    const eintrag = liste.find((zeile) => zeile.name === titel);
    if (!eintrag) {
      return;
    }
    await fetch(`/api/investitionen/${eintrag.id}`, { method: 'DELETE' });
  }, name);
}

async function ressourcen(page: Page): Promise<{ id: number; xp: number }> {
  return page.evaluate(async () => {
    const liste = (await fetch('/api/attribute').then((antwort) => antwort.json())) as {
      id: number;
      kennung: string | null;
      level: { xpGesamt: number };
    }[];
    const eintrag = liste.find((zeile) => zeile.kennung === 'ressourcen');
    if (!eintrag) {
      throw new Error('Ressourcen fehlen.');
    }
    return { id: eintrag.id, xp: eintrag.level.xpGesamt };
  });
}

test('Ein Vorschlag setzt den Betrag, ein eigener Wert und 100 XP mit 30 % bleiben frei', async ({ page }, testInfo) => {
  await anmelden(page);
  await entfernen(page, NAME);
  const stand = await ressourcen(page);
  const xpId = stand.xp > 0 ? xpZeile(stand.id, -stand.xp) : null;
  try {
    await page.goto('/investitionen');
    await page.getByRole('button', { name: /Investition anlegen/ }).click();
    const gesperrt = page.getByRole('dialog', { name: 'Investition', exact: true });
    const feldLeer = betragFeld(gesperrt);
    erwarteSteigend(await xpWerte(gesperrt));
    const teuer = gesperrt.locator('button[aria-disabled="true"]');
    await expect(teuer).toHaveCount(3);
    const ersterTeuer = teuer.first();
    await expect(ersterTeuer).toHaveAttribute('aria-disabled', 'true');
    expect(await ersterTeuer.getAttribute('disabled')).toBeNull();
    await ersterTeuer.focus();
    await expect(ersterTeuer).toBeFocused();
    const beschreibungId = await ersterTeuer.getAttribute('aria-describedby');
    expect(beschreibungId).toBeTruthy();
    await expect(gesperrt.locator(`[id="${beschreibungId}"]`)).toHaveText(/^fehlen .+ XP$/);
    const menge = (await ersterTeuer.getAttribute('aria-label'))?.match(/^([\d.]+)/)?.[1];
    expect(menge).toBeTruthy();
    await ersterTeuer.click({ force: true });
    await expect(feldLeer).toHaveValue('');
    await expect(gesperrt.getByText(`Dir fehlen ${menge} XP`)).toBeVisible();
    await betragZeile(gesperrt, testInfo.project.name === 'handy');
  } finally {
    if (xpId !== null) {
      streicheXp(xpId);
    }
  }

  const guthaben = xpZeile(stand.id, 20_000);
  try {
    await page.goto('/investitionen');
    const nachher = await ressourcen(page);
    expect(nachher.xp).toBeGreaterThanOrEqual(20_000);
    await page.getByRole('button', { name: /Investition anlegen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    await expect(dialog.getByText('1 Woche')).toHaveCount(0);
    await expect(dialog.getByText('1 Monat')).toHaveCount(0);
    await expect(dialog.getByText('3 Monate')).toHaveCount(0);
    const werte = await xpWerte(dialog);
    erwarteSteigend(werte);
    const chips = vorschlagChips(dialog);
    await betragZeile(dialog, testInfo.project.name === 'handy');

    const index = werte.findIndex((wert) => wert !== 100);
    const gewaehlt = chips.nth(index);
    await gewaehlt.click();
    const feld = betragFeld(dialog);
    await expect(feld).toHaveValue(String(werte[index]));
    await expect(dialog.getByText(/^Dir fehlen .+ XP$/)).toHaveCount(0);
    await betragZeile(dialog, testInfo.project.name === 'handy');
    await expect(gewaehlt).toHaveAttribute('aria-pressed', 'true');
    await feld.fill('100');
    await expect(gewaehlt).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('radio', { name: '+30 %' }).click();
    await expect(dialog.getByRole('radio', { name: '+30 %' })).toBeChecked();
    await dialog.getByText('Betrag', { exact: true }).scrollIntoViewIfNeeded();
    if (testInfo.project.name === 'handy') {
      await page.screenshot({ path: 'tmp-test/investition-betrag/handy-verlauf.png' });
    }
    await ohneSeitlichenUeberlauf(page);
    await dialog.getByRole('textbox', { name: 'Name' }).fill(NAME);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();

    const gespeichert = await page.evaluate(async (titel) => {
      const liste = (await fetch('/api/investitionen').then((antwort) => antwort.json())) as {
        name: string;
        betrag: number;
        groesse: number;
        bonus: number;
      }[];
      return liste.find((eintrag) => eintrag.name === titel) ?? null;
    }, NAME);
    expect(gespeichert?.betrag).toBe(100);
    expect(gespeichert?.groesse).toBe(3);
    expect(gespeichert?.bonus).toBeCloseTo(0.3, 5);
  } finally {
    streicheXp(guthaben);
    await entfernen(page, NAME);
  }
});

async function teilPasswort(): Promise<string> {
  return TEST_PASSWORT;
}

test('Ohne Verlauf bleiben die festen Beträge', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('input[name="username"]').fill('testteil');
  await page.locator('input[name="password"]').fill(await teilPasswort());
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForFunction(async () => (await fetch('/api/einstellungen')).ok);
  const bereit = await page.evaluate(async () => {
    const reset = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!reset.ok) {
      return reset.status;
    }
    const schrift = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profilAngelegt: true, sprache: 'de', funktionen: { ausruestung: true } }),
    });
    return schrift.status;
  });
  expect(bereit).toBe(200);
  await page.goto('/investitionen');
  const stand = await ressourcen(page);
  const datei = verweigereEchteDatenbank(TEST_TEIL_WELT);
  const xpId = xpZeile(stand.id, 2000, datei);
  try {
    await page.goto('/investitionen');
    await page.getByRole('button', { name: /Investition anlegen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    await expect(dialog.getByRole('button', { name: '100 XP', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '300 XP', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '800 XP', exact: true })).toBeVisible();
    erwarteSteigend(await xpWerte(dialog));
    await expect(dialog.getByRole('button', { name: /1 Woche|1 Monat|3 Monate/ })).toHaveCount(0);
    await betragZeile(dialog, testInfo.project.name === 'handy');
    await dialog.getByText('Betrag', { exact: true }).scrollIntoViewIfNeeded();
    if (testInfo.project.name === 'handy') {
      await page.screenshot({ path: 'tmp-test/investition-betrag/handy-ohne-verlauf.png' });
    }
    await ohneSeitlichenUeberlauf(page);
  } finally {
    streicheXp(xpId, datei);
  }
});
