import { createCipheriv, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { anmelden } from './helfer.ts';
import { expect, test, type Page } from './uhr.ts';

const SATZ = 'Der gespeicherte Token ist nicht mehr lesbar. Gib ihn neu ein.';
const TABELLEN = ['einstellungen', 'todoist_projekte', 'todoist_labels'] as const;

type Tabelle = (typeof TABELLEN)[number];

interface Stand {
  name: Tabelle;
  spalten: string[];
  zeilen: unknown[][];
}

function weltDb(): DatabaseSync {
  const datei = process.env.PLAYWRIGHT_WELT;
  if (!datei) {
    throw new Error('Abbruch: PLAYWRIGHT_WELT fehlt.');
  }
  return new DatabaseSync(verweigereEchteDatenbank(datei), { timeout: 5_000 });
}

function fremdPaket(): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), iv);
  const geheim = Buffer.concat([cipher.update('fremd-token-e2e', 'utf8'), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), geheim]).toString('base64')}`;
}

function sichere(name: Tabelle): Stand {
  const db = weltDb();
  try {
    const info = db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
    const spalten = info.map((zeile) => zeile.name);
    const zeilen = (db.prepare(`SELECT * FROM ${name}`).all() as Record<string, unknown>[]).map((zeile) =>
      spalten.map((spalte) => zeile[spalte] ?? null),
    );
    return { name, spalten, zeilen };
  } finally {
    db.close();
  }
}

function stelleHer(stand: Stand): void {
  const db = weltDb();
  const platzhalter = stand.spalten.map(() => '?').join(', ');
  const einfuegen = db.prepare(`INSERT INTO ${stand.name} (${stand.spalten.join(', ')}) VALUES (${platzhalter})`);
  db.exec('BEGIN');
  try {
    db.prepare(`DELETE FROM ${stand.name}`).run();
    for (const zeile of stand.zeilen) {
      einfuegen.run(...(zeile as (string | number | bigint | null)[]));
    }
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  } finally {
    db.close();
  }
}

function schreibePaket(paket: string): void {
  const db = weltDb();
  try {
    db.prepare(
      `INSERT INTO einstellungen (schluessel, wert) VALUES ('todoistToken', ?)
       ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`,
    ).run(JSON.stringify(paket));
  } finally {
    db.close();
  }
}

async function oeffneTodoist(page: Page): Promise<void> {
  await anmelden(page);
  await page.goto('/mehr/inhalte/verbindungen/todoist');
  await page.locator('#todoist').waitFor();
}

test('Ein unlesbarer Todoist-Token lässt sich neu eingeben', async ({ page }) => {
  const sicherung = TABELLEN.map((name) => sichere(name));
  try {
    schreibePaket(fremdPaket());
    await oeffneTodoist(page);
    const bereich = page.locator('#todoist');
    await expect(bereich.getByText(SATZ)).toBeVisible();
    await expect(bereich.getByRole('textbox', { name: 'API-Token' })).toBeVisible();
    await expect(bereich.getByRole('link', { name: 'Token in Todoist öffnen' })).toHaveCount(0);
    await expect(bereich).not.toContainText('STRIDE_TOKEN_SCHLUESSEL');
    await expect(bereich).not.toContainText('ASCEND_TOKEN_SCHLUESSEL');
    await bereich.getByRole('textbox', { name: 'API-Token' }).fill('e2e-todoist-token');
    await bereich.getByRole('button', { name: 'Verbinden', exact: true }).click();
    await expect(bereich.getByText('Verbunden als Todoist Test')).toBeVisible();
  } finally {
    for (const stand of sicherung) {
      stelleHer(stand);
    }
  }
});
