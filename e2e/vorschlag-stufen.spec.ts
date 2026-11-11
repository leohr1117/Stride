import fs from 'node:fs';
import { expect, test, type Locator, type Page } from './uhr.ts';
import { ATTRIBUT_KATALOG } from '../shared/features/attribute/attributKatalog.ts';
import type { AttributKennung } from '../shared/spiel/begriffe.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const BILD = 'tmp-test/vorschlag-stufen';

interface AttributZeile {
  id: number;
  typ: 'attribut' | 'status';
  name: string;
  kennung: AttributKennung | null;
  archiviert: boolean;
  verfallZeit: string;
  level: { level: number };
}

async function api<T>(seite: Page, pfad: string, methode: string, koerper?: unknown): Promise<T> {
  const antwort = await seite.request.fetch(pfad, { method: methode, data: koerper });
  const text = await antwort.text();
  if (!antwort.ok()) {
    throw new Error(`${methode} ${pfad} ${antwort.status()}: ${text.slice(0, 180)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const VERLUST_BILD = 'tmp-test/verlust-stufen';

async function stufenZeile(gruppe: Locator, namen: readonly string[]): Promise<void> {
  const knoepfe = gruppe.getByRole('button');
  await expect(knoepfe).toHaveCount(namen.length);
  for (let index = 0; index < namen.length; index += 1) {
    await expect(knoepfe.nth(index)).toHaveAttribute('aria-label', namen[index] ?? '');
  }
  const kaesten = await gruppe.locator('button, input').evaluateAll((knoten) =>
    knoten.map((knoten) => {
      const kasten = knoten.getBoundingClientRect();
      return { oben: kasten.top, links: kasten.left, rechts: kasten.right };
    }),
  );
  expect(kaesten).toHaveLength(namen.length + 1);
  const oben = kaesten[0]?.oben ?? 0;
  for (const kasten of kaesten) {
    expect(Math.abs(kasten.oben - oben)).toBeLessThan(2);
  }
  for (let index = 1; index < kaesten.length; index += 1) {
    const vorher = kaesten[index - 1];
    const aktuell = kaesten[index];
    expect(vorher).toBeTruthy();
    expect(aktuell).toBeTruthy();
    expect(aktuell!.links).toBeGreaterThan((vorher?.rechts ?? 0) - 1);
  }
}

test.beforeAll(() => {
  fs.mkdirSync(BILD, { recursive: true });
  fs.mkdirSync(VERLUST_BILD, { recursive: true });
});

test('Ein Vision-Vorschlag setzt das Level, ein eigener Wert bleibt gespeichert', async ({ page }, testInfo) => {
  const titel = `Vorschlag Vision ${testInfo.project.name}`;
  await anmelden(page);
  const vorher = await api<{ visionen: { id: number; titel: string }[] }>(page, '/api/ziele', 'GET');
  for (const vision of vorher.visionen) {
    if (vision.titel === titel) {
      await api(page, `/api/visionen/${vision.id}`, 'DELETE');
    }
  }
  const hell = testInfo.project.name === 'handy';
  let darstellung: { stil: string; glimmen: boolean; eigeneFarben: boolean; primaer: string; akzent: string; hintergrund: string } | null =
    null;
  try {
    if (hell) {
      darstellung = await api<{
        stil: string;
        glimmen: boolean;
        eigeneFarben: boolean;
        primaer: string;
        akzent: string;
        hintergrund: string;
      }>(page, '/api/einstellungen', 'GET');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width: 390, height: 844 });
      await api(page, '/api/einstellungen', 'PATCH', { stil: 'standard', farbenZuruecksetzen: true });
    }
    await page.goto('/ziele');
    await page.getByRole('button', { name: 'Neu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Vision', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Vision', exact: true });
    await expect(dialog.getByRole('button', { name: 'Beispiele', exact: true })).toHaveCount(0);
    const gruppe = dialog.getByRole('group', { name: 'Level', exact: true });
    const chip = gruppe.getByRole('button', { name: '2.000', exact: true });
    const feld = dialog.getByRole('textbox', { name: 'Eigenes Level', exact: true });
    await expect(feld).toHaveAttribute('placeholder', 'Eigener');
    await expect(dialog.getByText('Eigener', { exact: true })).toHaveCount(0);
    await expect(gruppe.getByText('Finanziell frei')).toHaveCount(0);
    await expect(gruppe.getByText('Gesund und fit bis ins Alter')).toHaveCount(0);
    await expect(gruppe.getByText('Menschen auf den Mars bringen')).toHaveCount(0);
    await stufenZeile(gruppe, ['300', '2.000', '20.000']);
    const hoehen = await gruppe.locator('button, input').evaluateAll((knoten) =>
      knoten.map((knoten) => knoten.getBoundingClientRect().height),
    );
    expect(hoehen).toHaveLength(4);
    for (const hoehe of hoehen) {
      expect(Math.abs(hoehe - 48)).toBeLessThan(1);
    }
    const texteGanz = await gruppe.locator('button span').evaluateAll((knoten) =>
      knoten.every((knoten) => knoten.scrollWidth <= knoten.clientWidth + 1),
    );
    expect(texteGanz).toBe(true);
    const platzhalterPasst = await feld.evaluate((element) => {
      const stil = getComputedStyle(element);
      const messer = document.createElement('span');
      messer.style.font = `12px ${stil.fontFamily}`;
      messer.style.position = 'absolute';
      messer.style.visibility = 'hidden';
      messer.textContent = element.placeholder;
      document.body.appendChild(messer);
      const breite = messer.getBoundingClientRect().width;
      messer.remove();
      const innen = element.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
      return breite <= innen + 1;
    });
    expect(platzhalterPasst).toBe(true);
    const hinweis = dialog.getByText(/XP beim Erreichen:/);
    await expect(hinweis).toBeVisible();
    const hinweisKasten = await hinweis.boundingBox();
    const gruppenKasten = await gruppe.boundingBox();
    expect(hinweisKasten).not.toBeNull();
    expect(gruppenKasten).not.toBeNull();
    expect(hinweisKasten!.y).toBeGreaterThan(gruppenKasten!.y + gruppenKasten!.height - 1);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `${BILD}/${testInfo.project.name}-vision.png` });
    if (hell) {
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const stil = getComputedStyle(document.documentElement);
            return `${stil.getPropertyValue('--flaeche').trim()}|${stil.getPropertyValue('--gefahr').trim()}`;
          }),
        )
        .toBe('#ffffff|#c62828');
      await page.evaluate(
        () => new Promise((loesen) => requestAnimationFrame(() => requestAnimationFrame(() => loesen(undefined)))),
      );
      await page.waitForTimeout(400);
      fs.mkdirSync('tmp-test/vision-level', { recursive: true });
      await page.screenshot({ path: 'tmp-test/vision-level/390-vision-anlegen.png' });
      await dialog.screenshot({ path: 'tmp-test/vision-level/390-vision-anlegen-dialog.png' });
      await gruppe.locator('..').screenshot({ path: 'tmp-test/vision-level/390-vision-level.png' });
    }
    await chip.click();
    await expect(feld).toHaveValue('2000');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const gross = gruppe.getByRole('button', { name: '20.000', exact: true });
    await gross.click();
    await expect(feld).toHaveValue('20000');
    await expect(gross).toHaveAttribute('aria-pressed', 'true');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    const wertPasst = await feld.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(wertPasst).toBe(true);
    await feld.fill('1500');
    await expect(gross).toHaveAttribute('aria-pressed', 'false');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('textbox', { name: 'Wunsch', exact: true }).fill(titel);
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeHidden();
    const nachher = await api<{ visionen: { id: number; titel: string; level: number | null }[] }>(page, '/api/ziele', 'GET');
    const gespeichert = nachher.visionen.find((vision) => vision.titel === titel);
    expect(gespeichert?.level).toBe(1500);
    if (gespeichert) {
      await api(page, `/api/visionen/${gespeichert.id}`, 'DELETE');
    }
  } finally {
    if (darstellung) {
      await api(
        page,
        '/api/einstellungen',
        'PATCH',
        darstellung.eigeneFarben
          ? {
              stil: darstellung.stil,
              glimmen: darstellung.glimmen,
              primaer: darstellung.primaer,
              akzent: darstellung.akzent,
              hintergrund: darstellung.hintergrund,
            }
          : { stil: darstellung.stil, glimmen: darstellung.glimmen, farbenZuruecksetzen: true },
      ).catch(() => undefined);
    }
  }
});

test('Verfall-Stufen setzen das Feld, ein eigener Prozentwert wird als Stufe gespeichert', async ({ page }, testInfo) => {
  await anmelden(page);
  const einstellungen = await api<{ funktionen: { verfallKoennen?: boolean } }>(page, '/api/einstellungen', 'GET');
  const verfallWarAn = einstellungen.funktionen.verfallKoennen === true;
  const liste = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
  const ziel =
    liste.find((eintrag) => eintrag.name === 'Körper' && eintrag.typ === 'attribut' && !eintrag.archiviert) ??
    liste.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert);
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }
  const hell = testInfo.project.name === 'handy';
  let darstellung: { stil: string; glimmen: boolean; eigeneFarben: boolean; primaer: string; akzent: string; hintergrund: string } | null =
    null;
  try {
    if (!verfallWarAn) {
      await api(page, '/api/einstellungen', 'PATCH', { funktionen: { verfallKoennen: true } });
    }
    if (hell) {
      darstellung = await api<{
        stil: string;
        glimmen: boolean;
        eigeneFarben: boolean;
        primaer: string;
        akzent: string;
        hintergrund: string;
      }>(page, '/api/einstellungen', 'GET');
      await page.emulateMedia({ colorScheme: 'light' });
      await api(page, '/api/einstellungen', 'PATCH', { stil: 'standard', farbenZuruecksetzen: true });
    }
    await page.goto('/koennen');
    await page.getByRole('button', { name: `Aktionen für ${ziel.name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: ziel.name, exact: true });
    await expect(dialog.getByText('Verlust bei Nichtnutzung', { exact: true })).toHaveCount(0);
    const zeit = dialog.getByRole('group', { name: 'Verlust über Zeit' });
    await zeit.scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await stufenZeile(zeit, ['Aus', '5 %', '10 %', '25 %']);
    await page.screenshot({ path: `${BILD}/${testInfo.project.name}-verfall.png` });
    const breite = testInfo.project.name === 'desktop' ? '1440' : '390';
    fs.mkdirSync('tmp-test/attribut-verfall', { recursive: true });
    await dialog.screenshot({ path: `tmp-test/attribut-verfall/${breite}-dialog.png` });
    if (hell) {
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const stil = getComputedStyle(document.documentElement);
            return `${stil.getPropertyValue('--flaeche').trim()}|${stil.getPropertyValue('--gefahr').trim()}`;
          }),
        )
        .toBe('#ffffff|#c62828');
      const abschnitt = dialog.locator('section').filter({ hasText: 'Verlust über Zeit' });
      await abschnitt.scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise((loesen) => requestAnimationFrame(() => requestAnimationFrame(() => loesen(undefined)))),
      );
      await page.screenshot({ path: `${VERLUST_BILD}/390-verlust.png` });
      await page.screenshot({ path: `${VERLUST_BILD}/390-verlust-ganz.png`, fullPage: true });
      await abschnitt.screenshot({ path: `${VERLUST_BILD}/390-verlust-abschnitt.png` });
    }
    const leicht = zeit.getByRole('button', { name: '5 %', exact: true });
    await leicht.click();
    const zeitFeld = zeit.getByRole('textbox');
    await expect(zeitFeld).toHaveValue('5');
    await expect(leicht).toHaveAttribute('aria-pressed', 'true');
    await zeitFeld.fill('7');
    await expect(leicht).toHaveAttribute('aria-pressed', 'false');
    await expect(zeitFeld).toHaveValue('7');
    await zeitFeld.fill('25');
    await expect(leicht).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeHidden();
    const nachher = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
    const gespeichert = nachher.find((eintrag) => eintrag.id === ziel.id);
    expect(gespeichert?.verfallZeit).toBe('stark');
  } finally {
    await api(page, `/api/attribute/${ziel.id}`, 'PATCH', {
      verfallZeit: ziel.verfallZeit,
    }).catch(() => undefined);
    if (!verfallWarAn) {
      await api(page, '/api/einstellungen', 'PATCH', { funktionen: { verfallKoennen: false } }).catch(() => undefined);
    }
    if (darstellung) {
      await api(
        page,
        '/api/einstellungen',
        'PATCH',
        darstellung.eigeneFarben
          ? {
              stil: darstellung.stil,
              glimmen: darstellung.glimmen,
              primaer: darstellung.primaer,
              akzent: darstellung.akzent,
              hintergrund: darstellung.hintergrund,
            }
          : { stil: darstellung.stil, glimmen: darstellung.glimmen, farbenZuruecksetzen: true },
      ).catch(() => undefined);
    }
  }
});

