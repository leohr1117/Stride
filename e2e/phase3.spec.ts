import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { lokalesDatum, plusTage } from '../shared/spiel/datum.ts';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

const FOLIEN = 4;

function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-bau/36', { recursive: true });
  return seite.screenshot({ path: `tmp-bau/36/${test.info().project.name}-${name}.png` });
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function vorbereiten(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testteil');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.locator('button[type="submit"]').click();
  await seite.waitForFunction(async () => (await fetch('/api/einstellungen')).ok);
  await seite.evaluate(async () => {
    const reset = await fetch('/api/profil/zuruecksetzen', { method: 'POST' });
    if (!reset.ok) {
      throw new Error(`zuruecksetzen ${reset.status}`);
    }
    const stil = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'antik' }),
    });
    if (!stil.ok) {
      throw new Error(`stil ${stil.status}`);
    }
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
  });
  await seite.goto('/');
  await expect(seite.locator('html')).toHaveAttribute('data-stil', 'antik');
}

async function zumStart(seite: Page, ziel: string): Promise<void> {
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  for (let index = 0; index < FOLIEN; index += 1) {
    await seite.getByRole('button', { name: index === FOLIEN - 1 ? 'Zu den Fragen' : 'Weiter', exact: true }).click();
  }
  await seite.locator('input[name="nickname"]').fill('Start');
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.locator('input[name="bday-year"]').fill('1994');
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('radio', { name: ziel }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('button', { name: 'Sport' }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(seite.getByRole('heading', { name: 'Zum Start', exact: true })).toBeVisible();
}

async function lesen<T>(seite: Page, pfad: string): Promise<T> {
  return seite.evaluate(async (url) => {
    const antwort = await fetch(url);
    if (!antwort.ok) {
      throw new Error(`${url} ${antwort.status}`);
    }
    return antwort.json() as Promise<T>;
  }, pfad);
}

test('Annehmen schreibt Vorbild und Boss und öffnet das Handbuch', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Ein Lebensziel');
  const vorbild = page.getByRole('region', { name: 'Vorbild' });
  const boss = page.getByRole('region', { name: 'Erster Boss' });
  const handbuch = page.getByRole('button', { name: 'Zum Handbuch', exact: true });
  await expect(page.getByRole('progressbar', { name: 'Fortschritt' })).toHaveAttribute('aria-valuemax', '5');
  await expect(page.getByRole('progressbar', { name: 'Fortschritt' })).toHaveAttribute('aria-valuenow', '5');
  await expect(page.getByRole('progressbar', { name: 'Fortschritt' }).locator('span')).toHaveCount(5);
  await expect(page.getByText('Stride', { exact: true })).toBeVisible();
  await expect(page.getByText('Zwei Angebote. Beides kannst du auslassen.')).toBeVisible();
  await expect(page.getByText('Später in den Einstellungen änderbar.')).toHaveCount(0);
  await expect(vorbild.getByText('Eliud Kipchoge')).toBeVisible();
  await expect(vorbild.getByText('Marathon')).toBeVisible();
  await expect(boss.getByText('Lauf beginnen')).toBeVisible();
  await expect(boss.getByText('Projekt Anfang · 7 Tage')).toBeVisible();
  await expect(handbuch).toBeDisabled();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'onboarding');

  const info = vorbild.getByRole('button', { name: 'Info' });
  await info.click();
  const hinweis = vorbild.getByText('Vorschlag aus dem Fokus.');
  await expect(hinweis).toBeVisible();
  await expect(info).not.toBeFocused();
  await expect(boss.getByRole('button', { name: 'Annehmen', exact: true })).toBeVisible();
  expect(await hinweis.evaluate((el) => getComputedStyle(el).position)).toBe('static');
  await bild(page, 'onboarding-info');
  await boss.getByText('Lauf beginnen').click();
  await expect(hinweis).toHaveCount(0);
  await info.click();
  await page.keyboard.press('Escape');
  await expect(vorbild.getByText('Vorschlag aus dem Fokus.')).toHaveCount(0);

  const annehmen = vorbild.getByRole('button', { name: 'Annehmen', exact: true });
  await annehmen.click();
  await annehmen.click();
  await expect(annehmen).toHaveAttribute('aria-pressed', 'true');
  await expect(annehmen).toHaveAttribute('data-angebot', 'an');
  await expect(handbuch).toBeDisabled();
  await boss.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await expect(handbuch).toBeEnabled();
  await bild(page, 'onboarding-gewaehlt');
  await handbuch.click();
  await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();

  const einstellungen = await lesen<{ funktionen: { vorbilder: boolean; bossAngriffe: boolean } }>(page, '/api/einstellungen');
  expect(einstellungen.funktionen.vorbilder).toBe(true);
  expect(einstellungen.funktionen.bossAngriffe).toBe(false);
  const ziele = await lesen<{ projekte: { name: string }[] }>(page, '/api/ziele');
  expect(ziele.projekte.map((projekt) => projekt.name)).toEqual(['Anfang']);
  const laufend = await lesen<{ bosse: { titel: string; boss: { deadline: string } | null }[]; vorhaben: unknown[] }>(
    page,
    '/api/laufend',
  );
  expect(laufend.bosse).toHaveLength(1);
  expect(laufend.bosse[0]?.titel).toBe('Lauf beginnen');
  expect(laufend.bosse[0]?.boss?.deadline).toBe(lokalesDatum(plusTage(new Date(), 7)));
  const zweites = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startVorbild: 'ronaldo', startBoss: true }),
    });
    return antwort.status;
  });
  expect(zweites).toBe(200);
  const danach = await lesen<{ projekte: { name: string }[] }>(page, '/api/ziele');
  expect(danach.projekte).toHaveLength(1);
  const laufendDanach = await lesen<{ bosse: { titel: string }[] }>(page, '/api/laufend');
  expect(laufendDanach.bosse.map((eintrag) => eintrag.titel)).toEqual(['Lauf beginnen']);
});

