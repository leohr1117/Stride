import { expect, test, type Locator, type Page } from '@playwright/test';
import { ATTRIBUT_KATALOG } from '../shared/features/attribute/attributKatalog.ts';
import { erscheinungAus } from '../shared/features/darstellung/paletten.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const FOLGE_NAME = 'Folgeprobe';
const FOLGE_TRIO = { primaer: '#d0d0d0', akzent: '#9a9a9a', hintergrund: '#141414' };

interface AttributZeile {
  id: number;
  typ: 'attribut' | 'status';
  name: string;
  kennung: string | null;
  archiviert: boolean;
}

interface KnotenZeile {
  titel: string;
  freigeschaltetAm: string | null;
  loeschbar: boolean;
}

interface FaehigkeitZeile {
  id: number;
  name: string;
  archiviert: boolean;
  knoten: KnotenZeile[];
}

interface Stand {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  eigeneFarben: boolean;
  glimmen: boolean;
  funktionen: Record<string, boolean>;
  paletten: { id: string; name: string }[];
}

async function oben(ziel: Locator): Promise<number> {
  const kasten = await ziel.boundingBox();
  expect(kasten).not.toBeNull();
  return kasten?.y ?? 0;
}

async function lese(seite: Page): Promise<Stand> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as Stand;
}

async function attribute(seite: Page): Promise<AttributZeile[]> {
  const antwort = await seite.request.get('/api/attribute');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as AttributZeile[];
}

function muster(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function knotenKnopf(seite: Page, titel: string): Locator {
  return seite.locator('.baum-karte').getByRole('button', {
    name: new RegExp(`^\\d+\\s+${muster(titel)}$`),
  });
}

async function katalogZeile(
  seite: Page,
  typ: AttributZeile['typ'],
  liste: AttributZeile[],
): Promise<{ name: string; wiederherstellen: boolean; archivId: number | null }> {
  const belegt = new Set(liste.filter((eintrag) => eintrag.typ === typ).map((eintrag) => eintrag.kennung));
  const frei = ATTRIBUT_KATALOG.find((vorlage) => vorlage.typ === typ && !belegt.has(vorlage.kennung));
  if (frei) {
    return { name: frei.name, wiederherstellen: false, archivId: null };
  }
  const schonArchiv = liste.find((eintrag) => eintrag.typ === typ && eintrag.archiviert && eintrag.kennung !== null);
  if (schonArchiv) {
    return { name: schonArchiv.name, wiederherstellen: true, archivId: null };
  }
  const ziel = liste.find((eintrag) => eintrag.typ === typ && !eintrag.archiviert && eintrag.kennung !== null);
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return { name: '', wiederherstellen: false, archivId: null };
  }
  const antwort = await seite.request.patch(`/api/attribute/${ziel.id}`, { data: { archiviert: true } });
  expect(antwort.ok()).toBe(true);
  return { name: ziel.name, wiederherstellen: true, archivId: ziel.id };
}

async function katalogZurueck(seite: Page, id: number | null): Promise<void> {
  if (id === null) {
    return;
  }
  const antwort = await seite.request.patch(`/api/attribute/${id}`, { data: { archiviert: false } });
  expect(antwort.ok()).toBe(true);
}

