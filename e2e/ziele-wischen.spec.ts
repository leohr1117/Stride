import { expect, test, type Locator, type Page } from '@playwright/test';
import { meilensteineAus } from './helfer.ts';
import { TEST_PASSWORT } from './testdaten.ts';

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

async function api<T>(seite: Page, pfad: string, methode: string, koerper?: unknown): Promise<T> {
  return seite.evaluate(
    async ({ pfad, methode, koerper }) => {
      const antwort = await fetch(pfad, {
        method: methode,
        headers: koerper === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: koerper === undefined ? undefined : JSON.stringify(koerper),
      });
      const text = await antwort.text();
      if (!antwort.ok) {
        throw new Error(`${methode} ${pfad} ${antwort.status}: ${text.slice(0, 180)}`);
      }
      return text ? (JSON.parse(text) as T) : (undefined as T);
    },
    { pfad, methode, koerper },
  );
}

async function vorbereiten(seite: Page): Promise<void> {
  await anmelden(seite);
  await api(seite, '/api/einstellungen', 'PATCH', {
    ebenen: { visionen: true, projekte: true },
    funktionen: { chronik: true },
  });
}

async function attributId(seite: Page): Promise<number> {
  const attribute = await api<{ id: number; archiviert: boolean }[]>(seite, '/api/attribute', 'GET');
  const id = attribute.find((attribut) => !attribut.archiviert)?.id;
  if (id === undefined) {
    throw new Error('Kein Attribut.');
  }
  return id;
}

async function projektAnlegen(seite: Page, name: string, vorlageId: number, mitEintrag: boolean): Promise<void> {
  const projekt = await api<{ id: number }>(seite, '/api/projekte', 'POST', {
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlageId,
  });
  if (!mitEintrag) {
    return;
  }
  await api(seite, '/api/eintraege', 'POST', {
    projektId: projekt.id,
    vorlageId,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden: 1,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  });
}

async function wischen(seite: Page, ziel: Locator, dx: number, dy: number): Promise<void> {
  await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const kasten = await ziel.boundingBox();
  if (!kasten) {
    throw new Error('Zeile nicht sichtbar.');
  }
  const startX = kasten.x + kasten.width - 110;
  const startY = kasten.y + kasten.height / 2;
  const session = await seite.context().newCDPSession(seite);
  const punkt = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(startX, startY) });
  const schritte = 8;
  for (let schritt = 1; schritt <= schritte; schritt += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: punkt(startX + (dx * schritt) / schritte, startY + (dy * schritt) / schritte),
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

function zeile(seite: Page, name: string): Locator {
  return seite.locator(`[data-schnell="${name}"]`);
}

test('wischen archiviert und löscht', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'handy', 'Nur Touch');
  const leer = 'Lauf73-leer-handy';
  const genutzt = 'Lauf73-genutzt-handy';
  const taetigkeit = 'Lauf73-tat-handy';
  await vorbereiten(page);
  const vorhandene = await api<{ id: number; archiviert: boolean }[]>(page, '/api/vorlagen', 'GET');
  const basisId = vorhandene.find((eintrag) => !eintrag.archiviert)?.id;
  if (basisId === undefined) {
    throw new Error('Keine Tätigkeit.');
  }
  await api(page, '/api/vorlagen', 'POST', {
    name: taetigkeit,
    icon: 'sparkles',
    gewichte: [{ attributId: await attributId(page), gewicht: 1 }],
  });
  await projektAnlegen(page, leer, basisId, false);
  await projektAnlegen(page, genutzt, basisId, true);

  await page.goto('/ziele');
  await expect(page.getByRole('heading', { name: 'Ziele' })).toBeVisible();
  const leereZeile = zeile(page, leer);
  const genutzteZeile = zeile(page, genutzt);
  await expect(leereZeile).toBeVisible();
  await wischen(page, genutzteZeile, 4, 30);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(genutzteZeile).toBeVisible();

  await wischen(page, leereZeile, -100, 0);
  await expect(leereZeile.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await leereZeile.getByRole('button', { name: 'Löschen' }).click();
  await expect(leereZeile).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(leer);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await wischen(page, genutzteZeile, -100, 0);
  await genutzteZeile.getByRole('button', { name: 'Archivieren' }).click();
  await expect(page.getByRole('status')).toContainText(`${genutzt} archiviert`);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(genutzteZeile).toBeVisible();

  await page.goto('/mehr/inhalte');
  const tatZeile = zeile(page, taetigkeit);
  await tatZeile.scrollIntoViewIfNeeded();
  await expect(tatZeile).toBeVisible();
  await tatZeile.getByRole('button', { name: `Aktionen für ${taetigkeit}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await expect(tatZeile).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(taetigkeit);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('menü und tastatur archivieren und brechen ab', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Nur Tastatur');
  const genutzt = 'Lauf73-genutzt-desktop';
  const notiz = 'Lauf73-notiz-desktop';
  await vorbereiten(page);
  const vorlagen = await api<{ id: number; archiviert: boolean }[]>(page, '/api/vorlagen', 'GET');
  const vorlageId = vorlagen.find((vorlage) => !vorlage.archiviert)?.id;
  if (vorlageId === undefined) {
    throw new Error('Keine Tätigkeit.');
  }
  await projektAnlegen(page, genutzt, vorlageId, true);
  await api(page, '/api/eintraege', 'POST', {
    projektId: null,
    vorlageId,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden: 1,
    notiz,
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  });

  await page.goto('/ziele');
  const genutzteZeile = zeile(page, genutzt);
  await expect(genutzteZeile).toBeVisible();
  const knopf = page.getByRole('button', { name: `Aktionen für ${genutzt}`, exact: true });
  await knopf.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Archivieren' })).toBeFocused();
  await page.keyboard.press('Enter');
  const rueckgaengig = page.getByRole('button', { name: 'Rückgängig' });
  await expect(rueckgaengig).toBeVisible();
  await rueckgaengig.focus();
  await page.keyboard.press('Enter');
  await expect(genutzteZeile).toBeVisible();

  await page.goto('/chronik');
  await meilensteineAus(page);
  const eintrag = zeile(page, notiz);
  await expect(eintrag).toBeVisible();
  await eintrag.getByRole('button', { name: `Aktionen für ${notiz}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Eintrag gelöscht');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(eintrag).toBeVisible();
});
