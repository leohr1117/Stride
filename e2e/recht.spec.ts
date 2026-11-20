import fs from 'node:fs';
import { APP_ADRESSE_META, appAdresse, appHost } from '../shared/appAdresse.ts';
import { expect, test, vorbereiteAufnahme, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const HELL = { primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };

async function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate(
    (schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim().toLowerCase(),
    name,
  );
}

async function rechtBild(seite: Page, projekt: string, name: string): Promise<void> {
  await expect.poll(() => variable(seite, '--flaeche')).toBe('#ffffff');
  await expect.poll(() => variable(seite, '--gefahr')).toBe('#c62828');
  await vorbereiteAufnahme(seite);
  fs.mkdirSync('tmp-test/recht', { recursive: true });
  const pfad = `tmp-test/recht/${projekt}-${name}.png`;
  await seite.screenshot({ path: pfad, fullPage: true, scale: 'css', animations: 'disabled' });
  expect(fs.readFileSync(pfad).readUInt32BE(16)).toBe(projekt === 'handy' ? 390 : 1440);
}

async function rechtUmbruch(seite: Page): Promise<void> {
  const artikel = await seite.locator('[data-recht]').evaluate((el) => {
    const stil = getComputedStyle(el);
    return { wordBreak: stil.wordBreak, overflowWrap: stil.overflowWrap };
  });
  expect(artikel.wordBreak).toBe('normal');
  expect(artikel.overflowWrap).toBe('break-word');

  const links = await seite.locator('[data-recht] a').evaluateAll((knoten) =>
    knoten.map((el) => {
      const stil = getComputedStyle(el);
      return {
        text: el.textContent ?? '',
        href: el.getAttribute('href') ?? '',
        wordBreak: stil.wordBreak,
        overflowWrap: stil.overflowWrap,
        whiteSpace: stil.whiteSpace,
        zeilen: el.getClientRects().length,
      };
    }),
  );
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    expect(link.wordBreak).not.toBe('break-all');
    expect(link.overflowWrap).not.toBe('anywhere');
  }
  const mails = links.filter((link) => link.href.startsWith('mailto:'));
  expect(mails.length).toBeGreaterThan(0);
  for (const mail of mails) {
    expect({ text: mail.text, zeilen: mail.zeilen, whiteSpace: mail.whiteSpace }).toEqual({
      text: mail.text,
      zeilen: 1,
      whiteSpace: 'nowrap',
    });
  }
  const formular = links.find((link) => link.text === 'Kontaktformular');
  expect(formular?.zeilen).toBe(1);
  expect(formular?.wordBreak).toBe('normal');
}

