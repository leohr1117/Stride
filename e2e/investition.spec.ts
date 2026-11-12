import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { meilensteineAus } from './helfer.ts';
import { TEST_PASSWORT } from './testdaten.ts';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';

interface ZielRef {
  art: string;
  id: number;
}

interface ProjektZeile {
  id: number;
  name: string;
  aktiv: boolean;
  visionId: number | null;
  investition: boolean;
  investitionZiel: ZielRef | null;
  investitionRessourcen: boolean;
  investitionGroesse: number;
  investitionBonus: number;
  geschafftAm: string | null;
  ausruestungBonus: number;
  standardVorlageId: number;
}

const BONUS_DECKE = 0.5;

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function projekte(seite: Page): Promise<ProjektZeile[]> {
  return seite.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    if (!antwort.ok) {
      throw new Error('Ziele nicht geladen');
    }
    const daten = (await antwort.json()) as { projekte: ProjektZeile[] };
    return daten.projekte;
  });
}

async function projektStand(seite: Page, id: number): Promise<ProjektZeile> {
  return seite.evaluate(async (projektId) => {
    const antwort = await fetch(`/api/projekte/${projektId}`);
    if (!antwort.ok) {
      throw new Error('Projekt nicht geladen');
    }
    const daten = (await antwort.json()) as { projekt: ProjektZeile };
    return daten.projekt;
  }, id);
}

function eigenerBeitrag(stand: ProjektZeile, zielId: number, visionId: number | null): number {
  if (!stand.investition || stand.geschafftAm === null || !stand.investitionZiel) {
    return 0;
  }
  const ziel = stand.investitionZiel;
  if (ziel.art === 'projekt' && ziel.id === zielId) {
    return stand.investitionBonus;
  }
  if (ziel.art === 'vision' && visionId !== null && ziel.id === visionId) {
    return stand.investitionBonus;
  }
  return 0;
}

async function wiederherstellen(seite: Page, vorher: ProjektZeile): Promise<void> {
  await seite.evaluate(async (stand) => {
    await fetch(`/api/projekte/${stand.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        investition: stand.investition,
        investitionZiel: stand.investitionZiel,
        investitionRessourcen: stand.investitionRessourcen,
        investitionGroesse: stand.investitionGroesse,
        geschafft: stand.geschafftAm !== null,
      }),
    });
  }, vorher);
}

async function anfragenHalten(seite: Page): Promise<{ an: () => void; aus: () => void; haengt: () => number; weg: () => Promise<void> }> {
  let wartend: Promise<void> | null = null;
  let loesen = (): void => undefined;
  let offen = 0;
  const muster = '**/api/projekte/*';
  const behandeln = async (route: Route) => {
    if (wartend && route.request().method() === 'PATCH') {
      offen += 1;
      try {
        await wartend;
      } finally {
        offen -= 1;
      }
    }
    await route.continue();
  };
  await seite.route(muster, behandeln);
  return {
    an: () => {
      wartend = new Promise<void>((resolve) => {
        loesen = resolve;
      });
    },
    aus: () => {
      wartend = null;
      loesen();
      loesen = () => undefined;
    },
    haengt: () => offen,
    weg: async () => {
      wartend = null;
      loesen();
      await seite.unroute(muster, behandeln);
    },
  };
}

async function stufeTippen(seite: Page, anteil: number): Promise<void> {
  const regler = seite.getByRole('slider', { name: 'Größe' });
  const kasten = await regler.boundingBox();
  if (!kasten) {
    throw new Error('Regler ohne Fläche');
  }
  const x = Math.min(kasten.width - 6, Math.max(6, kasten.width * anteil));
  await regler.click({ position: { x, y: kasten.height / 2 } });
}

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

// Gelöschte Investitionen hinterlassen Buchungen, und die Id wird wiederverwendet.
function entferneVerwaisteBuchungen(): void {
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    db.prepare(
      'DELETE FROM xp_ereignisse WHERE investition_id IS NOT NULL AND investition_id NOT IN (SELECT id FROM investitionen)',
    ).run();
  } finally {
    db.close();
  }
}

async function aktiveInvestitionenArchivieren(seite: Page, titel: string): Promise<void> {
  await seite.evaluate(async (titel) => {
    const antwort = await fetch('/api/investitionen');
    if (!antwort.ok) {
      return;
    }
    const liste = (await antwort.json()) as { id: number; name: string; archiviert: boolean }[];
    for (const eintrag of liste) {
      if ((eintrag.name === titel || eintrag.name === `${titel}b`) && !eintrag.archiviert) {
        await fetch(`/api/investitionen/${eintrag.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ archiviert: true }),
        });
      }
    }
  }, titel);
}

