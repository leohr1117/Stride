import { expect, test, type Page } from './uhr.ts';
import { TEST_PASSWORT } from './testdaten.ts';

let spracheVorher: string | null = null;

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  spracheVorher = await seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { sprache: string | null };
    return daten.sprache;
  });
  if (spracheVorher === 'de') {
    return;
  }
  const ok = await seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprache: 'de' }),
    });
    return antwort.ok;
  });
  expect(ok).toBe(true);
  await seite.reload();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test.afterEach(async ({ page }) => {
  if (spracheVorher && spracheVorher !== 'de') {
    await page.evaluate(async (sprache) => {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprache }),
      });
    }, spracheVorher);
  }
});

test('Speichern bleibt bei offener Tastatur im sichtbaren Bereich', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/tastatur-speichern/${testInfo.project.name}-${name}.png` });
  const layout = page.viewportSize()?.height ?? 844;
  const hoehe = 460;
  const tastatur = layout - hoehe;

  await page.goto('/faehigkeiten');
  await page.getByRole('button', { name: /Fähigkeit anlegen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Fähigkeit', exact: true });
  await expect(dialog).toHaveCSS('opacity', '1');
  const speichern = dialog.getByRole('button', { name: 'Speichern' });
  await expect(speichern).toBeVisible();
  await bild('offen');

  // Playwright hat keine Bildschirmtastatur. Die Maße ersetzen visualViewport.
  // „Im Viewport“ bestünde auch am alten Dialog, dessen Knopf unter der Tastatur liegt.
  await page.evaluate(
    ({ oben, hoehe: sichtHoehe, tastatur: ueberdeckung }) => {
      const fenster = window as Window & {
        __strideSicht?: { oben: number; hoehe: number; tastatur: number } | null;
      };
      fenster.__strideSicht = { oben, hoehe: sichtHoehe, tastatur: ueberdeckung };
      window.dispatchEvent(new Event('resize'));
    },
    { oben: 0, hoehe, tastatur },
  );

  await expect.poll(async () => {
    return page.evaluate(() => {
      const fenster = document.querySelector('[role="dialog"]');
      const knopf = fenster?.querySelector('button[type="submit"]');
      const felder = fenster?.querySelector('.formular-felder');
      if (!(fenster instanceof HTMLElement) || !(knopf instanceof HTMLElement) || !(felder instanceof HTMLElement)) {
        return null;
      }
      const wurzel = getComputedStyle(document.documentElement);
      const oben = Number.parseFloat(wurzel.getPropertyValue('--sicht-oben'));
      const sichtHoehe = Number.parseFloat(wurzel.getPropertyValue('--sicht-hoehe'));
      const kasten = knopf.getBoundingClientRect();
      const fensterKasten = fenster.getBoundingClientRect();
      const mitte = document.elementFromPoint(kasten.left + kasten.width / 2, kasten.top + kasten.height / 2);
      return {
        tastaturAn: document.documentElement.dataset.tastatur === 'an',
        tastatur: Number.parseFloat(wurzel.getPropertyValue('--tastatur')),
        oben,
        sichtHoehe,
        knopfUnten: kasten.bottom,
        knopfOben: kasten.top,
        fensterUnten: fensterKasten.bottom,
        fensterOben: fensterKasten.top,
        trifft: mitte instanceof Node && knopf.contains(mitte),
        scroll: felder.scrollTop,
        hoeher: felder.scrollHeight > felder.clientHeight + 8,
        imFuss: !felder.contains(knopf),
      };
    });
  }).toMatchObject({
    tastaturAn: true,
    tastatur,
    oben: 0,
    sichtHoehe: hoehe,
    trifft: true,
    scroll: 0,
    hoeher: true,
    imFuss: true,
  });

  const lage = await page.evaluate(() => {
    const fenster = document.querySelector('[role="dialog"]');
    const knopf = fenster?.querySelector('button[type="submit"]');
    const kasten = knopf?.getBoundingClientRect();
    const fensterKasten = fenster?.getBoundingClientRect();
    return {
      knopfUnten: kasten?.bottom ?? 9999,
      knopfOben: kasten?.top ?? -1,
      fensterUnten: fensterKasten?.bottom ?? 9999,
      fensterOben: fensterKasten?.top ?? -1,
    };
  });
  expect(lage.fensterOben).toBeGreaterThanOrEqual(-1);
  expect(lage.fensterUnten).toBeLessThanOrEqual(hoehe + 1);
  expect(lage.knopfOben).toBeGreaterThanOrEqual(0);
  expect(lage.knopfUnten).toBeLessThanOrEqual(hoehe + 1);
  await bild('tastatur');

  await dialog.getByRole('textbox', { name: 'Titel' }).fill('Tastaturprobe');
  await expect(speichern).toBeEnabled();
  await speichern.click({ trial: true });
  const scroll = await page.evaluate(() => {
    const felder = document.querySelector('[role="dialog"] .formular-felder');
    return felder instanceof HTMLElement ? felder.scrollTop : -1;
  });
  expect(scroll).toBe(0);
});
