import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ERLAUBTE_PAUSENTAGE } from '../shared/spiel/kette.ts';
import { RUECKKEHR, SCHUTZ } from '../shared/spiel/schutz.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

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
    localStorage.removeItem('stride-sprache');
    localStorage.removeItem('ascend-sprache');
    sessionStorage.clear();
  });
  await seite.goto('/');
  await expect(seite.locator('html')).toHaveAttribute('data-stil', 'antik');
}

function bildBewertung(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/bewertung-schutz', { recursive: true });
  return seite.screenshot({ path: `tmp-test/bewertung-schutz/${test.info().project.name}-${name}.png` });
}

async function uebungOhneBoss(seite: Page): Promise<void> {
  await vorbereiten(seite);
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.locator('input[name="nickname"]').fill('Start');
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('button', { name: 'Sport' }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('radio', { name: 'In etwas besser werden' }).click();
  await seite.getByRole('button', { name: 'Weiter', exact: true }).click();
  await seite.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await expect(seite.getByRole('heading', { name: 'Eingerichtet', exact: true })).toBeVisible();
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
}

async function bewertungTesten(seite: Page, an: boolean): Promise<void> {
  const ok = await seite.evaluate(async (testen) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bewertungTesten: testen }),
    });
    return antwort.ok;
  }, an);
  expect(ok).toBe(true);
}

async function eintraegeLegen(seite: Page, anzahl: number): Promise<void> {
  const status = await seite.evaluate(async (menge) => {
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlageId = vorlagen.find((vorlage) => !vorlage.archiviert && vorlage.projektId === null)?.id;
    if (!vorlageId) {
      return 0;
    }
    for (let index = 0; index < menge; index += 1) {
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
      if (!antwort.ok) {
        return antwort.status;
      }
    }
    return 201;
  }, anzahl);
  expect(status).toBe(201);
}

async function tragEin(seite: Page): Promise<void> {
  await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
  const dialog = seite.getByRole('dialog', { name: 'Was hast du getan?' });
  const knopf = dialog.getByRole('button', { name: /Eintragen/ });
  await expect(knopf).toBeEnabled();
  await knopf.click();
  await expect(dialog).toHaveCount(0);
  const schleier = seite.locator('div.fixed.inset-0').filter({ hasText: 'Level aufgestiegen' });
  try {
    await schleier.waitFor({ state: 'visible', timeout: 1500 });
    await schleier.click({ position: { x: 8, y: 8 } });
    await expect(schleier).toHaveCount(0);
  } catch {
    // Kein Level-Aufstieg bei diesem Eintrag.
  }
  const schliessen = seite.getByRole('button', { name: 'Schließen' });
  const da = await schliessen.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
  if (!da) {
    return;
  }
  await schliessen.click();
  await expect(schliessen).toBeHidden();
}

test('zehnter Eintrag mit bewertung_testen zeigt die Karte, Nicht fragen schließt sie', async ({ page }) => {
  test.setTimeout(90_000);
  await uebungOhneBoss(page);
  await bewertungTesten(page, true);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await eintraegeLegen(page, 9);
  await tragEin(page);
  const karte = page.getByRole('region', { name: 'Wie hilfreich ist Stride gerade?' });
  await expect(karte).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Willkommen bei Stride' })).toHaveCount(0);
  await expect(karte.getByRole('button', { name: '1', exact: true })).toBeVisible();
  await expect(karte.getByRole('button', { name: 'Nicht fragen', exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bildBewertung(page, 'bewertung');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await expect(karte).toHaveCount(0);
  await tragEin(page);
  await expect(karte).toBeVisible();

  await page.route('**/api/bewertung', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'weg' }) });
      return;
    }
    await route.continue();
  });
  await karte.getByRole('button', { name: '3', exact: true }).click();
  await expect(karte).toBeVisible();
  await expect(karte.getByText('Etwas ist schiefgelaufen.')).toBeVisible();
  await expect(karte.getByRole('button', { name: '3', exact: true })).not.toHaveAttribute('aria-pressed', 'true');
  await ohneSeitlichenUeberlauf(page);
  await bildBewertung(page, 'bewertung-fehler');
  await page.unroute('**/api/bewertung');

  await karte.getByRole('button', { name: 'Nicht fragen', exact: true }).click();
  await expect(karte).toHaveCount(0);
  await tragEin(page);
  await expect(karte).toHaveCount(0);
});

test('ohne bewertung_testen bleibt die Karte aus', async ({ page }) => {
  await uebungOhneBoss(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Eintrag loggen' })).toBeVisible();
  await eintraegeLegen(page, 9);
  await tragEin(page);
  await expect(page.getByRole('region', { name: 'Wie hilfreich ist Stride gerade?' })).toHaveCount(0);
});

test('testvoll ohne den Testschlüssel zeigt die Karte nicht', async ({ page }) => {
  await anmelden(page);
  await tragEin(page);
  await expect(page.getByRole('region', { name: 'Wie hilfreich ist Stride gerade?' })).toHaveCount(0);
});

test('Handbuch nennt Schutz und Rückkehr in kurzen Zeilen', async ({ page }) => {
  await anmelden(page);
  const vorher = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil: string };
    return daten.stil;
  });
  const stil = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stil: 'antik' }),
    });
    return antwort.ok;
  });
  expect(stil).toBe(true);
  try {
    await page.goto('/handbuch');
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'antik');
    await expect(page.getByRole('heading', { name: 'Handbuch', exact: true })).toBeVisible();
    const karte = page.locator('#streak');
    await expect(karte).toBeVisible();
    await expect(karte.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
    await expect(karte).toContainText(`Pause: ${ERLAUBTE_PAUSENTAGE} Tag frei`);
    await expect(karte).toContainText(`Schutz: alle ${SCHUTZ.schwelleTage} Tage, unter Heute einsetzen`);
    await expect(karte).toContainText(`Rückkehr: ${RUECKKEHR.fristTage} Tage, wenn kein Schutz`);
    await expect(karte).toContainText('Schutz und Rückkehr geben keine XP');
    await expect(karte.getByRole('columnheader', { name: 'Faktor', exact: true })).toBeVisible();
    await expect(karte.getByRole('button', { name: /^Info/ })).toHaveCount(0);
    const abgeschnitten = await karte.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(abgeschnitten).toBe(false);
    await ohneSeitlichenUeberlauf(page);
    await karte.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'nearest' }));
    fs.mkdirSync('tmp-test/bewertung-schutz', { recursive: true });
    const projekt = test.info().project.name;
    await karte.screenshot({ path: `tmp-test/bewertung-schutz/${projekt}-karte.png` });
    await page.screenshot({ path: `tmp-test/bewertung-schutz/${projekt}-seite.png` });

    await page.goto('/mehr/neu');
    const verlauf = page.getByRole('region', { name: 'Version 3.16.0' });
    await expect(verlauf).toBeVisible();
    await expect(verlauf.getByText('Der Schutz hält den Streak, wenn ein Tag Pause nicht reicht. Du verdienst ihn alle sieben Tage und setzt ihn unter Heute ein.')).toBeVisible();
    await expect(verlauf.getByText('Bricht der Streak, bleiben sieben Tage für die Rückkehr. Ein Eintrag in der Frist schließt sie.')).toBeVisible();
    await verlauf.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'nearest' }));
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/bewertung-schutz/${projekt}-version.png` });
  } finally {
    await page.evaluate(async (stil) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stil }),
      });
    }, vorher);
  }
});