test('Weitere Dialoge folgen der festen Reihenfolge', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const bild = (name: string) => page.screenshot({ path: `tmp-test/dialog-folge/${testInfo.project.name}-${name}.png` });
  await anmelden(page);
  const anfang = await lese(page);
  const archivIds: number[] = [];
  let paletteId: string | null = null;

  try {
    const schalter = await page.request.patch('/api/einstellungen', {
      data: { funktionen: { ...anfang.funktionen, verfallKoennen: true, verfallHaben: false } },
    });
    expect(schalter.ok()).toBe(true);

    await page.goto('/charakter');
    await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
    const klassen = page.getByRole('dialog', { name: 'Klassen und Titel' });
    const tabelle = klassen.locator('table');
    const satz = klassen.getByText('Fett ist dein stärkstes Können. Der Beiname folgt dem zweitstärksten.', { exact: true });
    const tabelleKasten = await tabelle.boundingBox();
    const satzKasten = await satz.boundingBox();
    expect(tabelleKasten && satzKasten && tabelleKasten.y + tabelleKasten.height <= satzKasten.y + 1).toBe(true);
    expect(await oben(satz)).toBeLessThan(await oben(klassen.getByText(/bis Level/)));
    await ohneSeitlichenUeberlauf(page);
    await bild('klassen');
    await klassen.getByRole('button', { name: 'Schließen' }).click();

    const liste = await attribute(page);
    const koennen = liste.find((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert);
    const haben = liste.find((eintrag) => eintrag.typ === 'status' && !eintrag.archiviert);
    expect(koennen && haben).toBeTruthy();
    if (!koennen || !haben) {
      return;
    }

    await page.goto('/koennen');
    await page.getByRole('button', { name: `Aktionen für ${koennen.name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
    const koennenDialog = page.getByRole('dialog', { name: koennen.name, exact: true });
    const verfall = koennenDialog.getByRole('heading', { name: 'Verfall', exact: true });
    const nichtnutzung = koennenDialog.getByText('Verlust bei Nichtnutzung', { exact: true });
    const zeit = koennenDialog.getByText('Verlust über Zeit', { exact: true });
    expect(await oben(verfall)).toBeLessThan(await oben(nichtnutzung));
    expect(await oben(nichtnutzung)).toBeLessThan(await oben(zeit));
    await expect(koennenDialog.getByRole('textbox', { name: 'Name' })).toHaveCount(0);
    const schalterZiel = koennenDialog.getByRole('switch', { name: 'Zu niedrig senkt XP anderer Attribute' });
    const zielWarAn = (await schalterZiel.getAttribute('aria-checked')) === 'true';
    if (!zielWarAn) {
      await schalterZiel.click();
    }
    await expect(koennenDialog.getByRole('combobox', { name: 'Ziel' })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('attribut');
    await koennenDialog.getByRole('button', { name: 'Schließen' }).click();
    if (!zielWarAn) {
      const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
      await expect(frage).toBeVisible();
      await frage.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    }
    await expect(koennenDialog).toBeHidden();

    await page.goto('/haben');
    await page.getByRole('button', { name: haben.name, exact: true }).click();
    const habenDialog = page.getByRole('dialog', { name: haben.name, exact: true });
    await expect(habenDialog.getByRole('heading', { name: 'Verfall', exact: true })).toHaveCount(0);
    await expect(habenDialog.getByText('Verlust bei Nichtnutzung')).toHaveCount(0);
    await habenDialog.getByRole('button', { name: 'Schließen' }).click();

    const koennenKatalog = await katalogZeile(page, 'attribut', await attribute(page));
    if (koennenKatalog.archivId !== null) {
      archivIds.push(koennenKatalog.archivId);
    }
    await page.goto('/koennen');
    await page.getByRole('button', { name: '+ Attribut hinzufügen', exact: true }).click();
    const katalog = page.getByRole('dialog', { name: 'Attribut hinzufügen', exact: true });
    const karte = katalog.locator('.rounded-xl').filter({ hasText: koennenKatalog.name }).first();
    await karte.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(karte.getByText('Selbst schätzen', { exact: true })).toBeVisible();
    if (koennenKatalog.wiederherstellen) {
      await expect(karte.getByRole('button', { name: 'Wiederherstellen', exact: true })).toBeVisible();
    } else {
      await expect(karte.getByText('Bei Level 1 starten', { exact: true })).toBeVisible();
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('katalog');
    await katalog.getByRole('button', { name: 'Schließen' }).click();
    await katalogZurueck(page, koennenKatalog.archivId);

    const habenKatalog = await katalogZeile(page, 'status', await attribute(page));
    if (habenKatalog.archivId !== null) {
      archivIds.push(habenKatalog.archivId);
    }
    await page.goto('/haben');
    await page.getByRole('button', { name: '+ Attribut hinzufügen', exact: true }).click();
    const habenKatalogDialog = page.getByRole('dialog', { name: 'Attribut hinzufügen', exact: true });
    await expect(habenKatalogDialog.locator('.rounded-xl').filter({ hasText: habenKatalog.name }).first()).toBeVisible();
    await habenKatalogDialog.getByRole('button', { name: 'Schließen' }).click();
    await katalogZurueck(page, habenKatalog.archivId);

    await page.goto('/faehigkeiten');
    await page.getByRole('button', { name: /Fähigkeit anlegen/ }).click();
    const faehigkeit = page.getByRole('dialog', { name: 'Fähigkeit', exact: true });
    expect(await oben(faehigkeit.getByRole('textbox', { name: 'Titel' }))).toBeLessThan(
      await oben(faehigkeit.getByRole('textbox', { name: 'Beschreibung' })),
    );
    await expect(faehigkeit.getByText('Symbol', { exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('faehigkeit');
    await faehigkeit.getByRole('button', { name: 'Schließen' }).click();

    const baum = await page.evaluate(async () => {
      const antwort = await fetch('/api/faehigkeiten');
      const daten = (await antwort.json()) as FaehigkeitZeile[];
      return daten.find((eintrag) => eintrag.name === 'Programmieren' && !eintrag.archiviert) ?? null;
    });
    expect(baum).toBeTruthy();
    if (!baum) {
      return;
    }
    const offen = baum.knoten.find((knoten) => knoten.freigeschaltetAm !== null);
    const gesperrt = baum.knoten.find((knoten) => knoten.titel === 'Release bauen' && knoten.freigeschaltetAm === null);
    expect(offen && gesperrt).toBeTruthy();
    if (!offen || !gesperrt) {
      return;
    }

    await page.goto(`/faehigkeiten/${baum.id}`);
    const offenKnopf = knotenKnopf(page, offen.titel);
    await offenKnopf.scrollIntoViewIfNeeded();
    await offenKnopf.click();
    const offenDialog = page.getByRole('dialog', { name: offen.titel, exact: true });
    await offenDialog.getByRole('button', { name: `Aktionen für ${offen.titel}`, exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Zurücknehmen', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await offenDialog.getByRole('button', { name: 'Schließen' }).click();

    const gesperrtKnopf = knotenKnopf(page, gesperrt.titel);
    await gesperrtKnopf.scrollIntoViewIfNeeded();
    await gesperrtKnopf.click();
    const knotenDialog = page.getByRole('dialog', { name: gesperrt.titel, exact: true });
    await expect(knotenDialog.getByRole('button', { name: /Freischalten/ })).toBeVisible();
    await knotenDialog.getByRole('button', { name: `Aktionen für ${gesperrt.titel}`, exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
    if (gesperrt.loeschbar) {
      await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await ohneSeitlichenUeberlauf(page);
    await bild('knoten');
    await knotenDialog.getByRole('button', { name: 'Darunter anlegen', exact: true }).click();
    const neu = page.getByRole('dialog', { name: 'Knoten', exact: true });
    expect(await oben(neu.getByRole('textbox', { name: 'Titel' }))).toBeLessThan(
      await oben(neu.getByRole('textbox', { name: 'Beschreibung' })),
    );
    await ohneSeitlichenUeberlauf(page);
    await bild('knoten-neu');
    await neu.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/basis');
    await page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true }).click();
    const basis = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
    const basisFelder = [
      basis.getByRole('textbox', { name: 'Name', exact: true }),
      basis.getByText('Symbol', { exact: true }),
      basis.getByRole('combobox', { name: 'Projekt', exact: true }),
      basis.getByRole('combobox', { name: 'Tätigkeit', exact: true }),
      basis.getByText('Dauer', { exact: true }),
    ];
    let zuletzt = -1;
    for (const feld of basisFelder) {
      const y = await oben(feld);
      expect(y).toBeGreaterThan(zuletzt);
      zuletzt = y;
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('basis');
    await basis.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/mehr/darstellung/paletten');
    await page.getByRole('button', { name: '+ Palette anlegen', exact: true }).click();
    const palette = page.getByRole('dialog', { name: 'Palette', exact: true });
    await palette.getByRole('button', { name: 'Info', exact: true }).click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toHaveText('Primär für Knöpfe, Akzent für XP, Hintergrund für die Fläche.');
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);
    await expect(palette).toBeVisible();
    expect(await oben(palette.getByRole('textbox', { name: 'Name', exact: true }))).toBeLessThan(
      await oben(palette.getByRole('heading', { name: 'Farben', exact: true })),
    );
    expect(await oben(palette.getByRole('heading', { name: 'Farben', exact: true }))).toBeLessThan(
      await oben(palette.locator('[data-vorschau]')),
    );
    await ohneSeitlichenUeberlauf(page);
    await bild('palette');
    await palette.getByRole('button', { name: 'Schließen' }).click();

    const angelegt = await page.request.patch('/api/einstellungen', {
      data: { paletteNeu: { name: FOLGE_NAME, ...FOLGE_TRIO } },
    });
    expect(angelegt.ok()).toBe(true);
    const nachAnlage = (await angelegt.json()) as Stand;
    paletteId = nachAnlage.paletten.find((eintrag) => eintrag.name === FOLGE_NAME)?.id ?? null;
    expect(paletteId).toBeTruthy();
    await page.reload();
    await page.getByRole('button', { name: FOLGE_NAME, exact: true }).click();
    const detail = page.getByRole('dialog', { name: FOLGE_NAME, exact: true });
    await expect(detail.locator('input[type="color"]')).toHaveCount(0);
    await detail.getByRole('button', { name: 'Aktionen', exact: true }).click();
    await expect(detail.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Löschen', exact: true })).toBeVisible();
    await detail.getByRole('button', { name: 'Aktionen', exact: true }).click();
    await ohneSeitlichenUeberlauf(page);
    await bild('palette-detail');
    const xpVorher = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--xp').trim());
    const uebernommen = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await detail.getByRole('button', { name: 'Auswählen', exact: true }).click();
    await uebernommen;
    await expect(detail).toHaveCount(0);
    const bildFarben = erscheinungAus(FOLGE_TRIO);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--grund').trim()))
      .toBe(bildFarben.hintergrund);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--xp').trim()))
      .toBe(xpVorher);
  } finally {
    for (const id of archivIds) {
      await page.request.patch(`/api/attribute/${id}`, { data: { archiviert: false } });
    }
    if (paletteId) {
      await page.request.patch('/api/einstellungen', { data: { paletteLoeschen: paletteId } });
    }
    await page.request.patch('/api/einstellungen', {
      data: {
        stil: anfang.stil,
        primaer: anfang.primaer,
        akzent: anfang.akzent,
        hintergrund: anfang.hintergrund,
        funktionen: anfang.funktionen,
      },
    });
    if (!anfang.eigeneFarben) {
      await page.request.patch('/api/einstellungen', { data: { farbenZuruecksetzen: true } });
    }
  }
});
