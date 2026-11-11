import { expect, test, type Locator, type Page } from './uhr.ts';
import type { Attribut } from '../shared/api/index.ts';
import { findeVorbild, vergleichspunkte } from '../shared/features/vorbilder/vorbilder.ts';
import type { Funktionen } from '../shared/spiel/funktionen.ts';
import { eigenesProfil } from '../client/src/pages/eigenesProfil.ts';
import { TEST_PASSWORT } from './testdaten.ts';

const HINWEIS =
  'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft. Ein ~ oder ein hohler Punkt im Radar heißt: Dazu gibt es kaum verlässliche Infos.';

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(TEST_PASSWORT);
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function leeren(seite: Page): Promise<void> {
  const stand = await seite.request.get('/api/einstellungen');
  expect(stand.ok()).toBeTruthy();
  const favoriten = ((await stand.json()) as { vorbildFavoriten: string[] }).vorbildFavoriten;
  for (const schluessel of favoriten) {
    const antwort = await seite.request.patch('/api/einstellungen', { data: { vorbildFavoritWeg: schluessel } });
    expect(antwort.ok()).toBeTruthy();
  }
}

async function markeOhneFuellung(marke: Locator): Promise<void> {
  await expect(marke).toHaveCount(1);
  await expect(marke).toHaveText('Schätzung');
  const stil = await marke.evaluate((element) => {
    const gelesen = getComputedStyle(element);
    return {
      hintergrund: gelesen.backgroundColor,
      rand: gelesen.borderTopWidth,
      tab: (element as HTMLElement).tabIndex,
      rolle: element.getAttribute('role'),
      index: element.getAttribute('tabindex'),
    };
  });
  expect(stil.hintergrund === 'transparent' || stil.hintergrund === 'rgba(0, 0, 0, 0)').toBe(true);
  expect(stil.rand).toBe('1px');
  expect(stil.tab).toBeLessThan(0);
  expect(stil.rolle).toBeNull();
  expect(stil.index).toBeNull();
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
  await leeren(page);
});

test.afterEach(async ({ page }) => {
  await leeren(page);
});

