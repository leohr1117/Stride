import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

interface KnotenZeile {
  id: number;
  titel: string;
  elternId: number | null;
  freigeschaltetAm: string | null;
}

interface FaehigkeitZeile {
  id: number;
  name: string;
  archiviert: boolean;
  knoten: KnotenZeile[];
}

interface AttributZeile {
  id: number;
  name: string;
  typ: 'attribut' | 'status';
  archiviert: boolean;
}

interface EinstellungenZeile {
  funktionen: Record<string, boolean>;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function alleAnzeigen(seite: Page): Promise<void> {
  const knopf = seite.getByRole('button', { name: /Alle anzeigen/ });
  while ((await knopf.count()) > 0) {
    await tippe(knopf.first());
  }
}

/**
 * Auf dem Handy deckt die Leiste den unteren Rand ab, und die Zeilenmitte
 * trifft das Info-Icon. Deshalb in die Mitte scrollen und rechts tippen.
 */
async function tippe(ziel: Locator): Promise<void> {
  await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const kasten = await ziel.boundingBox();
  if (!kasten) {
    throw new Error('Ziel nicht sichtbar');
  }
  await ziel.click({ position: { x: Math.max(8, kasten.width - 24), y: kasten.height / 2 } });
}

function xpImDialog(dialog: Locator): Locator {
  return dialog.getByText(/^\d+ XP$/);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Fähigkeiten zeigen denselben Baum', async ({ page }) => {
  const programmieren = await page.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error('Fähigkeiten nicht geladen');
    }
    const liste = (await antwort.json()) as FaehigkeitZeile[];
    return liste.find((eintrag) => eintrag.name === 'Programmieren' && !eintrag.archiviert) ?? null;
  });
  expect(programmieren).toBeTruthy();
  if (!programmieren) {
    return;
  }
  const release = programmieren.knoten.find((knoten) => knoten.titel === 'Release bauen');
  expect(release?.freigeschaltetAm).toBeNull();

  await page.goto(`/faehigkeiten/${programmieren.id}`);
  await expect(page.getByRole('heading', { name: 'Baum', exact: true })).toBeVisible();
  await expect(page.getByText('Skill Tree')).toHaveCount(0);
  const karte = page.locator('.baum-karte');
  await expect(karte).toBeVisible();
  await expect(karte.getByRole('list')).toHaveCount(0);
  await expect(karte.locator('.baum-wurzel')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);

  const flaeche = karte.locator('.baum-flaeche');
  const knot = karte.locator('.baum-knoten').first();
  const knotKasten = await knot.boundingBox();
  const wurzelKasten = await karte.locator('.baum-wurzel').boundingBox();
  const flaechenKasten = await flaeche.boundingBox();
  const kartenKasten = await karte.boundingBox();
  expect(knotKasten && wurzelKasten && flaechenKasten && kartenKasten).toBeTruthy();
  if (knotKasten && wurzelKasten && flaechenKasten && kartenKasten) {
    expect(knotKasten.width).toBeGreaterThan(40);
    expect(knotKasten.width).toBeLessThan(50);
    expect(wurzelKasten.width).toBeGreaterThan(52);
    expect(wurzelKasten.width).toBeLessThan(60);
    expect(flaechenKasten.width).toBeGreaterThan(180);
    expect(flaechenKasten.width).toBeLessThan(420);
    expect(flaechenKasten.x).toBeGreaterThanOrEqual(kartenKasten.x - 1);
    expect(flaechenKasten.x + flaechenKasten.width).toBeLessThanOrEqual(kartenKasten.x + kartenKasten.width + 1);
  }
  expect(await karte.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(false);

  const frei = karte.locator('[data-zustand="frei"]');
  const naechstes = karte.locator('[data-zustand="verfuegbar"]', { hasText: 'Release bauen' });
  await expect(frei.first()).toBeVisible();
  await expect(frei.locator('.baum-puls')).toHaveCount(0);
  await expect(frei.locator('[data-haken]').first()).toBeVisible();
  await expect(naechstes).toBeVisible();
  await expect(naechstes.locator('.baum-puls')).toHaveCount(1);
  await expect(naechstes.locator('[data-haken]')).toHaveCount(0);
  await expect(naechstes.locator('.baum-knoten')).toHaveCSS('border-top-style', 'solid');
  await expect(karte.locator('.baum-knoten', { hasText: '+' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  const neu = page.getByRole('dialog', { name: 'Knoten' });
  await expect(neu).toBeVisible();
  await neu.getByRole('button', { name: 'Schließen' }).click();

  await naechstes.click();
  const dialog = page.getByRole('dialog');
  await expect(xpImDialog(dialog)).toBeVisible();
  await dialog.getByRole('button', { name: 'Darunter anlegen' }).click();
  await expect(page.getByRole('dialog', { name: 'Knoten' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Knoten' }).getByRole('button', { name: 'Schließen' }).click();

  const extra = await page.evaluate(async (faehigkeitId) => {
    const lege = async (titel: string, elternId: number | null) => {
      const antwort = await fetch(`/api/faehigkeiten/${faehigkeitId}/knoten`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ titel, beschreibung: '', elternId }),
      });
      if (!antwort.ok) {
        throw new Error('Knoten fehlgeschlagen');
      }
      const daten = (await antwort.json()) as FaehigkeitZeile;
      const id = daten.knoten.find((knoten) => knoten.titel === titel)?.id ?? 0;
      if (id === 0) {
        throw new Error('Knoten fehlt');
      }
      return id;
    };
    const liste = (await (await fetch('/api/faehigkeiten')).json()) as FaehigkeitZeile[];
    const ziel = liste.find((eintrag) => eintrag.id === faehigkeitId);
    const eltern = ziel?.knoten.find((knoten) => knoten.titel === 'Release bauen')?.id ?? null;
    return {
      gesperrt: await lege('Lauf64 gesperrt', eltern),
      links: await lege('Lauf64 links', null),
      rechts: await lege('Lauf64 rechts', null),
    };
  }, programmieren.id);

  try {
    await page.reload();
    const breit = (page.viewportSize()?.width ?? 0) >= 700;
    const gesperrt = karte.locator('[data-zustand="gesperrt"]', { hasText: 'Lauf64 gesperrt' });
    await expect(gesperrt).toBeVisible();
    await expect(gesperrt.locator('.baum-puls')).toHaveCount(0);
    await expect(gesperrt.locator('.baum-knoten')).toHaveCSS('border-top-style', 'dashed');
    await expect(gesperrt).not.toContainText('+');
    await gesperrt.click();
    await expect(xpImDialog(page.getByRole('dialog'))).toBeVisible();
    await page.keyboard.press('Escape');
    const innen = await karte.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(innen).toBe(!breit);
    await ohneSeitlichenUeberlauf(page);
    if (!breit) {
      const ziel = karte.getByRole('button', { name: 'Lauf64 rechts' });
      await ziel.scrollIntoViewIfNeeded();
      await expect(ziel).toBeInViewport();
    }
  } finally {
    await page.evaluate(async (ids) => {
      for (const id of ids) {
        if (id > 0) {
          await fetch(`/api/knoten/${id}`, { method: 'DELETE' });
        }
      }
    }, [extra.gesperrt, extra.links, extra.rechts]);
  }
});

test('XP-Verlust ist für Können und Haben getrennt', async ({ page }) => {
  const vorher = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    if (!antwort.ok) {
      throw new Error('Einstellungen nicht geladen');
    }
    return antwort.json() as Promise<EinstellungenZeile>;
  });

  try {
    await page.goto('/mehr/funktionen');
    const koennen = page.locator('#funktion-verfallKoennen').getByRole('switch', { name: 'Verfall Können' });
    const haben = page.locator('#funktion-verfallHaben').getByRole('switch', { name: 'Verfall Haben' });
    await expect(koennen).toBeVisible();
    await expect(haben).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Attributverfall' })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);

    if ((await koennen.getAttribute('aria-checked')) !== 'true') {
      await tippe(koennen);
    }
    if ((await haben.getAttribute('aria-checked')) !== 'false') {
      await tippe(haben);
    }
    await expect(koennen).toHaveAttribute('aria-checked', 'true');
    await expect(haben).toHaveAttribute('aria-checked', 'false');

    const status = page.locator('#funktion-status').getByRole('switch', { name: 'Haben' });
    if ((await status.getAttribute('aria-checked')) === 'true') {
      await tippe(status);
      await expect(haben).toBeDisabled();
      await expect(page.locator('#funktion-verfallHaben')).toContainText('Erst Haben einschalten.');
      await tippe(status);
      await expect(haben).toBeEnabled();
      if ((await haben.getAttribute('aria-checked')) !== 'false') {
        await tippe(haben);
      }
    }

    await expect.poll(async () =>
      page.evaluate(async () => {
        const daten = (await (await fetch('/api/einstellungen')).json()) as EinstellungenZeile;
        return daten.funktionen.verfallKoennen === true && daten.funktionen.verfallHaben === false && daten.funktionen.status === true;
      }),
    ).toBe(true);

    const attribute = await page.evaluate(async () => {
      const antwort = await fetch('/api/attribute');
      if (!antwort.ok) {
        throw new Error('Attribute nicht geladen');
      }
      return antwort.json() as Promise<AttributZeile[]>;
    });
    const koennenAttribut = attribute.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert);
    const habenAttribut = attribute.find((eintrag) => eintrag.typ === 'status' && !eintrag.archiviert);
    expect(koennenAttribut && habenAttribut).toBeTruthy();
    if (!koennenAttribut || !habenAttribut) {
      return;
    }

    await page.goto('/koennen');
    await page.getByRole('button', { name: koennenAttribut.name, exact: true }).click();
    const koennenDialog = page.getByRole('dialog', { name: koennenAttribut.name, exact: true });
    await expect(koennenDialog.getByRole('heading', { name: 'Verfall', exact: true })).toBeVisible();
    await expect(koennenDialog.getByText('Verlust bei Nichtnutzung')).toBeVisible();
    await expect(koennenDialog.getByText('Verlust über Zeit')).toBeVisible();
    await koennenDialog.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/haben');
    await page.getByRole('button', { name: habenAttribut.name, exact: true }).click();
    const habenDialog = page.getByRole('dialog', { name: habenAttribut.name, exact: true });
    await expect(habenDialog.getByRole('heading', { name: 'Verfall', exact: true })).toHaveCount(0);
    await expect(habenDialog.getByText('Verlust bei Nichtnutzung')).toHaveCount(0);
    await expect(habenDialog.getByText('Verlust über Zeit')).toHaveCount(0);
    await habenDialog.getByRole('button', { name: 'Schließen' }).click();
    await ohneSeitlichenUeberlauf(page);
  } finally {
    await page.evaluate(async (funktionen) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ funktionen }),
      });
    }, vorher.funktionen);
  }
});
