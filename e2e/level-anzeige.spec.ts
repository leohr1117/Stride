import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { LevelRing } from '../client/src/ui/Anzeige.tsx';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function bild(seite: Page, name: string): Promise<void> {
  fs.mkdirSync('tmp-test/level-anzeige', { recursive: true });
  return seite.screenshot({ path: `tmp-test/level-anzeige/${name}.png`, fullPage: true });
}

function bruch(text: string): boolean {
  return /Lvl\s+\d+,\d/.test(text);
}

async function zustandszeile(zeile: Locator, hinweis: Locator, tippen: boolean): Promise<void> {
  await expect(hinweis).toBeVisible();
  const zeichen = hinweis.locator('span[aria-hidden="true"]');
  await expect(zeichen).toHaveText('⚠');
  await expect(zeichen).toHaveClass(/text-gefahr/);
  await expect(zeichen).not.toHaveClass(/text-haupt|bg-gefahr/);
  expect(await zeichen.evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px');
  expect(await hinweis.evaluate((element) => getComputedStyle(element).fontSize)).toBe('13px');
  const name = zeile.locator('[data-attribut-name]').first();
  const nameKasten = await name.boundingBox();
  const hinweisKasten = await hinweis.boundingBox();
  const stufe = zeile.getByText(/^Lvl \d+$/).last();
  await expect(stufe).toHaveClass(/text-gefahr/);
  await expect(stufe).not.toHaveClass(/text-leise/);
  const stufeKasten = await stufe.boundingBox();
  expect(nameKasten && hinweisKasten && stufeKasten).toBeTruthy();
  if (!nameKasten || !hinweisKasten || !stufeKasten) {
    return;
  }
  expect(Math.abs(hinweisKasten.y + hinweisKasten.height / 2 - (nameKasten.y + nameKasten.height / 2))).toBeLessThan(8);
  expect(hinweisKasten.x).toBeGreaterThanOrEqual(nameKasten.x + nameKasten.width - 2);
  expect(stufeKasten.x).toBeGreaterThan(hinweisKasten.x);
  expect(hinweisKasten.height).toBeLessThanOrEqual(24);
  const text = (await hinweis.innerText()).replace(/\s+/g, ' ').trim();
  if (text.includes('Lvl zu niedrig')) {
    await expect(hinweis.getByText('Lvl zu niedrig', { exact: true })).toHaveClass(/text-gefahr/);
    await expect(hinweis.getByRole('button')).toHaveCount(0);
    return;
  }
  const knopf = hinweis.getByRole('button', { name: 'Lvl zu niedrig' });
  await expect(knopf).toBeVisible();
  if (!tippen) {
    return;
  }
  await knopf.click();
  const seite = hinweis.page();
  await expect(seite.getByRole('tooltip')).toContainText('Lvl zu niedrig');
  await seite.keyboard.press('Escape');
  await expect(seite.getByRole('tooltip')).toHaveCount(0);
}

async function pruefeHinweise(seite: Page, klasse: string, tippen: boolean): Promise<void> {
  const hinweise = seite.locator('[data-zustand="zu-niedrig"]');
  const anzahl = await hinweise.count();
  expect(anzahl).toBeGreaterThan(0);
  let getippt = false;
  for (let index = 0; index < anzahl; index += 1) {
    const hinweis = hinweise.nth(index);
    const zeile = hinweis.locator(`xpath=ancestor::div[contains(@class,"${klasse}")][1]`);
    const jetzt = tippen && !getippt && (await hinweis.getByRole('button', { name: 'Lvl zu niedrig' }).count()) > 0;
    await zustandszeile(zeile, hinweis, jetzt);
    if (jetzt) {
      getippt = true;
    }
  }
}

async function flaechePasst(page: Page, spektrum: string): Promise<void> {
  const ziel = page.locator(`[data-spektrum="${spektrum}"]`).first();
  await expect(ziel).toBeVisible();
  await expect.poll(async () => ziel.evaluate((element) => {
    const werte = (element.getAttribute('data-werte') ?? '').split(',').map((teil) => Number(teil)).filter((wert) => Number.isFinite(wert));
    const lesePfad = (knoten: Element | null) => [...(knoten?.getAttribute('d') ?? '').matchAll(/[ML]\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)/gi)].map((treffer) => ({
      x: Number(treffer[1]),
      y: Number(treffer[2]),
    }));
    const flaeche = element.querySelector('path.recharts-polygon');
    const gelesen = lesePfad(flaeche);
    if (gelesen.length > 1) {
      const erster = gelesen[0];
      const letzter = gelesen[gelesen.length - 1];
      if (erster && letzter && Math.hypot(erster.x - letzter.x, erster.y - letzter.y) < 0.05) {
        gelesen.pop();
      }
    }
    const gitter = [...element.querySelectorAll('path.recharts-polar-grid-concentric-polygon')].map((knoten) => lesePfad(knoten)).filter((punkte) => punkte.length >= 3);
    if (!(flaeche instanceof Element) || werte.length < 3 || gelesen.length !== werte.length || gitter.length === 0) {
      return { grund: 'unvollstaendig', werte: werte.length, punkte: gelesen.length, gitter: gitter.length };
    }
    const mitteVon = (punkte: { x: number; y: number }[]) => ({
      x: punkte.reduce((summe, punkt) => summe + punkt.x, 0) / punkte.length,
      y: punkte.reduce((summe, punkt) => summe + punkt.y, 0) / punkte.length,
    });
    const reichweite = (punkte: { x: number; y: number }[], zentrum: { x: number; y: number }) =>
      punkte.reduce((max, punkt) => Math.max(max, Math.hypot(punkt.x - zentrum.x, punkt.y - zentrum.y)), 0);
    let zentrum = mitteVon(gitter[0] ?? []);
    let kleinst = Number.POSITIVE_INFINITY;
    for (const punkte of gitter) {
      const mitte = mitteVon(punkte);
      const radius = reichweite(punkte, mitte);
      if (radius < kleinst) {
        kleinst = radius;
        zentrum = mitte;
      }
    }
    const abst = gelesen.map((punkt) => Math.hypot(punkt.x - zentrum.x, punkt.y - zentrum.y));
    const maxA = Math.max(...abst);
    const maxW = Math.max(...werte);
    const abweichung = maxA === 0 || maxW === 0
      ? 999
      : werte.reduce((max, wert, index) => Math.max(max, Math.abs((abst[index] ?? 0) - (wert / maxW) * maxA)), 0);
    const stil = getComputedStyle(flaeche);
    const probe = document.createElement('span');
    probe.style.color = 'var(--fortschritt)';
    document.body.append(probe);
    const farbe = getComputedStyle(probe).color;
    probe.remove();
    const deckkraft = Number(stil.fillOpacity);
    if (abweichung > 1.5 || stil.stroke !== farbe || stil.fill !== farbe || stil.strokeWidth !== '2px' || Math.abs(deckkraft - 0.16) > 0.02) {
      return { grund: 'abweichung', abweichung, strich: stil.stroke, flaeche: stil.fill, farbe, breite: stil.strokeWidth, deckkraft: stil.fillOpacity };
    }
    return { grund: 'ok' };
  })).toEqual({ grund: 'ok' });
}