test('Vorbild-Werte sind sichtbar als Schätzung gekennzeichnet', async ({ page }) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Favoriten', exact: true })).toHaveCount(0);

  const aehnlich = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ähnlich', exact: true }) });
  const aehnlichMarke = aehnlich.locator('.abschnitt-kopf [data-schaetzung]');
  const aehnlichInfo = aehnlich.getByRole('button', { name: 'Info zu Ähnlich', exact: true });
  await markeOhneFuellung(aehnlichMarke);
  await expect(aehnlich.locator('[data-zeile] [data-schaetzung]')).toHaveCount(0);
  const markeKasten = await aehnlichMarke.boundingBox();
  const infoKasten = await aehnlichInfo.boundingBox();
  expect(markeKasten).toBeTruthy();
  expect(infoKasten).toBeTruthy();
  expect((markeKasten?.x ?? 0) + (markeKasten?.width ?? 0) <= (infoKasten?.x ?? 0) + 1).toBe(true);
  await aehnlichInfo.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(aehnlichMarke).not.toBeFocused();

  const zeile = aehnlich.locator('[data-zeile]').first();
  await expect(zeile).toContainText(/≈\s*\d+\s*%\s*ähnlich/);
  await expect(zeile.locator('.sr-only')).toContainText(/etwa .+ geschätzt/);
  await expect(zeile.getByRole('link')).toHaveAccessibleName(/etwa .+ geschätzt/);
  const alle = page.getByRole('button', { name: /^Alle/ });
  await expect(alle).toContainText(/≈\s*\d+\s*%/);
  await expect(alle).toHaveAccessibleName(/etwa .+ geschätzt/);
  await expect(page.locator('main')).not.toContainText('°');

  await aehnlichInfo.click();
  await expect(page.getByRole('tooltip')).toHaveText(HINWEIS);
  await page.keyboard.press('Escape');

  const dazu = await page.request.patch('/api/einstellungen', { data: { vorbildFavoritDazu: 'einstein' } });
  expect(dazu.ok()).toBeTruthy();
  await page.goto('/vorbilder');
  const favoriten = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Favoriten', exact: true }) });
  await markeOhneFuellung(favoriten.locator('.abschnitt-kopf [data-schaetzung]'));
  await expect(favoriten.locator('.abschnitt-kopf button')).toHaveCount(0);
  await expect(favoriten.locator('[data-zeile] [data-schaetzung]')).toHaveCount(0);
  await expect(favoriten.locator('[data-zeile]').first()).toContainText('≈');

  await page.goto('/vorbilder/davinci');
  await expect(page.getByRole('heading', { name: 'Leonardo da Vinci', exact: true })).toBeVisible();
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('°');
  const kopfMarke = page.locator('.vorbild-kopf [data-schaetzung]');
  await markeOhneFuellung(kopfMarke);
  await expect(page.locator('[data-vorbild-stand] [data-schaetzung]')).toHaveCount(0);
  const stand = await page.locator('[data-vorbild-stand]').boundingBox();
  const kopf = await kopfMarke.boundingBox();
  expect(stand).toBeTruthy();
  expect(kopf).toBeTruthy();
  expect((kopf?.y ?? 0) >= (stand?.y ?? 0) - 1).toBe(true);
  const aehnlichkeit = page.locator('[data-aehnlichkeit]');
  await expect(aehnlichkeit).toContainText(/≈\s*\d+\s*%\s*ähnlich/);
  await expect(aehnlichkeit.locator('.sr-only')).toContainText(/etwa .+ geschätzt/);

  const vergleich = page.locator('section[data-vergleich]');
  const vergleichMarke = vergleich.locator('.abschnitt-kopf [data-schaetzung]');
  const vergleichInfo = vergleich.getByRole('button', { name: 'Info zu Profil im Vergleich', exact: true });
  await markeOhneFuellung(vergleichMarke);
  const vergleichMarkeKasten = await vergleichMarke.boundingBox();
  const vergleichInfoKasten = await vergleichInfo.boundingBox();
  expect((vergleichMarkeKasten?.x ?? 0) < (vergleichInfoKasten?.x ?? 0)).toBe(true);
  await vergleichInfo.click();
  await expect(page.getByRole('tooltip')).toHaveText(HINWEIS);
  await page.keyboard.press('Escape');

  const weg = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lebensweg', exact: true }) });
  await markeOhneFuellung(weg.locator('.abschnitt-kopf [data-schaetzung]'));
  await expect(weg).not.toContainText('~');
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Stärken', exact: true }) }).locator('[data-schaetzung]')).toHaveCount(0);

  const attributeAntwort = await page.request.get('/api/attribute');
  expect(attributeAntwort.ok()).toBeTruthy();
  const einstellungenAntwort = await page.request.get('/api/einstellungen');
  expect(einstellungenAntwort.ok()).toBeTruthy();
  const funktionen = ((await einstellungenAntwort.json()) as { funktionen: Funktionen }).funktionen;
  const vorbild = findeVorbild('davinci');
  if (!vorbild) {
    throw new Error('Vorbild fehlt.');
  }
  const profil = eigenesProfil((await attributeAntwort.json()) as Attribut[], {
    koennen: funktionen.koennen,
    status: funktionen.status,
  });
  const punkte = vergleichspunkte(profil.level, vorbild, profil.kennungen);
  const unsicher = punkte.filter((punkt) => punkt.unsicher);
  const sicher = punkte.filter((punkt) => !punkt.unsicher);
  expect(punkte.length).toBeGreaterThanOrEqual(3);
  expect(unsicher.length).toBeGreaterThan(0);
  expect(sicher.length).toBeGreaterThan(0);

  const unsichereZeile = page.locator(`[data-kennung="${unsicher[0]?.kennung}"]`);
  await expect(unsichereZeile).toContainText(/Lvl ~/);
  await expect(unsichereZeile.locator('span.zahl.text-leise')).toContainText(/~\s*\d/);
  await expect(unsichereZeile.locator('.sr-only', { hasText: 'unsicher' })).toHaveCount(2);
  const sichereZeile = page.locator(`[data-kennung="${sicher[0]?.kennung}"]`);
  await expect(sichereZeile).not.toContainText('~');

  const hohl = page.locator('[data-radar="vergleich"] [data-vorbild-punkt="hohl"]');
  const voll = page.locator('[data-radar="vergleich"] [data-vorbild-punkt="voll"]');
  await expect(hohl).toHaveCount(unsicher.length);
  await expect(voll).toHaveCount(sicher.length);
  const formen = await page.locator('[data-radar="vergleich"] [data-vorbild-punkt]').evaluateAll((kreise) => {
    const farbwert = (wert: string) => {
      const probe = document.createElement('span');
      probe.style.color = wert;
      document.body.append(probe);
      const farbe = getComputedStyle(probe).color;
      probe.remove();
      return farbe;
    };
    const wurzel = getComputedStyle(document.documentElement);
    const flaeche = farbwert(wurzel.getPropertyValue('--flaeche').trim());
    const farbe = farbwert(wurzel.getPropertyValue('--diagramm-vorbild').trim());
    return kreise.map((kreis) => {
      const stil = getComputedStyle(kreis);
      return {
        art: kreis.getAttribute('data-vorbild-punkt'),
        fuellung: stil.fill,
        rand: stil.stroke,
        randBreite: stil.strokeWidth,
        radius: kreis.getAttribute('r'),
        verborgen: kreis.getAttribute('aria-hidden'),
        flaeche,
        farbe,
      };
    });
  });
  expect(formen.length).toBe(punkte.length);
  for (const form of formen) {
    expect(form.radius).toBe('3');
    expect(form.verborgen).toBe('true');
    expect(form.rand).toBe(form.farbe);
    if (form.art === 'hohl') {
      expect(form.fuellung).toBe(form.flaeche);
      expect(form.randBreite).toBe('1.5px');
    } else {
      expect(form.art).toBe('voll');
      expect(form.fuellung).toBe(form.farbe);
      expect(form.randBreite === '0px' || form.randBreite === '0').toBe(true);
    }
  }

  await page.locator('[data-radar="vergleich"]').scrollIntoViewIfNeeded();
  await hohl.first().hover({ force: true });
  const hinweis = page.locator('[data-diagramm-hinweis]');
  await expect(hinweis).toContainText(/Lvl ~/);
  await expect(hinweis.locator('span.text-leise', { hasText: /Lvl ~/ })).toHaveCount(1);
});
