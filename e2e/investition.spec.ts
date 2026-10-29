import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';

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
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
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

test('Investition am Projekt und als eigene Investition', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.on('dialog', (dialog) => {
    const art = dialog.type();
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${art}`);
  });
  await anmelden(page);
  const liste = await projekte(page);
  const aktive = liste.filter((projekt) => projekt.aktiv).sort((a, b) => a.ausruestungBonus - b.ausruestungBonus);
  const ziel = aktive[0];
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }

  const halt = await anfragenHalten(page);
  const eintragIds: number[] = [];
  const name = 'Prüfbank 63';
  const nameNeu = 'Prüfbank 63b';

  try {
    await page.goto(`/projekte/${ziel.id}`);
    const zeile = page.locator('#projekt-investition');
    await expect(zeile).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Größe' })).toHaveCount(0);
    await zeile.getByRole('button', { name: 'Info' }).click();
    const hinweis = page.getByRole('tooltip');
    await expect(hinweis).toContainText('Eine eigene Investition oder ein geschafftes Projekt gibt dauerhaft mehr XP.');
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
    if (!(await chip.getAttribute('class'))?.includes('chip-aktiv')) {
      await chip.click();
    }
    await expect(chip).toHaveClass(/chip-aktiv/);

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

    const ressourcen = dialog.getByRole('switch', { name: 'Bonus auch für Ressourcen' });
    await expect(ressourcen).toBeVisible();
    if ((await ressourcen.getAttribute('aria-checked')) !== 'true') {
      await ressourcen.click();
    }
    await expect(ressourcen).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('button', { name: 'Info' }).click();
    await expect(page.getByRole('tooltip')).toContainText('Ressourcen werden mit investiert');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await expect(dialog.getByRole('button', { name: 'Abschließen' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
    await expect(dialog.getByRole('switch', { name: 'Geschafft' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();
    const abschliessen = page.getByRole('button', { name: 'Abschließen', exact: true });
    if (await abschliessen.isVisible()) {
      await abschliessen.click();
      const frage = page.getByRole('alertdialog', { name: `"${ziel.name}" abschließen?` });
      await expect(frage.getByText('Die Investition wird aktiv.')).toBeVisible();
      await frage.getByRole('button', { name: 'Abschließen', exact: true }).click();
      await expect(frage).toBeHidden();
    }
    await expect(page.getByRole('button', { name: 'Öffnen', exact: true })).toBeVisible();
    await expect(zeile).toContainText('Aktiv · +10 %');
    await expect(page.getByRole('img', { name: 'abgeschlossen', exact: true })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `e2e/bilder/${testInfo.project.name}-investition-projekt.png`, fullPage: true });
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
    const filter = page.getByRole('switch', { name: 'Nur Meilensteine' });
    if ((await filter.getAttribute('aria-checked')) === 'true') {
      await filter.click();
    }
    await page.getByText('Prüfbonus 63').first().click();
    const chronik = page.getByRole('dialog');
    await expect(chronik.getByText(`Investitionen +${Math.round(erwartet * 100)} %`)).toBeVisible();
    await chronik.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/investitionen');
    const listeBereich = page.locator('main');
    await expect(listeBereich.locator('a[href^="/projekte/"]')).toHaveCount(0);
    await listeBereich.getByRole('button', { name: /Investition anlegen/ }).click();
    const neu = page.getByRole('dialog', { name: 'Neue Investition' });
    await neu.getByRole('textbox', { name: 'Name' }).fill(name);
    const eigenRegler = neu.getByRole('slider', { name: 'Größe' });
    await eigenRegler.focus();
    for (let schritt = 0; schritt < 4; schritt += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    await page.keyboard.press('ArrowRight');
    await expect(neu.getByText('+10 %')).toBeVisible();
    const projektSegment = neu.getByRole('button', { name: 'Projekt', exact: true });
    if (await projektSegment.isVisible()) {
      await projektSegment.click();
    }
    await neu.getByRole('button', { name: ziel.name, exact: true }).click();
    const ressourcenChip = neu.getByRole('button', { name: 'Ressourcen', exact: true });
    if (await ressourcenChip.count()) {
      await ressourcenChip.click();
    }
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
    await expect(page.locator('#projekt-investition')).toContainText('Aktiv · +10 %');
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
    await loeschen.getByRole('button', { name: 'Archivieren' }).click();
    await expect(loeschen).toBeHidden();
    await expect(listeBereich.getByText(nameNeu)).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `e2e/bilder/${testInfo.project.name}-investition-charakter.png`, fullPage: true });
  } finally {
    await halt.weg();
    await wiederherstellen(page, ziel);
    await page.evaluate(
      async ({ ids, titel }) => {
        for (const id of ids) {
          await fetch(`/api/eintraege/${id}`, { method: 'DELETE' });
        }
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
      },
      { ids: eintragIds, titel: name },
    );
  }
});
