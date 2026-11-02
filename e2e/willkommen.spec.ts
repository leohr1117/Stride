import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/willkommen', { recursive: true });
  await seite.screenshot({ path: `tmp-test/willkommen/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testteil\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testteil');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.locator('button[type="submit"]').click();
  await seite.waitForFunction(async () => (await fetch('/api/einstellungen')).ok);
}

async function zuruecksetzen(seite: Page): Promise<void> {
  const ok = await seite.evaluate(async () => (await fetch('/api/profil/zuruecksetzen', { method: 'POST' })).ok);
  expect(ok).toBe(true);
}

async function anlegen(seite: Page, daten: unknown): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: daten });
  expect(antwort.ok(), await antwort.text()).toBe(true);
}

async function ringUndName(seite: Page): Promise<void> {
  const ring = seite.locator('main [data-levelring]').first();
  const breite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(breite).toBe(96);
  await expect(seite.locator('main .kopfblock-name').locator('visible=true').first()).toHaveClass(/text-2xl/);
}

function karte(seite: Page) {
  return seite.locator('main section.karte').first();
}

test('angelegtes Projekt trägt einen Haken, die Schritte stehen nur hier', async ({ page }) => {
  await anmelden(page);
  await zuruecksetzen(page);
  await anlegen(page, {
    sprache: 'de',
    profilAngelegt: true,
    fokus: ['sport'],
    zielstrebigkeit: 'macher',
    startZiel: { art: 'projekt', name: 'Test' },
  });
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Heute');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toBeVisible();
  const willkommen = karte(page);
  await expect(willkommen).toContainText('Projekt „Test"');
  await expect(willkommen.getByRole('button', { name: 'Ersten Eintrag anlegen' })).toBeVisible();
  await expect(willkommen.getByRole('button', { name: 'Projekt anlegen' })).toHaveCount(0);
  await expect(willkommen.locator('#willkommen-ziel svg')).toHaveCount(1);
  await expect(page.getByText('Tätigkeiten prüfen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Zum Handbuch', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Erste Tätigkeit anlegen', { exact: true })).toHaveCount(0);
  await expect(willkommen.getByText(/\d+ \/ \d+/)).toHaveCount(0);
  await ringUndName(page);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'projekt');

  await willkommen.getByRole('button', { name: 'Ersten Eintrag anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Was hast du getan?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('heading', { name: 'Was hast du getan?' })).toHaveCount(0);

  await page.goto('/handbuch');
  await expect(page.getByText('Erste Schritte', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tätigkeiten prüfen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nach Vorliebe', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Einträge', exact: true })).toBeVisible();

  await anlegen(page, { funktionen: { handbuch: false } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toBeVisible();
  await expect(willkommen).toContainText('Projekt „Test"');
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'ohne-handbuch');
});

test('ohne Tätigkeit führt das Anlegen zum Dialog, der Eintrag fehlt', async ({ page }) => {
  await anmelden(page);
  await zuruecksetzen(page);
  await anlegen(page, {
    sprache: 'de',
    profilAngelegt: true,
    fokus: [],
    zielstrebigkeit: 'macher',
  });
  await page.goto('/');
  const willkommen = karte(page);
  await expect(willkommen.getByRole('button', { name: 'Erste Tätigkeit anlegen' })).toBeVisible();
  await expect(willkommen.getByRole('button', { name: 'Projekt anlegen' })).toBeVisible();
  await expect(willkommen.getByRole('button', { name: 'Ersten Eintrag anlegen' })).toHaveCount(0);
  await ringUndName(page);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'ohne-taetigkeit');

  await willkommen.getByRole('button', { name: 'Erste Tätigkeit anlegen' }).click();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);
  await expect(page.getByRole('heading', { name: 'Tätigkeit anlegen' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();

  await page.goto('/');
  await karte(page).getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page).toHaveURL(/\/ziele$/);
  await expect(page.getByRole('heading', { name: 'Neues Projekt' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();
  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Neues Projekt' })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
});

test('Einfach zeigt nur den Eintrag, der erste XP nimmt die Karte weg', async ({ page }) => {
  await anmelden(page);
  await zuruecksetzen(page);
  await anlegen(page, {
    sprache: 'de',
    profilAngelegt: true,
    fokus: ['sport'],
    zielstrebigkeit: 'einfach',
  });
  await page.goto('/');
  const willkommen = karte(page);
  await expect(willkommen.getByRole('button', { name: 'Ersten Eintrag anlegen' })).toBeVisible();
  await expect(willkommen.getByRole('button', { name: 'Projekt anlegen' })).toHaveCount(0);
  await expect(willkommen.getByRole('button', { name: 'Vision anlegen' })).toHaveCount(0);
  await expect(willkommen.getByRole('button', { name: 'Fähigkeit anlegen' })).toHaveCount(0);
  await expect(willkommen.getByRole('button', { name: 'Erste Tätigkeit anlegen' })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'einfach');

  const gelegt = await page.evaluate(async () => {
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as { id: number; archiviert: boolean }[];
    const vorlageId = vorlagen.find((vorlage) => !vorlage.archiviert)?.id;
    if (!vorlageId) {
      return false;
    }
    const antwort = await fetch('/api/eintraege', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projektId: null,
        vorlageId,
        vorhaben: null,
        abschluss: null,
        erkenntnis: '',
        stunden: 1,
        notiz: '',
        meilenstein: false,
        faehigkeitId: null,
        datum: null,
      }),
    });
    return antwort.ok;
  });
  expect(gelegt).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toHaveCount(0);
  await ringUndName(page);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'nach-xp');
});

test('angelegte Fähigkeit zeigt den Haken und öffnet kein Dialog von selbst', async ({ page }) => {
  await anmelden(page);
  await zuruecksetzen(page);
  await anlegen(page, {
    sprache: 'de',
    profilAngelegt: true,
    fokus: ['sport'],
    zielstrebigkeit: 'uebung',
    startZiel: { art: 'faehigkeit', name: 'Gitarre' },
  });
  await page.goto('/');
  const willkommen = karte(page);
  await expect(willkommen).toContainText('Fähigkeit „Gitarre"');
  await expect(willkommen.locator('#willkommen-faehigkeit button')).toHaveCount(0);
  await expect(willkommen.locator('#willkommen-faehigkeit svg')).toHaveCount(1);
  await expect(willkommen.getByRole('button', { name: 'Ersten Eintrag anlegen' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, 'faehigkeit');
  await page.goto('/faehigkeiten');
  await expect(page.getByRole('heading', { name: 'Neue Fähigkeit' })).toHaveCount(0);
  await expect(page.getByText('Gitarre', { exact: true })).toBeVisible();
});