async function ringPasst(ring: Locator): Promise<void> {
  const passt = await ring.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const mitteX = kasten.left + kasten.width / 2;
    const mitteY = kasten.top + kasten.height / 2;
    const innen = kasten.width * 0.36;
    const label = element.querySelector('span.uppercase');
    const zahl = element.querySelector('span.zahl');
    if (!label || !zahl) {
      return false;
    }
    const kaesten = [label.getBoundingClientRect(), zahl.getBoundingClientRect()];
    return kaesten.every((eintrag) => {
      const ecken = [
        [eintrag.left, eintrag.top],
        [eintrag.right, eintrag.top],
        [eintrag.left, eintrag.bottom],
        [eintrag.right, eintrag.bottom],
      ];
      return ecken.every(([x, y]) => Math.hypot(x - mitteX, y - mitteY) <= innen + 1);
    });
  });
  expect(passt).toBe(true);
}

test('Level ohne Bruch, Radare nebeneinander, Hinweis und Ring', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  await anmelden(page);

  await page.goto('/charakter');
  await expect(page.locator('[data-spektrum="attribut"]')).toBeVisible();
  await expect(page.locator('[data-spektrum="status"]')).toBeVisible();
  await flaechePasst(page, 'attribut');
  await flaechePasst(page, 'status');
  const spektren = page.locator('[data-spektren]');
  const kaesten = await spektren.locator('[data-spektrum]').evaluateAll((elemente) =>
    elemente.map((element) => {
      const kasten = element.getBoundingClientRect();
      return { links: kasten.left, rechts: kasten.right, oben: kasten.top };
    }),
  );
  expect(kaesten).toHaveLength(2);
  const links = kaesten[0];
  const rechts = kaesten[1];
  expect(links && rechts).toBeTruthy();
  if (links && rechts) {
    expect(links.rechts).toBeLessThanOrEqual(rechts.links + 1);
    expect(Math.abs(links.oben - rechts.oben)).toBeLessThan(2);
  }
  const fenster = page.viewportSize();
  expect(fenster).toBeTruthy();
  if (fenster && rechts) {
    expect(rechts.rechts).toBeLessThanOrEqual(fenster.width + 1);
  }
  expect(await spektren.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const stil = await page.locator('html').getAttribute('data-stil');
  const profilLabel = page.locator('main [data-levelring] span.uppercase');
  await expect(profilLabel).toBeVisible();
  expect(await profilLabel.evaluate((element) => getComputedStyle(element).fontSize)).toBe(stil === 'standard' ? '12px' : '10px');
  const profilZahl = page.locator('main [data-levelring] span.zahl');
  expect(await profilZahl.evaluate((element) => element.getAttribute('style') ?? '')).toBe('');

  const flaeche = page.locator('[data-spektrum="attribut"] .recharts-radar-polygon').first();
  await flaeche.hover({ force: true });
  const hinweis = page.locator('[data-diagramm-hinweis]');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText(/Lvl \d/);
  expect(bruch(await hinweis.innerText())).toBe(false);
  const hinweisKasten = await hinweis.boundingBox();
  expect(hinweisKasten).toBeTruthy();
  if (hinweisKasten && fenster) {
    expect(hinweisKasten.x).toBeGreaterThanOrEqual(-1);
    expect(hinweisKasten.y).toBeGreaterThanOrEqual(-1);
    expect(hinweisKasten.x + hinweisKasten.width).toBeLessThanOrEqual(fenster.width + 1);
    expect(hinweisKasten.y + hinweisKasten.height).toBeLessThanOrEqual(fenster.height + 1);
  }
  const untertitel = await spektren.locator('[data-spektrum] p').allInnerTexts();
  expect(untertitel.length).toBeGreaterThan(0);
  for (const text of untertitel) {
    expect(bruch(text)).toBe(false);
    expect(text).toMatch(/^Außen: Lvl \d+$/);
  }
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-profil`);

  await page.goto('/');
  const werteKopf = page.getByRole('button', { name: 'Werte', exact: true });
  if ((await werteKopf.getAttribute('aria-expanded')) !== 'true') {
    await werteKopf.click();
  }
  await pruefeHinweise(page, 'space-y-1.5', true);
  await bild(page, `${name}-heute`);

  await page.goto('/koennen');
  await expect(page.locator('[data-spektrum="attribut"] p')).toHaveText(/^Außen: Lvl \d+$/);
  await flaechePasst(page, 'attribut');
  await pruefeHinweise(page, 'attributzeile', true);
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    await expect(page.locator('main [data-zustand="zu-niedrig"]').first()).toContainText('Lvl zu niedrig');
  }
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-koennen`);

  const ausgang = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 844 });
  try {
    await page.goto('/');
    const werteKopf = page.getByRole('button', { name: 'Werte', exact: true });
    if ((await werteKopf.getAttribute('aria-expanded')) !== 'true') {
      await werteKopf.click();
    }
    await pruefeHinweise(page, 'space-y-1.5', true);
    await ohneSeitlichenUeberlauf(page);
    await page.goto('/koennen');
    await expect(page.locator('main [data-zustand="zu-niedrig"]').first().getByRole('button', { name: 'Lvl zu niedrig' })).toBeVisible();
    await pruefeHinweise(page, 'attributzeile', true);
    await ohneSeitlichenUeberlauf(page);
    await bild(page, `${name}-320`);
  } finally {
    if (ausgang) {
      await page.setViewportSize(ausgang);
    }
  }

  await page.goto('/haben');
  await expect(page.locator('[data-spektrum="status"] p')).toHaveText(/^Außen: Lvl \d+$/);
  await flaechePasst(page, 'status');

  await page.goto('/faehigkeiten');
  const ring = page.locator('main [data-levelring]').first();
  await expect(ring).toBeVisible();
  const breite = await ring.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(breite).toBe(56);
  await ringPasst(ring);
  const wort = ring.locator('span.uppercase');
  const schrift = await wort.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(schrift).toBeLessThan(12);
  await ohneSeitlichenUeberlauf(page);
  await bild(page, `${name}-faehigkeiten`);
});