async function einzelnAusfuehren(schritte: (() => Promise<void>)[]): Promise<void> {
  let ersterFehler: unknown = null;
  for (const schritt of schritte) {
    try {
      await schritt();
    } catch (grund) {
      if (ersterFehler === null) {
        ersterFehler = grund;
      }
    }
  }
  if (ersterFehler !== null) {
    throw ersterFehler;
  }
}

test('Investition am Projekt und als eigene Investition', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.on('dialog', (dialog) => {
    const art = dialog.type();
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${art}`);
  });
  const name = 'Prüfbank 63';
  const nameNeu = 'Prüfbank 63b';
  await anmelden(page);
  entferneVerwaisteBuchungen();
  await aktiveInvestitionenArchivieren(page, name);
  const liste = await projekte(page);
  const aktive = liste.filter((projekt) => projekt.aktiv).sort((a, b) => a.ausruestungBonus - b.ausruestungBonus);
  const ziel = aktive[0];
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }

  const halt = await anfragenHalten(page);
  const eintragIds: number[] = [];

  try {
    await page.goto(`/projekte/${ziel.id}`);
    const zeile = page.locator('#projekt-investition');
    await expect(zeile).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Größe' })).toHaveCount(0);
    await zeile.getByRole('button', { name: /^Info/ }).click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toContainText('Eine Investition kann XP eines Attributs kosten. Eine eigene Investition oder ein geschafftes Projekt gibt dauerhaft mehr XP.');
    const kasten = await hinweis.boundingBox();
    const fenster = page.viewportSize();
    expect(kasten).toBeTruthy();
    if (kasten && fenster) {
      expect(kasten.x).toBeGreaterThanOrEqual(0);
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
      expect(kasten.y).toBeGreaterThanOrEqual(0);
    }
    await page.keyboard.press('Escape');
    await expect(hinweis).toHaveCount(0);

    await page.getByRole('button', { name: 'Investition', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition' });
    await expect(dialog).toBeVisible();
    const schalter = dialog.getByRole('switch', { name: 'Investition' });
    const vorherAn = (await schalter.getAttribute('aria-checked')) === 'true';
    halt.an();
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', vorherAn ? 'false' : 'true', { timeout: 800 });
    await expect.poll(() => halt.haengt()).toBeGreaterThan(0);
    halt.aus();
    if ((await schalter.getAttribute('aria-checked')) !== 'true') {
      await schalter.click();
    }
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByRole('slider', { name: 'Größe' })).toBeVisible();

    const segment = dialog.getByRole('button', { name: 'Projekt', exact: true });
    if (await segment.isVisible()) {
      await segment.click();
    }
    const chip = dialog.getByRole('button', { name: ziel.name, exact: true });
    if ((await chip.getAttribute('aria-pressed')) !== 'true') {
      await chip.click();
    }
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(chip.locator('.chip-flaeche')).toHaveClass(/chip-aktiv/);

    const regler = dialog.getByRole('slider', { name: 'Größe' });
    await regler.scrollIntoViewIfNeeded();
    const flaeche = await regler.boundingBox();
    if (!flaeche) {
      throw new Error('Regler ohne Fläche');
    }
    const mitte = flaeche.y + flaeche.height / 2;
    halt.an();
    await page.mouse.move(flaeche.x + 8, mitte);
    await page.mouse.down();
    try {
      await page.mouse.move(flaeche.x + flaeche.width - 8, mitte, { steps: 12 });
      await expect(regler).toHaveValue('3');
      await expect(dialog.getByText('+30 %').first()).toBeVisible();
    } finally {
      await page.mouse.up();
    }
    await expect(regler).toHaveValue('3');
    await expect.poll(() => halt.haengt()).toBeGreaterThan(0);
    await expect(regler).toHaveValue('3');
    halt.aus();
    await expect(regler).toHaveValue('3');

    halt.an();
    await stufeTippen(page, 0.02);
    await expect(regler).toHaveValue('0');
    await expect(dialog.getByText('+5 %').first()).toBeVisible();
    await expect.poll(() => halt.haengt()).toBeGreaterThan(0);
    await expect(regler).toHaveValue('0');
    halt.aus();

    if ((page.viewportSize()?.width ?? 0) < 700) {
      const nochmal = await regler.boundingBox();
      if (!nochmal) {
        throw new Error('Regler ohne Fläche');
      }
      await page.touchscreen.tap(nochmal.x + nochmal.width - 8, nochmal.y + nochmal.height / 2);
      await expect(regler).toHaveValue('3');
    }

    await regler.focus();
    for (let schritt = 0; schritt < 4; schritt += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect(regler).toHaveValue('0');
    await page.keyboard.press('ArrowRight');
    await expect(regler).toHaveValue('1');
    await expect(dialog.getByText('+10 %').first()).toBeVisible();

    const ressourcen = dialog.getByRole('switch', { name: 'Bonus gilt auch für Ressourcen' });
    await expect(ressourcen).toBeVisible();
    if ((await ressourcen.getAttribute('aria-checked')) !== 'true') {
      await ressourcen.click();
    }
    await expect(ressourcen).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByRole('button', { name: /^Info/ })).toHaveCount(0);

    await expect(dialog.getByRole('button', { name: 'Abschließen' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
    await expect(dialog.getByRole('switch', { name: 'Geschafft' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();
    const menueKnopf = page.getByRole('button', { name: `Aktionen für ${ziel.name}`, exact: true });
    await menueKnopf.click();
    const abschliessen = page.getByRole('menuitem', { name: 'Projekt abschließen', exact: true });
    if (await abschliessen.isVisible()) {
      await abschliessen.click();
      const frage = page.getByRole('alertdialog', { name: `"${ziel.name}" abschließen?` });
      await expect(frage.getByText('Die Investition wird aktiv.')).toBeVisible();
      await frage.getByRole('button', { name: 'Abschließen', exact: true }).click();
      await expect(frage).toBeHidden();
      const feier = page.locator('.belohnung');
      await feier.waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
      for (let schritt = 0; schritt < 6 && (await feier.count()) > 0; schritt += 1) {
        const schliessen = feier.getByRole('button', { name: 'Schließen', exact: true });
        if (!(await schliessen.isVisible())) {
          break;
        }
        await schliessen.click({ force: true });
      }
      const aufstieg = page.getByRole('dialog').filter({ hasText: 'Level aufgestiegen' });
      await aufstieg.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
      if ((await aufstieg.count()) > 0) {
        await aufstieg.getByRole('button', { name: 'Weiter', exact: true }).click({ force: true });
        await expect(aufstieg).toBeHidden();
      }
    } else {
      await page.keyboard.press('Escape');
    }
    await menueKnopf.click();
    await expect(page.getByRole('menuitem', { name: 'Wieder öffnen', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(zeile).toContainText('+10 %');
    await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/investition/${testInfo.project.name}-projekt.png`, fullPage: true });
    await expect(zeile.getByText(ziel.name).first()).toBeVisible();

    await expect.poll(async () => {
      const stand = await projektStand(page, ziel.id);
      return (
        stand.investitionGroesse === 1 &&
        stand.geschafftAm !== null &&
        stand.investitionZiel?.art === 'projekt' &&
        stand.investitionZiel.id === ziel.id
      );
    }).toBe(true);
    const nachProjekt = await projektStand(page, ziel.id);
    const erwartet = Math.min(
      BONUS_DECKE,
      ziel.ausruestungBonus - eigenerBeitrag(ziel, ziel.id, ziel.visionId) + 0.1,
    );
    expect(nachProjekt.ausruestungBonus).toBeCloseTo(erwartet, 5);
    expect(nachProjekt.investitionZiel).toEqual({ art: 'projekt', id: ziel.id });
    expect(nachProjekt.geschafftAm).toBeTruthy();

    const ersterEintrag = await page.evaluate(
      async ({ projektId, vorlageId, notiz }) => {
        const antwort = await fetch('/api/eintraege', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projektId,
            vorlageId,
            vorhaben: null,
            abschluss: null,
            erkenntnis: '',
            stunden: null,
            notiz,
            meilenstein: false,
            faehigkeitId: null,
            datum: null,
          }),
        });
        if (!antwort.ok) {
          throw new Error('Eintrag fehlgeschlagen');
        }
        const daten = (await antwort.json()) as { eintrag: { id: number; ausruestungBonus: number } };
        return daten.eintrag;
      },
      { projektId: ziel.id, vorlageId: ziel.standardVorlageId, notiz: 'Prüfbonus 63' },
    );
    eintragIds.push(ersterEintrag.id);
    expect(ersterEintrag.ausruestungBonus).toBeCloseTo(erwartet, 5);

    await page.goto('/chronik');
    await meilensteineAus(page);
    await page.locator('[data-zeile]').filter({ hasText: 'Prüfbonus 63' }).first().locator('> button').click();
    const chronik = page.getByRole('dialog');
    await expect(chronik.getByText(`Investitionen +${Math.round(erwartet * 100)} %`)).toBeVisible();
    await chronik.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/investitionen');
    const listeBereich = page.locator('main');
    await expect(listeBereich.locator('a[href^="/projekte/"]')).toHaveCount(0);
    await listeBereich.getByRole('button', { name: /Investition anlegen/ }).click();
    const neu = page.getByRole('dialog', { name: 'Investition', exact: true });
    await neu.getByRole('textbox', { name: 'Name' }).fill(name);
    await neu.getByRole('radio', { name: '+10 %' }).click();
    await expect(neu.getByRole('radio', { name: '+10 %' })).toBeChecked();
    await neu.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
    const zahlWahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
    await zahlWahl.getByRole('option', { name: 'Nichts', exact: true }).click();
    await expect(zahlWahl).toBeHidden();
    await neu.getByRole('button', { name: 'Projekt · Keins' }).click();
    const zielWahl = page.getByRole('dialog', { name: 'Projekt' });
    await zielWahl.getByRole('option', { name: ziel.name, exact: true }).click();
    await expect(zielWahl).toBeHidden();
    await expect(neu.getByRole('button', { name: 'Attribut · Ressourcen' })).toBeVisible();
    await neu.getByRole('button', { name: 'Speichern' }).click();
    await expect(neu).toBeHidden();
    await expect(listeBereich.getByRole('button', { name, exact: true })).toBeVisible();

    const angelegt = await page.evaluate(async (titel) => {
      const antwort = await fetch('/api/investitionen');
      if (!antwort.ok) {
        throw new Error('Investitionen nicht geladen');
      }
      const eintraege = (await antwort.json()) as { name: string; archiviert: boolean; bonus: number; ziel: ZielRef | null }[];
      return eintraege.find((eintrag) => eintrag.name === titel && !eintrag.archiviert) ?? null;
    }, name);
    expect(angelegt?.ziel).toEqual({ art: 'projekt', id: ziel.id });
    expect(angelegt?.bonus).toBeCloseTo(0.1, 5);

    const zweiterEintrag = await page.evaluate(
      async ({ projektId, vorlageId, notiz }) => {
        const antwort = await fetch('/api/eintraege', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projektId,
            vorlageId,
            vorhaben: null,
            abschluss: null,
            erkenntnis: '',
            stunden: null,
            notiz,
            meilenstein: false,
            faehigkeitId: null,
            datum: null,
          }),
        });
        if (!antwort.ok) {
          throw new Error('Eintrag fehlgeschlagen');
        }
        const daten = (await antwort.json()) as { eintrag: { id: number; ausruestungBonus: number } };
        return daten.eintrag;
      },
      { projektId: ziel.id, vorlageId: ziel.standardVorlageId, notiz: 'Prüfbonus 63b' },
    );
    eintragIds.push(zweiterEintrag.id);
    expect(zweiterEintrag.ausruestungBonus).toBeCloseTo(Math.min(BONUS_DECKE, erwartet + 0.1), 5);

    await page.goto(`/projekte/${ziel.id}`);
    await page.reload();
    await expect(page.locator('#projekt-investition')).toContainText('+10 %');
    await page.getByRole('button', { name: 'Investition', exact: true }).click();
    const erneut = page.getByRole('dialog', { name: 'Investition' });
    await expect(erneut.getByRole('slider', { name: 'Größe' })).toHaveValue('1');
    await expect(erneut.getByRole('button', { name: 'Abschließen' })).toHaveCount(0);
    await expect(erneut.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
    await expect(erneut.getByText('Aktiv · +10 %')).toHaveCount(0);
    const reglerNeu = erneut.getByRole('slider', { name: 'Größe' });
    await reglerNeu.focus();
    await page.keyboard.press('ArrowRight');
    await expect(reglerNeu).toHaveValue('2');
    await erneut.getByRole('button', { name: 'Schließen' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Investition', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Investition' }).getByRole('slider', { name: 'Größe' })).toHaveValue('2');
    const aus = page.getByRole('dialog', { name: 'Investition' }).getByRole('switch', { name: 'Investition' });
    halt.an();
    await aus.click();
    await expect(aus).toHaveAttribute('aria-checked', 'false', { timeout: 800 });
    await expect(page.getByRole('slider', { name: 'Größe' })).toHaveCount(0);
    await expect.poll(() => halt.haengt()).toBeGreaterThan(0);
    halt.aus();
    await page.keyboard.press('Escape');

    await page.goto('/investitionen');
    await listeBereich.getByRole('button', { name, exact: true }).click();
    const bearbeiten = page.getByRole('dialog', { name: 'Investition' });
    await bearbeiten.getByRole('textbox', { name: 'Name' }).fill(nameNeu);
    await bearbeiten.getByRole('button', { name: 'Speichern' }).click();
    await expect(bearbeiten).toBeHidden();
    await expect(listeBereich.getByRole('button', { name: nameNeu, exact: true })).toBeVisible();
    await listeBereich.getByRole('button', { name: nameNeu, exact: true }).click();
    const loeschen = page.getByRole('dialog', { name: 'Investition' });
    await loeschen.getByRole('button', { name: `Aktionen für ${nameNeu}` }).click();
    await page.getByRole('menuitem', { name: 'Archivieren' }).click();
    await expect(loeschen).toBeHidden();
    await expect(listeBereich.getByText(nameNeu)).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/investition/${testInfo.project.name}-charakter.png`, fullPage: true });
  } finally {
    await einzelnAusfuehren([
      () => halt.weg(),
      () => wiederherstellen(page, ziel),
      () =>
        page.evaluate(async (ids) => {
          for (const id of ids) {
            await fetch(`/api/eintraege/${id}`, { method: 'DELETE' });
          }
        }, eintragIds),
      () => aktiveInvestitionenArchivieren(page, name),
    ]);
  }
});

interface ZielWahl {
  attribut: string | null;
  projekt: string | null;
  faehigkeit?: string | null;
}

async function waehleOption(seite: Page, dialog: Locator, feld: string, jetzt: string, option: string): Promise<string> {
  await dialog.getByRole('button', { name: `${feld} · ${jetzt}` }).click();
  const wahl = seite.getByRole('dialog', { name: feld });
  await wahl.getByRole('option', { name: option, exact: true }).click();
  await expect(wahl).toBeHidden();
  return option;
}

async function oeffneNeu(seite: Page): Promise<Locator> {
  await seite.goto('/investitionen');
  await seite.getByRole('button', { name: /Investition anlegen/ }).click();
  const dialog = seite.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(dialog.getByRole('button', { name: 'Attribut · Ressourcen' })).toBeVisible();
  return dialog;
}

async function legeEigene(seite: Page, name: string, ziel: ZielWahl): Promise<void> {
  const dialog = await oeffneNeu(seite);
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
  await dialog.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
  const zahl = seite.getByRole('dialog', { name: 'Bezahlt mit' });
  await zahl.getByRole('option', { name: 'Nichts', exact: true }).click();
  await expect(zahl).toBeHidden();
  let attribut = 'Ressourcen';
  if (ziel.attribut !== attribut) {
    attribut = await waehleOption(seite, dialog, 'Attribut', attribut, ziel.attribut ?? 'Keins');
  }
  if (ziel.projekt) {
    await waehleOption(seite, dialog, 'Projekt', 'Keins', ziel.projekt);
  }
  if (ziel.faehigkeit) {
    await waehleOption(seite, dialog, 'Fähigkeit', 'Keins', ziel.faehigkeit);
  }
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
}

function zeileVon(seite: Page, name: string): Locator {
  return seite.locator('[data-zeile]').filter({ has: seite.getByRole('button', { name, exact: true }) });
}

async function kasten(ziel: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await ziel.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error('Element ohne Fläche');
  }
  return box;
}

async function liegtLinksDavor(links: Locator, rechts: Locator): Promise<void> {
  const a = await kasten(links);
  const b = await kasten(rechts);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 2);
  const mitte = a.y + a.height / 2;
  expect(mitte).toBeGreaterThanOrEqual(b.y - 2);
  expect(mitte).toBeLessThanOrEqual(b.y + b.height + 2);
}

async function markeBeginntMitIcon(marke: Locator): Promise<void> {
  const icon = marke.locator('svg');
  const schrift = marke.locator('span');
  await expect(icon).toHaveCount(1);
  await liegtLinksDavor(icon, schrift);
}

async function entferneNamen(seite: Page, namen: string[]): Promise<void> {
  await seite.evaluate(async (titel) => {
    const antwort = await fetch('/api/investitionen');
    if (!antwort.ok) {
      return;
    }
    const liste = (await antwort.json()) as { id: number; name: string; archiviert: boolean; loeschbar: boolean }[];
    for (const eintrag of liste) {
      if (eintrag.archiviert || !titel.includes(eintrag.name)) {
        continue;
      }
      if (eintrag.loeschbar) {
        await fetch(`/api/investitionen/${eintrag.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/investitionen/${eintrag.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ archiviert: true }),
        });
      }
    }
  }, namen);
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    const loescheBuchung = db.prepare(
      'DELETE FROM xp_ereignisse WHERE investition_id IN (SELECT id FROM investitionen WHERE name = ?)',
    );
    const loesche = db.prepare('DELETE FROM investitionen WHERE name = ?');
    for (const name of namen) {
      loescheBuchung.run(name);
      loesche.run(name);
    }
  } finally {
    db.close();
  }
}

