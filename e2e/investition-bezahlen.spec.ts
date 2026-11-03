import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden } from './helfer.ts';

const NAME = 'Zahlung Prüfung';

interface AttributStand {
  id: number;
  kennung: string | null;
  name: string;
  level: { level: number; xpGesamt: number; xpImLevel: number };
}

interface InvestitionStand {
  id: number;
  name: string;
  bezahltAttributId: number | null;
  betrag: number;
}

async function staende(page: Page): Promise<{ attribute: AttributStand[]; investitionen: InvestitionStand[] }> {
  return page.evaluate(async () => {
    const attribute = (await fetch('/api/attribute').then((antwort) => antwort.json())) as AttributStand[];
    const investitionen = (await fetch('/api/investitionen').then((antwort) => antwort.json())) as InvestitionStand[];
    return { attribute, investitionen };
  });
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
    const eintrag = liste.find((zeile) => zeile.name === titel);
    if (!eintrag) {
      return;
    }
    await fetch(`/api/investitionen/${eintrag.id}`, { method: 'DELETE' });
  }, name);
}

test('Speichern bei leerem Betrag und bei zu wenig XP ändert nichts', async ({ page }) => {
  await anmelden(page);
  await entfernen(page, NAME);
  const basis = await staende(page);
  const zahlAttribut = basis.attribute.find((eintrag) => eintrag.kennung === 'ressourcen');
  expect(zahlAttribut).toBeTruthy();
  if (!zahlAttribut) {
    return;
  }
  const xpId = gutschrift(zahlAttribut.id, 200);
  try {
    await page.goto('/investitionen');
    const vorher = await staende(page);
    const ressourcen = vorher.attribute.find((eintrag) => eintrag.kennung === 'ressourcen');
    expect(ressourcen?.id).toBe(zahlAttribut.id);
    if (!ressourcen) {
      return;
    }
    await page.getByRole('button', { name: /Investition anlegen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(NAME);
    const speichern = dialog.getByRole('button', { name: 'Speichern' });
    await expect(speichern).toBeEnabled();
    await speichern.click();

    const betrag = dialog.getByRole('textbox', { name: 'Eigener' });
    const leer = dialog.getByRole('alert');
    await expect(leer).toContainText('Betrag eingeben oder „Nichts“ wählen');
    await expect(betrag).toBeFocused();
    await expect(betrag).toHaveAttribute('aria-invalid', 'true');
    const leerId = await leer.getAttribute('id');
    const beschrieben = await betrag.getAttribute('aria-describedby');
    expect(leerId).toBeTruthy();
    expect(beschrieben?.split(/\s+/)).toContain(leerId);
    expect((await staende(page)).investitionen.map((eintrag) => eintrag.name)).toEqual(vorher.investitionen.map((eintrag) => eintrag.name));

    const zuViel = ressourcen.level.xpGesamt + ressourcen.level.level + 50;
    await betrag.fill(String(zuViel));
    await betrag.blur();
    const hinweis = await dialog.getByText(/^Verfügbar:/).innerText();
    const menge = hinweis.match(/Verfügbar:\s*(.+)\s+XP/)?.[1];
    expect(menge).toBeTruthy();
    await expect(dialog.getByRole('alert')).toContainText(`Nur ${menge} XP verfügbar`);
    await speichern.click();
    await expect(betrag).toBeFocused();
    await expect(dialog).toBeVisible();
    expect((await staende(page)).investitionen.map((eintrag) => eintrag.name)).toEqual(vorher.investitionen.map((eintrag) => eintrag.name));

    const faellt = ressourcen.level.level > 1 && ressourcen.level.xpImLevel + 1 <= ressourcen.level.xpGesamt;
    const zahl = faellt ? ressourcen.level.xpImLevel + 1 : 1;
    expect(faellt).toBe(true);
    expect(ressourcen.level.xpGesamt).toBeGreaterThanOrEqual(zahl);
    await betrag.fill(String(zahl));
    await betrag.blur();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByText(/Kostet .+ XP aus Ressourcen · Bonus für Ressourcen/)).toBeVisible();
    if (faellt) {
      await expect(dialog.getByText(new RegExp(`fällt auf Level ${ressourcen.level.level - 1}(?!\\d)`))).toBeVisible();
    }
    await speichern.click();
    await expect(dialog).toBeHidden();
    const danach = (await staende(page)).investitionen.find((eintrag) => eintrag.name === NAME);
    expect(danach?.bezahltAttributId).toBe(ressourcen.id);
    expect(danach?.betrag).toBe(zahl);

    await page.getByRole('button', { name: NAME, exact: true }).click();
    const offen = page.getByRole('dialog', { name: 'Investition', exact: true });
    await offen.getByRole('button', { name: `Aktionen für ${NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Löschen' }).click();
    const warnung = page.getByRole('alertdialog');
    await expect(warnung).toContainText(`Die ${zahl} XP gehen zurück an Ressourcen.`);
    await warnung.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(warnung).toBeHidden();
    expect((await staende(page)).investitionen.some((eintrag) => eintrag.name === NAME)).toBe(true);
  } finally {
    await entfernen(page, NAME);
    streicheXp(xpId);
  }
});
