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
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/n3/${testInfo.project.name}-${name}.png`, fullPage: true });
  let geaendert = false;
  try {
    await anmelden(page);
    await page.goto('/mehr/uebersicht');
    const inhalt = page.locator('main');
    await expect(inhalt.locator('h1')).toHaveText('Übersicht');
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('href', '/mehr');
    const aktivitaet = inhalt.getByRole('switch', { name: 'Aktivität', exact: true });
    await expect(aktivitaet).toBeChecked();
    await expect(inhalt.getByRole('switch', { name: 'Identität', exact: true })).toBeChecked();
    await expect(inhalt.getByRole('switch')).toHaveCount(6);

    const info = inhalt.locator('h1').locator('xpath=..').getByRole('button', { name: 'Info' });
    await info.click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText('Hier legst du fest, welche Karten die Übersicht zeigt. Den Bereich schaltest du unter App & Verbindungen.');
    const kasten = await hinweis.boundingBox();
    const fenster = page.viewportSize();
    expect(kasten).not.toBeNull();
    expect(fenster).not.toBeNull();
    if (kasten && fenster) {
      expect(kasten.x).toBeGreaterThanOrEqual(0);
      expect(kasten.y).toBeGreaterThanOrEqual(0);
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
      expect(kasten.y + kasten.height).toBeLessThanOrEqual(fenster.height + 1);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('wahl');
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);

    const karteInfo = inhalt.locator('#uebersicht-karte-identitaet').getByRole('button', { name: 'Info' });
    await karteInfo.click();
    await expect(hinweis).toHaveText('Name, Level, Woche, Streak und Momentum.');
    await page.keyboard.press('Escape');

    const vorher = await karten(page);
    await inhalt.getByRole('link', { name: 'Bereich für Bosse', exact: true }).click();
    await expect(page).toHaveURL(/\/mehr\/funktionen#funktion-bossAngriffe$/);
    await expect(page.locator('#funktion-bossAngriffe').getByRole('switch', { name: 'Bosse' })).toBeVisible();
    const nachLink = await karten(page);
    expect(nachLink.boss).toBe(vorher.boss);
    expect(nachLink.aktivitaet).toBe(true);

    await page.goto('/mehr/uebersicht');
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
