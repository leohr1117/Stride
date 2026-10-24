import { expect, type Page } from '@playwright/test';
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
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

export async function schalte(seite: Page, an: boolean): Promise<void> {
  const schalter = seite.locator('#funktion-aufgaben').getByRole('switch', { name: 'Aufgaben', exact: true });
  const ist = (await schalter.getAttribute('aria-checked')) === 'true';
  if (ist === an) {
    return;
  }
  const antwort = seite.waitForResponse(
    (res) => res.url().includes('/api/einstellungen') && res.request().method() === 'PATCH' && res.ok(),
  );
  await schalter.click();
  await antwort;
}

export async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

interface BauAufgabe {
  id: number;
  name: string;
  heuteEintragId: number | null;
}

export async function raeumeBau(seite: Page): Promise<void> {
  for (const pfad of ['/api/aufgaben', '/api/aufgaben?archiv=1']) {
    const antwort = await seite.request.get(pfad);
    expect(antwort.ok()).toBe(true);
    const liste = (await antwort.json()) as BauAufgabe[];
    for (const aufgabe of liste) {
      if (!aufgabe.name.startsWith('Bau ')) {
        continue;
      }
      if (aufgabe.heuteEintragId !== null) {
        const eintrag = await seite.request.delete(`/api/eintraege/${aufgabe.heuteEintragId}`);
        expect(eintrag.ok()).toBe(true);
      }
      const weg = await seite.request.delete(`/api/aufgaben/${aufgabe.id}`);
      expect(weg.ok()).toBe(true);
    }
  }
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
