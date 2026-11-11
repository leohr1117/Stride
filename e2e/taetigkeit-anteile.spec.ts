import { expect, test, type Locator, type Page } from './uhr.ts';
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

interface AttributZeile {
  id: number;
  name: string;
  typ: string;
  archiviert: boolean;
}

async function koennen(seite: Page): Promise<AttributZeile[]> {
  const attribute = (await (await seite.request.get('/api/attribute')).json()) as AttributZeile[];
  return attribute.filter((attribut) => attribut.typ === 'attribut' && !attribut.archiviert);
}

async function setzeRegler(regler: Locator, wert: number): Promise<void> {
  await regler.evaluate((element, ziel) => {
    if (!(element instanceof HTMLInputElement)) {
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, String(ziel));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, wert);
  await expect(regler).toHaveValue(String(wert));
}

test('Plus und Abzug zeigen die Summe, speichern und öffnen sich wieder', async ({ page }, testInfo) => {
  const name = 'Feste Anteile';
  let id: number | null = null;
  try {
    await anmelden(page);
    await page.goto('/mehr/inhalte');
    const attribute = await koennen(page);
    const plus = attribute[0];
    const minus = attribute[1];
    const ruhend = attribute[2];
    if (!plus || !minus || !ruhend) {
      throw new Error('Zu wenige Attribute.');
    }
    await page.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
    const plusRegler = dialog.getByRole('slider', { name: `Anteil ${plus.name}` });
    const minusRegler = dialog.getByRole('slider', { name: `Anteil ${minus.name}` });
    const ruheRegler = dialog.getByRole('slider', { name: `Anteil ${ruhend.name}` });
    await expect(plusRegler).toBeVisible();
    await setzeRegler(plusRegler, 40);
    await setzeRegler(minusRegler, -30);
    await expect(plusRegler).toHaveAttribute('aria-valuetext', 'Plus 40 Prozent');
    await expect(minusRegler).toHaveAttribute('aria-valuetext', 'Abzug 30 Prozent');
    await expect(ruheRegler).toHaveAttribute('aria-valuetext', 'keine Wirkung');
    await expect(dialog.locator('span.zahl', { hasText: '−30 %' })).toBeVisible();
    const summe = dialog.locator('[data-summe]');
    await expect(summe).toContainText('Plus 40 % · Abzug 30 % · Rest 60 % ohne Attribut');

    const lage = await plusRegler.evaluate((element) => {
      const block = element.parentElement?.parentElement;
      const nameZeile = block?.querySelector('span.flex-1');
      const nameKasten = nameZeile?.getBoundingClientRect();
      const reglerKasten = element.getBoundingClientRect();
      return {
        breite: reglerKasten.width,
        hoehe: reglerKasten.height,
        reglerY: reglerKasten.y,
        nameUnten: nameKasten?.bottom ?? reglerKasten.y,
      };
    });
    expect(lage.breite).toBeGreaterThanOrEqual(240);
    expect(lage.hoehe).toBeGreaterThanOrEqual(48);
    expect(lage.reglerY).toBeGreaterThanOrEqual(lage.nameUnten - 1);
    await dialog.screenshot({ path: `tmp-test/taetigkeit-anteile/${testInfo.project.name}-formular.png` });

    await setzeRegler(plusRegler, 60);
    await setzeRegler(minusRegler, 50);
    const speichern = dialog.getByRole('button', { name: 'Speichern', exact: true });
    await expect(speichern).toBeEnabled();
    await speichern.click();
    await expect(dialog).toBeVisible();
    await expect(summe).toBeFocused();
    await expect(summe).toContainText('Zusammen höchstens 100 %.');

    await setzeRegler(plusRegler, 40);
    await setzeRegler(minusRegler, -30);
    await speichern.click();
    await expect(dialog).toBeHidden();

    const zeile = page.locator(`[data-taetigkeit="${name}"]`);
    await expect(zeile.locator('[data-rest="60"]')).toBeVisible();
    await expect(zeile.locator('[data-anteil="40"]')).toHaveCount(1);
    await expect(zeile).toContainText('−30 %');
    const liste = (await (await page.request.get('/api/vorlagen')).json()) as { id: number; name: string }[];
    id = liste.find((eintrag) => eintrag.name === name)?.id ?? null;
    expect(id).not.toBeNull();

    await zeile.getByRole('button', { name, exact: true }).click();
    const erneut = page.getByRole('dialog', { name: 'Tätigkeit bearbeiten' });
    await expect(erneut.getByRole('slider', { name: `Anteil ${plus.name}` })).toHaveValue('40');
    await expect(erneut.getByRole('slider', { name: `Anteil ${minus.name}` })).toHaveValue('-30');
    await expect(erneut.locator('[data-summe]')).toContainText('Rest 60 % ohne Attribut');
  } finally {
    if (id !== null) {
      await page.request.delete(`/api/vorlagen/${id}`);
    }
  }
});

test('Alte Tätigkeit bleibt im Verhältnis, wenn kein Regler sich bewegt', async ({ page }) => {
  let id: number | null = null;
  try {
    await anmelden(page);
    const attribute = await koennen(page);
    const erste = attribute[0];
    const zweite = attribute[1];
    const dritte = attribute[2];
    if (!erste || !zweite || !dritte) {
      throw new Error('Zu wenige Attribute.');
    }
    const gewichte = [
      { attributId: erste.id, gewicht: 39 },
      { attributId: zweite.id, gewicht: 38 },
      { attributId: dritte.id, gewicht: 23 },
    ];
    const antwort = await page.request.post('/api/vorlagen', {
      data: { name: 'Alte Anteile', icon: 'rocket', gewichte },
    });
    expect(antwort.ok()).toBe(true);
    const angelegt = (await antwort.json()) as { id: number; festeAnteile: boolean };
    id = angelegt.id;
    expect(angelegt.festeAnteile).toBe(false);

    await page.goto('/mehr/inhalte');
    await page.locator('[data-taetigkeit="Alte Anteile"]').getByRole('button', { name: 'Alte Anteile', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tätigkeit bearbeiten' });
    await expect(dialog.getByRole('slider', { name: `Anteil ${erste.name}` })).toHaveValue('39');
    await expect(dialog.getByRole('slider', { name: `Anteil ${zweite.name}` })).toHaveValue('38');
    await expect(dialog.getByRole('slider', { name: `Anteil ${dritte.name}` })).toHaveValue('23');
    await expect(dialog.locator('span.zahl', { hasText: '+39 %' })).toHaveCount(1);
    await expect(dialog.locator('span.zahl', { hasText: '+40 %' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeHidden();

    const listeAntwort = await page.request.get('/api/vorlagen');
    expect(listeAntwort.ok()).toBe(true);
    const liste = (await listeAntwort.json()) as {
      id: number;
      festeAnteile: boolean;
      gewichte: { attributId: number; gewicht: number }[];
      abzuege: unknown[];
    }[];
    const geladen = liste.find((eintrag) => eintrag.id === id);
    if (!geladen) {
      throw new Error('Die Tätigkeit fehlt in der Liste.');
    }
    expect(geladen.festeAnteile).toBe(false);
    expect(geladen.abzuege).toEqual([]);
    expect(geladen.gewichte.map((gewicht) => gewicht.gewicht).sort((a, b) => b - a)).toEqual([39, 38, 23]);
  } finally {
    if (id !== null) {
      await page.request.delete(`/api/vorlagen/${id}`);
    }
  }
});