test('Dauer-Chips setzen das Feld, eine eigene Stundenzahl bleibt gespeichert', async ({ page }, testInfo) => {
  const name = `Vorschlag Dauer ${testInfo.project.name}`;
  await anmelden(page);
  const vorher = await api<{ id: number; name: string }[]>(page, '/api/basis', 'GET');
  for (const aufgabe of vorher) {
    if (aufgabe.name === name) {
      await api(page, `/api/basis/${aufgabe.id}`, 'DELETE');
    }
  }
  await page.goto('/basis');
  await page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
  const dauer = dialog.getByRole('group', { name: 'Dauer', exact: true });
  await dauer.scrollIntoViewIfNeeded();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `${BILD}/${testInfo.project.name}-basis.png` });
  await expect(dauer.getByRole('button')).toHaveCount(7);
  await expect(dauer.locator('.grid')).toHaveClass(/grid-cols-3/);
  const feld = dauer.getByRole('textbox', { name: 'Eigene' });
  await expect(feld).toBeVisible();
  const viertel = dauer.getByRole('button', { name: '15 Min', exact: true });
  await viertel.click();
  await expect(feld).toHaveValue('0.25');
  await expect(feld).not.toBeFocused();
  await expect(viertel).toBeFocused();
  const stunde = dauer.getByRole('button', { name: '1 Std', exact: true });
  await stunde.click();
  await expect(feld).toHaveValue('1');
  await expect(stunde).toHaveAttribute('aria-pressed', 'true');
  await feld.fill('3');
  await expect(stunde).toHaveAttribute('aria-pressed', 'false');
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  const taetigkeit = dialog.getByRole('combobox', { name: 'Tätigkeit', exact: true });
  const wert = await taetigkeit.evaluate((el) => {
    if (!(el instanceof HTMLSelectElement)) {
      return '';
    }
    return [...el.options].find((option) => !option.disabled && option.value !== '')?.value ?? '';
  });
  expect(wert).not.toBe('');
  await taetigkeit.selectOption(wert);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  const nachher = await api<{ id: number; name: string; stunden: number | null }[]>(page, '/api/basis', 'GET');
  const gespeichert = nachher.find((aufgabe) => aufgabe.name === name);
  expect(gespeichert?.stunden).toBe(3);
  if (gespeichert) {
    await api(page, `/api/basis/${gespeichert.id}`, 'DELETE');
  }
});