const RING_ANSICHTEN = [
  { name: 'hologramm', stil: 'holo', primaer: '#3ea8ff', akzent: '#b38cff', hintergrund: '#050914' },
  { name: 'dunkel', stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' },
  { name: 'minimal', stil: 'minimal', primaer: '#6d5efc', akzent: '#d99a16', hintergrund: '#f7f7f8' },
  { name: 'antik', stil: 'antik', primaer: '#d6c79c', akzent: '#c9a24d', hintergrund: '#0d0c0a' },
  { name: 'jade', stil: 'jade', primaer: '#3dd68c', akzent: '#c4b5fd', hintergrund: '#0c0d0f' },
] as const;

test('Levelring: Verlauf, Spitze und Glühen in den Ansichten', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  fs.mkdirSync('tmp-test/level-anzeige', { recursive: true });
  await anmelden(page);
  const original = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as {
      stil: string;
      primaer: string;
      akzent: string;
      hintergrund: string;
      glimmen: boolean;
    };
    return daten;
  });
  const projekt = testInfo.project.name;
  try {
    for (const ansicht of RING_ANSICHTEN) {
      const ok = await page.evaluate(async (koerper) => {
        const antwort = await fetch('/api/einstellungen', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(koerper),
        });
        return antwort.ok;
      }, { stil: ansicht.stil, primaer: ansicht.primaer, akzent: ansicht.akzent, hintergrund: ansicht.hintergrund, glimmen: true });
      expect(ok).toBe(true);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-stil', ansicht.stil);
      const ring = page.locator('main [data-levelring]').first();
      await expect(ring).toBeVisible();
      const schema = await page.locator('html').getAttribute('data-schema');
      expect(schema).toBe(ansicht.name === 'minimal' ? 'light' : 'dark');
      const html = await ring.innerHTML();
      expect(html, ansicht.name).toContain('stroke="var(--flaeche-2)"');
      expect(html, ansicht.name).toContain('var(--fortschritt)');
      expect(html, ansicht.name).toContain('var(--haupt)');
      expect(html, ansicht.name).not.toContain('--akzent');
      const bogen = ring.locator('[data-levelbogen]');
      if ((await bogen.count()) > 0) {
        await expect(bogen).toHaveAttribute('style', /conic-gradient\(from 0deg/);
      } else {
        const voll = await ring.evaluate((element) =>
          [...element.querySelectorAll('circle')].some((kreis) => {
            const strich = kreis.getAttribute('stroke') ?? '';
            return strich.includes('color-mix') && strich.includes('var(--fortschritt)') && !kreis.hasAttribute('stroke-dasharray');
          }),
        );
        expect(voll, ansicht.name).toBe(true);
      }
      const schein = ring.locator('.levelring-spitze-schein');
      await expect(schein).toBeVisible();
      await expect(schein).toHaveAttribute('filter', /url\(#/);
      if (ansicht.name !== 'jade') {
        const echt = page.locator('main [data-flaeche]').filter({ has: page.locator('[data-levelring]') }).first();
        await echt.screenshot({ path: `tmp-test/level-anzeige/${projekt}-echt-${ansicht.name}.png` });
      }
    }
  } finally {
    const wieder = await page.evaluate(async (koerper) => {
      const antwort = await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      });
      return antwort.ok;
    }, {
      stil: original.stil,
      primaer: original.primaer,
      akzent: original.akzent,
      hintergrund: original.hintergrund,
      glimmen: original.glimmen,
    });
    expect(wieder).toBe(true);
  }
});

