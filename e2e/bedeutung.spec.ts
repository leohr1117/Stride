import { expect, test, type Page } from '@playwright/test';
import { kontrast } from '../shared/spiel/farben.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface Darstellung {
  stil: string;
  glimmen: boolean;
  primaer: string;
  akzent: string;
  hintergrund: string;
  ansichtFarben: Partial<Record<string, { primaer: string; akzent: string; hintergrund: string }>>;
}

async function leseDarstellung(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      glimmen: daten.glimmen,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      ansichtFarben: daten.ansichtFarben ?? {},
    };
  });
}

async function speichere(seite: Page, koerper: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (daten) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    return antwort.ok;
  }, koerper);
  expect(ok).toBe(true);
}

async function variable(seite: Page, name: string): Promise<string> {
  return seite.evaluate((schluessel) => getComputedStyle(document.documentElement).getPropertyValue(schluessel).trim(), name);
}

async function berechneteFarbe(seite: Page, auswahl: string, eigenschaft: 'color' | 'backgroundColor' | 'stroke'): Promise<string> {
  return seite.locator(auswahl).first().evaluate((element, feld) => {
    const stil = getComputedStyle(element);
    if (feld === 'stroke') {
      return stil.stroke;
    }
    return feld === 'color' ? stil.color : stil.backgroundColor;
  }, eigenschaft);
}