test('Überspringen beider Karten öffnet das Handbuch ohne Projekt', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Ein Lebensziel');
  const vorbild = page.getByRole('region', { name: 'Vorbild' });
  const boss = page.getByRole('region', { name: 'Erster Boss' });
  await vorbild.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await expect(vorbild.getByRole('button', { name: 'Überspringen', exact: true })).toHaveAttribute('data-angebot', 'aus');
  await boss.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await page.getByRole('button', { name: 'Zum Handbuch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();
  const einstellungen = await lesen<{ funktionen: { vorbilder: boolean; bossAngriffe: boolean } }>(page, '/api/einstellungen');
  expect(einstellungen.funktionen.vorbilder).toBe(false);
  expect(einstellungen.funktionen.bossAngriffe).toBe(false);
  const ziele = await lesen<{ projekte: unknown[] }>(page, '/api/ziele');
  expect(ziele.projekte).toHaveLength(0);
  const laufend = await lesen<{ bosse: unknown[]; vorhaben: unknown[] }>(page, '/api/laufend');
  expect(laufend.bosse).toHaveLength(0);
  expect(laufend.vorhaben).toHaveLength(0);
});

test('gemischte Wahl legt nur den Boss an', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Ein Lebensziel');
  const vorbild = page.getByRole('region', { name: 'Vorbild' });
  const boss = page.getByRole('region', { name: 'Erster Boss' });
  await vorbild.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await boss.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zum Handbuch', exact: true })).toBeEnabled();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'onboarding-gemischt');
  await page.getByRole('button', { name: 'Zum Handbuch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();
  const einstellungen = await lesen<{ funktionen: { vorbilder: boolean } }>(page, '/api/einstellungen');
  expect(einstellungen.funktionen.vorbilder).toBe(false);
  const ziele = await lesen<{ projekte: { name: string }[] }>(page, '/api/ziele');
  expect(ziele.projekte.map((projekt) => projekt.name)).toEqual(['Anfang']);
});

test('Übung zeigt nur das Vorbild', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Besser werden');
  await expect(page.getByText('Ein Angebot. Du kannst es auslassen.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vorbild' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Erster Boss' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zum Handbuch', exact: true })).toBeDisabled();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'onboarding-einfach');
  await page.getByRole('region', { name: 'Vorbild' }).getByRole('button', { name: 'Überspringen', exact: true }).click();
  await page.getByRole('button', { name: 'Zum Handbuch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();
  const ziele = await lesen<{ projekte: unknown[] }>(page, '/api/ziele');
  expect(ziele.projekte).toHaveLength(0);
  const einstellungen = await lesen<{ funktionen: { vorbilder: boolean } }>(page, '/api/einstellungen');
  expect(einstellungen.funktionen.vorbilder).toBe(false);
});

test('Zurück verwirft die Wahl', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Ein Lebensziel');
  const vorbild = page.getByRole('region', { name: 'Vorbild' });
  await vorbild.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fokus', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zum Start', exact: true })).toBeVisible();
  await expect(vorbild.getByRole('button', { name: 'Annehmen', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Zum Handbuch', exact: true })).toBeDisabled();
});

test('ein unbekannter Vorbild-Fehler lässt den Schritt stehen', async ({ page }) => {
  await vorbereiten(page);
  await zumStart(page, 'Ein Lebensziel');
  const vorbild = page.getByRole('region', { name: 'Vorbild' });
  const boss = page.getByRole('region', { name: 'Erster Boss' });
  await vorbild.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await boss.getByRole('button', { name: 'Annehmen', exact: true }).click();
  await page.route('**/api/einstellungen', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const daten = route.request().postDataJSON() as { profilAngelegt?: boolean };
    if (daten.profilAngelegt === true) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ fehler: 'Das Vorbild ist unbekannt.' }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Zum Handbuch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zum Start', exact: true })).toBeVisible();
  await expect(page.getByText('Das Vorbild ist unbekannt.')).toBeVisible();
  await expect(vorbild.getByRole('button', { name: 'Annehmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(boss.getByRole('button', { name: 'Annehmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'onboarding-fehler');
});
