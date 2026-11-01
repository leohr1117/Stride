import { createServer, type Server } from 'node:http';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function stempel(datum: Date): string {
  return datum.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function kalenderText(ende: Date, name: string, termin: string): string {
  const beginn = new Date(ende.getTime() - 60 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `X-WR-CALNAME:${name}`,
    'BEGIN:VEVENT',
    `UID:v3-${name.replace(/\s/g, '-')}`,
    `SUMMARY:${termin}`,
    `DTSTART:${stempel(beginn)}`,
    `DTEND:${stempel(ende)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function icsServer(text: string): Promise<{ url: string; lage: { status: number }; stop: () => Promise<void> }> {
  const lage = { status: 200 };
  return new Promise((resolve) => {
    const http: Server = createServer((_anfrage, antwort) => {
      antwort.writeHead(lage.status, { 'content-type': 'text/calendar; charset=utf-8' });
      antwort.end(lage.status === 200 ? text : '');
    });
    http.listen(0, '127.0.0.1', () => {
      const adresse = http.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/kalender.ics`,
        lage,
        stop: () => new Promise((fertig) => http.close(() => fertig())),
      });
    });
  });
}

function weltDb(): DatabaseSync {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return new DatabaseSync(verweigereEchteDatenbank(datei), { timeout: 5_000 });
}

function setzeSeit(name: string): void {
  const db = weltDb();
  try {
    const seit = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const ergebnis = db.prepare('UPDATE kalender SET seit = ? WHERE name = ?').run(seit, name);
    if (Number(ergebnis.changes) !== 1) {
      throw new Error(`Kalender ${name} nicht gefunden.`);
    }
  } finally {
    db.close();
  }
}

function hebeEintrag(notiz: string): void {
  const db = weltDb();
  try {
    db.prepare('UPDATE eintraege SET erstellt_am = ? WHERE notiz = ?').run(new Date().toISOString(), notiz);
  } finally {
    db.close();
  }
}

function eintragIdZu(notiz: string): number | null {
  const db = weltDb();
  try {
    const zeile = db.prepare('SELECT id FROM eintraege WHERE notiz = ?').get(notiz) as { id: number } | undefined;
    return zeile?.id ?? null;
  } finally {
    db.close();
  }
}

function kalenderKarte(seite: Page) {
  return seite.locator('section').filter({ has: seite.getByRole('heading', { name: 'Kalender', level: 2 }) });
}

function standZeile(seite: Page, name: string) {
  return kalenderKarte(seite).getByText(name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"flex-1")][1]');
}

async function speichereKalender(seite: Page, url: string, name: string): Promise<number> {
  await seite.goto('/mehr/inhalte/verbindungen');
  await seite.getByRole('button', { name: 'Kalender', exact: true }).click();
  const dialog = seite.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Andere', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'iCal-Adresse' }).fill(url);
  await dialog.getByRole('button', { name: 'Prüfen', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  const antwort = await seite.request.get('/api/verbindungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { kalender: { id: number; name: string }[] };
  const treffer = daten.kalender.find((eintrag) => eintrag.name === name);
  if (!treffer) {
    throw new Error(`Kalender ${name} fehlt.`);
  }
  return treffer.id;
}

async function gleicherNeu(seite: Page): Promise<void> {
  const sync = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/verbindungen/abgleichen') && antwort.request().method() === 'POST',
  );
  await seite.reload();
  expect((await sync).ok()).toBe(true);
}

test('Abgleich zeigt den Stand, behält Einträge und importiert nicht doppelt', async ({ page }, info) => {
  fs.mkdirSync('tmp-test', { recursive: true });
  const name = `V3 ${info.project.name}`;
  const termin = `V3 Termin ${info.project.name}`;
  const ende = new Date(Date.now() - 45 * 60 * 1000);
  const server = await icsServer(kalenderText(ende, name, termin));
  let kalenderId: number | null = null;
  try {
    await anmelden(page);
    kalenderId = await speichereKalender(page, server.url, name);
    // seit entsteht vor dem Abruf. Der Termin liegt sonst vor dem Verbindungszeitpunkt.
    setzeSeit(name);
    await gleicherNeu(page);
    const zeile = standZeile(page, name);
    await expect(zeile).toContainText('1 übernommen');
    await expect(zeile).toContainText(/Abgeglichen /);
    await zeile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-test/abgleich/stand-${info.project.name}.png` });
    await ohneSeitlichenUeberlauf(page);

    server.lage.status = 500;
    await gleicherNeu(page);
    await expect(zeile).toContainText('Der Kalender hat die Anfrage abgelehnt.');
    await zeile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-test/abgleich/fehler-${info.project.name}.png` });
    await ohneSeitlichenUeberlauf(page);

    await kalenderKarte(page).getByRole('heading', { name: 'Kalender', level: 2 }).locator('xpath=..').getByRole('button', { name: 'Info' }).click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toContainText('15 Minuten');
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);

    await kalenderKarte(page).getByRole('button', { name: `Aktionen für ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Entfernen' }).click();
    await page.getByRole('alertdialog', { name: `${name} entfernen?` }).getByRole('button', { name: 'Entfernen' }).click();
    await expect(kalenderKarte(page).getByText(name, { exact: true })).toHaveCount(0);
    kalenderId = null;

    hebeEintrag(termin);
    await page.goto('/chronik');
    await page.getByRole('switch', { name: 'Nur Meilensteine' }).click();
    await expect(page.getByText(termin).first()).toBeVisible();
    const liste = await page.request.get('/api/eintraege?limit=100');
    expect(liste.ok()).toBe(true);
    const chronik = (await liste.json()) as { eintraege: { typ: string; eintrag?: { notiz: string } }[] };
    expect(chronik.eintraege.filter((eintrag) => eintrag.eintrag?.notiz === termin)).toHaveLength(1);

    server.lage.status = 200;
    kalenderId = await speichereKalender(page, server.url, name);
    setzeSeit(name);
    await gleicherNeu(page);
    await expect(standZeile(page, name)).toContainText('1 übernommen');
    await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
    await expect(page.getByText('Keine neuen Einträge.')).toBeVisible();
    const danach = await page.request.get('/api/eintraege?limit=100');
    expect(danach.ok()).toBe(true);
    const zweite = (await danach.json()) as { eintraege: { eintrag?: { notiz: string } }[] };
    expect(zweite.eintraege.filter((eintrag) => eintrag.eintrag?.notiz === termin)).toHaveLength(1);
  } finally {
    await server.stop();
    if (kalenderId !== null) {
      await page.request.delete(`/api/verbindungen/kalender/${kalenderId}`).catch(() => undefined);
    }
    const id = eintragIdZu(termin);
    if (id !== null) {
      await page.request.delete(`/api/eintraege/${id}`).catch(() => undefined);
    }
  }
});
