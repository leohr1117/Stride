import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface AttributZeile {
  id: number;
  typ: 'attribut' | 'status';
  name: string;
  beschreibung: string;
  archiviert: boolean;
}

async function attribute(seite: Page): Promise<AttributZeile[]> {
  const antwort = await seite.request.get('/api/attribute');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as AttributZeile[];
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Attributnamen sind nur sichtbar', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/attribut-name/${testInfo.project.name}-${name}.png` });
  const vorher = await attribute(page);
  const namen = vorher.map((eintrag) => eintrag.name).sort();
  const koennen = vorher.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert);
  const haben = vorher.find((eintrag) => eintrag.typ === 'status' && !eintrag.archiviert);
  expect(koennen && haben).toBeTruthy();
  if (!koennen || !haben) {
    return;
  }

  for (const eintrag of [koennen, haben]) {
    const antwort = await page.request.patch(`/api/attribute/${eintrag.id}`, {
      data: { name: 'Nicht mehr erlaubt' },
    });
    expect(antwort.ok()).toBe(true);
    const gespeichert = (await antwort.json()) as AttributZeile;
    expect(gespeichert.name).toBe(eintrag.name);
  }

  await page.goto('/koennen');
  const bereich = page.locator('main');
  const knopf = bereich.getByRole('button', { name: koennen.name, exact: true });
  await knopf.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await knopf.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  const titel = (await dialog.getAttribute('aria-label')) ?? '';
  const sichtbar = koennen.name;
  expect(titel).toBe(sichtbar);
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveCount(0);
  await expect(dialog.locator('.feld', { hasText: 'Name' }).getByText(sichtbar, { exact: true })).toBeVisible();
  const werte = await dialog.locator('input, textarea').evaluateAll((felder) =>
    felder.map((feld) => (feld as HTMLInputElement).value),
  );
  expect(werte).not.toContain(sichtbar);
  await expect(dialog.getByRole('textbox', { name: 'Beschreibung' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  await ohneSeitlichenUeberlauf(page);
  await bild('dialog');

  const notiz = 'A4 Name bleibt';
  await dialog.getByRole('textbox', { name: 'Beschreibung' }).fill(notiz);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/koennen$/);

  const nachher = await attribute(page);
  expect(nachher.map((eintrag) => eintrag.name).sort()).toEqual(namen);
  const geaendert = nachher.find((eintrag) => eintrag.beschreibung === notiz);
  expect(geaendert).toBeTruthy();
  const original = geaendert ? vorher.find((eintrag) => eintrag.id === geaendert.id) : undefined;
  expect(original && geaendert && geaendert.name === original.name).toBe(true);

  await page.getByRole('button', { name: sichtbar, exact: true }).first().evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.getByRole('button', { name: sichtbar, exact: true }).first().click();
  const wieder = page.getByRole('dialog', { name: sichtbar, exact: true });
  await expect(wieder).toHaveCSS('opacity', '1');
  await expect(wieder.getByRole('textbox', { name: 'Name' })).toHaveCount(0);
  await expect(wieder.locator('.feld', { hasText: 'Name' }).getByText(sichtbar, { exact: true })).toBeVisible();
  await expect(wieder.getByRole('textbox', { name: 'Beschreibung' })).toHaveValue(notiz);
  await ohneSeitlichenUeberlauf(page);
  await bild('wieder');
  await wieder.getByRole('button', { name: 'Schließen' }).click();
  await expect(wieder).toBeHidden();
  await expect(page.locator('.dialog-fenster')).toHaveCount(0);
  await expect(page).toHaveURL(/\/koennen$/);
  await expect(bereich.getByRole('button', { name: 'Körper', exact: true })).toBeVisible();
  await bild('liste');

  if (original && geaendert) {
    const zurueck = await page.request.patch(`/api/attribute/${geaendert.id}`, {
      data: { name: 'Immer noch nicht', beschreibung: original.beschreibung },
    });
    expect(zurueck.ok()).toBe(true);
    const wiederhergestellt = (await zurueck.json()) as AttributZeile;
    expect(wiederhergestellt.name).toBe(original.name);
    expect(wiederhergestellt.beschreibung).toBe(original.beschreibung);
  }
});
