import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { RING_UMFANG, ringAbschluss, strichWeite } from '../client/src/ui/levelringAbschluss.ts';
import { helligkeit, kontrast } from '../shared/spiel/farben.ts';
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
  await expect(zeichen).toHaveClass(/text-haupt/);
  await expect(zeichen).not.toHaveClass(/text-gefahr|bg-gefahr/);
  expect(await zeichen.evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px');
  expect(await hinweis.evaluate((element) => getComputedStyle(element).fontSize)).toBe('13px');
  const name = zeile.locator('[data-attribut-name]').first();
  const nameKasten = await name.boundingBox();
  const hinweisKasten = await hinweis.boundingBox();
  const stufe = zeile.getByText(/^Lvl \d+$/).last();
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

const RING_PROBEN = [
  { name: '0', anteil: 0 },
  { name: 'klein', anteil: 0.08 },
  { name: 'mittel', anteil: 0.45 },
  { name: '100', anteil: 1 },
] as const;

const RING_ANSICHTEN = [
  { name: 'hologramm', stil: 'holo', primaer: '#3ea8ff', akzent: '#b38cff', hintergrund: '#050914' },
  { name: 'dunkel', stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' },
  { name: 'minimal', stil: 'minimal', primaer: '#6d5efc', akzent: '#d99a16', hintergrund: '#f7f7f8' },
  { name: 'antik', stil: 'antik', primaer: '#d6c79c', akzent: '#c9a24d', hintergrund: '#0d0c0a' },
  { name: 'jade', stil: 'jade', primaer: '#3dd68c', akzent: '#c4b5fd', hintergrund: '#0c0d0f' },
] as const;

function ringProbe(anteil: number, name: string): string {
  const id = `lr${name}`;
  const strich = strichWeite(64);
  const bahn = `<circle cx="50" cy="50" r="42" fill="none" stroke="var(--flaeche-2)" stroke-width="${strich}"/>`;
  const abschluss = ringAbschluss(anteil, 64);
  if (!abschluss) {
    return `<div class="levelring relative shrink-0" data-probe="${name}" style="width:64px;height:64px"><svg viewBox="0 0 100 100" class="absolute inset-0">${bahn}</svg></div>`;
  }
  const voll = abschluss.anteil >= 1;
  const strichKreis = voll
    ? `<circle class="levelring-strich" cx="50" cy="50" r="42" fill="none" stroke="var(--fortschritt)" stroke-width="${strich}" stroke-linecap="butt"/>`
    : `<circle class="levelring-strich" cx="50" cy="50" r="42" fill="none" stroke="var(--fortschritt)" stroke-width="${strich}" stroke-linecap="butt" stroke-dasharray="${anteil * RING_UMFANG} ${RING_UMFANG}" transform="rotate(-90 50 50)"/>`;
  const von = abschluss.verlaufVon;
  const nach = abschluss.verlaufNach;
  const verlauf =
    abschluss.verlauf !== null && abschluss.versatzVerlauf !== null && von && nach
      ? `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${von.x}" y1="${von.y}" x2="${nach.x}" y2="${nach.y}"><stop offset="0" stop-color="var(--balken-farbe)"/><stop offset="1" stop-color="var(--balken-verlauf-ton)"/></linearGradient></defs><circle class="levelring-verlauf" cx="50" cy="50" r="42" fill="none" stroke="url(#${id})" stroke-width="${strich}" stroke-linecap="butt" stroke-dasharray="${abschluss.verlauf} ${RING_UMFANG}" stroke-dashoffset="${abschluss.versatzVerlauf}"/>`
      : '';
  const spitze = `<circle class="levelring-spitze" cx="50" cy="50" r="42" fill="none" stroke="var(--balken-spitze)" stroke-width="${strich}" stroke-linecap="butt" stroke-dasharray="${abschluss.spitze} ${RING_UMFANG}" stroke-dashoffset="${abschluss.versatzSpitze}"/>`;
  return `<div class="levelring relative shrink-0" data-probe="${name}" style="width:64px;height:64px"><svg viewBox="0 0 100 100" class="absolute inset-0">${bahn}<g class="levelring-bogen">${strichKreis}${verlauf}${spitze}</g></svg></div>`;
}

function alsRgb(wert: string): string {
  const farb = wert.match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i);
  if (!farb?.[1] || !farb[2] || !farb[3]) {
    return wert;
  }
  const kanal = (teil: string) => Math.round(Number(teil) * 255);
  return `rgb(${kanal(farb[1])}, ${kanal(farb[2])}, ${kanal(farb[3])})`;
}

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
      await expect(page.locator('main [data-levelring]').first()).toBeVisible();
      const schema = await page.locator('html').getAttribute('data-schema');
      expect(schema).toBe(ansicht.name === 'minimal' ? 'light' : 'dark');
      const proben = RING_PROBEN.map((eintrag) => ringProbe(eintrag.anteil, eintrag.name)).join('');
      await page.evaluate((html) => {
        document.getElementById('ringproben')?.remove();
        const kasten = document.createElement('div');
        kasten.id = 'ringproben';
        kasten.style.position = 'fixed';
        kasten.style.zIndex = '40';
        kasten.style.left = '8px';
        kasten.style.top = '72px';
        kasten.style.display = 'flex';
        kasten.style.gap = '12px';
        kasten.style.padding = '24px';
        kasten.style.background = 'var(--flaeche)';
        kasten.innerHTML = html;
        document.body.append(kasten);
      }, proben);
      const kasten = page.locator('#ringproben');
      await expect(kasten.locator('[data-probe="0"] .levelring-bogen')).toHaveCount(0);
      await expect(kasten.locator('[data-probe="klein"] .levelring-verlauf')).toHaveCount(0);
      await expect(kasten.locator('[data-probe="klein"] .levelring-spitze')).toHaveCount(1);
      await expect(kasten.locator('[data-probe="mittel"] .levelring-verlauf')).toHaveCount(1);
      await expect(kasten.locator('[data-probe="100"] .levelring-strich')).not.toHaveAttribute('stroke-dasharray');
      const farben = await kasten.locator('[data-probe="mittel"]').evaluate((element) => {
        const bahn = element.querySelector('circle');
        const strich = element.querySelector('.levelring-strich');
        const spitze = element.querySelector('.levelring-spitze');
        const bogen = element.querySelector('.levelring-bogen');
        if (!(bahn instanceof Element) || !(strich instanceof Element) || !(spitze instanceof Element) || !(bogen instanceof Element)) {
          return null;
        }
        return {
          bahn: getComputedStyle(bahn).stroke,
          strich: getComputedStyle(strich).stroke,
          spitze: getComputedStyle(spitze).stroke,
          filter: getComputedStyle(bogen).filter,
        };
      });
      expect(farben).not.toBeNull();
      if (farben) {
        const bahn = alsRgb(farben.bahn);
        const strich = alsRgb(farben.strich);
        const spitze = alsRgb(farben.spitze);
        expect(kontrast(strich, bahn), `${ansicht.name} Füllung`).toBeGreaterThanOrEqual(3);
        expect(kontrast(spitze, bahn), `${ansicht.name} Spitze`).toBeGreaterThanOrEqual(3);
        expect(spitze.replace(/\s/g, '')).not.toBe('rgb(255,255,255)');
        if (schema === 'light') {
          expect(helligkeit(spitze), ansicht.name).toBeLessThan(helligkeit(strich));
          expect(farben.filter).toContain('4px');
        } else {
          expect(helligkeit(spitze), ansicht.name).toBeGreaterThan(helligkeit(strich));
          expect(farben.filter).toContain('6px');
        }
        expect(farben.filter).not.toBe('none');
      }
      if (ansicht.name !== 'jade') {
        await kasten.screenshot({ path: `tmp-test/level-anzeige/${projekt}-ring-${ansicht.name}.png` });
        const echt = page.locator('main [data-flaeche]').filter({ has: page.locator('[data-levelring]') }).first();
        await echt.screenshot({ path: `tmp-test/level-anzeige/${projekt}-echt-${ansicht.name}.png` });
      }
    }
    await page.emulateMedia({ forcedColors: 'active' });
    const gezwungen = await page.locator('#ringproben [data-probe="mittel"]').evaluate((element) => {
      const bogen = element.querySelector('.levelring-bogen');
      const verlauf = element.querySelector('.levelring-verlauf');
      const spitze = element.querySelector('.levelring-spitze');
      const strich = element.querySelector('.levelring-strich');
      return {
        filter: bogen ? getComputedStyle(bogen).filter : 'fehlend',
        verlauf: verlauf ? getComputedStyle(verlauf).display : 'fehlend',
        spitze: spitze ? getComputedStyle(spitze).display : 'fehlend',
        strich: strich ? getComputedStyle(strich).display : 'fehlend',
      };
    });
    expect(gezwungen.filter).toBe('none');
    expect(gezwungen.verlauf).toBe('none');
    expect(gezwungen.spitze).toBe('none');
    expect(gezwungen.strich).not.toBe('none');
  } finally {
    await page.emulateMedia({ forcedColors: 'none' });
    const wieder = await page.evaluate(async (koerper) => {
      document.getElementById('ringproben')?.remove();
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
