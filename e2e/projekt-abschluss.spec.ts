import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { TEST_PASSWORT } from './testdaten.ts';

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function api<T>(seite: Page, pfad: string, methode: string, koerper?: unknown): Promise<T> {
  return seite.evaluate(
    async ({ pfad, methode, koerper }) => {
      const antwort = await fetch(pfad, {
        method: methode,
        headers: koerper === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: koerper === undefined ? undefined : JSON.stringify(koerper),
      });
      const text = await antwort.text();
      if (!antwort.ok) {
        throw new Error(`${methode} ${pfad} ${antwort.status}: ${text.slice(0, 180)}`);
      }
      return text ? (JSON.parse(text) as T) : (undefined as T);
    },
    { pfad, methode, koerper },
  );
}

interface ProjektStand {
  level: { xpGesamt: number };
  anzahlEintraege: number;
  geschafftAm: string | null;
  abschluss: { xp: number; level: number; eintraege: number; stunden: number } | null;
}

async function stand(seite: Page, id: number): Promise<ProjektStand> {
  const detail = await api<{ projekt: ProjektStand }>(seite, `/api/projekte/${id}`, 'GET');
  return detail.projekt;
}

async function ohneUeberlauf(seite: Page): Promise<void> {
  expect(
    await seite.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true);
}

async function kopfEintrag(seite: Page, name: string, eintrag: string): Promise<void> {
  await seite.getByRole('button', { name: `Aktionen für ${name}`, exact: true }).click();
  await seite.getByRole('menuitem', { name: eintrag, exact: true }).click();
}

const HELL = { stil: 'standard', primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };

