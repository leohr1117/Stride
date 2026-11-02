import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function altersText(jahr: number): string {
  const alter = new Date().getFullYear() - jahr;
  if (alter <= 0) {
    return 'Du bist in diesem Jahr geboren.';
  }
  if (alter === 1) {
    return 'Das entspricht ungefähr einem Jahr.';
  }
  return `Das entspricht ungefähr ${alter} Jahren.`;
}

async function einstellungen(seite: Page): Promise<{ geburtsjahr: number | null; fokus: string[] }> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { geburtsjahr: number | null; fokus: string[] };
  return { geburtsjahr: daten.geburtsjahr, fokus: daten.fokus };
}

test('Konto gruppiert Profil und Anmeldung', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/konto', { recursive: true });
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-test/konto/${testInfo.project.name}-${name}.png`, fullPage: true });
  let passwortPosts = 0;
  page.on('request', (anfrage) => {
    if (anfrage.method() === 'POST' && anfrage.url().includes('/zugang/passwort')) {
      passwortPosts += 1;
    }
  });
  await anmelden(page);
  const anfang = await einstellungen(page);
  let titelVorher: string | null | undefined;

  try {
    await page.goto('/mehr/profil');
    await expect(page.getByRole('heading', { name: 'Konto', level: 1 })).toBeVisible();
    const profil = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Profil', exact: true, level: 2 }) });
    const anmeldung = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Anmeldung', exact: true, level: 2 }) });
    await expect(profil.getByRole('link')).toHaveCount(5);
    expect(await profil.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')))).toEqual([
      'Profilname',
      'Titel',
      'Geburtsjahr',
      'Was willst du erreichen?',
      'Fokus',
    ]);
    expect(await anmeldung.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')))).toEqual([
      'Passwort',
      'Accounts',
    ]);
    await expect(page.getByRole('link', { name: 'Benutzernamen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ziel-Stufen', exact: true })).toHaveCount(0);
    const name = page.locator('#profil-benutzername');
    await expect(name).toHaveAttribute('data-zeile', 'lesen');
    await expect(name).toContainText('testvoll');
    await expect(name.locator('a, button, svg')).toHaveCount(0);
    const zugang = await page.request.get('/api/zugang');
    expect(zugang.ok()).toBe(true);
    const status = (await zugang.json()) as { rolle: string | null; admin: boolean };
    const kontenPfad = status.rolle === 'inhaber' ? '/api/zugang/konten' : '/api/zugang/admin/konten';
    const konten = await page.request.get(kontenPfad);
    expect(konten.ok(), `${kontenPfad} ${konten.status()}`).toBe(true);
    const liste = (await konten.json()) as unknown[];
    await expect(anmeldung.locator('.zeile', { has: page.getByRole('link', { name: 'Accounts', exact: true }) })).toContainText(
      String(liste.length),
    );
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await page.getByRole('link', { name: 'Profilname', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/profil\/name$/);
    await expect(page.getByRole('heading', { name: 'Profilname', level: 1 })).toBeVisible();
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Konto');
    const profilname = page.getByRole('textbox', { name: 'Profilname' });
    await profilname.click();
    const layout = page.viewportSize()?.height ?? 844;
    const sichtHoehe = 460;
    const tastatur = layout - sichtHoehe;
    await page.evaluate(
      ({ oben, hoehe, tastatur: ueberdeckung }) => {
        const fenster = window as Window & { __strideSicht?: { oben: number; hoehe: number; tastatur: number } | null };
        fenster.__strideSicht = { oben, hoehe, tastatur: ueberdeckung };
        window.dispatchEvent(new Event('resize'));
      },
      { oben: 0, hoehe: sichtHoehe, tastatur },
    );
    await expect.poll(async () => {
      return page.evaluate(() => {
        const knopf = document.querySelector('.formular-fuss button[type="submit"]');
        const fuss = document.querySelector('.formular-fuss');
        if (!(knopf instanceof HTMLElement) || !(fuss instanceof HTMLElement)) {
          return null;
        }
        const kasten = knopf.getBoundingClientRect();
        const sicht = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sicht-hoehe'));
        const mitte = document.elementFromPoint(kasten.left + kasten.width / 2, kasten.top + kasten.height / 2);
        return {
          tastaturAn: document.documentElement.dataset.tastatur === 'an',
          fuss: getComputedStyle(fuss).bottom,
          imFenster: kasten.top >= 0 && kasten.bottom <= sicht + 1,
          trifft: mitte instanceof Node && knopf.contains(mitte),
        };
      });
    }).toMatchObject({ tastaturAn: true, fuss: `${tastatur}px`, imFenster: true, trifft: true });
    await bild('name');
    await page.evaluate(() => {
      const fenster = window as Window & { __strideSicht?: null };
      fenster.__strideSicht = null;
      window.dispatchEvent(new Event('resize'));
    });

    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);

    await page.getByRole('link', { name: 'Geburtsjahr', exact: true }).click();
    const jahr = page.getByRole('spinbutton', { name: 'Geburtsjahr' });
    await jahr.fill('1990');
    await expect(page.getByText(altersText(1990))).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('jahr');
    await jahr.fill('1000');
    await expect(page.getByRole('alert')).toContainText('außerhalb des erlaubten Bereichs');
    await expect(page.getByText(altersText(1990))).toHaveCount(0);
    await expect(page.getByText('Du bist in diesem Jahr geboren.')).toHaveCount(0);
    await jahr.fill(String(new Date().getFullYear()));
    await expect(page.getByText('Du bist in diesem Jahr geboren.')).toBeVisible();
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);

    await page.getByRole('link', { name: 'Was willst du erreichen?', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Was willst du erreichen?', level: 1 })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Ein großes Ziel/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Projekte umsetzen/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /In etwas besser werden/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Einfach festhalten/ })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await ohneSeitlichenUeberlauf(page);
    await bild('ziel');
    await page.locator('a[data-zurueck]').click();

    await page.getByRole('link', { name: 'Fokus', exact: true }).click();
    await expect(page.getByText('Speichern archiviert abgewählte Attribute.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Info' })).toHaveCount(0);
    const gruppe = page.getByRole('group', { name: 'Fokus' });
    for (let schutz = 0; schutz < 20 && (await gruppe.locator('button[aria-pressed="true"]').count()) > 0; schutz += 1) {
      await gruppe.locator('button[aria-pressed="true"]').first().click();
    }
    await expect(gruppe.locator('button[aria-pressed="true"]')).toHaveCount(0);
    const pflicht = page.getByRole('alert');
    await expect(pflicht).toContainText('Wähle mindestens einen Fokus.');
    await expect(gruppe).toHaveAttribute('aria-invalid', 'true');
    await expect(gruppe).toHaveAttribute('aria-describedby', 'fokus-pflicht');
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await ohneSeitlichenUeberlauf(page);
    await bild('fokus');
    await page.locator('a[data-zurueck]').click();

    await page.getByRole('link', { name: 'Passwort', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bisheriges' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Neues' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Wiederholen' })).toBeVisible();
    await expect(page.getByText('Mindestens 10 Zeichen.', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Bisheriges' }).fill('altes-geheim');
    await page.getByRole('textbox', { name: 'Neues' }).fill('kurz');
    await page.getByRole('textbox', { name: 'Wiederholen' }).fill('kurz');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();
    await expect(page.getByRole('alert')).toContainText('Das Passwort muss mindestens 10 Zeichen haben.');
    await expect(page.getByRole('alert').filter({ hasText: 'stimmen nicht überein' })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Neues' }).fill('1234567890');
    await page.getByRole('textbox', { name: 'Wiederholen' }).fill('1234567899');
    await page.getByRole('button', { name: 'Passwort ändern' }).click();
    await expect(page.getByRole('alert')).toContainText('Die Passwörter stimmen nicht überein.');
    await expect(page.getByRole('alert').filter({ hasText: 'mindestens 10 Zeichen' })).toHaveCount(0);
    expect(passwortPosts).toBe(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('passwort');
    await page.locator('a[data-zurueck]').click();

    const titelAntwort = await page.request.get('/api/erfolge');
    expect(titelAntwort.ok()).toBe(true);
    titelVorher = ((await titelAntwort.json()) as { titel: string | null }).titel;
    await page.getByRole('link', { name: 'Titel', exact: true }).click();
    const gewaehlt = page.locator('[role="radio"][aria-checked="true"]');
    await expect(gewaehlt).toHaveCount(1);
    const alterName = ((await gewaehlt.innerText()) || '').trim();
    const anderes = titelVorher === null ? 'Erwacht' : 'Kein Titel';
    const ziel = page.getByRole('radio', { name: anderes, exact: true });
    const gesetzt = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/titel') && antwort.request().method() === 'PUT' && antwort.ok(),
    );
    await ziel.click();
    const gesetztAntwort = await gesetzt;
    const koerper = gesetztAntwort.request().postDataJSON() as { schluessel: string | null };
    if (titelVorher === null) {
      expect(typeof koerper.schluessel).toBe('string');
      expect(koerper.schluessel?.length).toBeGreaterThan(0);
    } else {
      expect(koerper).toEqual({ schluessel: null });
    }
    await expect(ziel).toBeChecked();
    await ohneSeitlichenUeberlauf(page);
    await bild('titel');
    const zurueckgesetzt = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/titel') && antwort.request().method() === 'PUT' && antwort.ok(),
    );
    await page.getByRole('radio', { name: alterName, exact: true }).click();
    const zurueckAntwort = await zurueckgesetzt;
    expect(zurueckAntwort.request().postDataJSON()).toEqual({ schluessel: titelVorher });
    await expect(page.getByRole('radio', { name: alterName, exact: true })).toBeChecked();
    await page.locator('a[data-zurueck]').click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);

    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    const warnung = page.getByRole('alertdialog', { name: 'Abmelden?' });
    await expect(warnung).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('abmelden');
    await warnung.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(warnung).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Konto', level: 1 })).toBeVisible();

    expect(await einstellungen(page)).toEqual(anfang);
    const titelNachher = await page.request.get('/api/erfolge');
    expect(((await titelNachher.json()) as { titel: string | null }).titel).toBe(titelVorher);
  } finally {
    await page.evaluate(() => {
      const fenster = window as Window & { __strideSicht?: null };
      fenster.__strideSicht = null;
      window.dispatchEvent(new Event('resize'));
    });
    if (titelVorher !== undefined) {
      const zurueck = await page.request.put('/api/titel', { data: { schluessel: titelVorher } });
      expect(zurueck.ok()).toBe(true);
    }
  }
});
