import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { ohneSeitlichenUeberlauf } from './helfer.ts';

interface Stand {
  sprache: string | null;
  stil: string;
  glimmen: boolean;
  geburtsjahr: number | null;
  ebenen: Record<string, boolean>;
}

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<Stand> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  const stand = await seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Stand;
    return {
      sprache: daten.sprache,
      stil: daten.stil,
      glimmen: daten.glimmen,
      geburtsjahr: daten.geburtsjahr,
      ebenen: daten.ebenen,
    };
  });
  if (stand.sprache !== 'de') {
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
  return stand;
}

async function speichern(seite: Page, koerper: Record<string, unknown>): Promise<void> {
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

async function stelleStandard(seite: Page): Promise<void> {
  await seite.goto('/mehr/darstellung');
  await expect(seite.getByRole('heading', { name: 'Darstellung', exact: true })).toBeVisible();
  if ((await seite.locator('html').getAttribute('data-stil')) === 'standard') {
    return;
  }
  const gespeichert = seite.waitForResponse(
    (antwort) => antwort.url().includes('/api/einstellungen') && antwort.request().method() === 'PATCH' && antwort.ok(),
  );
  await seite.locator('button.rounded-xl').filter({ hasText: 'Standard' }).click();
  await gespeichert;
  await expect(seite.locator('html')).toHaveAttribute('data-stil', 'standard');
}

function flaecheMindestens(kasten: { width: number; height: number } | null, px: number): void {
  expect(kasten).not.toBeNull();
  expect(kasten!.width).toBeGreaterThanOrEqual(px);
  expect(kasten!.height).toBeGreaterThanOrEqual(px);
}

test('Formular, Warndialog und Toast halten die Maße', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/formulare', { recursive: true });
  const stand = await anmelden(page);
  const bild = (name: string) => page.screenshot({ path: `tmp-test/formulare/${testInfo.project.name}-${name}.png` });
  let visionId: number | null = null;
  let projektId: number | null = null;
  let vorlageId: number | null = null;
  const titel = `Formular ${testInfo.project.name}`;

  try {
    await stelleStandard(page);
    await page.goto('/mehr/inhalte');
    await page.getByRole('button', { name: 'Tätigkeit anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole('textbox', { name: 'Name' });
    const feld = await name.evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      const label = element.labels?.[0] ?? document.querySelector(`label[for="${element.id}"]`);
      const labelUnten = label instanceof HTMLElement ? label.getBoundingClientRect().bottom : kasten.top;
      return { hoehe: kasten.height, schrift: getComputedStyle(element).fontSize, labelUnten, oben: kasten.top };
    });
    expect(feld.hoehe).toBeGreaterThanOrEqual(48);
    expect(feld.schrift).toBe('16px');
    expect(feld.labelUnten).toBeLessThanOrEqual(feld.oben + 1);
    flaecheMindestens(await dialog.getByRole('button', { name: 'Speichern' }).boundingBox(), 48);
    flaecheMindestens(await dialog.getByRole('button', { name: 'Schließen' }).boundingBox(), 48);
    const regler = dialog.getByRole('slider').first();
    await expect(regler).toBeVisible();
    flaecheMindestens(await regler.boundingBox(), 48);
    await ohneSeitlichenUeberlauf(page);
    await bild('taetigkeit');

    await name.click();
    await expect(name).toBeFocused();
    await regler.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 1 });
    await expect(name).not.toBeFocused();
    const art = await page.evaluate(() => {
      const aktiv = document.activeElement;
      return aktiv instanceof HTMLInputElement ? aktiv.type : aktiv?.tagName ?? '';
    });
    expect(art).not.toBe('text');
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 1 }));
    });

    const layout = page.viewportSize()?.height ?? 844;
    const hoehe = 460;
    const tastatur = layout - hoehe;
    await name.click();
    await page.evaluate(
      ({ oben, hoehe: sichtHoehe, tastatur: ueberdeckung }) => {
        const fenster = window as Window & { __strideSicht?: { oben: number; hoehe: number; tastatur: number } | null };
        fenster.__strideSicht = { oben, hoehe: sichtHoehe, tastatur: ueberdeckung };
        window.dispatchEvent(new Event('resize'));
      },
      { oben: 0, hoehe, tastatur },
    );
    const speichernKnopf = dialog.getByRole('button', { name: 'Speichern' });
    await expect.poll(async () => {
      return page.evaluate(() => {
        const fenster = document.querySelector('[role="dialog"]');
        const knopf = fenster?.querySelector('button[type="submit"]');
        const felder = fenster?.querySelector('.formular-felder');
        if (!(knopf instanceof HTMLElement) || !(felder instanceof HTMLElement)) {
          return null;
        }
        const wurzel = getComputedStyle(document.documentElement);
        const kasten = knopf.getBoundingClientRect();
        const sichtHoehe = Number.parseFloat(wurzel.getPropertyValue('--sicht-hoehe'));
        const mitte = document.elementFromPoint(kasten.left + kasten.width / 2, Math.min(kasten.top + kasten.height / 2, sichtHoehe - 2));
        return {
          tastaturAn: document.documentElement.dataset.tastatur === 'an',
          imFenster: kasten.top >= 0 && kasten.bottom <= sichtHoehe + 1,
          trifft: mitte instanceof Node && knopf.contains(mitte),
          scroll: felder.scrollTop,
        };
      });
    }).toMatchObject({ tastaturAn: true, imFenster: true, trifft: true, scroll: 0 });
    await expect(speichernKnopf).toBeVisible();
    await bild('tastatur');
    await page.evaluate(() => {
      const fenster = window as Window & { __strideSicht?: null };
      fenster.__strideSicht = null;
      window.dispatchEvent(new Event('resize'));
    });
    await dialog.getByRole('button', { name: 'Schließen' }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/mehr/profil/jahr');
    const jahr = page.getByRole('spinbutton', { name: 'Geburtsjahr' });
    await jahr.fill('1000');
    const fehler = page.getByRole('alert').filter({ hasText: 'außerhalb des erlaubten Bereichs' });
    await expect(fehler).toBeVisible();
    await expect(fehler).toContainText('⚠');
    await expect(jahr).toHaveAttribute('aria-invalid', 'true');
    await ohneSeitlichenUeberlauf(page);
    await bild('jahr');

    await page.goto('/mehr/profil');
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    const warnung = page.locator('.dialog-warnung');
    await expect(warnung).toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Abmelden?' })).toBeVisible();
    const lage = await warnung.evaluate((element) => {
      const kasten = element.getBoundingClientRect();
      const stil = getComputedStyle(element);
      return {
        oben: kasten.top,
        unten: window.innerHeight - kasten.bottom,
        radius: stil.borderTopLeftRadius,
        untenRechts: stil.borderBottomRightRadius,
      };
    });
    expect(lage.oben).toBeGreaterThan(8);
    expect(lage.unten).toBeGreaterThan(8);
    expect(lage.radius).toBe('12px');
    expect(lage.untenRechts).toBe('12px');
    const abbrechen = warnung.getByRole('button', { name: 'Abbrechen' });
    const abmelden = warnung.getByRole('button', { name: 'Abmelden' });
    flaecheMindestens(await abbrechen.boundingBox(), 48);
    flaecheMindestens(await abmelden.boundingBox(), 48);
    await expect(warnung.getByRole('button', { name: 'Schließen' })).toHaveCount(0);
    await ohneSeitlichenUeberlauf(page);
    await bild('abmelden');
    await abbrechen.click();
    await expect(page.getByRole('heading', { name: 'Konto', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toBeVisible();

    await speichern(page, { ebenen: { ...stand.ebenen, visionen: true, projekte: true } });
    const angelegt = await page.evaluate(async (name) => {
      const lese = async (pfad: string, koerper: unknown) => {
        const antwort = await fetch(pfad, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(koerper),
        });
        if (!antwort.ok) {
          throw new Error(await antwort.text());
        }
        return (await antwort.json()) as { id: number };
      };
      const attribute = (await fetch('/api/attribute').then((antwort) => antwort.json())) as { id: number; archiviert: boolean }[];
      const attributId = attribute.find((attribut) => !attribut.archiviert)?.id;
      if (attributId === undefined) {
        throw new Error('Kein Attribut.');
      }
      const vision = await lese('/api/visionen', {
        titel: name,
        beschreibung: '',
        farbe: '#336699',
        woopErgebnis: '',
        woopHindernis: '',
        woopPlan: '',
        level: null,
      });
      const vorlage = await lese('/api/vorlagen', {
        name: `${name} tun`,
        icon: 'sparkles',
        gewichte: [{ attributId, gewicht: 1 }],
      });
      const projekt = await lese('/api/projekte', {
        name: `${name} projekt`,
        beschreibung: '',
        visionId: vision.id,
        organisationId: null,
        standardVorlageId: vorlage.id,
      });
      return { visionId: vision.id, vorlageId: vorlage.id, projektId: projekt.id };
    }, titel);
    visionId = angelegt.visionId;
    vorlageId = angelegt.vorlageId;
    projektId = angelegt.projektId;
    await page.goto('/ziele');
    const kopf = page.getByRole('button', { name: titel, exact: true });
    await expect(kopf).toBeVisible();
    await kopf.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await kopf.click();
    const vision = page.getByRole('dialog', { name: titel });
    await expect(vision).toBeVisible();
    await vision.getByRole('button', { name: `Aktionen für ${titel}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Archivieren', exact: true }).click();
    await vision.getByRole('button', { name: 'Schließen' }).click();
    await expect(vision).toBeHidden();
    const rueck = page.getByRole('button', { name: 'Rückgängig' });
    await expect(page.getByRole('status')).toContainText(`${titel} archiviert`);
    await rueck.focus();
    await page.waitForTimeout(5200);
    await expect(rueck).toBeVisible();
    await bild('toast');
    await rueck.click();
    await expect(kopf).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
  } finally {
    await page.evaluate(async ({ vision, projekt, vorlage }) => {
      if (projekt !== null) {
        await fetch(`/api/projekte/${projekt}`, { method: 'DELETE' });
      }
      if (vision !== null) {
        await fetch(`/api/visionen/${vision}`, { method: 'DELETE' });
      }
      if (vorlage !== null) {
        await fetch(`/api/vorlagen/${vorlage}`, { method: 'DELETE' });
      }
    }, { vision: visionId, projekt: projektId, vorlage: vorlageId });
    await speichern(page, {
      sprache: stand.sprache,
      stil: stand.stil,
      glimmen: stand.glimmen,
      geburtsjahr: stand.geburtsjahr,
      ebenen: stand.ebenen,
    });
  }
});
