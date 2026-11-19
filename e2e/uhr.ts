import { expect, test as basis, type Locator, type Page } from '@playwright/test';

export const TESTZEIT = '2026-11-10T12:00:00+01:00';
export const TESTDATUM = '2026-11-10';

const MITTAG = 12;
const echteSeiten = new WeakSet<Page>();
const aufnahmeHaengt = new WeakSet<object>();

export function testJetzt(): Date {
  const [jahr, monat, tag] = TESTDATUM.split('-').map(Number);
  return new Date(jahr, monat - 1, tag, MITTAG, 0, 0, 0);
}

export async function koppeleAnTestzeit(seite: Page): Promise<void> {
  if (echteSeiten.has(seite)) {
    return;
  }
  await schreibeTesttag(seite, TESTDATUM);
}

async function diagrammSteht(seite: Page): Promise<void> {
  let vorher = '';
  await expect
    .poll(async () => {
      const jetzt = await seite.evaluate(() => {
        const rahmen = document.querySelectorAll('.recharts-wrapper');
        if (rahmen.length === 0) {
          return 'keine';
        }
        const pfade: string[] = [];
        for (const knoten of rahmen) {
          for (const pfad of knoten.querySelectorAll('path')) {
            pfade.push(pfad.getAttribute('d') ?? '');
          }
        }
        if (pfade.length === 0 || pfade.every((pfad) => pfad === '')) {
          return 'leer';
        }
        return pfade.join('\n');
      });
      const stabil = jetzt !== 'leer' && jetzt === vorher;
      vorher = jetzt;
      return stabil;
    })
    .toBe(true);
}

export async function vorbereiteAufnahme(seite: Page): Promise<void> {
  await expect(seite.locator('main div.py-16').filter({ hasText: /^Lädt …$/ })).toHaveCount(0);
  await seite.evaluate(() => document.fonts.ready);
  await diagrammSteht(seite);
}

function haengeAufnahmeAn(seite: Page): void {
  const seitenMuster = Object.getPrototypeOf(seite) as { screenshot: Page['screenshot'] };
  if (!aufnahmeHaengt.has(seitenMuster)) {
    const original = seitenMuster.screenshot;
    seitenMuster.screenshot = async function (this: Page, options) {
      await vorbereiteAufnahme(this);
      return original.call(this, { ...options, animations: 'disabled' });
    };
    aufnahmeHaengt.add(seitenMuster);
  }
  const locatorMuster = Object.getPrototypeOf(seite.locator('html')) as {
    screenshot: Locator['screenshot'];
  };
  if (!aufnahmeHaengt.has(locatorMuster)) {
    const original = locatorMuster.screenshot;
    locatorMuster.screenshot = async function (this: Locator, options) {
      await vorbereiteAufnahme(this.page());
      return original.call(this, { ...options, animations: 'disabled' });
    };
    aufnahmeHaengt.add(locatorMuster);
  }
}

async function schreibeTesttag(seite: Page, datum: string | null): Promise<void> {
  const antwort = await seite.request.post('/api/test/heute', { data: { datum } });
  if (!antwort.ok()) {
    const aktion = datum === null ? 'zurücksetzen' : 'setzen';
    throw new Error(`Testuhr ließ sich nicht ${aktion}: ${antwort.status()} ${await antwort.text()}`);
  }
}

// leseJetzt() steht bei gesetztem Testtag auf dem Mittag und geht nicht weiter.
// Einträge bekommen diesen Zeitpunkt, eine neue Investition bekommt SQLite-now.
// Liegt der Eintrag davor, bleibt sie ungenutzt und das Menü zeigt Löschen.
// clock.install und setFixedTime ersetzen requestAnimationFrame. Die
// Belohnungskarte bleibt dann nach Schließen sichtbar, und warteAufRuhe sieht
// laufende Animationen. Beides braucht die echte Browserzeit.
// echteZeit setzt den Server-Testtag nur für den Test auf null und danach
// wieder auf TESTDATUM. Die Browseruhr bleibt dabei echt, damit Datum von
// Client und Server zusammenpassen. Eine echte Browseruhr bei festem
// Testtag lehnt den Eintrag ab, weil er für den Server in der Zukunft liegt.
export async function stelleTestuhr(seite: Page, uhrLaeuft = false): Promise<void> {
  if (uhrLaeuft) {
    await seite.clock.install({ time: TESTZEIT });
  } else {
    await seite.clock.setFixedTime(TESTZEIT);
  }
  await schreibeTesttag(seite, TESTDATUM);
}

export const test = basis.extend<{ festeUhr: void; uhrLaeuft: boolean; echteZeit: boolean }>({
  uhrLaeuft: [false, { option: true }],
  echteZeit: [false, { option: true }],
  festeUhr: [
    async ({ page, uhrLaeuft, echteZeit }, use) => {
      if (echteZeit) {
        echteSeiten.add(page);
        await schreibeTesttag(page, null);
      } else {
        await stelleTestuhr(page, uhrLaeuft);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      haengeAufnahmeAn(page);
      await use();
      await schreibeTesttag(page, TESTDATUM);
    },
    { auto: true },
  ],
});

export { expect };
export type { APIRequestContext, Browser, Locator, Page, Route, TestInfo } from '@playwright/test';
