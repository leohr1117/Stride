import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';
import { wochenSchluessel } from '../client/src/features/eintraege/wochenvergleich.ts';
import { expect, test, TESTZEIT, type Page } from './uhr.ts';

function xpText(xp: number): string {
  return `+${new Intl.NumberFormat('de-DE').format(xp)} XP`;
}

async function schalteRueckblick(seite: Page, an: boolean): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', {
    data: { funktionen: { rueckblick: an } },
  });
  expect(antwort.ok()).toBe(true);
}

async function pruefeVergleich(seite: Page): Promise<void> {
  const woche = wochenSchluessel(new Date(TESTZEIT));
  const antwort = await seite.request.get(`/api/rueckblick?woche=${woche}`);
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { woche: string; xp: number; xpVorwoche: number };
  expect(daten.woche).toBe(woche);

  const kasten = seite.locator('[data-wochenvergleich]');
  await expect(kasten).toBeVisible();
  await expect(seite.locator('.chronik-tag, .leer').first()).toBeVisible();
  const diese = kasten.locator('[data-woche="diese"]');
  const vor = kasten.locator('[data-woche="vor"]');
  await expect(diese).toContainText('Diese Woche');
  await expect(vor).toContainText('Vorwoche');
  await expect(diese).toContainText(xpText(daten.xp));
  await expect(vor).toContainText(xpText(daten.xpVorwoche));
  await expect(kasten).not.toContainText('Beispielwert');

  const lage = await kasten.evaluate((element) => {
    const mass = (knoten: Element | null) => {
      if (!knoten) {
        return null;
      }
      const kasten = knoten.getBoundingClientRect();
      return { x: kasten.x, y: kasten.y, rechts: kasten.right, unten: kasten.bottom, breite: kasten.width };
    };
    const linke = element.querySelector('[data-woche="diese"]');
    const rechte = element.querySelector('[data-woche="vor"]');
    const probe = document.createElement('span');
    probe.className = 'text-fortschritt';
    document.body.append(probe);
    const fortschritt = getComputedStyle(probe).color;
    probe.remove();
    const xp = linke?.querySelector('[data-wochen-xp]') ?? null;
    return {
      kasten: mass(element),
      diese: mass(linke),
      vor: mass(rechte),
      xp: mass(xp),
      label: mass(linke?.querySelector('[data-wochen-label]') ?? null),
      liste: mass(document.querySelector('main .chronik-tag, main .leer')),
      link: mass(document.querySelector('main a[href="/rueckblick"]')),
      xpFarbe: xp ? getComputedStyle(xp).color : '',
      fortschritt,
    };
  });

  expect(lage.xpFarbe).toBe(lage.fortschritt);
  if (!lage.kasten || !lage.diese || !lage.vor || !lage.xp || !lage.label) {
    throw new Error('Wochenvergleich ohne Kästen');
  }
  expect(lage.diese.x).toBeLessThan(lage.vor.x);
  expect(Math.abs(lage.diese.y - lage.vor.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(lage.diese.breite - lage.vor.breite)).toBeLessThanOrEqual(1);
  expect(Math.abs(lage.diese.rechts - lage.vor.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(lage.diese.x - lage.kasten.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(lage.vor.rechts - lage.kasten.rechts)).toBeLessThanOrEqual(1);
  expect(lage.xp.unten).toBeLessThanOrEqual(lage.label.y + 1);
  if (lage.liste) {
    expect(lage.kasten.unten).toBeLessThanOrEqual(lage.liste.y + 1);
  }
  if (lage.link) {
    expect(lage.kasten.unten).toBeLessThanOrEqual(lage.link.y + 1);
  }
  await ohneSeitlichenUeberlauf(seite);
}

test('Verlauf stellt diese Woche und die Vorwoche nebeneinander', async ({ page }) => {
  let angemeldet = false;
  try {
    await anmelden(page);
    angemeldet = true;
    await page.goto('/chronik');
    await expect(page.getByRole('heading', { name: 'Verlauf', exact: true })).toBeVisible();
    await pruefeVergleich(page);

    await schalteRueckblick(page, false);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Verlauf', exact: true })).toBeVisible();
    await expect(page.locator('main a[href="/rueckblick"]')).toHaveCount(0);
    await pruefeVergleich(page);
  } finally {
    if (angemeldet) {
      await schalteRueckblick(page, true);
    }
  }
});
