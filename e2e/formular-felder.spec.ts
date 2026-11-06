import fs from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function blattImBild(dialog: Locator): Promise<void> {
  const kasten = await dialog.boundingBox();
  const fenster = dialog.page().viewportSize();
  expect(kasten).not.toBeNull();
  expect(fenster).not.toBeNull();
  if (!kasten || !fenster) {
    return;
  }
  expect(kasten.x).toBeGreaterThanOrEqual(-1);
  expect(kasten.x + kasten.width).toBeLessThanOrEqual(fenster.width + 1);
  const zuBreit = await dialog.evaluate((el) => {
    const koerper = el.querySelector('.dialog-koerper');
    const ziel = koerper instanceof HTMLElement ? koerper : el;
    return ziel.scrollWidth > ziel.clientWidth + 1;
  });
  expect(zuBreit).toBe(false);
  const ausreisser = await dialog.evaluate((el) => {
    const grenze = el.getBoundingClientRect();
    for (const knotenEl of el.querySelectorAll('input, select, textarea, button, p, label')) {
      if (!(knotenEl instanceof HTMLElement)) {
        continue;
      }
      const kasten = knotenEl.getBoundingClientRect();
      if (kasten.width < 1 || kasten.height < 1) {
        continue;
      }
      let vorfahr = knotenEl.parentElement;
      let imQuerScroll = false;
      while (vorfahr && vorfahr !== el) {
        const stil = getComputedStyle(vorfahr);
        if (stil.overflowX === 'auto' || stil.overflowX === 'scroll') {
          imQuerScroll = true;
          break;
        }
        vorfahr = vorfahr.parentElement;
      }
      if (imQuerScroll) {
        continue;
      }
      if (kasten.right > grenze.right + 1 || kasten.left < grenze.left - 1) {
        return (knotenEl.innerText || knotenEl.getAttribute('aria-label') || knotenEl.tagName).slice(0, 80);
      }
    }
    const alle = [el, ...el.querySelectorAll('*')];
    for (const knoten of alle) {
      if (!(knoten instanceof HTMLElement)) {
        continue;
      }
      const stil = getComputedStyle(knoten);
      const quer = stil.overflowX === 'auto' || stil.overflowX === 'scroll';
      if (quer && stil.scrollbarWidth !== 'none' && knoten.scrollWidth > knoten.clientWidth + 1) {
        return `balken ${knoten.className}`.slice(0, 80);
      }
    }
    return '';
  });
  expect(ausreisser).toBe('');
}

async function keinDoppelPlus(wurzel: Locator): Promise<void> {
  const knoepfe = wurzel.locator('button');
  const anzahl = await knoepfe.count();
  for (let index = 0; index < anzahl; index += 1) {
    const knopf = knoepfe.nth(index);
    const text = (await knopf.innerText()).replace(/\s+/g, ' ');
    const plus = text.match(/\+/g)?.length ?? 0;
    const icon = await knopf.locator('.lucide-plus').count();
    expect(plus === 0 || icon === 0, text).toBe(true);
  }
}

