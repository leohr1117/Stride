import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_KOPIE } from './testdaten.ts';

const NAME = 'Betrag Vorschlag';

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
    const feldLeer = gesperrt.getByRole('textbox', { name: 'Eigener' });
    const teuer = gesperrt.locator('button[aria-disabled="true"]');
    await expect(teuer).toHaveCount(3);
    await teuer.first().click({ force: true });
    await expect(feldLeer).toHaveValue('');
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
    const woche = dialog.getByRole('button', { name: /1 Woche/ });
    const monat = dialog.getByRole('button', { name: /1 Monat/ });
    const quartal = dialog.getByRole('button', { name: /3 Monate/ });
    await expect(woche).toBeVisible();
    await expect(monat).toBeVisible();
    await expect(quartal).toBeVisible();
    const flaeche = await woche.boundingBox();
    const pille = await woche.locator('span').first().boundingBox();
    expect(flaeche?.height).toBeGreaterThanOrEqual(48);
    expect(pille?.height).toBeGreaterThanOrEqual(36);
    expect(pille?.height).toBeLessThanOrEqual(36);
    const wocheKasten = await woche.boundingBox();
    const monatKasten = await monat.boundingBox();
    const abstand = monatKasten && wocheKasten ? monatKasten.x - (wocheKasten.x + wocheKasten.width) : null;
    expect(abstand).toBeGreaterThanOrEqual(8);
    expect(abstand).toBeLessThanOrEqual(8);

    await woche.click();
    const feld = dialog.getByRole('textbox', { name: 'Eigener' });
    const roh = (await woche.getAttribute('aria-label'))?.match(/^([\d.]+)/)?.[1]?.replace(/\./g, '');
    expect(roh).toBeTruthy();
    await expect(feld).toHaveValue(roh!);
    await expect(woche).toHaveAttribute('aria-pressed', 'true');
    await feld.fill('100');
    await expect(woche).toHaveAttribute('aria-pressed', 'false');
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
  const fs = await import('node:fs');
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
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
  const datei = verweigereEchteDatenbank(path.join(TEST_KOPIE, 'welten', '4.db'));
  const xpId = xpZeile(stand.id, 2000, datei);
  try {
    await page.goto('/investitionen');
    await page.getByRole('button', { name: /Investition anlegen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    await expect(dialog.getByRole('button', { name: '100 XP', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '300 XP', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '800 XP', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /1 Woche/ })).toHaveCount(0);
    await dialog.getByText('Betrag', { exact: true }).scrollIntoViewIfNeeded();
    if (testInfo.project.name === 'handy') {
      await page.screenshot({ path: 'tmp-test/investition-betrag/handy-ohne-verlauf.png' });
    }
    await ohneSeitlichenUeberlauf(page);
  } finally {
    streicheXp(xpId, datei);
  }
});
