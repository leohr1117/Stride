import { expect, test, type Page } from './uhr.ts';
import {
  RECHT_FASSUNG,
  RECHT_FASSUNG_BESTAND,
  ZUSTIMMUNG_DIALOG_TITEL,
  ZUSTIMMUNG_KNOPF,
} from '../shared/recht/fassung.ts';
import { schreibePfadVariable } from '../server/umgebung.ts';
import { verweigereEchteDatenbank } from '../server/testpfad.ts';
import { TEST_APP, TEST_PASSWORT, TEST_ZUGANG } from './testdaten.ts';

process.env.STRIDE_TEST = '1';
schreibePfadVariable('DB_PFAD', TEST_APP);
schreibePfadVariable('ZUGANG_PFAD', TEST_ZUGANG);
verweigereEchteDatenbank(TEST_APP);
verweigereEchteDatenbank(TEST_ZUGANG);

const NUTZER = 'testvoll';
const EINTRAG = 'Eintrag loggen';

async function schliesseKopie(): Promise<void> {
  const { schliesseDatenbank } = await import('../server/db.ts');
  const { schliesseZugang } = await import('../server/features/zugang/zugang.ts');
  schliesseDatenbank();
  schliesseZugang();
}

async function setzeFassung(fassung: string): Promise<void> {
  try {
    const { listeKonten, setzeZustimmungsFassung } = await import('../server/features/zugang/zugang.ts');
    const konto = listeKonten().find((eintrag) => eintrag.benutzername === NUTZER);
    if (!konto) {
      throw new Error(`Das Konto ${NUTZER} fehlt.`);
    }
    setzeZustimmungsFassung(konto.id, fassung);
  } finally {
    await schliesseKopie();
  }
}

async function liesFassung(): Promise<string | null> {
  try {
    const { listeKonten, liesZustimmung } = await import('../server/features/zugang/zugang.ts');
    const konto = listeKonten().find((eintrag) => eintrag.benutzername === NUTZER);
    if (!konto) {
      throw new Error(`Das Konto ${NUTZER} fehlt.`);
    }
    return liesZustimmung(konto.id)?.fassung ?? null;
  } finally {
    await schliesseKopie();
  }
}

async function hauptknopfGesperrt(seite: Page): Promise<boolean> {
  return seite.evaluate((name) => {
    const wurzel = document.getElementById('root');
    if (!wurzel || wurzel.inert !== true) {
      return false;
    }
    const knoepfe = [...document.querySelectorAll('button')].filter((knopf) => {
      const text = (knopf.textContent ?? '').replace(/\s+/g, ' ').trim();
      return text === name || knopf.getAttribute('aria-label') === name;
    });
    return knoepfe.length > 0 && knoepfe.every((knopf) => wurzel.contains(knopf));
  }, EINTRAG);
}

test('Alte Fassung sperrt die App, bis die neue Fassung angenommen ist', async ({ page }) => {
  expect(RECHT_FASSUNG_BESTAND).not.toBe(RECHT_FASSUNG);
  try {
    await setzeFassung(RECHT_FASSUNG_BESTAND);
    expect(await liesFassung()).toBe(RECHT_FASSUNG_BESTAND);

    await page.goto('/');
    await page.locator('input[name="username"]').fill(NUTZER);
    await page.locator('input[name="password"]').fill(TEST_PASSWORT);
    await page.getByRole('button', { name: 'Anmelden' }).click();

    const dialog = page.getByRole('alertdialog', { name: ZUSTIMMUNG_DIALOG_TITEL });
    await expect(dialog).toBeVisible();
    await expect.poll(() => hauptknopfGesperrt(page)).toBe(true);

    await dialog.getByRole('button', { name: ZUSTIMMUNG_KNOPF, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#root')).toHaveJSProperty('inert', false);
    await expect(page.getByRole('button', { name: EINTRAG })).toBeVisible();

    const status = await page.evaluate(async () => {
      const antwort = await fetch('/api/zugang');
      return antwort.json() as Promise<{ zustimmungAktuell?: boolean }>;
    });
    expect(status.zustimmungAktuell).toBe(true);
    expect(await liesFassung()).toBe(RECHT_FASSUNG);
  } finally {
    await setzeFassung(RECHT_FASSUNG);
  }
});
