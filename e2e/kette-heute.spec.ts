import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { kettenLaenge } from '../shared/spiel/kette.ts';
import { SCHUTZ } from '../shared/spiel/schutz.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const SCHUTZ_VORRAT = 'schutz_vorrat';
const SCHUTZ_SCHWELLE = 'schutz_schwelle_verbraucht';
const SCHWELLE_OHNE_VERDIENST = SCHUTZ.schwelleTage * 1000;

const MS_PRO_TAG = 86_400_000;

function tagPlus(tag: string, tage: number): string {
  const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
  const zeitpunkt = new Date(Date.UTC(jahr, monat - 1, tagImMonat) + tage * MS_PRO_TAG);
  const monatNeu = String(zeitpunkt.getUTCMonth() + 1).padStart(2, '0');
  const tagNeu = String(zeitpunkt.getUTCDate()).padStart(2, '0');
  return `${zeitpunkt.getUTCFullYear()}-${monatNeu}-${tagNeu}`;
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

interface RueckkehrZeile {
  id: number;
  status: string;
  geoeffnet_am: string;
  frist_am: string;
  eintrag_id: number | null;
}

interface ProtokollZeile {
  id: number;
  art: string;
  bezug_typ: string | null;
  bezug_id: number | null;
  tag: string | null;
  erstellt_am: string;
}

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

function leseEinstellung(db: DatabaseSync, schluessel: string): string | null {
  const zeile = db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').get(schluessel) as { wert: string } | undefined;
  return zeile?.wert ?? null;
}

function schreibeEinstellung(db: DatabaseSync, schluessel: string, wert: string | null): void {
  if (wert === null) {
    db.prepare('DELETE FROM einstellungen WHERE schluessel = ?').run(schluessel);
    return;
  }
  db.prepare(
    `INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
     ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
  ).run(schluessel, wert);
}

function setzeSchutzZaehler(vorrat: 0 | 1, schwelle: number): void {
  const db = new DatabaseSync(weltDatei());
  schreibeEinstellung(db, SCHUTZ_VORRAT, JSON.stringify(vorrat));
  schreibeEinstellung(db, SCHUTZ_SCHWELLE, JSON.stringify(schwelle));
  db.close();
}

/** Tage, die fehlen, damit die Kette am letzten Eintrag mindestens eine Schutzschwelle lang ist. */
function ketteLuecken(letzter: string): string[] {
  const db = new DatabaseSync(weltDatei());
  const tage = (
    db.prepare(`SELECT DISTINCT date(erstellt_am, 'localtime') AS tag FROM eintraege`).all() as { tag: string }[]
  ).map((zeile) => zeile.tag);
  db.close();
  if (kettenLaenge(tage, letzter) >= SCHUTZ.schwelleTage) {
    return [];
  }
  const fehlend: string[] = [];
  for (let versatz = SCHUTZ.schwelleTage - 1; versatz >= 0; versatz -= 1) {
    const tag = tagPlus(letzter, -versatz);
    if (!tage.includes(tag)) {
      fehlend.push(tag);
    }
  }
  return fehlend;
}

/** Hält alte Rückkehren aus dem Bild. Der Schutzzähler steht so, dass erst der Streak-Eintrag ihn verdient. */
function bereiteKette(heute: string): () => void {
  const db = new DatabaseSync(weltDatei());
  const rueckkehr = db.prepare('SELECT id, status, geoeffnet_am, frist_am, eintrag_id FROM rueckkehr').all() as RueckkehrZeile[];
  const protokoll = db
    .prepare(`SELECT id, art, bezug_typ, bezug_id, tag, erstellt_am FROM protokoll WHERE art LIKE 'rueckkehr%'`)
    .all() as ProtokollZeile[];
  const ab = db.prepare(`SELECT wert FROM einstellungen WHERE schluessel = 'rueckkehr_ab'`).get() as { wert: string } | undefined;
  const vorratVorher = leseEinstellung(db, SCHUTZ_VORRAT);
  const schwelleVorher = leseEinstellung(db, SCHUTZ_SCHWELLE);
  db.exec(`DELETE FROM protokoll WHERE art LIKE 'rueckkehr%'`);
  db.exec('DELETE FROM rueckkehr');
  db.prepare('DELETE FROM streak_bruecken WHERE tag = ?').run(tagPlus(heute, -1));
  schreibeEinstellung(db, SCHUTZ_VORRAT, JSON.stringify(0));
  schreibeEinstellung(db, SCHUTZ_SCHWELLE, JSON.stringify(SCHWELLE_OHNE_VERDIENST));
  const wert = JSON.stringify(heute);
  if (ab) {
    db.prepare(`UPDATE einstellungen SET wert = ? WHERE schluessel = 'rueckkehr_ab'`).run(wert);
  } else {
    db.prepare(`INSERT INTO einstellungen (schluessel, wert) VALUES ('rueckkehr_ab', ?)`).run(wert);
  }
  db.close();
  return () => {
    const wieder = new DatabaseSync(weltDatei());
    wieder.exec(`DELETE FROM protokoll WHERE art LIKE 'rueckkehr%'`);
    wieder.exec('DELETE FROM rueckkehr');
    const rueck = wieder.prepare('INSERT INTO rueckkehr (id, status, geoeffnet_am, frist_am, eintrag_id) VALUES (?, ?, ?, ?, ?)');
    for (const zeile of rueckkehr) {
      rueck.run(zeile.id, zeile.status, zeile.geoeffnet_am, zeile.frist_am, zeile.eintrag_id);
    }
    const vorhanden = wieder.prepare('SELECT art FROM protokoll WHERE id = ?');
    const neu = wieder.prepare(
      'INSERT INTO protokoll (art, bezug_typ, bezug_id, tag, erstellt_am) VALUES (?, ?, ?, ?, ?)',
    );
    const alt = wieder.prepare(
      'INSERT INTO protokoll (id, art, bezug_typ, bezug_id, tag, erstellt_am) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const zeile of protokoll) {
      const da = vorhanden.get(zeile.id) as { art: string } | undefined;
      if (da?.art === zeile.art) {
        continue;
      }
      if (da) {
        neu.run(zeile.art, zeile.bezug_typ, zeile.bezug_id, zeile.tag, zeile.erstellt_am);
        continue;
      }
      alt.run(zeile.id, zeile.art, zeile.bezug_typ, zeile.bezug_id, zeile.tag, zeile.erstellt_am);
    }
    if (ab) {
      wieder
        .prepare(
          `INSERT INTO einstellungen (schluessel, wert) VALUES ('rueckkehr_ab', ?)
           ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
        )
        .run(ab.wert);
    } else {
      wieder.prepare(`DELETE FROM einstellungen WHERE schluessel = 'rueckkehr_ab'`).run();
    }
    schreibeEinstellung(wieder, SCHUTZ_VORRAT, vorratVorher);
    schreibeEinstellung(wieder, SCHUTZ_SCHWELLE, schwelleVorher);
    wieder.close();
  };
}

