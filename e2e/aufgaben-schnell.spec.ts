import { expect, test } from '@playwright/test';
import { anmelden, heuteDerWelt, ohneSeitlichenUeberlauf, raeumeBau, schalte } from './aufgabenHelfer.ts';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

function morgenVon(heute: string): string {
  const [jahr, monat, tag] = heute.split('-').map(Number);
  const datum = new Date(jahr ?? 2026, (monat ?? 1) - 1, tag ?? 1);
  datum.setDate(datum.getDate() + 1);
  const monatText = String(datum.getMonth() + 1).padStart(2, '0');
  const tagText = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monatText}-${tagText}`;
}

test('Schnelleingabe: morgen und Uhrzeit, Vorschläge, Kreis', async ({ page }, testInfo) => {
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/aufgaben-19/${projekt}-${name}.png` });
  const kern = `Bau schnell ${projekt} ${Date.now()}`;

  await page.goto('/mehr/funktionen');
  await schalte(page, true);
  await raeumeBau(page);

  const zieleAntwort = await page.request.get('/api/ziele');
  expect(zieleAntwort.ok()).toBe(true);
  const ziele = (await zieleAntwort.json()) as { projekte: { id: number; name: string; archiviert: boolean }[] };
  const ausdauer = ziele.projekte.find((eintrag) => eintrag.name === 'Ausdauer' && !eintrag.archiviert);
  expect(ausdauer).toBeTruthy();

  try {
    await page.goto('/aufgaben');
    await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const chip = dialog.getByRole('group', { name: 'Tätigkeit' }).getByRole('button').first();
    await chip.click();

    const name = dialog.getByLabel('Name');
    await name.fill('morgen 9 Uhr');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await expect(dialog.locator('input[type="time"]')).toHaveValue('09:00');
    await expect(dialog.locator('[data-treffer="1"]').filter({ hasText: 'morgen 9 Uhr' })).toBeVisible();

    await name.fill('Arzt anrufen #A');
    await name.press('End');
    const liste = dialog.getByRole('listbox', { name: 'Vorschläge' });
    await expect(liste).toBeVisible();
    await expect(liste.getByRole('option').first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /nicht erkennen/ })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('vorschlag');

    const option = liste.getByRole('option').first();
    const optionName = (await option.innerText()).trim();
    await option.click();
    await expect(name).toHaveValue(`Arzt anrufen #${optionName}`);
    await expect(dialog.locator('select')).not.toHaveValue('');

    const heute = await heuteDerWelt(page);
    await name.fill(`Arzt anrufen morgen 9 Uhr p1 #${ausdauer?.name ?? ''}`);
    await expect(dialog.locator('[data-treffer="1"]').filter({ hasText: 'morgen 9 Uhr' })).toBeVisible();
    await expect(dialog.locator('[data-treffer="1"]').filter({ hasText: 'p1' })).toBeVisible();
    await expect(dialog.locator('[data-treffer="1"]').filter({ hasText: `#${ausdauer?.name ?? ''}` })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'morgen 9 Uhr nicht erkennen' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'p1 nicht erkennen' })).toBeVisible();
    await expect(dialog.locator('input[type="date"]')).toHaveValue(morgenVon(heute));
    await expect(dialog.locator('input[type="time"]')).toHaveValue('09:00');
    await expect(dialog.locator('select')).toHaveValue(String(ausdauer?.id ?? ''));
    await expect(dialog.getByText('Priorität', { exact: true })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('schnell');

    await dialog.getByRole('button', { name: 'morgen 9 Uhr nicht erkennen' }).click();
    await expect(name).toHaveValue(`Arzt anrufen morgen 9 Uhr p1 #${ausdauer?.name ?? ''}`);
    await expect(dialog.locator('input[type="time"]')).toHaveValue('');
    await expect(dialog.locator('input[type="date"]')).toHaveValue('');
    await expect(dialog.locator('select')).toHaveValue(String(ausdauer?.id ?? ''));

    await name.fill(`${kern} morgen 9 Uhr`);
    await dialog.getByRole('group', { name: 'Tätigkeit' }).getByRole('button').first().click();
    await expect(dialog.locator('input[type="time"]')).toHaveValue('09:00');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);

    const naechstes = page.getByRole('button', { name: 'Als Nächstes', exact: true });
    await expect(naechstes).toHaveAttribute('aria-expanded', 'false');
    await naechstes.click();
    const zeile = page.getByRole('listitem').filter({ hasText: kern });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText('09:00');
    await expect(zeile).not.toContainText('morgen');
    await expect(zeile).not.toContainText('9 Uhr');
    await expect(zeile.getByRole('button', { name: kern, exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('zeile');

    await zeile.getByRole('button', { name: 'Erledigt', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.dialog-fenster')).toHaveCount(0);
  } finally {
    await raeumeBau(page);
  }
});