async function speichereFarben(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

test('Projektseite ohne Abschluss-Abschnitt, Eintrag im Kopfmenü', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'handy', 'Vergleichsbild nur bei 390 px');
  await anmelden(page);
  const original = await page.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen');
    return (await antwort.json()) as {
      stil: string;
      glimmen: boolean;
      primaer: string;
      akzent: string;
      hintergrund: string;
      eigeneFarben: boolean;
    };
  });
  const liste = await api<{ projekte: { id: number; name: string; geschafftAm: string | null }[] }>(
    page,
    '/api/ziele',
    'GET',
  );
  const app = liste.projekte.find((projekt) => projekt.name === 'App bauen');
  expect(app, 'Projekt App bauen').toBeTruthy();
  if (!app) {
    return;
  }
  try {
    await speichereFarben(page, HELL);
    await page.goto(`/projekte/${app.id}`);
    await expect(page.getByRole('heading', { name: 'App bauen', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-schema', 'light');
    await page.waitForFunction(() => {
      const stil = getComputedStyle(document.documentElement);
      return (
        stil.getPropertyValue('--flaeche').trim().toLowerCase() === '#ffffff' &&
        stil.getPropertyValue('--gefahr').trim().toLowerCase() === '#c62828'
      );
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('region', { name: 'Abschluss', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Abschluss', exact: true })).toHaveCount(0);
    fs.mkdirSync('tmp-test/projekt-abschluss', { recursive: true });
    await page.screenshot({ path: 'tmp-test/projekt-abschluss/handy-390-projekt.png' });
    await page.screenshot({ path: 'tmp-test/projekt-abschluss/handy-390-projekt-ganz.png', fullPage: true });
    await page.getByRole('button', { name: 'Aktionen für App bauen', exact: true }).click();
    const menue = page.getByRole('menu', { name: 'Aktionen', exact: true });
    const eintrag = app.geschafftAm ? 'Wieder öffnen' : 'Projekt abschließen';
    await expect(menue.getByRole('menuitem', { name: eintrag, exact: true })).toBeVisible();
    const namen = await menue.getByRole('menuitem').allTextContents();
    expect(namen[0]).toBe('Bearbeiten');
    expect(namen[1]).toBe(eintrag);
    await page.screenshot({ path: 'tmp-test/projekt-abschluss/handy-390-menue.png' });
    await page.keyboard.press('Escape');
  } finally {
    await speichereFarben(
      page,
      original.eigeneFarben
        ? {
            stil: original.stil,
            glimmen: original.glimmen,
            primaer: original.primaer,
            akzent: original.akzent,
            hintergrund: original.hintergrund,
          }
        : { stil: original.stil, glimmen: original.glimmen, farbenZuruecksetzen: true },
    );
  }
});

test('Abschlusstätigkeit, einmaliger Bonus und Kopfmenü', async ({ page }, testInfo) => {
  const name = `Lauf80-${testInfo.project.name}`;
  const denken = `${name}-Denken`;
  const liefern = `${name}-Liefern`;
  await anmelden(page);
  await api(page, '/api/einstellungen', 'PATCH', {
    ebenen: { visionen: true, organisationen: true, projekte: true, vorhaben: true },
  });
  const attribute = await api<{ id: number; archiviert: boolean }[]>(page, '/api/attribute', 'GET');
  const attributId = attribute.find((attribut) => !attribut.archiviert)?.id;
  if (attributId === undefined) {
    throw new Error('Kein Attribut.');
  }
  const standard = await api<{ id: number }>(page, '/api/vorlagen', 'POST', {
    name: denken,
    icon: 'sparkles',
    gewichte: [{ attributId, gewicht: 1 }],
  });
  const abschluss = await api<{ id: number }>(page, '/api/vorlagen', 'POST', {
    name: liefern,
    icon: 'sparkles',
    gewichte: [{ attributId, gewicht: 1 }],
  });
  const angelegt = await api<{ id: number }>(page, '/api/projekte', 'POST', {
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: standard.id,
    abschlussVorlageId: abschluss.id,
  });
  await api(page, '/api/eintraege', 'POST', {
    projektId: angelegt.id,
    vorlageId: standard.id,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden: 2,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  });

  await page.goto(`/projekte/${angelegt.id}`);
  await page.getByRole('button', { name: `Aktionen für ${name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Projekt', exact: true });
  const feld = dialog.locator('.feld').filter({ hasText: 'Tätigkeit beim Abschluss' });
  await expect(feld.getByRole('combobox', { name: 'Tätigkeit beim Abschluss' })).toContainText(liefern);
  await expect(dialog.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await feld.getByRole('combobox', { name: 'Tätigkeit beim Abschluss' }).click();
  const blatt = page.getByRole('dialog', { name: 'Tätigkeit beim Abschluss' });
  await expect(blatt.getByRole('option', { name: 'Keine · Bonus gibt es trotzdem' })).toBeVisible();
  await expect(blatt.getByRole('option', { name: liefern, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(blatt).toBeHidden();
  await ohneUeberlauf(page);
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toBeHidden();

  await kopfEintrag(page, name, 'Projekt abschließen');
  const frage = page.getByRole('alertdialog', { name: `"${name}" abschließen?` });
  await frage.getByRole('button', { name: 'Abschließen', exact: true }).click();
  const feier = page.locator('.belohnung');
  await expect(feier.getByText('Geschafft', { exact: true })).toBeVisible();
  await expect(feier.getByText('Projekt abgeschlossen', { exact: true })).toBeVisible();
  const weiter = page.getByRole('button', { name: 'Weiter', exact: true });
  await expect(weiter).toBeVisible();
  await page.screenshot({ path: `tmp-test/projekt-abschluss/${testInfo.project.name}-feier.png` });
  await weiter.click();
  await feier.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(feier).toHaveCount(0);

  await expect(page.getByRole('region', { name: 'Abschluss', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Abschluss', exact: true })).toHaveCount(0);
  await expect(page.getByText('Einmalig Bonus-XP nach den Einträgen im Projekt.')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
  await ohneUeberlauf(page);
  await page.screenshot({ path: `tmp-test/projekt-abschluss/${testInfo.project.name}-uebersicht.png`, fullPage: true });
  const nachAbschluss = await stand(page, angelegt.id);
  expect(nachAbschluss.abschluss?.stunden).toBe(2);
  expect(nachAbschluss.abschluss?.eintraege).toBe(2);
  expect(nachAbschluss.geschafftAm).not.toBeNull();

  await kopfEintrag(page, name, 'Wieder öffnen');
  const oeffnen = page.getByRole('alertdialog', { name: 'Projekt wieder öffnen?' });
  await oeffnen.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Abschluss', exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: `Aktionen für ${name}`, exact: true }).click();
  const menue = page.getByRole('menu', { name: 'Aktionen', exact: true });
  const namen = await menue.getByRole('menuitem').allTextContents();
  expect(namen[0]).toBe('Bearbeiten');
  expect(namen[1]).toBe('Projekt abschließen');
  await expect(menue.getByRole('menuitem', { name: 'Wieder öffnen', exact: true })).toHaveCount(0);
  await menue.getByRole('menuitem', { name: 'Projekt abschließen', exact: true }).click();
  const nochmal = page.getByRole('alertdialog', { name: `"${name}" abschließen?` });
  await nochmal.getByRole('button', { name: 'Abschließen', exact: true }).click();
  await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator('.belohnung')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toHaveCount(0);
  const danach = await stand(page, angelegt.id);
  expect(danach.level.xpGesamt).toBe(nachAbschluss.level.xpGesamt);
  expect(danach.anzahlEintraege).toBe(nachAbschluss.anzahlEintraege);
  expect(danach.abschluss?.xp).toBe(nachAbschluss.abschluss?.xp);
});
