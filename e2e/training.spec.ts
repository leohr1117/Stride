import { expect, test, type Locator } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './aufgabenHelfer.ts';
import { oben, raeume, schalte } from './trainingHelfer.ts';

const INFO = 'Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert.';

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  await page.goto('/mehr/funktionen');
  const schalter = page.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
  await schalter.waitFor({ state: 'visible' });
  await schalte(page, false);
});

test('Schalter Training sitzt hinter Aufgaben und blendet die Navigation', async ({ page }, testInfo) => {
  const breit = testInfo.project.name === 'desktop';
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-bau/training-schalter/${testInfo.project.name}-${name}.png` });

  await page.goto('/mehr/funktionen');
  const zeile = page.locator('#funktion-training');
  const schalter = zeile.getByRole('switch', { name: 'Training', exact: true });
  await expect(schalter).toBeVisible();
  await expect(schalter).toHaveAttribute('aria-checked', 'false');

  const reihenfolge = await page.locator('[id^="funktion-"]').evaluateAll((knoten) => knoten.map((knoten) => knoten.id));
  const aufgaben = reihenfolge.indexOf('funktion-aufgaben');
  expect(reihenfolge[aufgaben + 1]).toBe('funktion-training');

  const lage = await zeile.locator('button[aria-label="Info"]').evaluate((knopf) => {
    const kasten = knopf.getBoundingClientRect();
    const huelle = knopf.parentElement;
    const abstand = huelle ? Number.parseFloat(getComputedStyle(huelle).marginInlineStart) || 0 : 0;
    const titel = knopf.closest('#funktion-training')?.querySelector('.text-sm');
    const titelKasten = titel?.getBoundingClientRect();
    const delta = titelKasten ? kasten.top + kasten.height / 2 - (titelKasten.top + titelKasten.height / 2) : null;
    return { abstand, delta };
  });
  expect(lage.abstand).toBeGreaterThanOrEqual(5);
  expect(lage.abstand).toBeLessThanOrEqual(8);
  expect(Math.abs(lage.delta ?? 99)).toBeLessThanOrEqual(4);

  const seitenleiste = page.locator('aside.seitenleiste nav');
  const leiste = page.locator('nav.mobilleiste');
  if (breit) {
    await expect(seitenleiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  } else {
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('aus');

  await page.goto('/training');
  await expect(page).toHaveURL('/');

  await page.goto('/mehr/funktionen');
  await zeile.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.getByRole('tooltip')).toHaveText(INFO);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await schalte(page, true);
  await expect(schalter).toHaveAttribute('aria-checked', 'true');

  if (breit) {
    const link = seitenleiste.getByRole('link', { name: 'Training', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/training');
    const texte = (await seitenleiste.locator('a').allInnerTexts()).map((text) => text.trim());
    const trainingIndex = texte.indexOf('Training');
    const aufgabenIndex = texte.indexOf('Aufgaben');
    const basisIndex = texte.indexOf('Basis');
    const vorgaenger = aufgabenIndex >= 0 ? aufgabenIndex : basisIndex >= 0 ? basisIndex : texte.indexOf('Laufend');
    expect(trainingIndex).toBe(vorgaenger + 1);
  } else {
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild('an');

  await page.goto('/training');
  await expect(page).toHaveURL(/\/training$/);
  await page.goto('/mehr/funktionen');

  if (!breit) {
    await page.goto('/mehr');
    const sprung = page.getByRole('link', { name: 'Training', exact: true });
    await expect(sprung).toBeVisible();
    await expect(sprung).toHaveAttribute('href', '/training');
    await expect(leiste.getByRole('link', { name: 'Training', exact: true })).toHaveCount(0);
  }
});

const PLAN_ROUTE = '**/api/trainingsplaene*';

function textfeld(haupt: Locator, name: string, index: number): Locator {
  return haupt.getByRole('textbox', { name, exact: true }).nth(index);
}

test('Liste ohne Feld und Plan-Editor mit Feldern', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const projekt = testInfo.project.name;
  const haupt = page.locator('main');
  const steuerung = { durch: true, wartende: [] as Array<() => void> };
  const loese = () => {
    steuerung.durch = true;
    for (const fn of steuerung.wartende.splice(0)) {
      fn();
    }
  };
  const bild = (name: string) => page.screenshot({ path: `tmp-bau/training-26/${projekt}-${name}.png` });
  try {
    await page.goto('/mehr/funktionen');
    await schalte(page, true);
    await raeume(page);
    await page.goto('/training');
    await expect(haupt.getByText('Noch kein Plan.')).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: '+ Plan', exact: true })).toBeVisible();
    await bild('leer');
    await ohneSeitlichenUeberlauf(page);

    await page.route(PLAN_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ fehler: 'Etwas ist schiefgelaufen.' }),
      });
    });
    await page.reload();
    await expect(haupt.getByText('Etwas ist schiefgelaufen.')).toBeVisible();
    await expect(haupt.getByRole('button', { name: '+ Plan', exact: true })).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'kg', exact: true })).toBeVisible();
    await expect(haupt.getByText('Noch kein Plan.')).toHaveCount(0);
    await bild('fehler');
    await page.unroute(PLAN_ROUTE);

    steuerung.durch = false;
    await page.route(PLAN_ROUTE, async (route) => {
      try {
        if (steuerung.durch || route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        await new Promise<void>((resolve) => {
          steuerung.wartende.push(resolve);
        });
        await route.continue();
      } catch {
        return;
      }
    });
    await page.reload();
    await expect(haupt.getByRole('heading', { name: 'Training', level: 1 })).toBeVisible();
    await expect(haupt.getByText(/^Lädt/)).toBeVisible();
    await expect(haupt.getByRole('button', { name: '+ Plan', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'kg', exact: true })).toBeVisible();
    await bild('laden');
    loese();
    await expect(haupt.getByText('Noch kein Plan.')).toBeVisible();
    await page.unroute(PLAN_ROUTE);

    await haupt.getByRole('button', { name: '+ Plan', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/plaene\/neu$/);
    const taetigkeit = haupt.getByRole('combobox', { name: 'Tätigkeit', exact: true });
    await expect(taetigkeit.locator('option', { hasText: /^Training$/ })).toHaveCount(1);
    await taetigkeit.selectOption({ label: 'Training' });
    await haupt.getByRole('combobox', { name: 'Projekt', exact: true }).selectOption({ value: '' });
    await expect(haupt.locator('input, textarea, select').first()).toBeVisible();
    await expect(haupt.getByRole('link', { name: 'Training', exact: true })).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Archivieren', exact: true })).toHaveCount(0);
    await expect(haupt.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await bild('plan-neu');
    await ohneSeitlichenUeberlauf(page);

    await haupt.getByRole('textbox', { name: 'Name', exact: true }).fill('Unterkörper');
    await textfeld(haupt, 'Sätze', 0).fill('3');
    await textfeld(haupt, 'Wiederholungen', 0).fill('5');
    await textfeld(haupt, 'Gewicht', 0).fill('80');
    await haupt.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/plaene\/neu$/);
    await expect(haupt.getByText('Der Name darf nicht leer sein.')).toBeVisible();
    await expect(textfeld(haupt, 'Sätze', 0)).toHaveValue('3');
    await expect(textfeld(haupt, 'Wiederholungen', 0)).toHaveValue('5');
    await expect(textfeld(haupt, 'Gewicht', 0)).toHaveValue('80');
    await oben(page);
    await bild('plan-fehler');

    await haupt.getByRole('textbox', { name: 'Übung oder Gerät', exact: true }).fill('Kniebeuge');
    await haupt.getByRole('button', { name: 'Aufwärmen hinzufügen', exact: true }).click();
    await textfeld(haupt, 'Sätze', 1).fill('2');
    await textfeld(haupt, 'Wiederholungen', 1).fill('5');
    await textfeld(haupt, 'Gewicht', 1).fill('40');
    await haupt.getByRole('button', { name: 'Eintrag hinzufügen', exact: true }).click();
    await haupt.getByRole('textbox', { name: 'Übung oder Gerät', exact: true }).nth(1).fill('Klimmzug');
    await textfeld(haupt, 'Sätze', 2).fill('3');
    await textfeld(haupt, 'Wiederholungen', 2).fill('8');
    await haupt.getByRole('button', { name: 'Mo', exact: true }).click();
    await haupt.getByRole('button', { name: 'Mi', exact: true }).click();
    await haupt.getByRole('button', { name: 'Fr', exact: true }).click();
    const angelegt = page.waitForResponse(
      (res) => res.url().includes('/api/trainingsplaene') && res.request().method() === 'POST' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'Speichern', exact: true }).click();
    await angelegt;
    await expect(page).toHaveURL(/\/training$/);
    await expect(haupt.getByRole('heading', { name: 'Unterkörper', level: 2 })).toBeVisible();
    await expect(haupt.getByText('Mo · Mi · Fr')).toBeVisible();
    await expect(haupt.getByText('3 × 5 · 80,0 kg')).toBeVisible();
    await expect(haupt.getByText('Aufwärmen · 2 × 5 · 40,0 kg')).toBeVisible();
    await expect(haupt.getByText('3 × 8', { exact: true })).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await bild('training');
    await ohneSeitlichenUeberlauf(page);

    await haupt.getByRole('link', { name: 'Bearbeiten', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/plaene\/\d+$/);
    await expect(haupt.getByRole('heading', { name: 'Plan bearbeiten', level: 1 })).toBeVisible();
    await expect(textfeld(haupt, 'Gewicht', 0)).toHaveValue('80');
    await expect(textfeld(haupt, 'Gewicht', 1)).toHaveValue('40');
    await expect(haupt.getByRole('button', { name: 'Löschen', exact: true })).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Archivieren', exact: true })).toHaveCount(0);
    await oben(page);
    await bild('plan-bearbeiten');

    const aufPfund = page.waitForResponse(
      (res) => res.url().includes('/api/einstellungen') && res.request().method() === 'PATCH' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'lb', exact: true }).click();
    await aufPfund;
    await expect(textfeld(haupt, 'Gewicht', 0)).toHaveValue('176,4');
    await expect(textfeld(haupt, 'Gewicht', 1)).toHaveValue('88,2');
    await oben(page);
    await bild('plan-lb');
    const gespeichert = page.waitForResponse(
      (res) => /\/api\/trainingsplaene\/\d+$/.test(new URL(res.url()).pathname) && res.request().method() === 'PATCH' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'Speichern', exact: true }).click();
    await gespeichert;
    await expect(page).toHaveURL(/\/training$/);
    await expect(haupt.getByText('3 × 5 · 176,4 lb')).toBeVisible();
    await expect(haupt.getByText('Aufwärmen · 2 × 5 · 88,2 lb')).toBeVisible();
    await bild('training-lb');
    const gramm = await page.evaluate(async () => {
      const antwort = await fetch('/api/trainingsplaene');
      return antwort.json() as Promise<
        { name: string; uebungen: { name: string; zielGewichtG: number | null; aufwaermGewichtG: number | null }[] }[]
      >;
    });
    const kniebeuge = gramm.find((plan) => plan.name === 'Unterkörper')?.uebungen.find((uebung) => uebung.name === 'Kniebeuge');
    const klimmzug = gramm.find((plan) => plan.name === 'Unterkörper')?.uebungen.find((uebung) => uebung.name === 'Klimmzug');
    expect(kniebeuge?.zielGewichtG).toBe(80000);
    expect(kniebeuge?.aufwaermGewichtG).toBe(40000);
    expect(klimmzug?.zielGewichtG).toBeNull();

    await haupt.getByRole('button', { name: '+ Plan', exact: true }).click();
    await expect(page).toHaveURL(/\/training\/plaene\/neu$/);
    await expect(haupt.getByRole('combobox', { name: 'Tätigkeit', exact: true })).toBeVisible();
    await haupt.getByRole('textbox', { name: 'Name', exact: true }).fill('Rumpf');
    await haupt.getByRole('textbox', { name: 'Übung oder Gerät', exact: true }).fill('Unterarmstütz');
    await haupt.getByRole('button', { name: 'Dauer', exact: true }).click();
    await textfeld(haupt, 'Sätze', 0).fill('3');
    await textfeld(haupt, 'Sekunden', 0).fill('45');
    await expect(haupt.getByRole('textbox', { name: 'Gewicht', exact: true })).toHaveCount(0);
    await oben(page);
    await bild('plan-dauer');
    await ohneSeitlichenUeberlauf(page);
    await haupt.locator('[data-zurueck]').click();
    await expect(page).toHaveURL(/\/training$/);
    await expect(haupt.getByRole('heading', { name: 'Rumpf', level: 2 })).toHaveCount(0);
    await expect(haupt.getByRole('heading', { name: 'Unterkörper', level: 2 })).toBeVisible();

    const gestartet = page.waitForResponse(
      (res) => res.url().includes('/api/trainingseinheiten') && res.request().method() === 'POST' && res.ok(),
    );
    await haupt.getByRole('button', { name: 'Starten', exact: true }).click();
    await gestartet;
    await expect(haupt.getByText('Einheit läuft')).toBeVisible();
    await expect(haupt.getByText('Unterkörper · gerade gestartet')).toBeVisible();
    await expect(haupt.getByRole('button', { name: 'Öffnen', exact: true }).first()).toBeVisible();
    await expect(haupt.locator('input, textarea, select')).toHaveCount(0);
    await bild('voll');
    await ohneSeitlichenUeberlauf(page);
  } finally {
    loese();
    await page.unroute(PLAN_ROUTE).catch(() => undefined);
    await raeume(page);
  }
});