function zielDerZeile(name: string): { ziel_art: string | null; ziel_id: number | null } {
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    const zeile = db.prepare('SELECT ziel_art, ziel_id FROM investitionen WHERE name = ?').get(name) as
      | { ziel_art: string | null; ziel_id: number | null }
      | undefined;
    if (!zeile) {
      throw new Error('Investition fehlt');
    }
    return zeile;
  } finally {
    db.close();
  }
}

test('Investition zielt auf Attribut, Projekt, Vision oder beides', async ({ page }) => {
  const namen = ['Nur Attribut', 'Nur Projekt', 'Nur Vision', 'Beides'];
  await anmelden(page);
  await entferneNamen(page, namen);
  try {
    const dialog = await oeffneNeu(page);
    await dialog.getByRole('heading', { name: 'Wirkung' }).scrollIntoViewIfNeeded();
    const attributKnopf = dialog.getByRole('button', { name: 'Attribut · Ressourcen' });
    const projektKnopf = dialog.getByRole('button', { name: 'Projekt · Keins' });
    const attributLage = await kasten(attributKnopf);
    const projektLage = await kasten(projektKnopf);
    expect(attributLage.y + attributLage.height).toBeLessThanOrEqual(projektLage.y + 1);
    expect(Math.abs(attributLage.x - projektLage.x)).toBeLessThan(4);

    await attributKnopf.click();
    const attributWahl = page.getByRole('dialog', { name: 'Attribut' });
    await expect(attributWahl.getByRole('option').first()).toHaveText('Keins');
    await attributWahl.getByRole('option', { name: 'Ressourcen', exact: true }).click();
    await expect(attributWahl).toBeHidden();
    await projektKnopf.click();
    const projektWahl = page.getByRole('dialog', { name: 'Projekt' });
    await expect(projektWahl.getByRole('option').first()).toHaveText('Keins');
    await projektWahl.getByRole('option', { name: 'Keins', exact: true }).click();
    await expect(projektWahl).toBeHidden();

    await dialog.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
    const zahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
    await zahl.getByRole('option', { name: 'Nichts', exact: true }).click();
    await expect(zahl).toBeHidden();
    await waehleOption(page, dialog, 'Attribut', 'Ressourcen', 'Keins');
    const speichern = dialog.getByRole('button', { name: 'Speichern' });
    await expect(speichern).toBeEnabled();
    await speichern.click();
    const fehler = dialog.locator('[data-feld="attribut"] [role="alert"]');
    await expect(fehler).toHaveText('Wähle ein Attribut, ein Projekt oder eine Fähigkeit.');
    await expect(speichern).toBeEnabled();
    await expect(dialog).toBeVisible();
    const fehlerLage = await kasten(fehler);
    const oben = await kasten(dialog.getByRole('button', { name: 'Attribut · Keins' }));
    const unten = await kasten(dialog.getByRole('button', { name: 'Projekt · Keins' }));
    expect(oben.y + oben.height).toBeLessThanOrEqual(fehlerLage.y + 1);
    expect(fehlerLage.y).toBeLessThan(unten.y);
    expect(fehlerLage.x).toBeGreaterThanOrEqual(oben.x - 2);
    await expect(dialog.locator('[data-feld="attribut"] button').first()).toBeFocused();

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Nur Attribut');
    await waehleOption(page, dialog, 'Attribut', 'Keins', 'Körper');
    await speichern.click();
    await expect(dialog).toBeHidden();
    const nurAttribut = zeileVon(page, 'Nur Attribut').locator('[data-investition-neben]');
    await expect(nurAttribut.getByText('Körper', { exact: true })).toBeVisible();
    await expect(nurAttribut.locator('[data-ziel]')).toHaveCount(0);
    await expect(nurAttribut.locator('svg')).toHaveCount(0);

    await legeEigene(page, 'Nur Projekt', { attribut: null, projekt: 'Ausdauer' });
    const nurProjekt = zeileVon(page, 'Nur Projekt').locator('[data-investition-neben]');
    const projektMarke = nurProjekt.locator('[data-ziel="projekt"]');
    await expect(projektMarke).toHaveAttribute('data-icon', 'target');
    await expect(nurProjekt).not.toContainText('Körper');
    await expect(nurProjekt).not.toContainText('Ressourcen');
    await markeBeginntMitIcon(projektMarke);
    await expect(nurProjekt.locator('svg')).toHaveCount(1);

    await legeEigene(page, 'Nur Vision', { attribut: null, projekt: 'Fit und belastbar' });
    const nurVision = zeileVon(page, 'Nur Vision').locator('[data-investition-neben]');
    const visionMarke = nurVision.locator('[data-ziel="vision"]');
    await expect(visionMarke).toHaveAttribute('data-icon', 'flag');
    await markeBeginntMitIcon(visionMarke);

    await legeEigene(page, 'Beides', { attribut: 'Körper', projekt: 'Ausdauer' });
    const beides = zeileVon(page, 'Beides').locator('[data-investition-neben]');
    const beidesMarke = beides.locator('[data-ziel="projekt"]');
    await expect(beidesMarke).toHaveAttribute('data-icon', 'target');
    await liegtLinksDavor(beides.getByText('Körper', { exact: true }), beidesMarke);
    await markeBeginntMitIcon(beidesMarke);

    const bank = zeileVon(page, 'Trainingsbank').locator('[data-investition-neben]');
    const bankMarke = bank.locator('[data-ziel="vision"]');
    await expect(bankMarke).toHaveAttribute('data-icon', 'flag');
    await liegtLinksDavor(bank.getByText('Körper', { exact: true }), bankMarke);
  } finally {
    await entferneNamen(page, namen);
  }
});

