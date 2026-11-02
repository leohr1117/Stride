import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const MS_PRO_TAG = 86_400_000;

function tagPlus(tag: string, tage: number): string {
  const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
  const zeitpunkt = new Date(Date.UTC(jahr, monat - 1, tagImMonat) + tage * MS_PRO_TAG);
  const monatNeu = String(zeitpunkt.getUTCMonth() + 1).padStart(2, '0');
  const tagNeu = String(zeitpunkt.getUTCDate()).padStart(2, '0');
  return `${zeitpunkt.getUTCFullYear()}-${monatNeu}-${tagNeu}`;
}

function tageZwischen(von: string, bis: string): number {
  const utc = (tag: string) => {
    const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
    return Date.UTC(jahr, monat - 1, tagImMonat);
  };
  return Math.round((utc(bis) - utc(von)) / MS_PRO_TAG);
}

function heuteLokal(): string {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0');
  const tag = String(jetzt.getDate()).padStart(2, '0');
  return `${jetzt.getFullYear()}-${monat}-${tag}`;
}

function lokalesDatum(iso: string): string {
  const datum = new Date(iso);
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monat}-${tag}`;
}

async function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/kette-heute', { recursive: true });
  await seite.screenshot({ path: `tmp-test/kette-heute/${name}.png` });
}

async function beideBreiten(seite: Page, name: string): Promise<void> {
  await seite.setViewportSize({ width: 390, height: 844 });
  await ohneSeitlichenUeberlauf(seite);
  await bild(seite, `kette-390-${name}`);
  await seite.setViewportSize({ width: 1440, height: 900 });
  await ohneSeitlichenUeberlauf(seite);
  await bild(seite, `kette-1440-${name}`);
}

async function schutzSchonDa(seite: Page): Promise<boolean> {
  const antwort = await seite.request.get('/api/eintraege?nurMeilensteine=true&limit=50');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { eintraege: { typ: string; protokoll?: { art: string } }[] };
  return daten.eintraege.some((zeile) => zeile.typ === 'protokoll' && zeile.protokoll?.art === 'schutz_eingesetzt');
}

async function letzterEintragTag(seite: Page): Promise<string> {
  const antwort = await seite.request.get('/api/eintraege?limit=100');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { eintraege: { typ: string; eintrag?: { erstelltAm: string } }[] };
  const eintrag = daten.eintraege.find((zeile) => zeile.typ === 'eintrag' && zeile.eintrag);
  if (!eintrag?.eintrag) {
    throw new Error('Kein Eintrag in der Chronik.');
  }
  return lokalesDatum(eintrag.eintrag.erstelltAm);
}

async function freieVorlage(seite: Page): Promise<number> {
  const antwort = await seite.request.get('/api/vorlagen');
  expect(antwort.ok()).toBe(true);
  const vorlagen = (await antwort.json()) as { id: number; archiviert: boolean; projektId: number | null }[];
  const vorlage = vorlagen.find((eintrag) => !eintrag.archiviert && eintrag.projektId === null);
  if (!vorlage) {
    throw new Error('Keine freie Tätigkeit.');
  }
  return vorlage.id;
}

async function legeEintrag(seite: Page, vorlageId: number, datum: string): Promise<number> {
  const antwort = await seite.request.post('/api/eintraege', {
    data: {
      projektId: null,
      vorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: null,
      notiz: '',
      meilenstein: false,
      faehigkeitId: null,
      datum,
    },
  });
  if (!antwort.ok()) {
    throw new Error(`Eintrag ${datum} ${antwort.status()} ${await antwort.text()}`);
  }
  const daten = (await antwort.json()) as { eintrag: { id: number } };
  return daten.eintrag.id;
}

async function loescheStill(seite: Page, id: number): Promise<void> {
  const antwort = await seite.request.delete(`/api/eintraege/${id}`);
  if (antwort.status() !== 204 && antwort.status() !== 404) {
    throw new Error(`Löschen ${id} Status ${antwort.status()}`);
  }
}

async function dialogBleibtZeile(seite: Page, zeile: string): Promise<void> {
  const karte = seite.locator(`[data-kette="${zeile}"]`);
  await karte.getByRole('button', { name: 'Eintrag' }).click();
  await expect(seite.getByRole('dialog', { name: 'Was hast du getan?' })).toBeVisible();
  await seite.keyboard.press('Escape');
  await expect(seite.getByRole('dialog')).toHaveCount(0);
  await expect(karte).toBeVisible();
}

async function pruefeChronik(seite: Page, projekt: string): Promise<void> {
  await seite.goto('/chronik');
  await expect(seite.getByRole('heading', { name: 'Verlauf', exact: true })).toBeVisible();
  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const anfang = seite.getByRole('dialog', { name: 'Filter' });
  await expect(anfang.getByRole('switch', { name: 'Nur Meilensteine' })).toBeChecked();
  await seite.keyboard.press('Escape');
  await expect(anfang).toBeHidden();
  const eingesetzt = seite.locator('[data-protokoll="schutz_eingesetzt"]');
  await expect(eingesetzt).toBeVisible();
  await expect(seite.locator('[data-protokoll="schutz_verdient"]')).toBeVisible();
  await eingesetzt.click();
  await expect(seite.getByRole('dialog')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(seite);
  await bild(seite, `${projekt}-chronik`);

  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const filter = seite.getByRole('dialog', { name: 'Filter' });
  await filter.getByRole('combobox', { name: 'Bereich' }).click();
  const bereich = seite.getByRole('dialog', { name: 'Bereich' });
  await bereich.getByRole('option').nth(1).click();
  await bereich.getByRole('button', { name: 'Anwenden' }).click();
  await filter.getByRole('button', { name: 'Anwenden' }).click();
  await expect(seite.locator('[data-protokoll]')).toHaveCount(0);

  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const zurueck = seite.getByRole('dialog', { name: 'Filter' });
  await zurueck.getByRole('button', { name: 'Zurücksetzen' }).click();
  await zurueck.getByRole('button', { name: 'Anwenden' }).click();
  await expect(eingesetzt).toBeVisible();

  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const chips = seite.getByRole('dialog', { name: 'Filter' });
  await chips.locator('.chip-reihe button').nth(1).click();
  await chips.getByRole('button', { name: 'Anwenden' }).click();
  await expect(seite.locator('[data-protokoll]')).toHaveCount(0);

  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const alle = seite.getByRole('dialog', { name: 'Filter' });
  await alle.getByRole('button', { name: 'Alle', exact: true }).click();
  await alle.getByRole('button', { name: 'Anwenden' }).click();
  await expect(eingesetzt).toBeVisible();
  await ohneSeitlichenUeberlauf(seite);
  await bild(seite, `${projekt}-chronik-filter`);
}

test('Kettenfehler bleibt in Heute', async ({ page }, testInfo) => {
  await anmelden(page);
  await page.route('**/api/kette/heute', (route) => route.abort());
  await page.reload();
  await expect(page.locator('[data-heute]')).toContainText('Etwas ist schiefgelaufen.');
  await expect(page.getByText('Server nicht erreichbar.')).toHaveCount(0);
  await expect(page.locator('[data-wochenwert="Streak"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
  await expect(page.getByText('Momentum')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Basis' })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${testInfo.project.name}-fehler`);
});

