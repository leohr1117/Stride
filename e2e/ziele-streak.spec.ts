import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, heuteDerWelt } from './helfer.ts';

interface ProjektKurz {
  id: number;
  name: string;
  archiviert: boolean;
  visionId: number | null;
  organisationId: number | null;
  standardVorlageId: number;
  kette: { laenge: number; angeknackst: boolean };
}

interface Farben {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
}

function verschiebe(tag: string, tage: number): string {
  const [jahr, monat, tagZahl] = tag.split('-').map(Number);
  const datum = new Date(Date.UTC(jahr ?? 0, (monat ?? 1) - 1, tagZahl ?? 1));
  datum.setUTCDate(datum.getUTCDate() + tage);
  return datum.toISOString().slice(0, 10);
}

function zeile(seite: Page, id: number): Locator {
  return seite.locator('[data-zeile]').filter({ has: seite.locator(`a[href="/projekte/${id}"]`) });
}

async function projekte(seite: Page): Promise<ProjektKurz[]> {
  const antwort = await seite.request.get('/api/ziele');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { projekte: ProjektKurz[] };
  return daten.projekte;
}

async function legeEintrag(seite: Page, projektId: number, vorlageId: number, datum: string): Promise<number> {
  const antwort = await seite.request.post('/api/eintraege', {
    data: {
      projektId,
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

async function farben(seite: Page): Promise<Farben> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  return (await antwort.json()) as Farben;
}

async function stelleFarben(seite: Page, daten: Farben, zurueck: boolean): Promise<void> {
  const koerper = zurueck
    ? { stil: daten.stil, glimmen: daten.glimmen, farbenZuruecksetzen: true }
    : {
        stil: daten.stil,
        primaer: daten.primaer,
        akzent: daten.akzent,
        hintergrund: daten.hintergrund,
        glimmen: daten.glimmen,
      };
  const antwort = await seite.request.patch('/api/einstellungen', { data: koerper });
  expect(antwort.ok()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Die Nebenzeile eines Projekts beginnt mit dem Streak und rechts steht nur das Level', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const original = await farben(page);
  const eintraege: number[] = [];
  const angelegt: number[] = [];
  let farbenGeaendert = false;
  try {
    let liste = await projekte(page);
    let mit = liste.find((projekt) => !projekt.archiviert && projekt.kette.laenge >= 2);
    if (!mit) {
      const basis = liste.find((projekt) => !projekt.archiviert);
      expect(basis).toBeTruthy();
      if (!basis) {
        return;
      }
      const heute = await heuteDerWelt(page);
      for (const tag of [verschiebe(heute, -1), heute]) {
        eintraege.push(await legeEintrag(page, basis.id, basis.standardVorlageId, tag));
      }
      liste = await projekte(page);
      mit = liste.find((projekt) => projekt.id === basis.id);
    }
    expect(mit).toBeTruthy();
    if (!mit) {
      return;
    }
    const serie = mit;
    const gleicheEltern = (projekt: ProjektKurz) =>
      projekt.visionId === serie.visionId && projekt.organisationId === serie.organisationId;
    let ohne =
      liste.find((projekt) => !projekt.archiviert && projekt.id !== serie.id && projekt.kette.laenge < 2 && gleicheEltern(projekt)) ??
      liste.find((projekt) => !projekt.archiviert && projekt.id !== serie.id && projekt.kette.laenge < 2);
    if (!ohne) {
      const erstellt = await page.request.post('/api/projekte', {
        data: {
          name: 'Folge leer',
          beschreibung: '',
          visionId: null,
          organisationId: null,
          standardVorlageId: serie.standardVorlageId,
        },
      });
      expect(erstellt.ok()).toBe(true);
      ohne = (await erstellt.json()) as ProjektKurz;
      angelegt.push(ohne.id);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ziele');
    await expect(page.getByRole('heading', { name: 'Ziele', level: 1 })).toBeVisible();

    const mitZeile = zeile(page, serie.id);
    const ohneZeile = zeile(page, ohne.id);
    await expect(mitZeile).toBeVisible();
    await expect(ohneZeile).toBeVisible();
    await mitZeile.scrollIntoViewIfNeeded();
    await ohneZeile.scrollIntoViewIfNeeded();

    const neben = mitZeile.locator('.zeile-neben');
    const aufbau = await neben.evaluate((element) => {
      const stil = getComputedStyle(element);
      const zeilenhoehe = Number.parseFloat(stil.lineHeight);
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const svg = element.querySelector('svg');
      const svgKasten = svg?.getBoundingClientRect();
      const nebenKasten = element.getBoundingClientRect();
      const spans = [...element.querySelectorAll('span')];
      const streak = element.querySelector('svg')?.parentElement ?? null;
      const ruhe = spans.find((span) => (span.textContent ?? '').trim().startsWith('·'));
      const streakKasten = streak?.getBoundingClientRect();
      const ruheKasten = ruhe?.getBoundingClientRect();
      const probe = document.createElement('span');
      probe.style.color = 'var(--streak)';
      document.body.append(probe);
      const streakFarbe = getComputedStyle(probe).color;
      probe.style.color = 'var(--leise)';
      const leiseFarbe = getComputedStyle(probe).color;
      probe.remove();
      const ruheStil = ruhe ? getComputedStyle(ruhe) : null;
      return {
        text,
        hoehe: element.getBoundingClientRect().height,
        zeilenhoehe,
        nowrap: stil.whiteSpace === 'nowrap',
        ellipse: stil.textOverflow === 'ellipsis' || ruheStil?.textOverflow === 'ellipsis',
        svgBreite: svgKasten?.width ?? -1,
        svgAmAnfang: svgKasten !== undefined && svgKasten.x - nebenKasten.x <= 2,
        streakFarbe: streak ? getComputedStyle(streak).color : '',
        sollStreak: streakFarbe,
        ruheFarbe: ruhe ? getComputedStyle(ruhe).color : '',
        leiseFarbe,
        angeknackst: text.includes('angeknackst'),
        gleicheZeile:
          streakKasten !== undefined &&
          ruheKasten !== undefined &&
          Math.abs(streakKasten.y - ruheKasten.y) <= 2,
      };
    });
    expect(aufbau.text).toMatch(/^\d[\d.]* Tage(?: · angeknackst)? · /);
    expect(aufbau.text).toMatch(/Eintr(?:ag|äge)/);
    expect(aufbau.text).toContain('Vorhaben offen');
    expect(aufbau.nowrap).toBe(true);
    expect(aufbau.ellipse).toBe(true);
    expect(aufbau.gleicheZeile).toBe(true);
    expect(aufbau.hoehe).toBeLessThan(aufbau.zeilenhoehe * 2);
    expect(aufbau.svgAmAnfang).toBe(true);
    expect(Math.abs(aufbau.svgBreite - 12)).toBeLessThanOrEqual(1);
    expect(aufbau.streakFarbe).toBe(aufbau.angeknackst ? aufbau.leiseFarbe : aufbau.sollStreak);
    expect(aufbau.ruheFarbe).toBe(aufbau.leiseFarbe);

    const wert = mitZeile.locator('[data-zeile-wert]');
    await expect(wert).toHaveText(/^Lvl \d+$/);
    await expect(wert.locator('xpath=..')).toHaveText(/^Lvl \d+$/);
    await expect(mitZeile.locator('.zeile-neben svg')).toHaveCount(1);

    const mitKasten = await wert.boundingBox();
    const ohneKasten = await ohneZeile.locator('[data-zeile-wert]').boundingBox();
    const mitHoehe = await mitZeile.boundingBox();
    const ohneHoehe = await ohneZeile.boundingBox();
    expect(mitKasten && ohneKasten && mitHoehe && ohneHoehe).toBeTruthy();
    if (mitKasten && ohneKasten && mitHoehe && ohneHoehe) {
      expect(Math.abs(mitKasten.x + mitKasten.width - (ohneKasten.x + ohneKasten.width))).toBeLessThanOrEqual(2);
      expect(Math.abs(mitHoehe.height - ohneHoehe.height)).toBeLessThanOrEqual(1);
    }

    if (testInfo.project.name === 'handy') {
      fs.mkdirSync('tmp-test/ziele-streak', { recursive: true });
      const aufnahme = async (name: string, breite: number, dunkel: boolean) => {
        await page.setViewportSize({ width: breite, height: 844 });
        await page.emulateMedia({ colorScheme: dunkel ? 'dark' : 'light' });
        if (original.eigeneFarben || original.stil !== 'standard') {
          await stelleFarben(page, { ...original, stil: 'standard' }, true);
          farbenGeaendert = true;
        }
        await page.goto('/ziele');
        await expect(page.locator('html')).toHaveAttribute('data-schema', dunkel ? 'dark' : 'light');
        const ziel = zeile(page, serie.id);
        await expect(ziel).toBeVisible();
        await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await page.screenshot({ path: `tmp-test/ziele-streak/${name}.png` });
      };
      await aufnahme('390-hell', 390, false);
      await aufnahme('390-dunkel', 390, true);
      await aufnahme('360-dunkel', 360, true);
      await aufnahme('360-hell', 360, false);
    }
  } finally {
    for (const id of eintraege) {
      await page.request.delete(`/api/eintraege/${id}`);
    }
    for (const id of angelegt) {
      await page.request.delete(`/api/projekte/${id}`);
    }
    if (farbenGeaendert) {
      await stelleFarben(page, original, !original.eigeneFarben);
    }
  }
});
