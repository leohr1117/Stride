import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden } from './helfer.ts';

const BETRAG = 20;

function nameFuer(projekt: string): string {
  return `Verlauf ${projekt}`;
}

interface AttributStand {
  id: number;
  kennung: string | null;
  level: { xpGesamt: number };
}

function weltDatei(): string {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return verweigereEchteDatenbank(datei);
}

function gutschrift(attributId: number, xp: number): number {
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    const zeile = db
      .prepare(`INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`)
      .run(attributId, xp, '2099-06-01T00:00:00.000Z');
    return Number(zeile.lastInsertRowid);
  } finally {
    db.close();
  }
}

function streicheXp(id: number): void {
  const db = new DatabaseSync(weltDatei(), { timeout: 5_000 });
  try {
    db.prepare('DELETE FROM xp_ereignisse WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

async function entfernen(page: Page, name: string): Promise<void> {
  await page.evaluate(async (titel) => {
    const liste = (await fetch('/api/investitionen').then((antwort) => antwort.json())) as { id: number; name: string }[];
    for (const eintrag of liste.filter((zeile) => zeile.name === titel)) {
      await fetch(`/api/investitionen/${eintrag.id}`, { method: 'DELETE' });
    }
  }, name);
}

test('Verlauf zeigt die Zahlung und die Rückbuchung', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/investition-verlauf', { recursive: true });
  const NAME = nameFuer(testInfo.project.name);
  await anmelden(page);
  await entfernen(page, NAME);
  const attribute = await page.evaluate(async () => {
    return (await fetch('/api/attribute').then((antwort) => antwort.json())) as AttributStand[];
  });
  const ressourcen = attribute.find((eintrag) => eintrag.kennung === 'ressourcen');
  const koerper = attribute.find((eintrag) => eintrag.kennung === 'koerper');
  expect(ressourcen).toBeTruthy();
  expect(koerper).toBeTruthy();
  if (!ressourcen || !koerper) {
    return;
  }
  const xpId = ressourcen.level.xpGesamt >= BETRAG ? null : gutschrift(ressourcen.id, BETRAG);
  try {
    const angelegt = await page.evaluate(
      async (daten) => {
        const antwort = await fetch('/api/investitionen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(daten),
        });
        if (!antwort.ok) {
          throw new Error(`Anlegen ${antwort.status}`);
        }
        return (await antwort.json()) as { id: number };
      },
      { name: NAME, icon: 'gem', groesse: 1, attributId: koerper.id, bezahltAttributId: ressourcen.id, betrag: BETRAG },
    );
    expect(angelegt.id).toBeGreaterThan(0);

    await page.goto('/chronik');
    await expect(page.getByRole('heading', { name: 'Verlauf' })).toBeVisible();
    const treffer = page.locator('[data-buchung-art="zahlung"]', { hasText: NAME });
    await expect(treffer).toHaveCount(1);
    const zeile = treffer;
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText(`Investition · ${NAME}`);
    await expect(zeile).toContainText('aus Ressourcen');
    await expect(zeile).toContainText(`−${BETRAG} XP`);
    await expect(zeile).not.toHaveClass(/text-xp/);
    const farben = await zeile.evaluate((element) => {
      const titel = element.querySelector('.text-base');
      const betrag = element.querySelector('.zahl');
      const probe = document.createElement('span');
      probe.style.color = 'var(--leise)';
      document.body.append(probe);
      const leise = getComputedStyle(probe).color;
      probe.remove();
      if (!titel || !betrag) {
        return null;
      }
      const stil = getComputedStyle(betrag);
      return {
        betrag: stil.color,
        leise,
        xp: betrag.classList.contains('text-xp'),
        zahlen: stil.fontVariantNumeric.includes('tabular-nums'),
      };
    });
    expect(farben?.xp).toBe(false);
    expect(farben?.betrag).toBe(farben?.leise);
    expect(farben?.zahlen).toBe(true);
    const loeschbar = await zeile.evaluate((element) => element.closest('[data-schnell]') !== null);
    expect(loeschbar).toBe(false);
    await expect(page.getByRole('button', { name: `Aktionen für ${NAME}` })).toHaveCount(0);

    await zeile.click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(NAME);
    await page.screenshot({ path: `tmp-test/investition-verlauf/${testInfo.project.name}-blatt.png` });
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();

    await zeile.screenshot({ path: `tmp-test/investition-verlauf/${testInfo.project.name}-zeile.png` });

    const geloescht = page.locator('[data-buchung-art="geloescht"]', { hasText: `+${BETRAG} XP · Investition gelöscht` });
    const vorher = await geloescht.count();
    await entfernen(page, NAME);
    await page.reload();
    await expect(geloescht).toHaveCount(vorher + 1);
    await expect(page.locator('[data-buchung-art="zahlung"]', { hasText: NAME })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Investition · ${NAME}` })).toHaveCount(0);
  } finally {
    await entfernen(page, NAME);
    if (xpId !== null) {
      streicheXp(xpId);
    }
  }
});