async function setzeHeute(seite: Page, datum: string | null): Promise<void> {
  const antwort = await seite.request.post('/api/test/heute', { data: { datum } });
  if (!antwort.ok()) {
    throw new Error(`Testuhr ${antwort.status()} ${await antwort.text()}`);
  }
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

async function spracheSetzen(seite: Page, sprache: string): Promise<void> {
  const ok = await seite.evaluate(async (code) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache: code }),
    });
    return antwort.ok;
  }, sprache);
  expect(ok).toBe(true);
  await seite.reload();
}

async function pruefeTextknopf(seite: Page, kennung: string): Promise<void> {
  const zeile = seite.locator(`[data-kette="${kennung}"]`);
  const zeilen = await zeile.locator('[data-kette-satz]').evaluate((element) => {
    const stil = getComputedStyle(element);
    const zeilenhoehe = Number.parseFloat(stil.lineHeight);
    const hoehe = element.getBoundingClientRect().height;
    return { zeilen: Math.round(hoehe / zeilenhoehe), umbruch: stil.whiteSpace };
  });
  expect(zeilen.umbruch).toBe('nowrap');
  expect(zeilen.zeilen).toBe(1);
  const mass = await zeile.getByRole('button', { name: /^\+/ }).evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    const aktion = getComputedStyle(document.documentElement).getPropertyValue('--aktion').trim();
    const probe = document.createElement('span');
    probe.style.color = aktion;
    document.body.append(probe);
    const soll = getComputedStyle(probe).color;
    probe.remove();
    return {
      hoehe: Math.round(kasten.height),
      breite: Math.round(kasten.width),
      hintergrund: stil.backgroundColor,
      farbe: stil.color,
      soll,
    };
  });
  expect(mass.hoehe).toBe(48);
  expect(mass.breite).toBeGreaterThanOrEqual(48);
  expect(mass.hintergrund).toBe('rgba(0, 0, 0, 0)');
  expect(mass.farbe).toBe(mass.soll);
}

