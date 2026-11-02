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
