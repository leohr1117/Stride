import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
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
  verfallBelastung: string;
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

test.beforeAll(() => {
  fs.mkdirSync(BILD, { recursive: true });
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
  await page.goto('/ziele');
  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Vision', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vision', exact: true });
  await expect(dialog.getByRole('button', { name: 'Beispiele', exact: true })).toHaveCount(0);
  const chip = dialog.getByRole('button', { name: 'Finanziell frei' });
  await chip.scrollIntoViewIfNeeded();
  await expect(dialog.getByText(/XP beim Erreichen:/)).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `${BILD}/${testInfo.project.name}-vision.png` });
  await chip.click();
  const feld = dialog.getByRole('textbox', { name: 'Eigener' });
  await expect(feld).toHaveValue('2000');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await feld.fill('1500');
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
});

test('Verfall-Stufen setzen das Feld, ein eigener Prozentwert wird als Stufe gespeichert', async ({ page }, testInfo) => {
  await anmelden(page);
  const einstellungen = await api<{ funktionen: { verfallKoennen?: boolean } }>(page, '/api/einstellungen', 'GET');
  const verfallWarAn = einstellungen.funktionen.verfallKoennen === true;
  const liste = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
  const ziel = liste.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert);
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }
  try {
    if (!verfallWarAn) {
      await api(page, '/api/einstellungen', 'PATCH', { funktionen: { verfallKoennen: true } });
    }
    await page.goto('/koennen');
    await page.getByRole('button', { name: `Aktionen für ${ziel.name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: ziel.name, exact: true });
    const nicht = dialog.getByRole('group', { name: 'Verlust bei Nichtnutzung' });
    const zeit = dialog.getByRole('group', { name: 'Verlust über Zeit' });
    await nicht.scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `${BILD}/${testInfo.project.name}-verfall.png` });
    const mittel = nicht.getByRole('button', { name: 'Mittel' });
    await mittel.click();
    const feld = nicht.getByRole('textbox');
    await expect(feld).toHaveValue('10');
    await expect(mittel).toHaveAttribute('aria-pressed', 'true');
    await feld.fill('20');
    await expect(mittel).toHaveAttribute('aria-pressed', 'false');
    const leicht = zeit.getByRole('button', { name: 'Leicht' });
    await leicht.click();
    const zeitFeld = zeit.getByRole('textbox');
    await expect(zeitFeld).toHaveValue('5');
    await expect(leicht).toHaveAttribute('aria-pressed', 'true');
    await zeitFeld.fill('25');
    await expect(leicht).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toBeHidden();
    const nachher = await api<AttributZeile[]>(page, '/api/attribute', 'GET');
    const gespeichert = nachher.find((eintrag) => eintrag.id === ziel.id);
    expect(gespeichert?.verfallBelastung).toBe('stark');
    expect(gespeichert?.verfallZeit).toBe('stark');
  } finally {
    await api(page, `/api/attribute/${ziel.id}`, 'PATCH', {
      verfallBelastung: ziel.verfallBelastung,
      verfallZeit: ziel.verfallZeit,
    }).catch(() => undefined);
    if (!verfallWarAn) {
      await api(page, '/api/einstellungen', 'PATCH', { funktionen: { verfallKoennen: false } }).catch(() => undefined);
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
  const stunde = dauer.getByRole('button', { name: '1 Std', exact: true });
  await stunde.click();
  const feld = dauer.getByRole('textbox', { name: 'Eigene' });
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
