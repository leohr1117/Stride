import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface VorlageZeile {
  id: number;
  name: string;
  archiviert: boolean;
  projektId: number | null;
}

async function vorlagen(seite: Page): Promise<VorlageZeile[]> {
  const antwort = await seite.request.get('/api/vorlagen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as VorlageZeile[];
}

test('Tätigkeiten lassen sich anordnen, die oberste steht zuerst', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/n4/${testInfo.project.name}-${name}.png` });
  let ursprung: number[] | null = null;

  try {
    await anmelden(page);
    await page.goto('/mehr/inhalte');
    await expect(page.locator('main h1')).toHaveText('Tätigkeiten');

    const vorher = (await vorlagen(page)).filter((eintrag) => !eintrag.archiviert);
    expect(vorher.length).toBeGreaterThan(1);
    ursprung = vorher.map((eintrag) => eintrag.id);
    const erste = vorher[0];
    const zweite = vorher[1];
    if (!erste || !zweite) {
      throw new Error('Zwei Tätigkeiten fehlen.');
    }

    await expect(page.getByRole('button', { name: 'Reihenfolge', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('liste');

    await page.getByRole('button', { name: 'Reihenfolge', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reihenfolge' });
    await expect(dialog).toBeVisible();
    const zeile = (id: number) => dialog.locator(`[data-reihenfolge="${id}"]`);
    await expect(zeile(erste.id).getByRole('button', { name: 'nach oben' })).toBeDisabled();
    await expect(zeile(vorher[vorher.length - 1].id).getByRole('button', { name: 'nach unten' })).toBeDisabled();
    await expect(zeile(erste.id)).toContainText(erste.name);

    const info = dialog.getByRole('button', { name: 'Info' });
    await info.click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText('Die oberste Tätigkeit steht zuerst, auch beim Eintragen.');
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
    await bild('dialog');
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await zeile(zweite.id).getByRole('button', { name: 'nach oben' }).click();
    await expect.poll(async () => (await vorlagen(page)).filter((eintrag) => !eintrag.archiviert)[0]?.id).toBe(zweite.id);
    await expect(zeile(zweite.id).getByRole('button', { name: 'nach oben' })).toBeDisabled();
    await expect(zeile(erste.id).getByRole('button', { name: 'nach oben' })).toBeEnabled();
    const nachher = (await vorlagen(page)).filter((eintrag) => !eintrag.archiviert);
    expect(nachher[1]?.id).toBe(erste.id);
    await bild('verschoben');

    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();
    const bearbeiten = page.locator('#taetigkeiten').getByRole('button', { name: / bearbeiten$/ });
    await expect(bearbeiten.first()).toHaveAccessibleName(`${zweite.name} bearbeiten`);
    await ohneSeitlichenUeberlauf(page);

    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await expect(eintrag).toBeVisible();
    const ersteAllgemein = nachher.find((eintragZeile) => eintragZeile.projektId === null);
    expect(ersteAllgemein).toBeDefined();
    const chips = eintrag.locator('.chip-reihe').getByRole('button');
    await expect(chips.first()).toContainText(ersteAllgemein?.name ?? '');
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    await ohneSeitlichenUeberlauf(page);
    await bild('eintrag');
    await eintrag.getByRole('button', { name: 'Schließen' }).click();
    await expect(eintrag).toBeHidden();

    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.locator('a[data-zurueck]')).toHaveCount(0);
      await page.locator('aside.seitenleiste a[href="/mehr"]').click();
    } else {
      await page.locator('a[data-zurueck]').click();
    }
    await expect(page).toHaveURL(/\/mehr$/);
  } finally {
    if (ursprung) {
      const antwort = await page.request.put('/api/vorlagen/reihenfolge', { data: { ids: ursprung } });
      expect(antwort.ok()).toBe(true);
    }
  }
});