test('Levelring auf Heute und Projekt ist gleich groß', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  await anmelden(page);
  await page.goto('/');
  const ring = page.locator('main [data-levelring]').first();
  await expect(ring).toBeVisible();
  const fenster = page.viewportSize()?.width ?? 0;
  const heute = await ring.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const text = element.nextElementSibling?.getBoundingClientRect();
    return {
      breite: kasten.width,
      hoehe: kasten.height,
      mitte: kasten.top + kasten.height / 2,
      textMitte: text ? text.top + text.height / 2 : null,
    };
  });
  expect(Math.round(heute.breite)).toBe(96);
  expect(Math.abs(heute.breite - heute.hoehe)).toBeLessThanOrEqual(1);
  if (heute.textMitte !== null) {
    expect(Math.abs(heute.mitte - heute.textMitte)).toBeLessThanOrEqual(2);
  }
  if (fenster >= 360) {
    const zeilen = await page.locator('main [data-xp-zeile]').evaluate((element) => {
      const bereich = document.createRange();
      bereich.selectNodeContents(element);
      return bereich.getClientRects().length;
    });
    expect(zeilen).toBe(1);
  }
  fs.mkdirSync('tmp-test/level-anzeige', { recursive: true });
  const flaeche = page.locator('main [data-flaeche]').filter({ has: page.locator('[data-levelring]') }).first();
  await flaeche.screenshot({ path: `tmp-test/level-anzeige/${name}-${fenster}-heute.png` });

  const ziel = await page.evaluate(async () => {
    const ziele = (await fetch('/api/ziele').then((antwort) => antwort.json())) as {
      projekte: { id: number; archiviert: boolean }[];
    };
    return ziele.projekte.find((eintrag) => !eintrag.archiviert) ?? null;
  });
  expect(ziel).not.toBeNull();
  if (!ziel) {
    return;
  }
  await page.goto(`/projekte/${ziel.id}`);
  const projektRing = page.locator('main [data-levelring]').first();
  await expect(projektRing).toBeVisible();
  const projekt = await projektRing.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const text = element.nextElementSibling?.getBoundingClientRect();
    return {
      breite: kasten.width,
      mitte: kasten.top + kasten.height / 2,
      textMitte: text ? text.top + text.height / 2 : null,
    };
  });
  expect(Math.round(projekt.breite)).toBe(96);
  expect(Math.round(projekt.breite)).toBe(Math.round(heute.breite));
  expect(projekt.textMitte).not.toBeNull();
  if (projekt.textMitte !== null) {
    expect(Math.abs(projekt.mitte - projekt.textMitte)).toBeLessThanOrEqual(2);
  }
  await projektRing.screenshot({ path: `tmp-test/level-anzeige/${name}-${fenster}-projekt.png` });

  const ausgang = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const eng = page.locator('main [data-levelring]').first();
  await expect(eng).toBeVisible();
  const engBreite = await eng.evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(engBreite).toBe(96);
  await page.locator('main [data-flaeche]').filter({ has: page.locator('[data-levelring]') }).first().screenshot({
    path: `tmp-test/level-anzeige/${name}-320-heute.png`,
  });
  if (ausgang) {
    await page.setViewportSize(ausgang);
  }
});

