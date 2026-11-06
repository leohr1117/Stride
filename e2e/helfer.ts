import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

export async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  const sprache = await seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { sprache: string | null };
    return daten.sprache;
  });
  if (sprache === 'de') {
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

export async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

/** Schaltet „Nur Meilensteine“ im Filterblatt aus und übernimmt das. */
export async function meilensteineAus(seite: Page): Promise<void> {
  await seite.getByRole('button', { name: 'Filter', exact: true }).click();
  const blatt = seite.getByRole('dialog', { name: 'Filter' });
  const schalter = blatt.getByRole('switch', { name: 'Nur Meilensteine' });
  if ((await schalter.getAttribute('aria-checked')) === 'true') {
    await schalter.click();
  }
  await blatt.getByRole('button', { name: 'Anwenden' }).click();
  await expect(blatt).toBeHidden();
}

export async function heuteDerWelt(seite: Page): Promise<string> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as { zeitzone: string | null };
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: daten.zeitzone ?? undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function auswahlZeilen(
  gruppe: Locator,
  rolle: 'radio' | 'checkbox',
  hoehe: number,
  haken: 'rechts' | 'links',
  halbFett: boolean,
): Promise<void> {
  await expect(gruppe).toHaveAttribute('data-flaeche', '');
  await expect(gruppe.locator('[data-flaeche]')).toHaveCount(0);
  const zeilen = gruppe.getByRole(rolle);
  expect(await zeilen.count()).toBeGreaterThan(0);
  await expect(gruppe.locator(`[role="${rolle}"][aria-checked="true"]`)).not.toHaveCount(0);
  const anzahl = await zeilen.count();
  for (let index = 0; index < anzahl; index += 1) {
    const masse = await zeilen.nth(index).evaluate((element) => {
      const stil = getComputedStyle(element);
      const name = element.querySelector('[data-wahl-name]');
      const zeichen = element.querySelector('svg');
      const nameKasten = name?.getBoundingClientRect();
      const zeichenKasten = zeichen?.getBoundingClientRect();
      const gewichtText = name ? getComputedStyle(name).fontWeight : '400';
      const gewicht = gewichtText === 'normal' ? 400 : Number.parseInt(gewichtText, 10);
      return {
        hoehe: element.getBoundingClientRect().height,
        rand: [stil.borderTopWidth, stil.borderRightWidth, stil.borderBottomWidth, stil.borderLeftWidth],
        radius: stil.borderTopLeftRadius,
        flaeche: stil.backgroundColor,
        gewicht,
        zeichen: zeichenKasten ? zeichenKasten.x : null,
        name: nameKasten ? nameKasten.x : null,
        gewaehlt: element.getAttribute('aria-checked') === 'true',
      };
    });
    expect(Math.abs(masse.hoehe - hoehe)).toBeLessThanOrEqual(1);
    expect(masse.rand).toEqual(['0px', '0px', '0px', '0px']);
    expect(Number.parseFloat(masse.radius)).toBe(0);
    expect(masse.flaeche).toBe('rgba(0, 0, 0, 0)');
    expect(masse.name).not.toBeNull();
    if (masse.gewaehlt) {
      expect(masse.zeichen).not.toBeNull();
      if (haken === 'rechts') {
        expect(masse.zeichen!).toBeGreaterThan(masse.name!);
      } else {
        expect(masse.zeichen!).toBeLessThan(masse.name!);
      }
      if (halbFett) {
        expect(masse.gewicht).toBeGreaterThanOrEqual(600);
      } else {
        expect(masse.gewicht).toBeLessThan(600);
      }
    } else {
      expect(masse.zeichen).toBeNull();
      expect(masse.gewicht).toBeLessThan(600);
    }
  }
}
