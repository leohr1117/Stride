import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

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

test('Abschlusstätigkeit, einmaliger Bonus und Übersicht', async ({ page }, testInfo) => {
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
  const dialog = page.getByRole('dialog', { name: 'Projekt bearbeiten' });
  const feld = dialog.locator('.feld').filter({ hasText: 'Abschlusstätigkeit' });
  await expect(feld.locator('select')).toHaveValue(String(abschluss.id));
  await expect(feld.locator('option', { hasText: 'Keine' })).toHaveCount(1);
  await expect(feld.locator('option', { hasText: liefern })).toHaveCount(1);
  await feld.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toContainText('Ohne Tätigkeit gibt es den Bonus trotzdem.');
  await ohneUeberlauf(page);
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
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

  const region = page.getByRole('region', { name: 'Abschluss', exact: true });
  await expect(region).toBeVisible();
  await expect(region).toContainText('XP');
  await expect(region).toContainText('Level');
  await expect(region).toContainText('Einträge');
  await expect(region).toContainText('Std');
  await region.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toContainText('Wieder öffnen gibt den Bonus nicht noch einmal.');
  await ohneUeberlauf(page);
  await page.screenshot({ path: `tmp-test/projekt-abschluss/${testInfo.project.name}-uebersicht.png`, fullPage: true });
  const nachAbschluss = await stand(page, angelegt.id);
  expect(nachAbschluss.abschluss?.stunden).toBe(2);
  expect(nachAbschluss.abschluss?.eintraege).toBe(2);
  expect(nachAbschluss.geschafftAm).not.toBeNull();

  await page.getByRole('button', { name: 'Wieder öffnen', exact: true }).click();
  const oeffnen = page.getByRole('alertdialog', { name: 'Projekt wieder öffnen?' });
  await oeffnen.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(region).toBeVisible();
  await expect(region.getByRole('button', { name: 'Abschließen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
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
