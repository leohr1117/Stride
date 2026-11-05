import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function kanal(wert: number): number {
  const anteil = wert / 255;
  return anteil <= 0.04045 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4;
}

function rgb(text: string): [number, number, number, number] {
  const teile = text.match(/[\d.]+/g)?.map(Number) ?? [];
  return [teile[0] ?? 0, teile[1] ?? 0, teile[2] ?? 0, teile[3] ?? 1];
}

function kontrast(farbe: string, grund: string, deckkraft: number): number {
  const [vr, vg, vb, va] = rgb(farbe);
  const [gr, gg, gb] = rgb(grund);
  const deckung = va * deckkraft;
  const rot = vr * deckung + gr * (1 - deckung);
  const gruen = vg * deckung + gg * (1 - deckung);
  const blau = vb * deckung + gb * (1 - deckung);
  const vorn = 0.2126 * kanal(rot) + 0.7152 * kanal(gruen) + 0.0722 * kanal(blau);
  const hinten = 0.2126 * kanal(gr) + 0.7152 * kanal(gg) + 0.0722 * kanal(gb);
  const hell = Math.max(vorn, hinten);
  const dunkel = Math.min(vorn, hinten);
  return (hell + 0.05) / (dunkel + 0.05);
}

async function pfeil(knopf: Locator) {
  return knopf.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    let hintergrund = 'rgba(0, 0, 0, 0)';
    let knoten: Element | null = element;
    while (knoten) {
      const grund = getComputedStyle(knoten).backgroundColor;
      if (grund && grund !== 'rgba(0, 0, 0, 0)' && grund !== 'transparent') {
        hintergrund = grund;
        break;
      }
      knoten = knoten.parentElement;
    }
    return {
      breite: Math.round(kasten.width),
      hoehe: Math.round(kasten.height),
      opacity: Number(stil.opacity),
      farbe: stil.color,
      hintergrund,
      gesperrt: element.getAttribute('aria-disabled'),
      disabled: element instanceof HTMLButtonElement ? element.disabled : false,
    };
  });
}

async function funktionen(seite: Page, werte: Record<string, boolean>): Promise<void> {
  const antwort = await seite.request.patch('/api/einstellungen', { data: { funktionen: werte } });
  expect(antwort.ok()).toBe(true);
}