test('Ein geschätztes Level kommt aus dem Vorschlag und ein eigener Wert bleibt gespeichert', async ({ page }) => {
  await anmelden(page);
  const liste = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
  const nachKennung = new Map(liste.filter((eintrag) => eintrag.kennung !== null).map((eintrag) => [eintrag.kennung, eintrag]));
  const katalog = ATTRIBUT_KATALOG.filter((vorlage) => vorlage.typ === 'attribut');
  let vorlage = katalog.find((eintrag) => !nachKennung.has(eintrag.kennung));
  let vorher = vorlage ? undefined : katalog.map((eintrag) => nachKennung.get(eintrag.kennung)).find((eintrag) => eintrag?.archiviert);
  if (!vorlage && vorher?.kennung) {
    vorlage = katalog.find((eintrag) => eintrag.kennung === vorher?.kennung);
  }
  let selbstArchiviert = false;
  if (!vorlage) {
    vorher = liste.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert && eintrag.kennung !== null);
    vorlage = katalog.find((eintrag) => eintrag.kennung === vorher?.kennung);
    expect(vorlage).toBeTruthy();
    if (!vorlage || !vorher) {
      return;
    }
    await api(page, `/api/attribute/${vorher.id}`, 'PATCH', { archiviert: true });
    selbstArchiviert = true;
  }
  const suchtext = vorher?.name ?? vorlage.name;
  const speicherKnopf = vorher ? 'Wiederherstellen' : 'Hinzufügen';
  let geaendert = false;
  try {
    await page.goto('/koennen');
    await page.getByRole('button', { name: '+ Attribut hinzufügen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Attribut hinzufügen', exact: true });
    const karte = dialog.locator('.rounded-xl').filter({ hasText: suchtext }).first();
    await karte.scrollIntoViewIfNeeded();
    await karte.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await karte.getByRole('radio', { name: 'Selbst schätzen', exact: true }).click();
    const chip = karte.getByRole('button', { name: '100', exact: true });
    await chip.click();
    const feld = karte.getByRole('textbox', { name: 'Eigener' });
    await expect(feld).toHaveValue('100');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await feld.fill('42');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await karte.getByRole('button', { name: speicherKnopf, exact: true }).click();
    geaendert = true;
    await expect(dialog).toBeHidden();
    const nachher = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
    const gespeichert = nachher.find((eintrag) => eintrag.kennung === vorlage.kennung && !eintrag.archiviert);
    expect(gespeichert?.level.level).toBe(42);
    if (!vorher && gespeichert) {
      await api(page, `/api/attribute/${gespeichert.id}`, 'DELETE');
      geaendert = false;
    }
  } finally {
    if (!vorher && geaendert) {
      const reste = await api<AttributZeile[]>(page, '/api/attribute', 'GET').catch(() => []);
      const neu = reste.find((eintrag) => eintrag.kennung === vorlage.kennung && !eintrag.archiviert);
      if (neu) {
        await api(page, `/api/attribute/${neu.id}`, 'DELETE').catch(() => undefined);
      }
    } else if (geaendert && vorher) {
      await api(page, `/api/attribute/${vorher.id}`, 'PATCH', { archiviert: true }).catch(() => undefined);
      await api(page, '/api/attribute', 'POST', { kennung: vorher.kennung, modus: 'level', level: vorher.level.level }).catch(() => undefined);
      if (vorher.archiviert) {
        await api(page, `/api/attribute/${vorher.id}`, 'PATCH', { archiviert: true }).catch(() => undefined);
      }
    } else if (selbstArchiviert && vorher) {
      await api(page, `/api/attribute/${vorher.id}`, 'PATCH', { archiviert: false }).catch(() => undefined);
    }
  }
});
