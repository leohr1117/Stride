import { expect, test, type Page } from '@playwright/test';
import { standardVorlage } from '../shared/features/darstellung/paletten.ts';
import type { Farbtrio } from '../shared/features/darstellung/paletten.ts';
import type { Stil } from '../shared/features/darstellung/stile.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

interface Darstellung {
  stil: Stil;
  glimmen: boolean;
  ansichtFarben: Partial<Record<Stil, Farbtrio>>;
}

async function leseDarstellung(seite: Page): Promise<Darstellung> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Darstellung;
    return {
      stil: daten.stil,
      glimmen: daten.glimmen,
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

async function waehleAnsicht(seite: Page, name: string, stil: Stil): Promise<void> {
  const gespeichert = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await seite.locator('button.rounded-xl').filter({ hasText: name }).click();
  await gespeichert;
  await expect.poll(async () => seite.locator('html').getAttribute('data-stil')).toBe(stil);
}

async function eckenRadius(seite: Page, auswahl: string): Promise<string> {
  return seite.locator(auswahl).first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
}

async function kartenEcke(seite: Page): Promise<string> {
  return seite.evaluate(() => {
    const vorhanden = document.querySelector('.karte');
    const ziel = vorhanden ?? document.createElement('section');
    if (!vorhanden) {
      ziel.className = 'karte rounded-2xl';
      document.body.append(ziel);
    }
    const radius = getComputedStyle(ziel).borderTopLeftRadius;
    if (!vorhanden) {
      ziel.remove();
    }
    return radius;
  });
}

async function flaecheGleich(seite: Page, auswahl: string): Promise<boolean> {
  return seite.locator(auswahl).evaluate((element) => {
    const ist = getComputedStyle(element).backgroundColor;
    const probe = document.createElement('div');
    probe.style.background = getComputedStyle(document.documentElement).getPropertyValue('--flaeche');
    document.body.append(probe);
    const soll = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return ist === soll && ist !== 'rgba(0, 0, 0, 0)';
  });
}

test('Standard hat die eckige Form und die Logo-Palette, Minimal bleibt rund', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await anmelden(page);
  const original = await leseDarstellung(page);
  const standardFarben = original.ansichtFarben.standard;
  const projekt = testInfo.project.name;

  try {
    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
    await waehleAnsicht(page, 'Standard', 'standard');
    const zuruecksetzen = page.getByRole('button', { name: 'Auf Palette zurücksetzen', exact: true });
    if (await zuruecksetzen.isEnabled()) {
      const zurueckgesetzt = page.waitForResponse(
        (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
      );
      await zuruecksetzen.click();
      await zurueckgesetzt;
    }
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
    await expect(page.getByRole('switch', { name: 'Glühen', exact: true })).toBeVisible();

    const dunkel = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    const logo = standardVorlage('standard', dunkel);
    const werte = await page.evaluate(() => {
      const stil = getComputedStyle(document.documentElement);
      const schrift = getComputedStyle(document.body);
      return {
        leise: stil.getPropertyValue('--leise').trim(),
        grund: stil.getPropertyValue('--grund').trim(),
        flaeche: stil.getPropertyValue('--flaeche').trim(),
        flaeche2: stil.getPropertyValue('--flaeche-2').trim(),
        rand: stil.getPropertyValue('--rand').trim(),
        haupt: stil.getPropertyValue('--haupt').trim(),
        xp: stil.getPropertyValue('--xp').trim(),
        schrift: schrift.fontFamily,
        groesse: schrift.fontSize,
      };
    });
    expect(werte.leise).toBe(logo.flaechen.leise);
    expect(werte.grund).toBe(logo.hintergrund);
    expect(werte.flaeche).toBe(logo.flaechen.flaeche);
    expect(werte.flaeche2).toBe(logo.flaechen.flaeche2);
    expect(werte.rand).toBe(logo.flaechen.rand);
    expect(werte.haupt).toBe(logo.flaechen.haupt);
    expect(werte.xp).toBe(logo.akzent);
    expect(werte.schrift).toContain('Segoe UI');
    expect(werte.groesse).toBe('16px');
    expect(await page.locator('.mobilkopf h1').evaluate((element) => getComputedStyle(element).textTransform)).toBe('none');
    expect(await eckenRadius(page, '.liste')).toBe(projekt === 'handy' ? '12px' : '8px');
    expect(await eckenRadius(page, '[data-zurueck]')).toBe('8px');
    expect(await page.locator('.knopf').first().evaluate((element) => getComputedStyle(element).minHeight)).toBe('48px');
    const info = page.getByRole('button', { name: /^Info/ }).first();
    const infoLuecke = await info.evaluate((knopf) => {
      const kasten = knopf.getBoundingClientRect();
      const huelle = knopf.parentElement;
      if (!huelle) {
        return -1;
      }
      let zeile: Element = huelle;
      let behaelter = huelle.parentElement;
      if (behaelter && behaelter.childElementCount === 1 && behaelter.previousElementSibling) {
        zeile = behaelter;
        behaelter = behaelter.parentElement;
      }
      if (!behaelter) {
        return -1;
      }
      const bereich = document.createRange();
      bereich.setStart(behaelter, 0);
      bereich.setEndBefore(zeile);
      const iconMitte = kasten.top + kasten.height / 2;
      const rects = [...bereich.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1 && rect.right <= kasten.left + 2);
      const passend = rects
        .map((rect) => ({ rect, dy: Math.abs(rect.top + rect.height / 2 - iconMitte) }))
        .sort((a, b) => a.dy - b.dy || b.rect.right - a.rect.right)[0];
      return passend ? kasten.left - passend.rect.right : -1;
    });
    expect(infoLuecke).toBeGreaterThanOrEqual(4);
    expect(infoLuecke).toBeLessThanOrEqual(12);
    await info.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await info.click();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    expect(await flaecheGleich(page, 'nav.mobilleiste')).toBe(true);
    if (projekt === 'handy') {
      expect(await flaecheGleich(page, '.mobilkopf')).toBe(true);
    }
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-darstellung.png`, fullPage: true });

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
    expect(await eckenRadius(page, '[data-flaeche]')).toBe(projekt === 'handy' ? '12px' : '8px');
    expect(await kartenEcke(page)).toBe('8px');
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-heute.png`, fullPage: true });

    await page.getByRole('button', { name: 'Eintrag loggen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Was hast du getan?' });
    await expect(dialog).toBeVisible();
    const dialogEcken = await page.locator('.dialog-fenster').evaluate((element) => {
      const stil = getComputedStyle(element);
      return [stil.borderTopLeftRadius, stil.borderTopRightRadius, stil.borderBottomRightRadius, stil.borderBottomLeftRadius];
    });
    expect(dialogEcken[0]).toBe('12px');
    expect(dialogEcken[1]).toBe('12px');
    expect(dialogEcken[2]).toBe(projekt === 'handy' ? '0px' : '12px');
    expect(dialogEcken[3]).toBe(projekt === 'handy' ? '0px' : '12px');
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-eintrag.png` });
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/ziele');
    await expect(page.getByRole('heading', { name: 'Ziele', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-ziele.png`, fullPage: true });

    await page.goto('/mehr');
    await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-mehr.png`, fullPage: true });

    await page.goto('/mehr/darstellung');
    await waehleAnsicht(page, 'Minimal', 'minimal');
    await expect(page.getByRole('switch', { name: 'Glühen', exact: true })).toBeVisible();
    await page.goto('/');
    expect(await kartenEcke(page)).toBe('16px');
    await page.goto('/mehr/darstellung');
    await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
    const zurueckMinimal = await eckenRadius(page, '[data-zurueck]');
    expect(Number.parseFloat(zurueckMinimal)).toBeGreaterThan(8);
    await ohneSeitlichenUeberlauf(page);
    await page.screenshot({ path: `tmp-test/standard-stil/${projekt}-minimal.png`, fullPage: true });

    await speichere(page, { stil: 'schlicht' });
    expect((await leseDarstellung(page)).stil).toBe('standard');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
  } finally {
    if (standardFarben) {
      await speichere(page, { stil: 'standard', ...standardFarben });
    }
    await speichere(page, { stil: original.stil, glimmen: original.glimmen });
  }
});
