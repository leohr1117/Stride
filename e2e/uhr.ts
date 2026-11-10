import { expect, test as basis, type Page } from '@playwright/test';

export const TESTZEIT = '2026-11-10T12:00:00+01:00';
export const TESTDATUM = '2026-11-10';

const MITTAG = 12;

export function testJetzt(): Date {
  const [jahr, monat, tag] = TESTDATUM.split('-').map(Number);
  return new Date(jahr, monat - 1, tag, MITTAG, 0, 0, 0);
}

async function schreibeTesttag(seite: Page, datum: string | null): Promise<void> {
  const antwort = await seite.request.post('/api/test/heute', { data: { datum } });
  if (!antwort.ok()) {
    const aktion = datum === null ? 'zurücksetzen' : 'setzen';
    throw new Error(`Testuhr ließ sich nicht ${aktion}: ${antwort.status()} ${await antwort.text()}`);
  }
}

// kette-heute, heute-aufbau, balken-boss-dialog, benachrichtigungen,
// investition und pruefaufnahmen bleiben bei der echten Uhr. Eigene Tage,
// Animationen, der Schließen-Zustand und die Zeitstempel-Reihenfolge
// brauchen laufende Zeit.
export const test = basis.extend<{ festeUhr: void }>({
  festeUhr: [
    async ({ page }, use) => {
      await page.clock.setFixedTime(TESTZEIT);
      await schreibeTesttag(page, TESTDATUM);
      await use();
      await schreibeTesttag(page, null);
    },
    { auto: true },
  ],
});

export { expect };
export type { APIRequestContext, Browser, Locator, Page, Route, TestInfo } from '@playwright/test';