test('Streak-Info öffnet sich', async ({ page }, testInfo) => {
  await anmelden(page);
  const info = page.locator('[data-wochenwert="Streak"]').getByRole('button', { name: 'Info' });
  await info.click();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveText('Ein Tag Pause ist frei. Danach ist der Streak angeschlagen.');
  await expect(tooltip).not.toContainText('Kette');
  await expect(tooltip).not.toContainText('unter Heute');
  const verdeckt = await page.evaluate(() => {
    const kasten = document.querySelector('[role="tooltip"]')?.getBoundingClientRect();
    const zahlen = ['Streak', 'Momentum'].map((name) =>
      document.querySelector(`[data-wochenwert="${name}"] .zahl`)?.getBoundingClientRect(),
    );
    if (!kasten || zahlen.some((zahl) => !zahl)) {
      return true;
    }
    return zahlen.some((zahl) => {
      const box = zahl as DOMRect;
      return !(kasten.right < box.left || kasten.left > box.right || kasten.bottom < box.top || kasten.top > box.bottom);
    });
  });
  expect(verdeckt).toBe(false);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${testInfo.project.name}-streak-info`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('Laufend ohne Angriffe zeigt den ersten Boss ohne Datum', async ({ page }, testInfo) => {
  await anmelden(page);
  const vorher = await page.request.get('/api/einstellungen');
  expect(vorher.ok()).toBe(true);
  const daten = (await vorher.json()) as { funktionen: { bossAngriffe: boolean } };
  try {
    const aus = await page.request.patch('/api/einstellungen', { data: { funktionen: { bossAngriffe: false } } });
    expect(aus.ok()).toBe(true);
    await page.goto('/laufend');
    await expect(page.getByText('Erste Version raus')).toBeVisible();
    await expect(page.getByText(/Erwacht|Entsteht/)).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild(page, `${testInfo.project.name}-laufend-aus`);
    const an = await page.request.patch('/api/einstellungen', { data: { funktionen: { bossAngriffe: true } } });
    expect(an.ok()).toBe(true);
    await page.reload();
    await expect(page.getByText(/Erwacht|Entsteht/)).not.toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild(page, `${testInfo.project.name}-laufend-an`);
  } finally {
    await page.request.patch('/api/einstellungen', { data: { funktionen: { bossAngriffe: daten.funktionen.bossAngriffe } } });
  }
});

test('Kette auf Heute und Protokoll in der Chronik', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await anmelden(page);
  if (await schutzSchonDa(page)) {
    await pruefeChronik(page, testInfo.project.name);
    return;
  }

  const ausgang = page.viewportSize() ?? { width: 390, height: 844 };
  const angelegt: number[] = [];
  try {
    const heute = heuteLokal();
    const letzter = await letzterEintragTag(page);
    const abstand = tageZwischen(letzter, heute);
    if (abstand < 3 || abstand > 10) {
      throw new Error(`Abstand ${abstand} zwischen ${letzter} und ${heute} liegt außerhalb von 3 bis 10.`);
    }
    const vorlage = await freieVorlage(page);
    const streakTag = tagPlus(heute, -2);
    const bruchTag = tagPlus(heute, -3);
    // Der Eintrag von vorgestern kommt zuerst. Sonst sieht die Pflege den Bruchtag und öffnet die Rückkehr, bevor der Streak steht.
    if (abstand >= 4) {
      angelegt.push(await legeEintrag(page, vorlage, streakTag));
      const bis = tagPlus(heute, -4);
      for (let tag = tagPlus(letzter, 1); tag <= bis; tag = tagPlus(tag, 1)) {
        angelegt.push(await legeEintrag(page, vorlage, tag));
      }
      await page.goto('/');
      await expect(page.locator('[data-kette="streak"]')).toContainText('Pause aufgebraucht');
      await expect(page.locator('[data-kette="rueckkehr"]')).toHaveCount(0);
      await expect(page.locator('[data-kette="schutz"]')).toHaveCount(0);
      await dialogBleibtZeile(page, 'streak');
      await beideBreiten(page, 'streak');
      await page.setViewportSize(ausgang);
      angelegt.push(await legeEintrag(page, vorlage, bruchTag));
      const streakId = angelegt[0];
      if (streakId === undefined) {
        throw new Error('Kein Eintrag für den Streak.');
      }
      await loescheStill(page, streakId);
    }
    await page.goto('/');
    await expect(page.locator('[data-kette="rueckkehr"]')).toBeVisible();
    await expect(page.locator('[data-kette="schutz"]')).toContainText('Hält die');
    await expect(page.locator('[data-kette="streak"]')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert="Streak"] .text-streak')).toHaveCount(0);
    await dialogBleibtZeile(page, 'rueckkehr');
    const heuteInfo = page.locator('[data-heute]').getByRole('button', { name: 'Info' });
    await heuteInfo.click();
    await expect(page.getByRole('tooltip')).toContainText('Ein Eintrag in sieben Tagen');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await beideBreiten(page, 'schutz');
    await page.setViewportSize(ausgang);

    await page.locator('[data-kette="schutz"]').getByRole('button', { name: 'Einsetzen' }).click();
    await expect(page.locator('[data-kette="schutz"]')).toHaveCount(0);
    await expect(page.locator('[data-kette="rueckkehr"]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Rückkehr +')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert="Streak"] .text-streak')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await beideBreiten(page, 'danach');
    await page.setViewportSize(ausgang);
    await pruefeChronik(page, 'kette');
  } finally {
    await page.request.post('/api/kette/schutz', { data: {} }).catch(() => undefined);
    for (const id of angelegt) {
      await loescheStill(page, id).catch(() => undefined);
    }
    await page.setViewportSize(ausgang).catch(() => undefined);
  }
});