test('Eine alte Investition mit zweitem Attribut bleibt, bis ein Projekt gewählt wird', async ({ page }) => {
  const name = 'Altziel zweites Attribut';
  await anmelden(page);
  await entferneNamen(page, [name]);
  const ids = await page.evaluate(async () => {
    const antwort = await fetch('/api/attribute');
    if (!antwort.ok) {
      throw new Error('Attribute nicht geladen');
    }
    return (await antwort.json()) as { id: number; kennung: string | null }[];
  });
  const koerper = ids.find((eintrag) => eintrag.kennung === 'koerper');
  const ressourcen = ids.find((eintrag) => eintrag.kennung === 'ressourcen');
  expect(koerper).toBeTruthy();
  expect(ressourcen).toBeTruthy();
  if (!koerper || !ressourcen) {
    return;
  }
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    db.prepare(
      `INSERT INTO investitionen (name, icon, groesse, bonus, ziel_art, ziel_id, attribut_id, archiviert, betrag)
       VALUES (?, 'gem', 1, 0.1, 'attribut', ?, ?, 0, 0)`,
    ).run(name, ressourcen.id, koerper.id);
  } finally {
    db.close();
  }
  try {
    await page.goto('/investitionen');
    await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    const hinweis = dialog.getByText('Wirkt auch auf Ressourcen', { exact: true });
    await expect(hinweis).toBeVisible();
    const hinweisLage = await kasten(hinweis);
    const projektLage = await kasten(dialog.getByRole('button', { name: 'Projekt · Keins' }));
    expect(projektLage.y + projektLage.height).toBeLessThanOrEqual(hinweisLage.y + 1);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();
    expect(zielDerZeile(name)).toEqual({ ziel_art: 'attribut', ziel_id: ressourcen.id });

    await page.getByRole('button', { name, exact: true }).click();
    const erneut = page.getByRole('dialog', { name: 'Investition', exact: true });
    await expect(erneut.getByText('Wirkt auch auf Ressourcen', { exact: true })).toBeVisible();
    await waehleOption(page, erneut, 'Projekt', 'Keins', 'Ausdauer');
    await expect(erneut.getByText('Wirkt auch auf Ressourcen')).toHaveCount(0);
    await erneut.getByRole('button', { name: 'Speichern' }).click();
    await expect(erneut).toBeHidden();
    const danach = zielDerZeile(name);
    expect(danach.ziel_art).toBe('projekt');
    expect(danach.ziel_id).not.toBe(ressourcen.id);
    const zeile = zeileVon(page, name).locator('[data-investition-neben]');
    await expect(zeile.locator('[data-ziel="projekt"][data-icon="target"]')).toBeVisible();
    await expect(zeile).not.toContainText('Ressourcen');
  } finally {
    await entferneNamen(page, [name]);
  }
});

