import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const NAME = 'Anteile Test';
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
    text: `Stärkt: ${namen.map((name, index) => `${name} ${prozente[index]} %`).join(' · ')}`,
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
    await expect(page.getByRole('button', { name: /Alle anzeigen/ })).toHaveCount(0);
    await expect(zeile).toBeVisible();
    const nebenzeile = zeile.locator('[data-anteile-text]');
    await expect(nebenzeile).toHaveAttribute('aria-label', angelegt.text);
    await page.evaluate(() => document.fonts.ready);
    await expect(async () => {
      const stand = await nebenzeile.evaluate((el) => ({
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ueberlauf: el.scrollWidth - el.clientWidth,
        zeilen: el.getClientRects().length,
        hoehe: el.getBoundingClientRect().height,
        nowrap: getComputedStyle(el).whiteSpace,
      }));
      expect(stand.ueberlauf).toBeLessThanOrEqual(1);
      expect(stand.zeilen).toBe(1);
      expect(stand.nowrap).toBe('nowrap');
      expect(stand.hoehe).toBeGreaterThanOrEqual(16);
      expect(stand.hoehe).toBeLessThanOrEqual(20);
      expect(stand.text === angelegt.text || stand.text.endsWith('…')).toBe(true);
      if (stand.text !== angelegt.text) {
        const stamm = stand.text.replace(/…$/, '').replace(/[\s·]+$/u, '');
        expect(angelegt.text.startsWith(stamm)).toBe(true);
        const danach = angelegt.text.slice(stamm.length);
        expect(danach === '' || /^[\s·]/.test(danach)).toBe(true);
      }
      if (testInfo.project.name === 'handy') {
        expect(stand.text.endsWith('…')).toBe(true);
        expect(stand.text.length).toBeLessThan(angelegt.text.length);
      }
    }).toPass();
    await expect(nebenzeile).not.toContainText('50');
    await expect(nebenzeile).not.toContainText('30');
    expect(angelegt.text).not.toContain('50');
    expect(angelegt.text).not.toContain('30');

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
    await page.screenshot({ path: `tmp-test/taetigkeit-anteile/${testInfo.project.name}-liste.png` });
    await zeile.locator('[data-anteile]').screenshot({ path: `tmp-test/taetigkeit-anteile/${testInfo.project.name}-balken.png` });

    await zeile.getByRole('button', { name: NAME, exact: true }).click();
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
    await page.screenshot({ path: `tmp-test/taetigkeit-anteile/${testInfo.project.name}-dialog.png` });
  } finally {
    if (id !== null) {
      await page.request.delete(`/api/vorlagen/${id}`);
    }
  }
});
