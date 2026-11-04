import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Stil } from '../shared/features/darstellung/stile.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const ANSICHTEN: { stil: Stil; name: string }[] = [
  { stil: 'standard', name: 'Standard' },
  { stil: 'minimal', name: 'Minimal' },
  { stil: 'jade', name: 'Jade' },
  { stil: 'holo', name: 'Hologramm' },
  { stil: 'antik', name: 'Antik' },
];

async function speichere(seite: Page, koerper: Record<string, unknown>): Promise<void> {
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

function kreis(radius: string, breite: number): boolean {
  const px = Number.parseFloat(radius);
  return Number.isFinite(px) && px + 0.6 >= breite / 2;
}

function klassenSvgs(): string[] {
  const quelle = fs.readFileSync('client/src/components/KlassenBild.tsx', 'utf8');
  const start = quelle.indexOf('const ZEICHEN');
  const ende = quelle.indexOf('export function KlassenBild');
  const block = quelle.slice(start, ende);
  return [...block.matchAll(/<Zeichen kinder=\{([\s\S]*?)\} \/>/g)].map((treffer) => {
    const innen = (treffer[1] ?? '')
      .replaceAll('<>', '')
      .replaceAll('</>', '')
      .replaceAll('fillRule=', 'fill-rule=')
      .replace(/\s+/g, ' ')
      .trim();
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${innen}</svg>`;
  });
}

async function flaechen(seite: Page, auswahl: string): Promise<{ hintergrund: string; flaeche: string; farbe: string; text: string; zeichen: number }> {
  const ziel = seite.locator(auswahl);
  await expect(ziel).toBeVisible();
  return ziel.evaluate((element) => {
    const stil = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--flaeche-2)';
    probe.style.color = 'var(--haupt)';
    document.body.append(probe);
    const probeStil = getComputedStyle(probe);
    const svg = element.querySelector('svg');
    const ergebnis = {
      hintergrund: stil.backgroundColor,
      flaeche: probeStil.backgroundColor,
      farbe: stil.color,
      text: probeStil.color,
      zeichen: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    };
    probe.remove();
    return ergebnis;
  });
}

async function zeigeZeichenprobe(seite: Page): Promise<void> {
  const bilder = klassenSvgs();
  expect(bilder).toHaveLength(12);
  await seite.evaluate((svgs) => {
    document.querySelector('[data-zeichenprobe]')?.remove();
    const kopf = document.querySelector('[data-kopf]');
    if (!(kopf instanceof HTMLElement)) {
      return;
    }
    const zeile = document.createElement('div');
    zeile.setAttribute('data-zeichenprobe', '');
    zeile.style.display = 'flex';
    zeile.style.flexWrap = 'wrap';
    zeile.style.gap = '8px';
    zeile.style.alignItems = 'center';
    zeile.style.padding = '8px 16px';
    zeile.style.background = 'var(--grund)';
    for (const svg of svgs) {
      const span = document.createElement('span');
      span.className = 'klassenbild profilbild inline-flex shrink-0 items-center justify-center rounded-full size-8';
      span.innerHTML = `<span class="size-[18px]">${svg}</span>`;
      zeile.append(span);
    }
    kopf.append(zeile);
  }, bilder);
}

async function form(seite: Page, auswahl: string): Promise<{ radius: string; breite: number; ueberlauf: string; schatten: string; hintergrund: string }> {
  const ziel = seite.locator(auswahl);
  await expect(ziel).toBeVisible();
  return ziel.evaluate((element) => {
    const stil = getComputedStyle(element);
    return {
      radius: stil.borderTopLeftRadius,
      breite: element.getBoundingClientRect().width,
      ueberlauf: stil.overflow,
      schatten: stil.boxShadow,
      hintergrund: stil.backgroundColor,
    };
  });
}

test('Profilbild bleibt in jeder Ansicht rund', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await anmelden(page);
  const original = await page.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as { stil: Stil };
    return daten.stil;
  });
  const projekt = testInfo.project.name;
  fs.mkdirSync('tmp-test/profilbild', { recursive: true });
  const bild = (name: string) => page.screenshot({ path: `tmp-test/profilbild/${projekt}-${name}.png`, fullPage: true });

  try {
    for (const ansicht of ANSICHTEN) {
      await speichere(page, { stil: ansicht.stil });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-stil', ansicht.stil);
      await expect(page.getByText('Lädt …')).toHaveCount(0);

      const kopf = await form(page, '[data-kopf] [data-profilbild]');
      expect(kreis(kopf.radius, kopf.breite), `${ansicht.name} Kopf ${kopf.radius}`).toBe(true);
      expect(kopf.ueberlauf).toBe('hidden');
      expect(Math.round(kopf.breite)).toBeGreaterThanOrEqual(30);
      expect(Math.round(kopf.breite)).toBeLessThanOrEqual(34);
      const kopfFarbe = await flaechen(page, '[data-kopf] [data-profilbild]');
      expect(kopfFarbe.hintergrund, `${ansicht.name} Kopf-Fläche`).toBe(kopfFarbe.flaeche);
      expect(kopfFarbe.farbe, `${ansicht.name} Kopf-Zeichen`).toBe(kopfFarbe.text);
      expect(kopfFarbe.zeichen, `${ansicht.name} Kopf-Zeichengröße`).toBe(18);

      if (ansicht.stil === 'antik') {
        expect(kopf.radius).toBe('9999px');
        expect(kopf.schatten).toBe('none');
        expect(kopf.hintergrund).not.toBe('rgba(0, 0, 0, 0)');
        const liste = await page.locator('.seitenleiste .klassenbild').evaluate((element) => {
          const stil = getComputedStyle(element);
          return {
            radius: stil.borderTopLeftRadius,
            schatten: stil.boxShadow,
            profil: element.classList.contains('profilbild'),
          };
        });
        expect(liste.radius).toBe('2px');
        expect(liste.schatten).not.toBe('none');
        expect(liste.profil).toBe(false);
      }

      const seitenbild = await page.locator('.seitenleiste .klassenbild').evaluate((element) => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--flaeche-2)';
        document.body.append(probe);
        const flaeche = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          profil: element.classList.contains('profilbild'),
          gleicheFlaeche: getComputedStyle(element).backgroundColor === flaeche,
        };
      });
      expect(seitenbild.profil, `${ansicht.name} Seitenleiste`).toBe(false);
      expect(seitenbild.gleicheFlaeche, `${ansicht.name} Seitenleiste`).toBe(false);

      if (ansicht.stil === 'standard') {
        await zeigeZeichenprobe(page);
        const probe = page.locator('[data-zeichenprobe] .klassenbild');
        await expect(probe).toHaveCount(12);
        const masse = await probe.evaluateAll((knoten) => knoten.map((element) => {
          const svg = element.querySelector('svg');
          return {
            breite: Math.round(element.getBoundingClientRect().width),
            zeichen: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
          };
        }));
        for (const eintrag of masse) {
          expect(eintrag.breite).toBe(32);
          expect(eintrag.zeichen).toBe(18);
        }
        await page.locator('[data-zeichenprobe]').screenshot({ path: `tmp-test/profilbild/${projekt}-klassenzeichen-32.png` });
        await page.evaluate(() => document.querySelector('[data-zeichenprobe]')?.remove());
      }

      const link = page.locator('header a.profilziel');
      await expect(link).toBeVisible();
      const name = await link.getAttribute('aria-label');
      expect(name).toMatch(/^Profil, Level \d+$/);
      if (projekt === 'desktop') {
        await expect(link).toHaveAttribute('title', name?.replace('Profil, Level ', 'Profil · Level ') ?? '');
      } else {
        await expect(link).not.toHaveAttribute('title');
      }
      let taste = false;
      for (let schritt = 0; schritt < 40; schritt += 1) {
        taste = await link.evaluate((element) => element === document.activeElement);
        if (taste) {
          break;
        }
        await page.keyboard.press('Tab');
      }
      expect(taste).toBe(true);
      const fokus = await link.evaluate((element) => {
        const stil = getComputedStyle(element);
        const kasten = element.getBoundingClientRect();
        return {
          radius: stil.borderTopLeftRadius,
          breite: kasten.width,
          hoehe: kasten.height,
          ueberlauf: stil.overflow,
          umriss: stil.outlineStyle,
          eingabe: document.documentElement.dataset.eingabe ?? '',
        };
      });
      expect(fokus.eingabe).toBe('tastatur');
      expect(kreis(fokus.radius, fokus.breite), `${ansicht.name} Fokus ${fokus.radius}`).toBe(true);
      expect(kreis(fokus.radius, fokus.hoehe)).toBe(true);
      expect(fokus.ueberlauf).toBe('hidden');
      expect(fokus.umriss).toBe('solid');
      expect(Math.round(fokus.breite)).toBeGreaterThanOrEqual(48);
      expect(Math.round(fokus.hoehe)).toBeGreaterThanOrEqual(48);

      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-heute`);
      }

      await page.locator('header h1').click();
      await link.evaluate((element) => {
        if (element instanceof HTMLElement) {
          element.focus({ focusVisible: true });
        }
      });
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eingabe ?? '')).toBe('zeiger');
      expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');

      await page.goto('/mehr');
      await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible();
      await expect(page.getByText('Lädt …')).toHaveCount(0);
      const zeile = await form(page, '[data-abschnitt="seiten"] [data-profilbild]');
      expect(kreis(zeile.radius, zeile.breite), `${ansicht.name} Mehr ${zeile.radius}`).toBe(true);
      expect(zeile.ueberlauf).toBe('hidden');
      expect(Math.round(zeile.breite)).toBe(20);
      const zeileFarbe = await flaechen(page, '[data-abschnitt="seiten"] [data-profilbild]');
      expect(zeileFarbe.hintergrund, `${ansicht.name} Mehr-Fläche`).toBe(zeileFarbe.flaeche);
      expect(zeileFarbe.farbe, `${ansicht.name} Mehr-Zeichen`).toBe(zeileFarbe.text);
      expect(zeileFarbe.zeichen).toBeGreaterThan(10);
      expect(zeileFarbe.zeichen).toBeLessThan(16);
      await ohneSeitlichenUeberlauf(page);
      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-mehr`);
      }

      await page.locator('[data-abschnitt="seiten"]').getByRole('link', { name: 'Profil', exact: true }).click();
      await expect(page).toHaveURL(/\/charakter$/);
      await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
      await expect(page.getByText('Lädt …')).toHaveCount(0);
      const profil = await form(page, 'main [data-levelring] [data-profilbild]');
      expect(kreis(profil.radius, profil.breite), `${ansicht.name} Profil ${profil.radius}`).toBe(true);
      expect(profil.ueberlauf).toBe('hidden');
      expect(Math.round(profil.breite)).toBe(64);
      const profilFarbe = await flaechen(page, 'main [data-levelring] [data-profilbild]');
      expect(profilFarbe.hintergrund, `${ansicht.name} Profil-Fläche`).toBe(profilFarbe.flaeche);
      expect(profilFarbe.farbe, `${ansicht.name} Profil-Zeichen`).toBe(profilFarbe.text);
      expect(profilFarbe.zeichen).toBeGreaterThan(36);
      expect(profilFarbe.zeichen).toBeLessThan(44);
      const ring = await page.locator('main [data-levelring]').evaluate((element) => Math.round(element.getBoundingClientRect().width));
      expect(ring).toBe(104);
      await expect(page.locator('main [data-levelring] span.uppercase')).toBeVisible();
      await ohneSeitlichenUeberlauf(page);
      if (ansicht.stil === 'holo' || ansicht.stil === 'antik') {
        await bild(`${ansicht.stil}-profil`);
      }
    }
  } finally {
    await speichere(page, { stil: original });
  }
});
