import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ALLE_AN = {
  identitaet: true,
  bosse: true,
  comeback: true,
  basis: true,
  werte: true,
  aktivitaet: true,
};

async function karten(seite: Page): Promise<{ aktivitaet: boolean; boss: boolean }> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as {
    uebersichtKarten: { aktivitaet: boolean };
    funktionen: { bossAngriffe: boolean };
  };
  return { aktivitaet: daten.uebersichtKarten.aktivitaet, boss: daten.funktionen.bossAngriffe };
}

test('Nutzer wählt die Karten der Übersicht', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/uebersicht-karten/${testInfo.project.name}-${name}.png`, fullPage: true });
  let geaendert = false;
  try {
    await anmelden(page);
    await page.goto('/mehr/uebersicht');
    const inhalt = page.locator('main');
    await expect(inhalt.locator('h1')).toHaveText('Karten auf Heute');
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    const aktivitaet = inhalt.getByRole('switch', { name: 'Aktivität', exact: true });
    await expect(aktivitaet).toBeChecked();
    await expect(inhalt.getByRole('switch', { name: 'Identität', exact: true })).toBeChecked();
    await expect(inhalt.getByRole('switch')).toHaveCount(6);
    await expect(inhalt.getByRole('button', { name: /^Info/ })).toHaveCount(0);
    await expect(inhalt.getByText('Immer', { exact: true })).toHaveCount(0);
    await expect(inhalt.getByRole('link', { name: /^Bereich für / })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('wahl');

    const vorher = await karten(page);
    geaendert = true;
    await aktivitaet.click();
    await expect(aktivitaet).not.toBeChecked();
    await expect.poll(() => karten(page).then((stand) => stand.aktivitaet)).toBe(false);
    const nachAus = await karten(page);
    expect(nachAus.boss).toBe(vorher.boss);
    await ohneSeitlichenUeberlauf(page);

    await page.goto('/');
    await expect(page.getByText('XP diese Woche')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aktivität', exact: true })).toHaveCount(0);
    await expect(page.locator('main').getByRole('switch', { name: 'Aktivität', exact: true })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('aus');

    await page.goto('/mehr/uebersicht');
    await aktivitaet.click();
    await expect(aktivitaet).toBeChecked();
    await expect.poll(() => karten(page).then((stand) => stand.aktivitaet)).toBe(true);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Aktivität', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('an');
  } finally {
    if (geaendert) {
      const antwort = await page.request.patch('/api/einstellungen', { data: { uebersichtKarten: ALLE_AN } });
      expect(antwort.ok()).toBe(true);
    }
  }
});
