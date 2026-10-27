import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function benutzername(seite: Page): Promise<string> {
  const antwort = await seite.request.get('/api/zugang');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { benutzername: string | null };
  return daten.benutzername ?? '';
}

test('Benutzername ist eindeutig und bleibt änderbar', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/n1/${testInfo.project.name}-${name}.png`, fullPage: true });
  const frei = `N1Frei${testInfo.project.name}`;
  await anmelden(page);
  try {
    await page.goto('/mehr/profil');
    await page.getByRole('link', { name: 'Benutzername' }).click();
    await expect(page).toHaveURL(/\/mehr\/profil\/benutzer$/);
    const feld = page.getByRole('textbox', { name: 'Benutzername', exact: true });
    await expect(feld).toHaveValue('testvoll');
    const speichern = page.getByRole('button', { name: 'Speichern' });
    await expect(speichern).toBeDisabled();
    await expect(speichern).toBeInViewport();

    await feld.fill('TestTeil');
    await speichern.click();
    await expect(page.getByText('Der Benutzername ist schon vergeben.')).toBeVisible();
    expect(await benutzername(page)).toBe('testvoll');
    await ohneSeitlichenUeberlauf(page);
    await bild('vergeben');

    await feld.fill('TestVoll');
    await speichern.click();
    await expect.poll(() => benutzername(page)).toBe('TestVoll');
    await expect(page.getByText('Der Benutzername ist schon vergeben.')).toHaveCount(0);
    await expect(speichern).toBeDisabled();

    await feld.fill(frei);
    await speichern.click();
    await expect.poll(() => benutzername(page)).toBe(frei);
    await expect(feld).toHaveValue(frei);
    await expect(speichern).toBeDisabled();
    await ohneSeitlichenUeberlauf(page);
    await bild('geaendert');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);
    await expect(page.getByText(frei, { exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('profil');
  } finally {
    const aktuell = await page.request.get('/api/zugang').catch(() => null);
    if (aktuell?.ok()) {
      const daten = (await aktuell.json()) as { benutzername?: string | null };
      if (daten.benutzername && daten.benutzername !== 'testvoll') {
        const zurueck = await page.request.post('/api/zugang/benutzername', { data: { benutzername: 'testvoll' } });
        if (!zurueck.ok()) {
          throw new Error(`Benutzername blieb ${daten.benutzername}.`);
        }
      }
    }
  }
});
