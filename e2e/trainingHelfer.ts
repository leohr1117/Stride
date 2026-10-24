import { expect, type Page } from '@playwright/test';

const PLAN_NAMEN = ['Unterkörper', 'Rumpf'];

export async function schalte(seite: Page, an: boolean): Promise<void> {
  const schalter = seite.locator('#funktion-training').getByRole('switch', { name: 'Training', exact: true });
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

export async function oben(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  });
}

export async function raeume(seite: Page): Promise<void> {
  const probleme = await seite.evaluate(async (namen) => {
    const hinweise: string[] = [];
    const alsListe = async (pfad: string): Promise<unknown[]> => {
      const antwort = await fetch(pfad);
      if (!antwort.ok) {
        return [];
      }
      const daten: unknown = await antwort.json();
      return Array.isArray(daten) ? daten : [];
    };
    const einheiten = (await alsListe('/api/trainingseinheiten')) as {
      id: number;
      status: string;
      planName: string;
      eintragId: number | null;
    }[];
    for (const einheit of einheiten) {
      if (!namen.includes(einheit.planName)) {
        continue;
      }
      if (einheit.eintragId !== null) {
        const weg = await fetch(`/api/eintraege/${einheit.eintragId}`, { method: 'DELETE' });
        if (!weg.ok) {
          hinweise.push(`eintrag ${einheit.eintragId} ${weg.status}`);
        }
        continue;
      }
      if (einheit.status !== 'offen') {
        continue;
      }
      const weg = await fetch(`/api/trainingseinheiten/${einheit.id}`, { method: 'DELETE' });
      if (!weg.ok) {
        hinweise.push(`einheit ${einheit.id} ${weg.status}`);
      }
    }
    for (const archiv of [false, true]) {
      const pfad = archiv ? '/api/trainingsplaene?archiv=1' : '/api/trainingsplaene';
      const plaene = (await alsListe(pfad)) as { id: number; name: string }[];
      for (const plan of plaene) {
        if (!namen.includes(plan.name)) {
          continue;
        }
        const weg = await fetch(`/api/trainingsplaene/${plan.id}`, { method: 'DELETE' });
        if (!weg.ok) {
          hinweise.push(`plan ${plan.id} ${weg.status}`);
        }
      }
    }
    const einheit = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gewichtEinheit: 'kg' }),
    });
    if (!einheit.ok) {
      hinweise.push(`kg ${einheit.status}`);
    }
    return hinweise;
  }, PLAN_NAMEN);
  expect(probleme).toEqual([]);
}