test('Feste Bedeutungsfarben in Palette Dunkel', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await anmelden(page);
  const original = await leseDarstellung(page);
  const standardFarben = original.ansichtFarben.standard;
  const projekt = testInfo.project.name;
  const bild = (name: string) => page.screenshot({ path: `tmp-test/bedeutung/${projekt}-${name}.png`, fullPage: true });

  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.locator('[data-kopf] .klassenbild')).toBeVisible();
    const kopfVorher = await page.evaluate(() => {
      const ring = document.querySelector('[data-kopfring]');
      const bildKnoten = document.querySelector('[data-kopf] .klassenbild');
      if (!(ring instanceof Element) || !(bildKnoten instanceof Element)) {
        return null;
      }
      const ringFarbe = getComputedStyle(ring).stroke;
      const bildStil = getComputedStyle(bildKnoten);
      return { ring: ringFarbe, hintergrund: bildStil.backgroundColor, schrift: bildStil.color };
    });
    expect(kopfVorher).not.toBeNull();
    if (kopfVorher) {
      expect(kopfVorher.ring).not.toBe(kopfVorher.hintergrund);
      expect(kopfVorher.ring).not.toBe(kopfVorher.schrift);
    }

    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
    const gespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.locator('button.rounded-xl').filter({ hasText: 'Standard' }).click();
    await gespeichert;
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
    const dunkelGespeichert = page.waitForResponse(
      (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
    );
    await page.getByRole('region', { name: 'Standard' }).getByRole('button', { name: 'Dunkel', exact: true }).click();
    await dunkelGespeichert;
    await expect.poll(() => variable(page, '--fortschritt')).toBe('#60a5fa');
    await expect.poll(() => variable(page, '--streak')).toBe('#fb923c');
    await expect.poll(() => variable(page, '--gefahr')).toBe('#f87171');
    await expect.poll(() => variable(page, '--erfolg')).toBe('#4ade80');
    await expect.poll(() => variable(page, '--fokus')).toBe('#60a5fa');
    await expect.poll(() => variable(page, '--schalter-an')).toBe('#60a5fa');
    await expect.poll(() => variable(page, '--schalter-knopf-an')).toBe('#141414');
    await expect.poll(() => variable(page, '--schalter-aus')).toBe('#262626');
    await expect.poll(() => variable(page, '--schalter-knopf-aus')).toBe('#949494');
    const xp = await variable(page, '--xp');
    const akzent = await variable(page, '--akzent');
    expect(xp).not.toBe(akzent);

    await page.goto('/');
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect(page.locator('[data-wochenwert="XP diese Woche"] .text-fortschritt')).toBeVisible();
    const woche = await berechneteFarbe(page, '[data-wochenwert="XP diese Woche"] .text-fortschritt', 'color');
    const fortschritt = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = '#60a5fa';
      document.body.append(probe);
      const wert = getComputedStyle(probe).color;
      probe.remove();
      return wert;
    });
    expect(woche).toBe(fortschritt);
    const flamme = page.locator('[data-wochenwert="Streak"] .lucide-flame');
    await expect(flamme).toBeVisible();
    const flammenFarbe = await berechneteFarbe(page, '[data-wochenwert="Streak"] .lucide-flame', 'color');
    expect(flammenFarbe).not.toBe('rgb(138, 138, 138)');
    if ((await page.locator('[data-wochenwert="Streak"] .text-streak').count()) > 0) {
      expect(flammenFarbe).toBe(
        await page.evaluate(() => {
          const probe = document.createElement('span');
          probe.style.color = '#fb923c';
          document.body.append(probe);
          const wert = getComputedStyle(probe).color;
          probe.remove();
          return wert;
        }),
      );
    }
    const ringHtml = await page.locator('.levelring').first().innerHTML();
    expect(ringHtml.toLowerCase()).not.toContain('fill="white"');
    expect(ringHtml).not.toContain('conic-gradient');
    expect(ringHtml).not.toContain('feGaussianBlur');
    expect(ringHtml).not.toContain('levelring-spitze-schein');
    expect(ringHtml).toContain('stroke="var(--fortschritt)"');
    expect(ringHtml).toContain('stroke="var(--flaeche-2)"');
    expect(ringHtml).not.toContain('--akzent');
    const kopf = await page.evaluate(() => {
      const ring = document.querySelector('[data-kopfring]');
      const bildKnoten = document.querySelector('[data-kopf] .klassenbild');
      if (!(ring instanceof Element) || !(bildKnoten instanceof Element)) {
        return null;
      }
      return {
        ring: getComputedStyle(ring).stroke,
        hintergrund: getComputedStyle(bildKnoten).backgroundColor,
        schrift: getComputedStyle(bildKnoten).color,
      };
    });
    expect(kopf).not.toBeNull();
    if (kopf) {
      expect(kopf.ring).toBe(fortschritt);
      expect(kopf.ring).not.toBe(kopf.hintergrund);
      expect(kopf.ring).not.toBe(kopf.schrift);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('heute');

    await page.goto('/ziele');
    await expect(page.getByRole('heading', { name: 'Ziele', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('ziele');

    await page.goto('/mehr');
    await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('mehr');

    await page.goto('/');
    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await expect(dialog).toBeVisible();
    const schalter = dialog.getByRole('switch', { name: 'Meilenstein' });
    await expect(schalter).toBeVisible();
    const zeile = schalter.locator('xpath=..');
    const knopf = zeile.locator('.schalter-knopf');
    const bahn = zeile.locator('.schalter-bahn');
    const farbeVon = async (ziel: typeof knopf, feld: 'backgroundColor') =>
      ziel.evaluate((element, eigenschaft) => getComputedStyle(element)[eigenschaft], feld);
    const knopfAus = await farbeVon(knopf, 'backgroundColor');
    const bahnAus = await farbeVon(bahn, 'backgroundColor');
    expect(kontrast(knopfAus, bahnAus)).toBeGreaterThanOrEqual(3);
    const linksAus = await knopf.evaluate((element) => element.getBoundingClientRect().left);
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-checked', 'true');
    const knopfAn = await farbeVon(knopf, 'backgroundColor');
    const bahnAn = await farbeVon(bahn, 'backgroundColor');
    expect(kontrast(knopfAn, bahnAn)).toBeGreaterThanOrEqual(3);
    await expect.poll(() => knopf.evaluate((element) => element.getBoundingClientRect().left)).toBeGreaterThan(linksAus);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/bedeutung/${projekt}-dialog.png` });
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    await expect(frage).toBeVisible();
    await frage.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(dialog).toBeHidden();
  } finally {
    if (standardFarben) {
      await speichere(page, { stil: 'standard', ...standardFarben });
    } else {
      await speichere(page, { stil: 'standard', farbenZuruecksetzen: true });
    }
    await speichere(page, {
      stil: original.stil,
      glimmen: original.glimmen,
      primaer: original.primaer,
      akzent: original.akzent,
      hintergrund: original.hintergrund,
    });
  }
});