const BOGEN_FAELLE = [
  { anteil: 0.25, cx: 92, cy: 50, grad: 90 },
  { anteil: 0.75, cx: 8, cy: 50, grad: 270 },
  { anteil: 1, cx: 50, cy: 8, grad: 360 },
] as const;

test('Levelring: Bogen beginnt oben und der Lichtpunkt sitzt am Ende', async ({ page }) => {
  await anmelden(page);
  await page.goto('/');
  await expect(page.locator('main [data-levelring]').first()).toBeVisible();
  for (const fall of BOGEN_FAELLE) {
    const html = renderToStaticMarkup(createElement(LevelRing, { level: 4, anteil: fall.anteil, groesse: 96 }));
    await page.evaluate((markup) => {
      document.getElementById('bogenprobe')?.remove();
      const kasten = document.createElement('div');
      kasten.id = 'bogenprobe';
      kasten.style.position = 'fixed';
      kasten.style.left = '8px';
      kasten.style.top = '80px';
      kasten.style.zIndex = '50';
      kasten.innerHTML = markup;
      document.body.append(kasten);
    }, html);
    const ring = page.locator('#bogenprobe [data-levelring]');
    const lage = await ring.evaluate((element, erwartet) => {
      const kasten = element.getBoundingClientRect();
      const licht = element.querySelector('[data-ringlicht]');
      if (!(licht instanceof SVGGraphicsElement)) {
        return { abstand: 999, stil: '', vollerKreis: false, breite: 0 };
      }
      const punkt = licht.getBoundingClientRect();
      const istX = punkt.left + punkt.width / 2;
      const istY = punkt.top + punkt.height / 2;
      const sollX = kasten.left + (erwartet.cx / 100) * kasten.width;
      const sollY = kasten.top + (erwartet.cy / 100) * kasten.height;
      const bogen = element.querySelector('[data-levelbogen]');
      const stil = bogen instanceof HTMLElement ? (bogen.getAttribute('style') ?? '') : '';
      const vollerKreis = [...element.querySelectorAll('circle')].some((kreis) => {
        const strich = kreis.getAttribute('stroke') ?? '';
        return strich.includes('color-mix') && !kreis.hasAttribute('stroke-dasharray') && !kreis.hasAttribute('transform');
      });
      return {
        abstand: Math.hypot(istX - sollX, istY - sollY),
        stil,
        vollerKreis,
        breite: kasten.width,
      };
    }, { cx: fall.cx, cy: fall.cy });
    expect(lage.breite, `${fall.anteil}`).toBeCloseTo(96, 0);
    expect(lage.abstand, `${fall.anteil}`).toBeLessThanOrEqual(2);
    if (fall.anteil < 1) {
      expect(lage.stil, `${fall.anteil}`).toContain('conic-gradient(from 0deg');
      expect(lage.stil, `${fall.anteil}`).toContain(`${fall.grad}deg`);
      expect(lage.stil, `${fall.anteil}`).toContain(`transparent ${fall.grad}deg`);
    } else {
      expect(lage.stil).toBe('');
      expect(lage.vollerKreis).toBe(true);
    }
  }
  await page.evaluate(() => document.getElementById('bogenprobe')?.remove());
});