test('Verlauf, Rückblick, Statistik und Basis', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync('tmp-test/rueckschau-aufbau', { recursive: true });
  const bild = (name: string) =>
    page.screenshot({ path: `tmp-test/rueckschau-aufbau/${testInfo.project.name}-${name}.png` });
  await anmelden(page);
  const vorher = await page.request.get('/api/einstellungen');
  expect(vorher.ok()).toBe(true);
  const stand = (await vorher.json()) as { funktionen: Record<string, boolean> };
  const herkunft = {
    rueckblick: stand.funktionen.rueckblick,
    statistiken: stand.funktionen.statistiken,
    basis: stand.funktionen.basis,
  };

  try {
    await funktionen(page, { rueckblick: false, statistiken: false, basis: true });
    await page.goto('/chronik');
    await expect(page.locator('main h1')).toHaveText('Verlauf');
    const inhalt = page.locator('main');
    await expect(inhalt.getByRole('link', { name: 'Rückblick', exact: true })).toHaveCount(0);
    await expect(inhalt.getByRole('link', { name: 'Statistik', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-filter-punkt]')).toBeVisible();

    await funktionen(page, { rueckblick: true, statistiken: true, basis: true });
    await page.reload();
    await expect(inhalt.getByRole('link', { name: 'Rückblick', exact: true })).toBeVisible();
    await expect(inhalt.getByRole('link', { name: 'Statistik', exact: true })).toBeVisible();

    const zeile = page.locator('[data-schnell]').first();
    await expect(zeile).toBeVisible();
    await expect(zeile.locator('.zahl')).toBeVisible();
    await expect(zeile.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
    await zeile.getByRole('button', { name: /Aktionen für/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    const protokoll = page.locator('[data-protokoll]').first();
    if ((await protokoll.count()) > 0) {
      await expect(protokoll.locator('button')).toHaveCount(0);
      await protokoll.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('verlauf');

    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const blatt = page.getByRole('dialog', { name: 'Filter' });
    const schalter = blatt.getByRole('switch', { name: 'Nur Meilensteine' });
    await expect(schalter).toBeChecked();
    await schalter.click();
    await blatt.getByRole('button', { name: 'Schließen' }).click();
    await expect(blatt).toBeHidden();
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(blatt.getByRole('switch', { name: 'Nur Meilensteine' })).toBeChecked();
    await expect(blatt.getByRole('button', { name: 'Anwenden' })).toBeVisible();
    await expect(blatt.getByRole('button', { name: 'Zurücksetzen' })).toBeVisible();
    await expect(blatt.locator('.chip-reihe')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('filter');
    await blatt.getByRole('button', { name: 'Schließen' }).click();

    await page.goto('/rueckblick');
    await expect(page.locator('main h1')).toHaveText('Rückblick');
    const zurueck = page.getByRole('button', { name: 'Vorherige Woche' });
    const weiter = page.getByRole('button', { name: 'Nächste Woche' });
    await expect(zurueck).toBeVisible();
    await expect(weiter).toBeVisible();
    const woche = page.locator('main p.zahl').first();
    const titel = await woche.innerText();
    const gesperrt = await pfeil(weiter);
    expect(gesperrt.breite).toBe(48);
    expect(gesperrt.hoehe).toBe(48);
    expect(gesperrt.disabled).toBe(false);
    expect(gesperrt.gesperrt).toBe('true');
    expect(gesperrt.opacity).toBe(1);
    expect(kontrast(gesperrt.farbe, gesperrt.hintergrund, gesperrt.opacity)).toBeGreaterThanOrEqual(3);
    const offen = await pfeil(zurueck);
    expect(offen.breite).toBe(48);
    expect(offen.hoehe).toBe(48);
    expect(offen.gesperrt).toBeNull();
    await weiter.click({ force: true });
    await expect(woche).toHaveText(titel);
    await zurueck.click();
    await expect(woche).not.toHaveText(titel);
    await weiter.click();
    await expect(woche).toHaveText(titel);
    const abschnitte = (await page.locator('main h2').allInnerTexts()).map((text) => text.trim());
    const zahlen = abschnitte.indexOf('Zahlen');
    const reflexion = abschnitte.indexOf('Reflexion');
    expect(zahlen).toBeGreaterThanOrEqual(0);
    expect(reflexion).toBeGreaterThan(zahlen);
    for (const name of ['Höhepunkte', 'Veränderung']) {
      const index = abschnitte.indexOf(name);
      if (index >= 0) {
        expect(index).toBeLessThan(zahlen);
      }
    }
    const label = page.getByText('Was lief gut?', { exact: true });
    await expect(label).toBeVisible();
    const labelStil = await label.evaluate((element) => {
      const stil = getComputedStyle(element);
      return { groesse: stil.fontSize, gewicht: Number(stil.fontWeight) };
    });
    expect(labelStil.groesse).toBe('14px');
    expect(labelStil.gewicht).toBeGreaterThanOrEqual(600);
    const feld = page.getByRole('textbox', { name: 'Was lief gut?' });
    const feldStil = await feld.evaluate((element) => {
      const stil = getComputedStyle(element);
      return {
        resize: stil.resize,
        schrift: stil.fontSize,
        abstand: stil.paddingTop,
        waechst: stil.getPropertyValue('field-sizing'),
      };
    });
    expect(feldStil.resize).toBe('none');
    expect(feldStil.schrift).toBe('16px');
    expect(feldStil.abstand).toBe('12px');
    expect(feldStil.waechst).toBe('content');
    const wochenzahlen = page.locator('[data-wochenzahl]');
    await expect(wochenzahlen).toHaveCount(4);
    const kennzahl = await wochenzahlen.first().evaluate((element) => {
      const stil = getComputedStyle(element);
      const probe = document.createElement('span');
      probe.style.color = 'var(--haupt)';
      document.body.append(probe);
      const haupt = getComputedStyle(probe).color;
      probe.remove();
      return {
        groesse: stil.fontSize,
        zeile: stil.lineHeight,
        gewicht: Number(stil.fontWeight),
        haupt: stil.color === haupt,
      };
    });
    expect(kennzahl.groesse).toBe('20px');
    expect(kennzahl.zeile).toBe('24px');
    expect(kennzahl.gewicht).toBe(600);
    expect(kennzahl.haupt).toBe(true);
    const spalten = await page.locator('[data-wochenraster]').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(spalten).toBe(2);
    await expect(page.getByText('Was lief gut?')).toBeVisible();
    await expect(page.getByText('Was nehme ich mit?')).toBeVisible();
    await expect(page.getByText('Worauf konzentriere ich mich nächste Woche?')).toBeVisible();
    await expect(page.getByRole('button', { name: /Speichern/ })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('rueckblick');

    await page.goto('/statistiken');
    await expect(page.locator('main h1')).toHaveText('Statistik');
    const zeitraum = page.getByRole('button', { name: '3 Monate', exact: true });
    await expect(zeitraum).toBeVisible();
    await expect(zeitraum.locator('svg')).toBeVisible();
    await expect(zeitraum).toHaveCSS('font-weight', '600');
    await expect(page.getByRole('button', { name: '12 Monate', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '12 Monate', exact: true }).locator('svg')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Gesamt', exact: true })).toBeVisible();
    const kennzahlen = page.locator('[data-kennzahl]');
    if ((await kennzahlen.count()) === 0) {
      await expect(page.getByText('Noch keine Einträge.', { exact: true })).toBeVisible();
    } else {
      expect(await kennzahlen.count()).toBeGreaterThanOrEqual(5);
      const klasse = (await kennzahlen.first().getAttribute('class')) ?? '';
      expect(klasse).not.toContain('rounded');
      expect(klasse).not.toContain('border');
      await expect(page.getByRole('heading', { name: /XP pro (Woche|Monat)/ })).toBeVisible();
      await expect(page.locator('[data-achsen]').first()).toHaveAttribute('data-achsen', /\d/);
      const achsenText = (await page.locator('[data-achsen]').first().getAttribute('data-achsen')) ?? '';
      const achsen = achsenText.split(' ').map(Number);
      expect(achsen.length).toBeGreaterThan(1);
      expect(achsen[0]).toBe(0);
      const schritt = (achsen[1] ?? 0) - (achsen[0] ?? 0);
      const zehner = 10 ** Math.floor(Math.log10(schritt));
      const norm = Math.round((schritt / zehner) * 1e6) / 1e6;
      expect([1, 2, 5]).toContain(norm);
      for (let index = 1; index < achsen.length; index += 1) {
        expect((achsen[index] ?? 0) - (achsen[index - 1] ?? 0)).toBe(schritt);
      }
      await bild('statistik-wochen');
      await page.getByRole('button', { name: '12 Monate', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'XP pro Monat' })).toBeVisible();
      await expect(page.getByRole('button', { name: '12 Monate', exact: true }).locator('svg')).toBeVisible();
      const mass = async (name: string) => {
        const abschnitt = page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
        const zeile = abschnitt.locator('[data-balken]').first();
        await expect(zeile).toBeVisible();
        return zeile.evaluate((element) => {
          const spur = element.querySelector('.bg-flaeche-2');
          const fuellung = spur?.querySelector('div');
          const nameEl = element.querySelector('.truncate');
          const wert = element.querySelector('.zahl');
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--diagramm-vorbild)';
          document.body.append(probe);
          const diagramm = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            hoehe: spur ? Math.round(spur.getBoundingClientRect().height) : 0,
            name: nameEl ? getComputedStyle(nameEl).fontSize : '',
            wert: wert ? getComputedStyle(wert).fontSize : '',
            farbe: fuellung ? getComputedStyle(fuellung).backgroundColor : '',
            diagramm,
          };
        });
      };
      const taetigkeiten = await mass('Tätigkeiten');
      const projekte = await mass('Projekte');
      expect(taetigkeiten.hoehe).toBe(6);
      expect(projekte.hoehe).toBe(6);
      expect(taetigkeiten.name).toBe('16px');
      expect(projekte.name).toBe('16px');
      expect(taetigkeiten.wert).toBe('13px');
      expect(projekte.wert).toBe('13px');
      expect(taetigkeiten.farbe).toBe(taetigkeiten.diagramm);
      expect(projekte.farbe).not.toBe(taetigkeiten.diagramm);
      await page.getByRole('heading', { name: 'Tätigkeiten', exact: true }).scrollIntoViewIfNeeded();
      await bild('statistik-balken');
    }
    await ohneSeitlichenUeberlauf(page);
    await bild('statistik');

    await page.goto('/basis');
    await expect(page.locator('main h1')).toHaveText('Basis');
    const anlegen = page.getByRole('button', { name: '+ Basis-Aufgabe', exact: true });
    const leer = page.getByRole('button', { name: 'Basis-Aufgabe anlegen', exact: true });
    await expect(anlegen.or(leer)).toBeVisible();
    if ((await anlegen.count()) > 0) {
      const knopf = page.locator('main').getByRole('checkbox').first();
      await expect(knopf).toBeVisible();
      const kasten = await knopf.boundingBox();
      expect(kasten).not.toBeNull();
      expect(Math.round(kasten!.width)).toBe(48);
      expect(Math.round(kasten!.height)).toBe(48);
      const ring = knopf.locator('[data-abhak]');
      const mass = await ring.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          breite: Math.round(box.width),
          hoehe: Math.round(box.height),
          rand: getComputedStyle(element).borderTopWidth,
          haken: element.querySelector('svg') !== null,
          zustand: element.getAttribute('data-abhak'),
        };
      });
      expect(mass.breite).toBe(24);
      expect(mass.hoehe).toBe(24);
      expect(mass.haken).toBe(mass.zustand === 'erledigt');
      expect(mass.rand).toBe(mass.zustand === 'offen' ? '2px' : '0px');
      const erste = page.locator('main [data-schnell]').first();
      await erste.getByRole('button', { name: /Aktionen für/ }).click();
      await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Basis-Aufgabe' })).toBeVisible();
      await page.keyboard.press('Escape');
      await anlegen.click();
    } else {
      await expect(page.getByText('Noch keine Basis-Aufgaben.', { exact: true })).toBeVisible();
      await leer.click();
    }
    const dialog = page.getByRole('dialog', { name: 'Basis-Aufgabe' });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(dialog.getByText('Symbol', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Tätigkeit', exact: true })).toBeVisible();
    await expect(dialog.getByText('Dauer', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('basis');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  } finally {
    await page.request.patch('/api/einstellungen', { data: { funktionen: herkunft } }).catch(() => undefined);
  }
});