async function dialogBleibtZeile(seite: Page, zeile: string): Promise<void> {
  const karte = seite.locator(`[data-kette="${zeile}"]`);
  await karte.getByRole('button', { name: '+ Eintrag', exact: true }).click();
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
  const info = page.locator('[data-wochenwert="Streak"]').getByRole('button', { name: /^Info/ });
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
  let wieder: (() => void) | null = null;
  try {
    const letzter = await letzterEintragTag(page);
    const heute = tagPlus(letzter, 4);
    wieder = bereiteKette(heute);
    await setzeHeute(page, heute);
    const vorlage = await freieVorlage(page);
    const streakTag = tagPlus(heute, -2);
    const bruchTag = tagPlus(heute, -3);
    for (const tag of ketteLuecken(letzter)) {
      angelegt.push(await legeEintrag(page, vorlage, tag));
    }
    setzeSchutzZaehler(0, 0);
    // Der Eintrag von vorgestern kommt zuerst. Sonst sieht die Pflege den Bruchtag und öffnet die Rückkehr, bevor der Streak steht.
    const streakId = await legeEintrag(page, vorlage, streakTag);
    angelegt.push(streakId);
    const bis = tagPlus(heute, -4);
    for (let tag = tagPlus(letzter, 1); tag <= bis; tag = tagPlus(tag, 1)) {
      angelegt.push(await legeEintrag(page, vorlage, tag));
    }
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
    await expect(page.locator('[data-kette="streak"]')).toContainText('Pause genutzt · gestern frei');
    await page.setViewportSize({ width: 390, height: 844 });
    await pruefeTextknopf(page, 'streak');
    await expect(page.locator('[data-kette="streak"]').getByRole('button', { name: /^Info/ })).toHaveCount(1);
    await page.setViewportSize(ausgang);
    await expect(page.locator('[data-kette="rueckkehr"]')).toHaveCount(0);
    await expect(page.locator('[data-kette="schutz"]')).toHaveCount(0);
    await dialogBleibtZeile(page, 'streak');
    await beideBreiten(page, 'streak');
    await page.setViewportSize(ausgang);
    angelegt.push(await legeEintrag(page, vorlage, bruchTag));
    await loescheStill(page, streakId);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
    await expect(page.locator('[data-kette="rueckkehr"]')).toContainText('Streak unterbrochen · bis');
    await expect(page.locator('[data-kette="rueckkehr"]')).toContainText('zurückholen');
    await page.setViewportSize({ width: 390, height: 844 });
    await pruefeTextknopf(page, 'rueckkehr');
    await spracheSetzen(page, 'ru');
    await expect(page.locator('[data-kette="rueckkehr"] [data-kette-satz]')).toContainText('прервана');
    await pruefeTextknopf(page, 'rueckkehr');
    await spracheSetzen(page, 'ja');
    await expect(page.locator('[data-kette="rueckkehr"] [data-kette-satz]')).toContainText('連続');
    await pruefeTextknopf(page, 'rueckkehr');
    await spracheSetzen(page, 'de');
    await page.setViewportSize(ausgang);
    await expect(page.locator('[data-kette="schutz"]')).toContainText('Hält die');
    await expect(page.locator('[data-kette="schutz"]').getByRole('button', { name: 'Einsetzen' })).toBeVisible();
    await expect(page.locator('[data-kette="streak"]')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert="Streak"] .text-streak')).toHaveCount(0);
    await dialogBleibtZeile(page, 'rueckkehr');
    const heuteInfo = page.locator('[data-heute]').getByRole('button', { name: /^Info/ });
    await heuteInfo.click();
    await expect(page.getByRole('tooltip')).toContainText('Ein Eintrag in sieben Tagen');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await beideBreiten(page, 'schutz');
    await page.setViewportSize(ausgang);

    await page.locator('[data-kette="schutz"]').getByRole('button', { name: 'Einsetzen' }).click();
    await expect(page.locator('[data-kette="schutz"]')).toHaveCount(0);
    await expect(page.locator('[data-kette="rueckkehr"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Streak', exact: true })).toBeVisible();
    await expect(page.locator('[data-kette="offen"]')).toContainText('Streak offen · heute eintragen');
    await page.setViewportSize({ width: 390, height: 844 });
    await pruefeTextknopf(page, 'offen');
    await expect(page.locator('[data-kette="offen"]').getByRole('button', { name: /^Info/ })).toHaveCount(1);
    await page.setViewportSize(ausgang);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Rückkehr +')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert="Streak"] .text-streak')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await beideBreiten(page, 'danach');
    await page.setViewportSize(ausgang);
    await pruefeChronik(page, 'kette');
  } finally {
    await setzeHeute(page, null).catch(() => undefined);
    await page.request.post('/api/kette/schutz', { data: {} }).catch(() => undefined);
    for (const id of angelegt) {
      await loescheStill(page, id).catch(() => undefined);
    }
    wieder?.();
    await spracheSetzen(page, 'de').catch(() => undefined);
    await page.setViewportSize(ausgang).catch(() => undefined);
  }
});