async function zeile(text: Locator): Promise<void> {
  const masse = await text.evaluate((el) => {
    const stil = getComputedStyle(el);
    const hohe = parseFloat(stil.lineHeight);
    const kasten = el.getBoundingClientRect();
    return {
      zeilen: Math.round(kasten.height / hohe),
      rechts: kasten.right,
      fenster: window.innerWidth,
    };
  });
  expect(masse.zeilen).toBe(1);
  expect(masse.rechts).toBeLessThanOrEqual(masse.fenster + 1);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Investition trennt Kosten und Wirkung', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/formular-felder', { recursive: true });
  await page.goto('/investitionen');
  await page.getByRole('button', { name: /Investition anlegen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Kosten' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Wirkung' })).toBeVisible();
  await expect(dialog.getByText('Investiert in', { exact: true })).toHaveCount(0);
  await zeile(dialog.getByRole('heading', { name: 'Kosten' }));
  await zeile(dialog.getByRole('heading', { name: 'Wirkung' }));
  await expect(dialog.getByRole('button', { name: 'Bezahlt mit · Ressourcen' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Eigener Betrag', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Bonus für · Ressourcen' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Auch für · Keins' })).toBeVisible();
  const speichern = dialog.getByRole('button', { name: 'Speichern' });
  await expect(speichern).toBeEnabled();

  await dialog.getByRole('button', { name: 'Bezahlt mit · Ressourcen' }).click();
  const wahl = page.getByRole('dialog', { name: 'Bezahlt mit' });
  await wahl.getByRole('option', { name: 'Nichts', exact: true }).click();
  await expect(wahl).toBeHidden();
  await expect(dialog.getByRole('textbox', { name: 'Eigener Betrag', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Kostenlos · Bonus für Ressourcen')).toBeVisible();
  await expect(speichern).toBeEnabled();

  await blattImBild(dialog);
  await keinDoppelPlus(dialog);
  await ohneSeitlichenUeberlauf(page);
  await dialog.getByRole('heading', { name: 'Wirkung' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `tmp-test/formular-felder/${testInfo.project.name}-investition.png` });
});

test('Anlegen zeigt nur ein Plus und Blätter bleiben im Bild', async ({ page }, testInfo) => {
  await page.goto('/mehr/inhalte');
  const taetigkeit = page.getByRole('button', { name: '+ Tätigkeit anlegen', exact: true });
  await expect(taetigkeit.locator('.lucide-plus')).toHaveCount(0);
  await keinDoppelPlus(page.locator('main'));
  await taetigkeit.click();
  const formular = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await blattImBild(formular);
  await formular.getByRole('button', { name: 'Schließen' }).click();
  await expect(formular).toBeHidden();
  await expect(page).toHaveURL(/\/mehr\/inhalte$/);

  await page.goto('/');
  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const eintrag = page.getByRole('dialog', { name: 'Was hast du getan?' });
  const anlegen = eintrag.getByRole('button', { name: '+ Tätigkeit' });
  await expect(anlegen.locator('.lucide-plus')).toHaveCount(0);
  await keinDoppelPlus(eintrag);
  await blattImBild(eintrag);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/formular-felder/${testInfo.project.name}-eintrag.png` });
  await eintrag.getByRole('button', { name: 'Schließen' }).click();
  await expect(eintrag).toBeHidden();

  await page.goto('/basis');
  const basisKnopf = page.getByRole('button', { name: /Basis-Aufgabe/ }).first();
  await basisKnopf.click();
  const basis = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
  await basis.getByRole('combobox', { name: 'Tätigkeit' }).scrollIntoViewIfNeeded();
  await blattImBild(basis);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/formular-felder/${testInfo.project.name}-basis.png` });
});

test('Auswahlfelder gleichen den Texteingaben', async ({ page }, testInfo) => {
  await page.goto('/basis');
  await page.getByRole('button', { name: /Basis-Aufgabe/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
  const feld = dialog.getByRole('textbox', { name: 'Name' });
  const auswahl = dialog.getByRole('combobox', { name: 'Tätigkeit' });
  const projekt = dialog.getByRole('combobox', { name: 'Projekt' });
  await auswahl.scrollIntoViewIfNeeded();
  const stil = await dialog.evaluate((el) => {
    const name = el.querySelector<HTMLElement>('input.feld-eingabe');
    const liste = el.querySelector<HTMLSelectElement>('select');
    const wahl = el.querySelector<HTMLElement>('[role="combobox"]');
    const werte = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) {
        return null;
      }
      const s = getComputedStyle(el);
      return {
        hoehe: Math.round(el.getBoundingClientRect().height),
        radius: s.borderRadius,
        rand: s.borderTopColor,
        flaeche: s.backgroundColor,
        links: s.paddingLeft,
        ausrichtung: s.textAlign,
        aussehen: s.appearance,
      };
    };
    return { name: werte(name), liste: werte(liste), wahl: werte(wahl) };
  });
  expect(stil.liste).not.toBeNull();
  expect(stil.name).not.toBeNull();
  expect(stil.wahl).not.toBeNull();
  if (!stil.liste || !stil.name || !stil.wahl) {
    return;
  }
  expect(stil.liste.aussehen).toBe('none');
  expect(stil.liste.ausrichtung).toMatch(/left|start/);
  expect(stil.liste.hoehe).toBe(stil.name.hoehe);
  expect(stil.liste.radius).toBe(stil.name.radius);
  expect(stil.liste.flaeche).toBe(stil.name.flaeche);
  expect(stil.liste.links).toBe(stil.name.links);
  expect(stil.wahl.hoehe).toBe(stil.name.hoehe);
  expect(stil.wahl.radius).toBe(stil.name.radius);
  expect(stil.wahl.links).toBe(stil.name.links);
  await expect(feld).toBeVisible();
  await expect(auswahl).toBeVisible();
  await expect(projekt).toBeVisible();
  const pfeil = auswahl.locator('xpath=..').locator('.lucide-chevron-down');
  await expect(pfeil).toBeVisible();
  const pfeilLage = await pfeil.evaluate((el) => {
    const icon = el.getBoundingClientRect();
    const select = el.parentElement?.querySelector('select')?.getBoundingClientRect();
    if (!select || icon.width < 1) {
      return null;
    }
    return {
      innen: icon.left >= select.left - 1 && icon.right <= select.right + 1 && icon.top >= select.top - 1 && icon.bottom <= select.bottom + 1,
      abstandRechts: select.right - icon.right,
    };
  });
  expect(pfeilLage).not.toBeNull();
  expect(pfeilLage?.innen).toBe(true);
  expect(pfeilLage?.abstandRechts).toBeGreaterThanOrEqual(8);
  expect(pfeilLage?.abstandRechts).toBeLessThanOrEqual(24);
  const wahlPfeil = projekt.locator('.lucide-chevron-down');
  await expect(wahlPfeil).toBeVisible();
  await blattImBild(dialog);
  await page.screenshot({ path: `tmp-test/formular-felder/${testInfo.project.name}-auswahl.png` });
});

test('Projekt-Investition bleibt im Blatt', async ({ page }, testInfo) => {
  const projektId = await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    const daten = (await antwort.json()) as { projekte: { id: number; aktiv: boolean }[] };
    return daten.projekte.find((eintrag) => eintrag.aktiv)?.id ?? null;
  });
  expect(projektId).not.toBeNull();
  await page.goto(`/projekte/${projektId}`);
  await page.getByRole('button', { name: 'Investition', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Investition' });
  await expect(dialog.getByRole('switch', { name: 'Investition' })).toBeVisible();
  await blattImBild(dialog);
  await keinDoppelPlus(dialog);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/formular-felder/${testInfo.project.name}-projekt.png` });
});

async function symbolZeile(dialog: Locator): Promise<Locator> {
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.locator('.grid-cols-8')).toHaveCount(0);
  const zeile = dialog.getByRole('combobox', { name: /^Symbol · / });
  await expect(zeile).toBeVisible();
  await zeile.scrollIntoViewIfNeeded();
  const kasten = await zeile.boundingBox();
  expect(kasten).not.toBeNull();
  expect(Math.round(kasten?.height ?? 0)).toBe(48);
  await expect(zeile).toContainText('Symbol');
  await expect(zeile.locator('.lucide-chevron-right')).toBeVisible();
  const felder = dialog.locator('.formular-felder');
  if ((await felder.count()) > 0) {
    await felder.evaluate((element) => {
      element.scrollTop = 0;
    });
  }
  return zeile;
}

test('Symbolwahl ist eine Zeile, das Raster liegt im Blatt', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/symbolwahl', { recursive: true });
  const breite = page.viewportSize()?.width ?? 0;
  const bild = (dialog: Locator, name: string) => dialog.screenshot({ path: `tmp-test/symbolwahl/nachher-${breite}-${name}.png` });

  await page.goto('/mehr/inhalte');
  await page.getByRole('button', { name: '+ Tätigkeit anlegen', exact: true }).click();
  const taetigkeit = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  const zeileTaetigkeit = await symbolZeile(taetigkeit);
  await expect(zeileTaetigkeit.locator('.lucide-sparkles')).toBeVisible();
  await bild(taetigkeit, 'd3-taetigkeit');
  await zeileTaetigkeit.click();
  const raster = page.getByRole('dialog', { name: 'Symbol', exact: true });
  await expect(raster).toBeVisible();
  await expect(raster.locator('.grid-cols-8')).toBeVisible();
  const sparkles = raster.getByRole('gridcell', { name: 'sparkles', exact: true });
  await expect(sparkles).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const flame = raster.getByRole('gridcell', { name: 'flame', exact: true });
  await expect(flame).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const lightbulb = raster.getByRole('gridcell', { name: 'lightbulb', exact: true });
  await expect(lightbulb).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(raster).toBeHidden();
  await expect(zeileTaetigkeit.locator('.lucide-lightbulb')).toBeVisible();
  await expect(taetigkeit.locator('.grid-cols-8')).toHaveCount(0);
  await taetigkeit.getByRole('button', { name: 'Schließen' }).click();
  await expect(taetigkeit).toBeHidden();

  await page.goto('/investitionen');
  await page.getByRole('button', { name: /Investition anlegen/ }).click();
  const investition = page.getByRole('dialog', { name: 'Investition', exact: true });
  const zeileInvestition = await symbolZeile(investition);
  await expect(zeileInvestition.locator('.lucide-gem')).toBeVisible();
  await bild(investition, 'd11-investition');
  await investition.getByRole('button', { name: 'Schließen' }).click();
  await expect(investition).toBeHidden();

  await page.goto('/basis');
  await page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true }).click();
  const basis = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
  const zeileBasis = await symbolZeile(basis);
  await expect(zeileBasis.locator('.lucide-sparkles')).toBeVisible();
  await bild(basis, 'd19-basis');
  await zeileBasis.click();
  const basisRaster = page.getByRole('dialog', { name: 'Symbol', exact: true });
  await basisRaster.getByRole('gridcell', { name: 'leaf', exact: true }).click();
  await expect(basisRaster).toBeHidden();
  await expect(zeileBasis.locator('.lucide-leaf')).toBeVisible();
  await basis.getByRole('button', { name: 'Schließen' }).click();
  await expect(basis).toBeHidden();

  await page.goto('/koennen');
  const koerper = page.getByRole('button', { name: 'Körper', exact: true });
  await koerper.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await koerper.click();
  const attribut = page.getByRole('dialog', { name: 'Körper', exact: true });
  await symbolZeile(attribut);
  await bild(attribut, 'd14-attribut');
  await attribut.getByRole('button', { name: 'Schließen' }).click();

  if (testInfo.project.name === 'handy') {
    const stand = await page.request.get('/api/einstellungen');
    expect(stand.ok()).toBe(true);
    const daten = (await stand.json()) as { funktionen: Record<string, boolean> };
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      const aus = await page.request.patch('/api/einstellungen', {
        data: { funktionen: { ...daten.funktionen, verfallKoennen: false, verfallHaben: false } },
      });
      expect(aus.ok()).toBe(true);
      await page.goto('/koennen');
      const erneut = page.getByRole('button', { name: 'Körper', exact: true });
      await erneut.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await erneut.click();
      const ohne = page.getByRole('dialog', { name: 'Körper', exact: true });
      await expect(ohne).toHaveCSS('opacity', '1');
      await expect(ohne.getByRole('heading', { name: 'Verfall' })).toHaveCount(0);
      await expect(ohne.locator('.grid-cols-8')).toHaveCount(0);
      const felder = ohne.locator('.formular-felder');
      const ueberhang = await felder.evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(ueberhang).toBeLessThanOrEqual(1);
      const knopf = await ohne.getByRole('button', { name: 'Speichern' }).boundingBox();
      expect(knopf).not.toBeNull();
      expect((knopf?.y ?? 0) + (knopf?.height ?? 0)).toBeLessThanOrEqual(844);
    } finally {
      await page.request.patch('/api/einstellungen', { data: { funktionen: daten.funktionen } });
    }
  }
});
