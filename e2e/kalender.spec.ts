import { createServer, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const GOOGLE = 'https://calendar.google.com/calendar/r/settings';
const IPHONE = 'https://support.apple.com/guide/iphone/iph7613c4fb/ios';
const MAC = 'https://support.apple.com/guide/calendar/icl32362/mac';
const ICLOUD = 'https://www.icloud.com/calendar/';

function stempel(datum: Date): string {
  return datum.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function kalenderText(jetzt: Date, name: string): string {
  const ende = new Date(jetzt.getTime() - 60 * 60 * 1000);
  const beginn = new Date(ende.getTime() - 60 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `X-WR-CALNAME:${name}`,
    'BEGIN:VEVENT',
    'UID:e2e-besprechung',
    'SUMMARY:Besprechung',
    `DTSTART:${stempel(beginn)}`,
    `DTEND:${stempel(ende)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function icsServer(text: string): Promise<{ url: string; stop: () => Promise<void> }> {
  return new Promise((resolve) => {
    const http: Server = createServer((_anfrage, antwort) => {
      antwort.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' });
      antwort.end(text);
    });
    http.listen(0, '127.0.0.1', () => {
      const adresse = http.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/kalender.ics`,
        stop: () => new Promise((fertig) => http.close(() => fertig())),
      });
    });
  });
}

async function oeffneDialog(seite: Page): Promise<void> {
  await seite.goto('/mehr/inhalte/verbindungen');
  await seite.getByRole('button', { name: '+ Kalender verbinden', exact: true }).click();
  await expect(seite.getByRole('dialog', { name: 'Kalender verbinden' })).toBeVisible();
}

async function waehleErsteTaetigkeit(seite: Page): Promise<void> {
  const dialog = seite.getByRole('dialog', { name: 'Kalender verbinden' });
  await dialog.getByRole('combobox', { name: 'Zählt als' }).click();
  const wahl = seite.getByRole('dialog', { name: 'Zählt als' });
  await wahl.getByRole('option').first().click();
  await expect(wahl).toBeHidden();
}

test('Kalender von Google und Apple lassen sich prüfen, bevor sie gespeichert werden', async ({ page }, info) => {
  const name = `E2E ${info.project.name}`;
  const server = await icsServer(kalenderText(new Date(), name));
  try {
    await anmelden(page);
    await oeffneDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Google', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Apple', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Andere', exact: true })).toBeVisible();
    await page.screenshot({ path: `tmp-test/kalender/kalender-anbieter-${info.project.name}.png` });

    await dialog.getByRole('button', { name: 'Google', exact: true }).click();
    await expect(dialog.getByText('Öffne Google Kalender am Computer.')).toBeVisible();
    await expect(dialog.getByText('Wähle den Kalender in den Einstellungen.')).toBeVisible();
    await expect(dialog.getByText('Kopiere die geheime Adresse im iCal-Format.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Google Kalender öffnen' })).toHaveAttribute('href', GOOGLE);
    await expect(dialog.getByText('Google aktualisiert das Abo nur alle paar Stunden.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Info/ })).toHaveCount(0);
    await page.screenshot({ path: `tmp-test/kalender/kalender-google-info-${info.project.name}.png` });

    await dialog.getByRole('button', { name: 'Apple', exact: true }).click();
    await expect(dialog.getByText('Öffne die Kalender-App.')).toBeVisible();
    await expect(dialog.getByText('Tippe auf Kalender und dann auf das Info-Symbol.')).toBeVisible();
    await expect(dialog.getByText('Schalte Öffentlicher Kalender ein und kopiere den Link.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Anleitung von Apple' })).toHaveAttribute('href', IPHONE);
    await dialog.getByRole('button', { name: 'Mac', exact: true }).click();
    await expect(dialog.getByText('Klicke auf Teilen neben dem Kalender.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Anleitung von Apple' })).toHaveAttribute('href', MAC);
    await dialog.getByRole('button', { name: 'iCloud', exact: true }).click();
    await expect(dialog.getByText('Öffne den Kalender auf iCloud.com.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'iCloud Kalender öffnen' })).toHaveAttribute('href', ICLOUD);
    await page.screenshot({ path: `tmp-test/kalender/kalender-apple-${info.project.name}.png` });

    await dialog.getByRole('button', { name: 'Andere', exact: true }).click();
    await expect(dialog.getByText('Sie beginnt mit https:// oder webcal://.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Google', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'iCal-Adresse' }).fill(server.url);
    await dialog.getByRole('button', { name: 'Prüfen', exact: true }).click();
    await expect(dialog.getByText(`Gültig · ${name}`)).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
    await expect(dialog.getByText(/XP für die letzten Termine/)).toHaveCount(0);
    await expect(dialog.getByText('Besprechung')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Überspringen' })).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Gehört zu' })).toContainText('Kein Ziel');
    await expect(dialog.getByRole('combobox', { name: 'Zählt als' })).toBeVisible();
    await expect(dialog.getByText('Nur Termine mit diesen Wörtern', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Leer: alle Termine. Komma trennt Wörter.')).toBeVisible();
    await expect(dialog.getByText('Titel enthält', { exact: true })).toHaveCount(0);
    await dialog.getByText('Nur Termine mit diesen Wörtern', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-test/kalender/kalender-pruefung-${info.project.name}.png` });
    await dialog.getByRole('button', { name: /^Info/ }).click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toContainText('Dauer des Termins');
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await ohneSeitlichenUeberlauf(page);

    await waehleErsteTaetigkeit(page);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();
    const zeile = page.getByRole('button', { name: `Termine in ${name}` });
    await expect(zeile).toBeVisible();
    await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
    await expect(page.getByText('Keine neuen Einträge.')).toBeVisible();
    await page.screenshot({ path: `tmp-test/kalender/kalender-liste-${info.project.name}.png` });

    await zeile.click();
    const bearbeiten = page.getByRole('dialog', { name });
    await expect(bearbeiten.getByRole('button', { name: 'Google', exact: true })).toHaveCount(0);
    await expect(bearbeiten.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
    await expect(bearbeiten.getByRole('textbox', { name: 'iCal-Adresse' })).toHaveCount(0);
    await expect(bearbeiten.getByRole('button', { name: `Aktionen für ${name}`, exact: true })).toBeVisible();
    await bearbeiten.getByRole('button', { name: 'Schließen' }).click();
  } finally {
    await server.stop();
  }
});