test('Investition zielt auf eine Fähigkeit oder auf alle drei', async ({ page }) => {
  const namen = ['Nur Fähigkeit', 'Alle drei'];
  await anmelden(page);
  await entferneNamen(page, namen);
  try {
    const dialog = await oeffneNeu(page);
    await dialog.getByRole('heading', { name: 'Wirkung' }).scrollIntoViewIfNeeded();
    const attributKnopf = dialog.getByRole('button', { name: 'Attribut · Ressourcen' });
    const projektKnopf = dialog.getByRole('button', { name: 'Projekt · Keins' });
    const faehigkeitKnopf = dialog.getByRole('button', { name: 'Fähigkeit · Keins' });
    await attributKnopf.scrollIntoViewIfNeeded();
    const attributLage = await kasten(attributKnopf);
    const projektLage = await kasten(projektKnopf);
    expect(attributLage.y + attributLage.height).toBeLessThanOrEqual(projektLage.y + 1);
    expect(Math.abs(attributLage.x - projektLage.x)).toBeLessThan(4);
    await faehigkeitKnopf.scrollIntoViewIfNeeded();
    const projektDanach = await kasten(projektKnopf);
    const faehigkeitLage = await kasten(faehigkeitKnopf);
    expect(projektDanach.y + projektDanach.height).toBeLessThanOrEqual(faehigkeitLage.y + 1);
    expect(Math.abs(projektDanach.x - faehigkeitLage.x)).toBeLessThan(4);

    await faehigkeitKnopf.click();
    const faehigkeitWahl = page.getByRole('dialog', { name: 'Fähigkeit' });
    await expect(faehigkeitWahl.getByRole('option').first()).toHaveText('Keins');
    await faehigkeitWahl.getByRole('option', { name: 'Keins', exact: true }).click();
    await expect(faehigkeitWahl).toBeHidden();

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Nur Fähigkeit');
    await dialog.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
    const zahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
    await zahl.getByRole('option', { name: 'Nichts', exact: true }).click();
    await expect(zahl).toBeHidden();
    await waehleOption(page, dialog, 'Attribut', 'Ressourcen', 'Keins');
    await waehleOption(page, dialog, 'Fähigkeit', 'Keins', 'Programmieren');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();

    const nurFaehigkeit = zeileVon(page, 'Nur Fähigkeit').locator('[data-investition-neben]');
    const nurMarke = nurFaehigkeit.locator('[data-ziel="faehigkeit"][data-icon="sparkles"]');
    await expect(nurMarke).toContainText('Programmieren');
    await expect(nurMarke.locator('svg')).toHaveClass(/inline-block/);
    await expect(nurMarke.locator('svg')).toHaveClass(/size-3\.5/);
    await markeBeginntMitIcon(nurMarke);
    await expect(nurFaehigkeit.locator('[data-ziel="projekt"], [data-ziel="vision"]')).toHaveCount(0);
    await expect(nurFaehigkeit).toContainText('+10 %');
    await expect(nurFaehigkeit).not.toContainText('Körper');
    await expect(nurFaehigkeit).not.toContainText('Ressourcen');

    await legeEigene(page, 'Alle drei', { attribut: 'Körper', projekt: 'Ausdauer', faehigkeit: 'Programmieren' });
    const alle = zeileVon(page, 'Alle drei').locator('[data-investition-neben]');
    const koerper = alle.getByText('Körper', { exact: true });
    const projektMarke = alle.locator('[data-ziel="projekt"][data-icon="target"]');
    const skillMarke = alle.locator('[data-ziel="faehigkeit"][data-icon="sparkles"]');
    await expect(projektMarke).toContainText('Ausdauer');
    await expect(skillMarke).toContainText('Programmieren');
    await liegtLinksDavor(koerper, projektMarke);
    await liegtLinksDavor(projektMarke, skillMarke);
    await markeBeginntMitIcon(skillMarke);
    await expect(alle.locator('svg')).toHaveCount(2);

    for (const name of ['Nur Fähigkeit', 'Alle drei', 'Trainingsbank']) {
      const zeile = zeileVon(page, name);
      await zeile.scrollIntoViewIfNeeded();
      const hoehe = (await kasten(zeile)).height;
      expect(Math.abs(hoehe - 68)).toBeLessThanOrEqual(1);
      expect(await zeile.getAttribute('data-zeilen')).toBeNull();
    }
  } finally {
    await entferneNamen(page, namen);
  }
});
