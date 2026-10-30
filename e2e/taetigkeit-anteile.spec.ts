import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const NAME = 'U21d Anteile';
const GEWICHTE = [
  { kennung: 'ansehen', gewicht: 50, prozent: 36 },
  { kennung: 'einfluss', gewicht: 30, prozent: 22 },
  { kennung: 'mut', gewicht: 30, prozent: 21 },
  { kennung: 'ressourcen', gewicht: 30, prozent: 21 },
] as const;

interface AttributZeile {
  id: number;
  kennung: string | null;
  name: string;
  farbe: string;
}

async function legeAn(seite: Page): Promise<{ id: number; text: string; farben: string[] }> {
  const attribute = (await (await seite.request.get('/api/attribute')).json()) as AttributZeile[];
  const nachKennung = new Map(attribute.map((attribut) => [attribut.kennung, attribut]));
  const gewichte = GEWICHTE.map((eintrag) => {
    const attribut = nachKennung.get(eintrag.kennung);
    if (!attribut) {
      throw new Error(`Attribut ${eintrag.kennung} fehlt.`);
    }
    return { attributId: attribut.id, gewicht: eintrag.gewicht };
  });
  const antwort = await seite.request.post('/api/vorlagen', {
    data: { name: NAME, icon: 'rocket', gewichte },
  });
  expect(antwort.ok()).toBe(true);
  const vorlage = (await antwort.json()) as { id: number; gewichte: { attributId: number; gewicht: number }[] };
  const nachId = new Map(attribute.map((attribut) => [attribut.id, attribut]));
  const gespeichert = vorlage.gewichte.filter((gewicht) => gewicht.gewicht > 0);
  expect(gespeichert.map((gewicht) => gewicht.gewicht)).toEqual([50, 30, 30, 30]);
  const prozente = [36, 22, 21, 21];
  const namen = gespeichert.map((gewicht) => nachId.get(gewicht.attributId)?.name ?? '?');
  const farben = gespeichert.map((gewicht) => nachId.get(gewicht.attributId)?.farbe ?? '');
  return {
    id: vorlage.id,
    text: namen.map((name, index) => `${name} ${prozente[index]} %`).join(' · '),
    farben,
  };
}

test('Tätigkeiten zeigen Prozent, die 100 ergeben, und gleich breite gleiche Farben', async ({ page }, testInfo) => {
  let id: number | null = null;
  try {
    await anmelden(page);
    const angelegt = await legeAn(page);
    id = angelegt.id;
    await page.goto('/mehr/inhalte');
    await expect(page.locator('main h1')).toHaveText('Tätigkeiten');
    const zeile = page.locator(`[data-taetigkeit="${NAME}"]`);
    if (!(await zeile.count())) {
      await page.getByRole('button', { name: /Alle anzeigen/ }).click();
    }
    await expect(zeile).toBeVisible();
    await expect(zeile.locator('[data-anteile-text]')).toHaveText(angelegt.text);
    await expect(zeile.locator('[data-anteile-text]')).not.toContainText('50');
    await expect(zeile.locator('[data-anteile-text]')).not.toContainText('30');

    const segmente = zeile.locator('[data-anteil]');
    await expect(segmente).toHaveCount(4);
    const gemessen = await segmente.evaluateAll((knoten) => {
      const balken = knoten[0]?.parentElement?.getBoundingClientRect().width ?? 0;
      return knoten.map((el) => {
        const stil = getComputedStyle(el);
        return {
          prozent: Number(el.getAttribute('data-anteil')),
          farbe: el.getAttribute('data-farbe'),
          breite: el.getBoundingClientRect().width,
          naht: stil.boxShadow !== 'none',
          balken,
        };
      });
    });
    const erwartet = [36, 22, 21, 21];
    expect(gemessen.map((eintrag) => eintrag.prozent)).toEqual(erwartet);
    expect(gemessen.map((eintrag) => eintrag.farbe)).toEqual(angelegt.farben);
    const balken = gemessen[0]?.balken ?? 0;
    expect(balken).toBeGreaterThan(100);
    for (const eintrag of gemessen) {
      expect(Math.abs(eintrag.breite - (balken * eintrag.prozent) / 100)).toBeLessThan(1.5);
    }
    const gelb = gemessen.filter((eintrag) => eintrag.farbe === '#facc15');
    expect(gelb).toHaveLength(2);
    expect(Math.abs((gelb[0]?.breite ?? 0) - (gelb[1]?.breite ?? 0))).toBeLessThan(1.5);
    for (let index = 0; index < gemessen.length; index++) {
      const gleich = gemessen[index]?.farbe !== '' && gemessen[index]?.farbe === gemessen[index + 1]?.farbe;
      expect(gemessen[index]?.naht).toBe(gleich);
    }

    await ohneSeitlichenUeberlauf(page);
    await zeile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp-bau/u21d/${testInfo.project.name}-liste.png` });
    await zeile.locator('[data-anteile]').screenshot({ path: `tmp-bau/u21d/${testInfo.project.name}-balken.png` });

    await zeile.getByRole('button', { name: `${NAME} bearbeiten` }).click();
    const dialog = page.getByRole('dialog', { name: 'Tätigkeit bearbeiten' });
    await expect(dialog).toBeVisible();
    const texte = await dialog.locator('span.zahl').allTextContents();
    let summe = 0;
    for (const text of texte) {
      const zahl = Number(text.replace('%', '').trim());
      if (!Number.isNaN(zahl)) {
        summe += zahl;
      }
    }
    expect(summe).toBe(100);
    const ansehenProzent = dialog.locator('span.zahl', { hasText: '36 %' });
    await expect(ansehenProzent).toHaveCount(1);
    await ansehenProzent.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(ansehenProzent).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-bau/u21d/${testInfo.project.name}-dialog.png` });
  } finally {
    if (id !== null) {
      await page.request.delete(`/api/vorlagen/${id}`);
    }
  }
});
