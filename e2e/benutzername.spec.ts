import { expect, test, type APIRequestContext, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { TEST_PASSWORT } from './testdaten.ts';

interface AdminKonto {
  id: number;
  benutzername: string;
  rolle: 'inhaber' | 'mitglied';
  admin: boolean;
}

function rollenWort(konto: AdminKonto): string {
  if (konto.rolle === 'inhaber') {
    return 'Inhaber';
  }
  if (konto.admin) {
    return 'Admin';
  }
  return 'Mitglied';
}

function passwortVon(name: string): string {
  if (name !== 'testvoll' && name !== 'testteil') {
    throw new Error('Testzugang fehlt.');
  }
  return TEST_PASSWORT;
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
  const bild = (name: string) => page.screenshot({ path: `tmp-test/benutzername/${testInfo.project.name}-${name}.png`, fullPage: true });
  const frei = `Neu${testInfo.project.name}`;
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
    const zeile = page.locator('#profil-benutzername');
    await expect(zeile).toContainText('testvoll');
    await expect(zeile).toHaveAttribute('data-zeile', 'lesen');
    await expect(zeile.locator('a, button, svg')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Benutzernamen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ziel-Stufen', exact: true })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('profil');

    const listeAntwort = await page.request.get('/api/zugang/admin/konten');
    expect(listeAntwort.ok()).toBe(true);
    const konten = (await listeAntwort.json()) as AdminKonto[];
    const teil = konten.find((konto) => konto.benutzername === 'testteil');
    if (!teil) {
      throw new Error('testteil fehlt in der Admin-Liste.');
    }
    kontoId = teil.id;
    const kontenVerboten = await page.request.get('/api/zugang/konten');
    expect(kontenVerboten.status()).toBe(403);

    await page.route('**/api/zugang/konten', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"nein"}' }),
    );
    await page.goto('/mehr/profil/benutzernamen');
    await expect(page).toHaveURL(/\/mehr\/profil\/accounts$/);
    await page.goto(`/mehr/profil/benutzernamen/${teil.id}`);
    await expect(page).toHaveURL(/\/mehr\/profil\/accounts$/);
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    for (const konto of konten) {
      const zeile = page.locator('.zeile', { has: page.getByText(konto.benutzername, { exact: true }) });
      await expect(zeile).toHaveCount(1);
      await expect(zeile).toContainText(`${konto.benutzername} · ${rollenWort(konto)}`);
      await expect(zeile).toHaveAttribute('data-zeilen', '2');
    }
    await expect(page.getByRole('button', { name: 'Account anlegen' })).toHaveCount(0);
    const kontoZeile = page.locator('.zeile', { hasText: 'testteil' }).first();
    await expect(kontoZeile).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await kontoZeile.getByRole('button', { name: 'Aktionen für testteil', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Benutzername ändern', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Benutzername ändern', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Benutzername ändern' });
    await expect(dialog).toBeVisible();
    const feld = dialog.getByRole('textbox', { name: 'Benutzername', exact: true });
    await expect(feld).toHaveValue('testteil');
    await expect(feld).toBeFocused();
    const speichern = dialog.getByRole('button', { name: 'Speichern' });
    await expect(speichern).toBeEnabled();
    await ohneSeitlichenUeberlauf(page);
    await bild('dialog');

    await feld.fill('testvoll');
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    const verwerfen = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(verwerfen).toBeVisible();
    await verwerfen.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(verwerfen).toBeHidden();
    await expect(feld).toHaveValue('testvoll');

    await speichern.click();
    await expect(dialog.getByRole('alert')).toContainText('Der Name ist schon vergeben.');
    await expect(feld).toHaveValue('testvoll');
    expect((await (await page.request.get('/api/zugang/admin/konten')).json()) as AdminKonto[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: teil.id, benutzername: 'testteil' })]),
    );
    await ohneSeitlichenUeberlauf(page);
    await bild('vergeben');

    await feld.fill(frei);
    fremd = true;
    await speichern.click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);
    await expect
      .poll(async () => {
        const aktuell = (await (await page.request.get('/api/zugang/admin/konten')).json()) as AdminKonto[];
        return aktuell.find((konto) => konto.id === teil.id)?.benutzername;
      })
      .toBe(frei);
    await expect(page.locator('.zeile', { hasText: frei }).first()).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('geaendert');

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
