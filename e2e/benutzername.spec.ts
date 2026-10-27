import fs from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface AdminKonto {
  id: number;
  benutzername: string;
}

function passwortVon(name: string): string {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(new RegExp(`Benutzername: ${name}\\s+Passwort:\\s*(\\S+)`))?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function benutzername(api: APIRequestContext): Promise<string> {
  const antwort = await api.get('/api/zugang');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { benutzername: string | null };
  return daten.benutzername ?? '';
}

async function stelleHer(seite: Page, id: number): Promise<void> {
  const direkt = await seite.request.post(`/api/zugang/admin/konten/${id}/benutzername`, {
    data: { benutzername: 'testteil' },
  });
  if (direkt.ok()) {
    return;
  }
  await seite.context().clearCookies();
  await anmelden(seite);
  const nochmal = await seite.request.post(`/api/zugang/admin/konten/${id}/benutzername`, {
    data: { benutzername: 'testteil' },
  });
  if (!nochmal.ok()) {
    throw new Error('Der Testaccount blieb umbenannt.');
  }
}

test('Nutzer ändert den eigenen Namen nicht, nur der Admin', async ({ page, request }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/n1k/${testInfo.project.name}-${name}.png`, fullPage: true });
  const frei = `N1k${testInfo.project.name}`;
  let kontoId: number | null = null;
  let fremd = false;
  try {
    const login = await request.post('/api/zugang', {
      data: { benutzername: 'testteil', passwort: passwortVon('testteil') },
    });
    expect(login.ok()).toBe(true);
    expect(await benutzername(request)).toBe('testteil');
    const selbst = await request.post('/api/zugang/benutzername', { data: { benutzername: 'SollteNicht' } });
    expect(selbst.status()).toBe(403);
    expect(await selbst.json()).toEqual({ fehler: 'Nur der Admin ändert Benutzernamen.' });
    expect(await benutzername(request)).toBe('testteil');
    const verboten = await request.get('/api/zugang/admin/konten');
    expect(verboten.status()).toBe(403);
    expect(await verboten.text()).not.toContain('testvoll');
    const umbenennen = await request.post('/api/zugang/admin/konten/1/benutzername', { data: { benutzername: 'Carlo' } });
    expect(umbenennen.status()).toBe(403);

    await anmelden(page);
    const alt = await page.request.post('/api/zugang/benutzername', { data: { benutzername: 'SollteNicht' } });
    expect(alt.status()).toBe(403);
    expect(await benutzername(page.request)).toBe('testvoll');

    await page.goto('/mehr/profil');
    await expect(page.locator('a[href="/mehr/profil/benutzer"]')).toHaveCount(0);
    await expect(page.locator('#profil-benutzername')).toContainText('testvoll');
    const info = page.locator('#profil-benutzername').getByRole('button', { name: 'Info' });
    await info.click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText('Den Benutzernamen ändert der Admin.');
    const kasten = await hinweis.boundingBox();
    const fenster = page.viewportSize();
    expect(kasten).not.toBeNull();
    expect(fenster).not.toBeNull();
    if (kasten && fenster) {
      expect(kasten.x).toBeGreaterThanOrEqual(0);
      expect(kasten.y).toBeGreaterThanOrEqual(0);
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
      expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
    }
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('profil');

    await page.getByRole('link', { name: 'Benutzernamen' }).click();
    await expect(page).toHaveURL(/\/mehr\/profil\/benutzernamen$/);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/profil');
    const listeAntwort = await page.request.get('/api/zugang/admin/konten');
    expect(listeAntwort.ok()).toBe(true);
    const konten = (await listeAntwort.json()) as AdminKonto[];
    const teil = konten.find((konto) => konto.benutzername === 'testteil');
    if (!teil) {
      throw new Error('testteil fehlt in der Admin-Liste.');
    }
    kontoId = teil.id;
    await expect(page.getByRole('link', { name: 'testteil', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'testvoll', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await page.getByRole('link', { name: 'testteil', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/mehr/profil/benutzernamen/${teil.id}$`));
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr/profil/benutzernamen');
    const feld = page.getByRole('textbox', { name: 'Benutzername', exact: true });
    await expect(feld).toHaveValue('testteil');
    const speichern = page.getByRole('button', { name: 'Speichern' });
    await expect(speichern).toBeDisabled();
    await expect(speichern).toBeInViewport();

    await feld.fill('testvoll');
    await speichern.click();
    await expect(page.getByText('Der Benutzername ist schon vergeben.')).toBeVisible();
    expect((await (await page.request.get('/api/zugang/admin/konten')).json()) as AdminKonto[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: teil.id, benutzername: 'testteil' })]),
    );
    await ohneSeitlichenUeberlauf(page);
    await bild('vergeben');

    await feld.fill(frei);
    fremd = true;
    await speichern.click();
    await expect(feld).toHaveValue(frei);
    await expect(speichern).toBeDisabled();
    await expect
      .poll(async () => {
        const aktuell = (await (await page.request.get('/api/zugang/admin/konten')).json()) as AdminKonto[];
        return aktuell.find((konto) => konto.id === teil.id)?.benutzername;
      })
      .toBe(frei);
    await ohneSeitlichenUeberlauf(page);
    await bild('geaendert');

    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr\/profil\/benutzernamen$/);
    await expect(page.getByRole('link', { name: frei, exact: true })).toBeVisible();
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);
    await expect(page.locator('#profil-benutzername')).toContainText('testvoll');

    await stelleHer(page, teil.id);
    fremd = false;
  } finally {
    if (kontoId !== null && fremd) {
      await stelleHer(page, kontoId);
    }
  }
});
