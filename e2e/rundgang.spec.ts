import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SPRACHEN, type Sprache } from '../shared/sprache/kern.ts';
import { zeige } from '../shared/sprache/index.ts';
import { TEST_APP, TEST_ZUGANG } from './testdaten.ts';

process.env.ASCEND_TEST = '1';
process.env.DB_PFAD ??= TEST_APP;
process.env.ZUGANG_PFAD ??= TEST_ZUGANG;

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
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
}

function beobachte(seite: Page): string[] {
  const fehler: string[] = [];
  seite.on('pageerror', (error) => fehler.push(error.message));
  seite.on('console', (meldung) => {
    if (meldung.type() !== 'error') {
      return;
    }
    const text = meldung.text();
    if (text.includes('favicon')) {
      return;
    }
    fehler.push(text);
  });
  seite.on('response', (antwort) => {
    if (!antwort.url().includes('/api/') || antwort.status() < 400) {
      return;
    }
    fehler.push(`${antwort.status()} ${antwort.url()}`);
  });
  return fehler;
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
        throw new Error(`${methode} ${pfad} ${antwort.status}`);
      }
      return text ? (JSON.parse(text) as T) : (undefined as T);
    },
    { pfad, methode, koerper },
  );
}

interface Stand {
  sprache: Sprache | null;
  funktionen: Record<string, boolean>;
  ebenen: Record<string, boolean>;
}

async function stand(seite: Page): Promise<Stand> {
  return api<Stand>(seite, '/api/einstellungen', 'GET');
}

async function setzen(seite: Page, aenderung: unknown): Promise<void> {
  await api(seite, '/api/einstellungen', 'PATCH', aenderung);
}

async function wiederherstellen(seite: Page, vorher: Stand): Promise<void> {
  await setzen(seite, {
    sprache: vorher.sprache ?? 'de',
    ebenen: vorher.ebenen,
    funktionen: vorher.funktionen,
  });
}

async function kopieSchliessen(): Promise<void> {
  const { schliesseDatenbank } = await import('../server/db.ts');
  const { schliesseZugang } = await import('../server/features/zugang/zugang.ts');
  schliesseDatenbank();
  schliesseZugang();
}

async function seitenrand(seite: Page): Promise<string[]> {
  return seite.evaluate(() => {
    const wurzel = document.documentElement;
    const liste: string[] = [];
    if (wurzel.scrollWidth > wurzel.clientWidth + 1) {
      liste.push(`seite ${wurzel.scrollWidth}>${wurzel.clientWidth}`);
    }
    const text = document.querySelector('main')?.textContent ?? '';
    if (/\{[a-zA-Z]+\}/.test(text)) {
      liste.push(text.match(/\{[a-zA-Z]+\}/)?.[0] ?? 'platzhalter');
    }
    for (const knopf of document.querySelectorAll('button')) {
      const huelle = knopf.parentElement;
      if (!huelle?.classList.contains('ms-1.5')) {
        continue;
      }
      const abstand = Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0;
      if (abstand < 5 || abstand > 8) {
        liste.push(`info ${abstand}`);
      }
    }
    return liste;
  });
}

