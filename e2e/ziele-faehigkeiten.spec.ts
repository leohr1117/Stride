import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { kompakt } from '../client/src/format.ts';

interface ProjektZeile {
  id: number;
  name: string;
  aktiv: boolean;
  archiviert: boolean;
  kontext: { titel: string } | null;
  investition: boolean;
  investitionZiel: { art: string; id: number } | null;
  investitionRessourcen: boolean;
  investitionGroesse: number;
  geschafftAm: string | null;
}

interface KnotenZeile {
  id: number;
  titel: string;
  xp: number;
  freigeschaltetAm: string | null;
}

interface FaehigkeitZeile {
  id: number;
  name: string;
  archiviert: boolean;
  knoten: KnotenZeile[];
}

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

async function stelleProjekt(seite: Page, id: number, daten: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async ({ projektId, koerper }) => {
    const antwort = await fetch(`/api/projekte/${projektId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return antwort.ok;
  }, { projektId: id, koerper: daten });
  expect(ok).toBe(true);
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

function muster(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function zahlPasstInBlase(kreis: Locator): Promise<void> {
  const passt = await kreis.evaluate((element) => {
    const zahl = element.querySelector('.zahl');
    if (!(zahl instanceof HTMLElement)) {
      return false;
    }
    const aussen = element.getBoundingClientRect();
    const innen = zahl.getBoundingClientRect();
    return (
      innen.width > 0 &&
      innen.height > 0 &&
      innen.left >= aussen.left - 1 &&
      innen.right <= aussen.right + 1 &&
      innen.top >= aussen.top - 1 &&
      innen.bottom <= aussen.bottom + 1 &&
      zahl.scrollWidth <= zahl.clientWidth + 1 &&
      zahl.scrollHeight <= zahl.clientHeight + 1 &&
      parseFloat(getComputedStyle(zahl).fontSize) >= 10
    );
  });
  expect(passt).toBe(true);
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Abgeschlossen bleibt in der Kopfzeile', async ({ page }, testInfo) => {
  const liste = await projekte(page);
  const ziel = liste
    .filter((projekt) => projekt.aktiv)
    .sort((a, b) => (b.kontext?.titel.length ?? 0) - (a.kontext?.titel.length ?? 0))[0];
  expect(ziel).toBeTruthy();
  if (!ziel) {
    return;
  }

  try {
    await stelleProjekt(page, ziel.id, { geschafft: true });
    await page.goto(`/projekte/${ziel.id}`);
    const titel = page.locator('[data-projektname]');
    const marke = page.getByRole('img', { name: 'abgeschlossen', exact: true });
    await expect(titel).toBeVisible();
    await expect(marke).toBeVisible();
    const titelKasten = await titel.boundingBox();
    const markeKasten = await marke.boundingBox();
    expect(titelKasten && markeKasten).toBeTruthy();
    if (titelKasten && markeKasten) {
      const mitte = markeKasten.y + markeKasten.height / 2;
      expect(mitte).toBeGreaterThan(titelKasten.y);
      expect(mitte).toBeLessThan(titelKasten.y + titelKasten.height);
      expect(markeKasten.x).toBeGreaterThan(titelKasten.x + titelKasten.width - 2);
      expect(markeKasten.height).toBeLessThan(32);
    }
    const untertitel = titel.locator('xpath=parent::div/following-sibling::p[1]');
    const untertitelKasten = await untertitel.boundingBox();
    expect(untertitelKasten).toBeTruthy();
    if (untertitelKasten) {
      expect(untertitelKasten.height).toBeLessThan(32);
      expect(untertitelKasten.y).toBeGreaterThan((titelKasten?.y ?? 0) + (titelKasten?.height ?? 0) - 4);
    }
    await expect(untertitel).not.toContainText('abgeschlossen');
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/ziele-faehigkeiten/${testInfo.project.name}-kopf.png`, fullPage: false });

    await page.goto('/ziele');
    const link = page.locator('[data-zeile]').filter({ has: page.locator(`a[href="/projekte/${ziel.id}"]`) });
    const name = link.getByText(ziel.name, { exact: true });
    const wort = link.getByText('abgeschlossen', { exact: true });
    await expect(wort).toBeVisible();
    const nameKasten = await name.boundingBox();
    const wortKasten = await wort.boundingBox();
    expect(nameKasten && wortKasten).toBeTruthy();
    if (nameKasten && wortKasten) {
      expect(Math.abs(wortKasten.y + wortKasten.height / 2 - (nameKasten.y + nameKasten.height / 2))).toBeLessThan(8);
    }
  } finally {
    await stelleProjekt(page, ziel.id, { geschafft: ziel.geschafftAm !== null });
  }
});

test('Skill-Blasen zeigen XP ohne Haken', async ({ page }, testInfo) => {
  const faehigkeit = await page.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error('Fähigkeiten nicht geladen');
    }
    const liste = (await antwort.json()) as FaehigkeitZeile[];
    return (
      liste.find((eintrag) => eintrag.name === 'Programmieren' && !eintrag.archiviert && eintrag.knoten.length > 0) ??
      liste.find((eintrag) => !eintrag.archiviert && eintrag.knoten.length > 0) ??
      null
    );
  });
  expect(faehigkeit).toBeTruthy();
  if (!faehigkeit) {
    return;
  }
  if (faehigkeit.name === 'Programmieren') {
    expect(faehigkeit.knoten.some((knoten) => knoten.freigeschaltetAm !== null)).toBe(true);
    expect(faehigkeit.knoten.some((knoten) => knoten.freigeschaltetAm === null)).toBe(true);
  }

  await page.goto(`/faehigkeiten/${faehigkeit.id}`);
  const karte = page.locator('.baum-karte');
  await expect(karte.locator('.baum-wurzel')).toBeVisible();
  await expect(karte.locator('.baum-knoten svg')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);

  for (const knoten of faehigkeit.knoten) {
    const text = kompakt(knoten.xp);
    const knopf = karte.getByRole('button', {
      name: new RegExp(`^${muster(text)}\\s+${muster(knoten.titel)}$`),
    });
    await expect(knopf).toHaveCount(1);
    await knopf.scrollIntoViewIfNeeded();
    const kreis = knopf.locator('.baum-knoten');
    await expect(kreis).toHaveText(text);
    await zahlPasstInBlase(kreis);
    if (knoten.freigeschaltetAm !== null) {
      await expect(knopf).toHaveAttribute('data-zustand', 'frei');
      await expect(kreis).toHaveClass(/baum-frei/);
      const schein = await kreis.evaluate((element) => {
        const stil = getComputedStyle(element);
        return {
          verlauf: stil.backgroundImage.includes('gradient'),
          glanz: stil.boxShadow !== 'none',
        };
      });
      expect(schein.verlauf).toBe(true);
      expect(schein.glanz).toBe(true);
    } else {
      await expect(kreis).not.toHaveClass(/baum-frei/);
      await expect(knopf).not.toHaveAttribute('data-zustand', 'frei');
    }
  }

  await page.screenshot({ path: `tmp-test/ziele-faehigkeiten/${testInfo.project.name}-baum.png`, fullPage: false });
});