test('Rechtsseiten sind ohne Anmeldung erreichbar', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  await page.addInitScript((werte) => {
    localStorage.setItem('stride.stil', 'standard');
    localStorage.setItem('stride.primaer', werte.primaer);
    localStorage.setItem('stride.akzent', werte.akzent);
    localStorage.setItem('stride.hintergrund', werte.hintergrund);
    localStorage.setItem('stride.glimmen', 'an');
  }, HELL);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  const meta = page.locator(`meta[name="${APP_ADRESSE_META}"]`);
  const inhalt = (await meta.count()) > 0 ? await meta.getAttribute('content') : null;
  const host = appHost(appAdresse(inhalt));
  const nav = page.getByRole('navigation', { name: 'Rechtliches' });
  await nav.getByRole('link', { name: 'Impressum', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('c/o COCENTER')).toBeVisible();
  await expect(page.getByText('Koppoldstr. 1')).toBeVisible();
  await expect(page.getByText('86551 Aichach')).toBeVisible();
  await expect(page.getByText('Hetzner Online GmbH')).toBeVisible();
  await expect(page.getByText('Industriestr. 25')).toBeVisible();
  await expect(page.getByText('91710 Gunzenhausen')).toBeVisible();
  await expect(page.getByText('Falkenstein (Deutschland)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kontaktformular', exact: true })).toHaveAttribute('href', '/kontakt');
  const impressum = await page.locator('[data-recht]').innerHTML();
  expect(impressum).not.toContain('<!--');
  expect(impressum).not.toContain('PRÜFEN');
  await rechtUmbruch(page);
  await ohneSeitlichenUeberlauf(page);
  await rechtBild(page, projekt, 'impressum');

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeVisible();
  await expect(page.getByText('ascend_sitzung')).toBeVisible();
  await expect(page.getByText('30 Tage ab der Anmeldung')).toBeVisible();
  await expect(page.getByText('Thüringer Landesbeauftragten für den Datenschutz und die Informationsfreiheit')).toBeVisible();
  await expect(page.getByText(`Wupo (${host})`)).toBeVisible();
  await expect(page.getByText('Hetzner handelt als Auftragsverarbeiter')).toBeVisible();
  await expect(page.getByText('Vertrag zur Auftragsverarbeitung')).toBeVisible();
  await expect(page.getByText('Ein Hosting-Anbieter hat darauf keinen Zugriff.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Datenschutzerklärung von Hetzner' })).toHaveAttribute(
    'href',
    'https://www.hetzner.com/legal/privacy-policy',
  );
  await expect(page.getByText('Tunnel von Cloudflare')).toBeVisible();
  const cloudflare = page.locator('[data-recht] p').filter({ hasText: 'Cloudflare, Inc.' });
  await expect(cloudflare).toContainText('101 Townsend St, San Francisco, CA 94107, USA');
  await expect(cloudflare).toContainText('Auftragsverarbeiter (Art. 28 DSGVO) laut Cloudflare Customer DPA');
  await expect(cloudflare).toContainText('an den Server bei Hetzner');
  await expect(cloudflare).not.toContainText('meinen Server');
  await expect(cloudflare).toContainText('IP-Adresse und die Inhalte der Verbindung');
  await expect(cloudflare).toContainText('EU-U.S. Data Privacy Framework');
  await expect(cloudflare).toContainText('Art. 45 DSGVO');
  await expect(cloudflare).toContainText('EU-Standardvertragsklauseln');
  await expect(cloudflare).toContainText('Art. 6 Abs. 1 lit. f DSGVO');
  await expect(page.getByRole('link', { name: 'cloudflare.com/privacypolicy' })).toHaveAttribute(
    'href',
    'https://www.cloudflare.com/privacypolicy/',
  );
  await expect(page.getByText('Google-Nutzerkennung')).toBeVisible();
  const google = page.locator('[data-recht] p').filter({ hasText: 'Google Ireland Limited' });
  await expect(google).toContainText('Gordon House, Barrow Street, Dublin 4, Irland');
  await expect(google).toContainText('Google kann Daten auch auf Servern außerhalb der EU verarbeiten.');
  await expect(google).toContainText('Rechtsgrundlage ist die von dir gewählte Anmeldung (Art. 6 Abs. 1 lit. b DSGVO).');
  await expect(google).not.toContainText('Data Privacy Framework');
  await expect(page.getByRole('link', { name: 'policies.google.com/privacy' })).toHaveAttribute(
    'href',
    'https://policies.google.com/privacy',
  );
  await expect(page.getByText('Registrierst du dich mit einem Passwort')).toBeVisible();
  await expect(page.getByText('Zoho Mail EU')).toBeVisible();
  await expect(page.getByText('bis zu 37 Tage')).toHaveCount(2);
  await expect(page.getByText('nach 29 Tagen')).toBeVisible();
  await expect(page.getByText('nach sieben Sicherungen')).toBeVisible();
  await expect(page.getByText('Push-Abo')).toBeVisible();
  const push = page.locator('[data-recht] p').filter({ hasText: 'Push-Abo' });
  await expect(push).toContainText(
    'Das Abo läuft über den Push-Dienst deines Browser-Herstellers (z. B. Google bei Chrome, Mozilla bei Firefox, Apple bei Safari)',
  );
  await expect(push).toContainText('Der Inhalt der Benachrichtigung ist verschlüsselt; der Dienst sieht die Push-Adresse und den Zeitpunkt.');
  await expect(push).toContainText('Dabei kann eine Übermittlung in die USA stattfinden.');
  await expect(push).toContainText('Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du im Browser erteilst.');
  await expect(push).not.toContainText('Firebase');
  await expect(page.getByText('Todoist-API-Token')).toBeVisible();
  await expect(page.getByText('Ich speichere es verschlüsselt')).toBeVisible();
  await expect(page.getByRole('heading', { name: '7. Kalender-Verbindung' })).toBeVisible();
  const daten = await page.locator('[data-recht]').innerHTML();
  expect(daten).not.toContain('<!--');
  expect(daten).not.toContain('Browser und Betriebssystem');
  expect(daten).not.toContain('Firebase');
  expect(daten).not.toContain('Benutzername und Passwort brauchst du für ein Konto');
  await ohneSeitlichenUeberlauf(page);
  await rechtBild(page, projekt, 'datenschutz');

  await page.goto('/nutzungsbedingungen');
  await expect(page.getByRole('heading', { level: 1, name: 'Nutzungsbedingungen' })).toBeVisible();
  await expect(page.getByText(`Web-App Wupo unter ${host}`)).toBeVisible();
  await expect(page.getByText(`web app Wupo at ${host}`)).toBeVisible();
  await expect(page.getByText('nächtlich auf dem Hetzner-Server')).toBeVisible();
  await expect(page.getByText('backed up nightly on the Hetzner server')).toBeVisible();
  await expect(page.getByText('bis zu 37 Tage')).toBeVisible();
  await expect(page.getByText('up to 37 days')).toBeVisible();
  await expect(page.getByText('Exportiere wichtige Daten deshalb zusätzlich selbst.')).toBeVisible();
  await expect(page.getByText('so please also export important data yourself.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Terms of Use (English)' })).toBeVisible();
  const nutzung = await page.locator('[data-recht]').innerHTML();
  expect(nutzung).not.toContain('20.11.2026');
  await ohneSeitlichenUeberlauf(page);
  await rechtBild(page, projekt, 'nutzung');

  await page.goto('/lizenzhinweise');
  await expect(page.getByRole('heading', { level: 1, name: 'Lizenzhinweise' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Liste der Open-Source-Komponenten' })).toHaveAttribute('href', '/lizenzen.txt');
  await expect(page.getByText('Exo 2, die Schrift der App')).toBeVisible();
  await expect(page.getByText('lucide-react')).toBeVisible();
  const liste = await page.request.get('/lizenzen.txt');
  expect(liste.ok()).toBe(true);
  const text = await liste.text();
  expect(text).toContain('## lucide-react@');
  expect(text).toContain('## @fontsource-variable/exo-2@');
  expect(text).toContain('## @fontsource/cinzel@');
  expect(text).not.toContain('<!--');
  await ohneSeitlichenUeberlauf(page);
});

test('Mehr verlinkt die Rechtsseiten', async ({ page }) => {
  await anmelden(page);
  await page.goto('/mehr');
  await expect(page.locator('[data-abschnitt="recht"]')).toHaveCount(0);
  await page.locator('[data-abschnitt="rechtliches"]').getByRole('link', { name: 'Rechtliches', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/rechtliches$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Rechtliches' })).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
  await expect(page.locator('a[data-platz="/mehr"][aria-current="page"]')).not.toHaveCount(0);
  const links = page.locator('[data-recht-hub] a');
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveAttribute('aria-label', 'Kontakt');
  await expect(links.nth(1)).toHaveAttribute('aria-label', 'Impressum');
  await expect(links.nth(2)).toHaveAttribute('aria-label', 'Datenschutz');
  await expect(links.nth(3)).toHaveAttribute('aria-label', 'Nutzungsbedingungen');
  await expect(links.nth(4)).toHaveAttribute('aria-label', 'Lizenzen');
  await links.nth(3).click();
  await expect(page).toHaveURL(/\/nutzungsbedingungen$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nutzungsbedingungen' })).toBeVisible();
  await expect(page.getByText('Exportiere wichtige Daten deshalb zusätzlich selbst.')).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/rechtliches');
  await page.goto('/kontakt');
  await expect(page.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeVisible();
  await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/rechtliches');
  await expect(page.locator('a[data-platz="/mehr"][aria-current="page"]')).not.toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
});

test('Rechtliches ist ohne Anmeldung erreichbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Rechtliches', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/rechtliches$/);
  await expect(page.locator('.mobilleiste')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Rechtliches' })).toBeVisible();
  const links = page.locator('[data-recht-hub] a');
  await expect(links.nth(0)).toHaveAttribute('aria-label', 'Kontakt');
  await links.nth(1).click();
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.locator('header a')).toHaveAttribute('href', '/mehr/rechtliches');
  await expect(page.locator('header a')).toHaveAttribute('aria-label', 'Zurück zu Rechtliches');
  await page.goto('/impressum', { referer: '' });
  await expect(page.locator('header a')).toHaveAttribute('href', '/');
  await expect(page.locator('header a')).toHaveAttribute('aria-label', 'Anmelden');
  await ohneSeitlichenUeberlauf(page);
});