async function wischen(seite: Page, ziel: Locator, dx: number): Promise<void> {
  await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const kasten = await ziel.boundingBox();
  if (!kasten) {
    throw new Error('Zeile nicht sichtbar.');
  }
  const startX = kasten.x + Math.min(kasten.width - 24, Math.max(80, kasten.width - 110));
  const startY = kasten.y + kasten.height / 2;
  const session = await seite.context().newCDPSession(seite);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const punkt = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(startX, startY) });
  const schritte = 8;
  for (let schritt = 1; schritt <= schritte; schritt += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: punkt(startX + (dx * schritt) / schritte, startY),
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test('Beschriftungen folgen der Sprache', async ({ page }) => {
  test.setTimeout(90_000);
  const fehler = beobachte(page);
  await anmelden(page);
  const vorher = await stand(page);
  await setzen(page, {
    sprache: 'en',
    ebenen: { visionen: true, projekte: true, vorhaben: true, organisationen: true },
    funktionen: { statistiken: true, rueckblick: true, chronik: true, vorbilder: true },
  });
  try {
    await page.reload();
    await page.getByRole('button', { name: 'Log entry' }).waitFor();
    await page.goto('/ziele');
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show archive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Project' }).first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: zeige('Ohne {name}', 'en', { name: zeige('Vision', 'en') }), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: zeige('{mehrzahl} ohne {name}', 'en', { mehrzahl: zeige('Organisationen', 'en'), name: zeige('Vision', 'en') }),
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Vision' }).first().click();
    await expect(page.getByRole('dialog', { name: 'New Vision' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/statistiken');
    await expect(page.getByRole('button', { name: '3 months' })).toBeVisible();
    await expect(page.getByRole('button', { name: '12 months' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Log entry' }).click();
    const dialog = page.getByRole('dialog', { name: 'What did you do?' });
    await expect(dialog).toBeVisible();
    const meilenstein = dialog.getByRole('switch', { name: 'Milestone' });
    if (await meilenstein.count()) {
      await meilenstein.click();
      await expect(dialog.getByRole('button', { name: /about \+.*milestone/ })).toBeVisible();
      await meilenstein.click();
    }
    await expect(dialog.getByRole('button', { name: /about \+/ })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await seitenrand(page)).toEqual([]);
  } finally {
    await wiederherstellen(page, vorher).catch(() => undefined);
  }
  expect(fehler).toEqual([]);
});

test('Eintrag anlegen und löschen', async ({ page }) => {
  const fehler = beobachte(page);
  const notiz = `Lauf81-${test.info().project.name}`;
  await anmelden(page);
  const vorher = await stand(page);
  await setzen(page, { funktionen: { chronik: true } });
  try {
    const vorlagen = await api<{ id: number; name: string; archiviert: boolean }[]>(page, '/api/vorlagen', 'GET');
    const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert);
    if (!vorlage) {
      throw new Error('Keine Tätigkeit.');
    }
    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await dialog.getByRole('button', { name: vorlage.name, exact: true }).click();
    await dialog.getByRole('button', { name: '1 Std', exact: true }).click();
    const schalter = dialog.getByRole('switch', { name: 'Meilenstein' });
    if (await schalter.count()) {
      await schalter.click();
      await expect(dialog.getByRole('button', { name: /\+ Meilenstein/ })).toBeVisible();
      await schalter.click();
    }
    await dialog.locator('textarea').last().fill(notiz);
    await expect(dialog.getByRole('button', { name: /Eintragen · ca\. \+/ })).toBeVisible();
    await dialog.getByRole('button', { name: /Eintragen · ca\. \+/ }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto('/chronik');
    const filter = page.getByRole('switch', { name: 'Nur Meilensteine' });
    if ((await filter.getAttribute('aria-checked')) === 'true') {
      await filter.click();
    }
    const zeile = page.locator(`[data-schnell="${notiz}"]`);
    await expect(zeile).toBeVisible();
    await zeile.getByRole('button', { name: `Aktionen für ${notiz}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Löschen' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Eintrag gelöscht');
    await expect(zeile).toHaveCount(0);
  } finally {
    await setzen(page, { funktionen: { chronik: vorher.funktionen.chronik } }).catch(() => undefined);
    const uebrig = await api<{ eintraege: { id: number; notiz: string }[] }>(page, '/api/eintraege', 'GET').catch(() => null);
    const treffer = uebrig?.eintraege.find((eintrag) => eintrag.notiz === notiz);
    if (treffer) {
      await api(page, `/api/eintraege/${treffer.id}`, 'DELETE').catch(() => undefined);
    }
  }
  expect(fehler).toEqual([]);
});

test('Wischen löscht sofort und der nächste Toast ersetzt den ersten', async ({ page }) => {
  const projekt = test.info().project.name;
  const ersteName = `Lauf81a-${projekt}`;
  const zweiteName = `Lauf81b-${projekt}`;
  const fehler = beobachte(page);
  await anmelden(page);
  const vorher = await stand(page);
  await setzen(page, { ebenen: { visionen: true, projekte: true }, sprache: 'de' });
  await page.reload();
  await page.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
  const angelegt: number[] = [];
  try {
    for (const titel of [ersteName, zweiteName]) {
      const vision = await api<{ id: number }>(page, '/api/visionen', 'POST', {
        titel,
        beschreibung: '',
        farbe: '#336699',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      angelegt.push(vision.id);
    }
    await page.goto('/ziele');
    const ersteZeile = page.locator(`[data-schnell="${ersteName}"]`);
    const zweiteZeile = page.locator(`[data-schnell="${zweiteName}"]`);
    await wischen(page, ersteZeile, -180);
    await expect(ersteZeile).toHaveCount(0);
    const status = page.getByRole('status');
    await expect(status).toContainText(ersteName);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(status).toBeVisible();
    await wischen(page, zweiteZeile, -180);
    await expect(zweiteZeile).toHaveCount(0);
    await expect(status).toContainText(zweiteName);
    await expect(status).not.toContainText(ersteName);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(zweiteZeile).toBeVisible();
    await expect(ersteZeile).toHaveCount(0);
  } finally {
    const ziele = await api<{ visionen: { id: number }[] }>(page, '/api/ziele', 'GET').catch(() => null);
    const da = new Set((ziele?.visionen ?? []).map((vision) => vision.id));
    for (const id of angelegt) {
      if (ziele && !da.has(id)) {
        continue;
      }
      await api(page, `/api/visionen/${id}`, 'DELETE').catch(() => undefined);
    }
    await setzen(page, { ebenen: vorher.ebenen, sprache: vorher.sprache ?? 'de' }).catch(() => undefined);
  }
  expect(fehler).toEqual([]);
});

test('Einführung fragt die Sprache und dann den Namen', async ({ page }) => {
  const name = `l81${test.info().project.name}${Date.now().toString(36).slice(-5)}`;
  const geheim = randomBytes(12).toString('base64url');
  let kontoId: number | null = null;
  const { erstelleMitglied, entferneKonto } = await import('../server/features/zugang/konten.ts');
  try {
    try {
      kontoId = erstelleMitglied({ benutzername: name, passwort: geheim }).id;
    } finally {
      await kopieSchliessen();
    }
    await page.goto('/');
    await page.locator('input[name="username"]').fill(name);
    await page.locator('input[name="password"]').fill(geheim);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What should Stride call you?' })).toBeVisible();
    await expect(page.getByText('Log what you do. It turns into levels and a streak.')).toBeVisible();
    await expect(page.getByText('Entries show up as levels.')).toHaveCount(0);
  } finally {
    await page
      .evaluate(async () => {
        await fetch('/api/zugang/abmelden', { method: 'POST' }).catch(() => undefined);
      })
      .catch(() => undefined);
    if (kontoId !== null) {
      try {
        entferneKonto(kontoId);
      } catch {
        // Die Testkopie wird beim Aufräumen gelöscht.
      } finally {
        await kopieSchliessen();
      }
    }
  }
});

test('Zurück geht zur Elternseite, Hauptseiten haben keins', async ({ page }) => {
  test.setTimeout(120_000);
  const fehler = beobachte(page);
  await anmelden(page);
  const vorher = await stand(page);
  await setzen(page, {
    ebenen: { visionen: true, projekte: true, vorhaben: true },
    funktionen: {
      chronik: true,
      basis: true,
      rueckblick: true,
      statistiken: true,
      vorbilder: true,
      handbuch: true,
      faehigkeiten: true,
    },
  });
  try {
    const leiste = await page.evaluate(async () => {
      const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { mobilLeiste: string[] };
      return daten.mobilLeiste;
    });
    const pc = (page.viewportSize()?.width ?? 0) >= 768;
    for (const pfad of ['/', '/laufend', '/basis', '/ziele', '/chronik', '/rueckblick', '/statistiken', '/vorbilder', '/handbuch', '/mehr']) {
      await page.goto(pfad);
      await expect(page).toHaveURL(new RegExp(`${pfad === '/' ? '/$' : `${pfad}$`}`));
      const platz = pfad === '/' || pc || leiste.includes(pfad);
      await expect(page.locator('a[data-zurueck]')).toHaveCount(platz ? 0 : 1);
    }

    await page.goto('/ziele');
    const projekt = page.locator('a[href^="/projekte/"]').first();
    await expect(projekt).toBeVisible();
    await projekt.click();
    await expect(page).toHaveURL(/\/projekte\/\d+$/);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Ziele');
    await page.goBack();
    await expect(page).toHaveURL(/\/ziele$/);
    await expect(page.locator('a[data-zurueck]')).toHaveCount(pc || leiste.includes('/ziele') ? 0 : 1);

    await page.goto('/mehr');
    await page.locator('a[href="/mehr/profil"]').click();
    await expect(page).toHaveURL(/\/mehr\/profil$/);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Mehr');
    await page.goBack();
    await expect(page).toHaveURL(/\/mehr$/);

    await page.goto('/vorbilder');
    await page.locator('a[href^="/vorbilder/"]').first().click();
    await expect(page).toHaveURL(/\/vorbilder\/.+/);
    await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Vorbilder');
    await page.goBack();
    await expect(page).toHaveURL(/\/vorbilder$/);
  } finally {
    await setzen(page, { ebenen: vorher.ebenen, funktionen: vorher.funktionen }).catch(() => undefined);
  }
  expect(fehler).toEqual([]);
});

test('Seiten, Sprachen, Darstellung, Vorbilder und Todoist', async ({ page }) => {
  test.setTimeout(240_000);
  const fehler = beobachte(page);
  await anmelden(page);
  const vorher = await stand(page);
  await setzen(page, {
    ebenen: { visionen: true, projekte: true, vorhaben: true, organisationen: true },
    funktionen: {
      chronik: true,
      basis: true,
      rueckblick: true,
      statistiken: true,
      vorbilder: true,
      faehigkeiten: true,
      handbuch: true,
    },
  });
  const verboten = [
    'Archiv anzeigen',
    'Eintragen · ca.',
    'Neue Vision',
    'Neues Projekt',
    'Ohne Vision',
    'Organisationen ohne Vision',
    'Projekt in ',
    'Bester Tag ·',
    'Abgeglichen ',
  ];
  try {
    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Ansichten' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Standardfarben' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Glühen' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Sound' })).toBeVisible();
    expect(await seitenrand(page)).toEqual([]);

    await page.goto('/vorbilder');
    await expect(page.getByText(/%/).first()).toBeVisible();
    const filter = page.getByRole('button').filter({ hasText: /%/ });
    if ((await filter.count()) > 1) {
      await filter.nth(1).click();
      await expect(page.getByRole('heading', { name: 'Vorbilder' })).toBeVisible();
      await page.getByRole('button', { name: /^Alle/ }).click();
    }
    await page.locator('a[href^="/vorbilder/"]').first().click();
    await expect(page.getByText(/%/).first()).toBeVisible();
    await page.goBack();

    await page.goto('/faehigkeiten');
    const skill = page.locator('a[href^="/faehigkeiten/"]').first();
    if (await skill.count()) {
      await skill.click();
      await expect(page.locator('a[data-zurueck]')).toHaveAttribute('aria-label', 'Zurück zu Fähigkeiten');
      await expect(page.locator('svg, canvas').first()).toBeVisible();
    }

    await page.goto('/ziele');
    const projekt = page.locator('a[href^="/projekte/"]').first();
    if (await projekt.count()) {
      await projekt.click();
      await expect(page.getByRole('heading').first()).toBeVisible();
      await page.goBack();
    }

    await page.goto('/mehr/inhalte/verbindungen');
    await expect(page.getByRole('heading', { name: 'Todoist' })).toBeVisible();
    const token = page.getByRole('textbox', { name: 'API-Token' });
    if (await token.count()) {
      await token.fill('e2e-todoist-token');
      await page.getByRole('button', { name: 'Verbinden' }).click();
      await expect(page.getByRole('switch', { name: 'Posteingang' })).toBeVisible();
      await page.getByRole('button', { name: 'Aktionen für Todoist' }).click();
      await page.getByRole('menuitem', { name: 'Trennen' }).click();
      await page.getByRole('button', { name: 'Trennen' }).click();
      await expect(token).toBeVisible();
    } else {
      await expect(page.getByRole('switch', { name: 'Posteingang' })).toBeVisible();
    }

    for (const sprache of SPRACHEN) {
      if (sprache === 'de') {
        continue;
      }
      await setzen(page, { sprache });
      await page.goto('/ziele');
      await page.reload();
      await expect(page.getByRole('heading', { name: zeige('Ziele', sprache) })).toBeVisible();
      await expect(page.getByRole('button', { name: zeige('Archiv anzeigen', sprache) })).toBeVisible();
      await expect(page.getByRole('button', { name: zeige('Projekt', sprache) }).first()).toBeVisible();
      await expect(
        page.getByRole('heading', { name: zeige('Ohne {name}', sprache, { name: zeige('Vision', sprache) }), exact: true }),
      ).toBeVisible();
      const text = await page.locator('main').innerText();
      for (const satz of verboten) {
        expect(text, sprache).not.toContain(satz);
      }
      expect(await seitenrand(page)).toEqual([]);

      await page.goto('/statistiken');
      await expect(page.getByRole('button', { name: zeige('Gesamt', sprache), exact: true })).toBeVisible();
      await page.goto('/mehr/darstellung');
      await expect(page.getByRole('heading', { name: zeige('Darstellung', sprache) })).toBeVisible();
      await expect(page.getByRole('switch', { name: zeige('Glühen', sprache) })).toBeVisible();
      await page.goto('/vorbilder');
      await expect(page.getByRole('heading', { name: zeige('Vorbilder', sprache) })).toBeVisible();
      await expect(page.getByText(/%/).first()).toBeVisible();
      await page.goto('/rueckblick');
      expect(await page.locator('main').innerText(), sprache).not.toContain('Bester Tag ·');
    }
  } finally {
    await wiederherstellen(page, vorher).catch(() => undefined);
  }
  expect(fehler).toEqual([]);
});
