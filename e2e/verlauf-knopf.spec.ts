import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

function nah(wert: number, ziel: number): boolean {
  return Math.abs(wert - ziel) <= 1;
}

async function massKnopf(seite: Page) {
  const knopf = seite.getByRole('button', { name: 'Ältere Einträge laden' });
  return knopf.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const stil = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--feldrand)';
    probe.style.backgroundColor = 'var(--flaeche-2)';
    document.body.append(probe);
    const probeStil = getComputedStyle(probe);
    const feldrand = probeStil.color;
    const flaeche2 = probeStil.backgroundColor;
    probe.remove();
    const inhalt = element.closest('main')?.querySelector(':scope > div');
    const inhaltKasten = inhalt?.getBoundingClientRect();
    const inhaltStil = inhalt ? getComputedStyle(inhalt) : null;
    return {
      hoehe: kasten.height,
      links: kasten.left,
      rechtsAbstand: document.documentElement.clientWidth - kasten.right,
      rechts: kasten.right,
      hintergrund: stil.backgroundColor,
      rahmenBreite: Number.parseFloat(stil.borderTopWidth),
      rahmenStil: stil.borderTopStyle,
      rahmenFarbe: stil.borderTopColor,
      feldrand,
      flaeche2,
      inhaltLinks: inhaltKasten && inhaltStil ? inhaltKasten.left + Number.parseFloat(inhaltStil.paddingLeft) : null,
      inhaltRechts: inhaltKasten && inhaltStil ? inhaltKasten.right - Number.parseFloat(inhaltStil.paddingRight) : null,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Ältere Einträge laden ist ein Zweitknopf mit Rahmen', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/verlauf-knopf', { recursive: true });
  await page.goto('/chronik');
  await expect(page.getByRole('heading', { name: 'Verlauf', level: 1 })).toBeVisible();
  const knopf = page.getByRole('button', { name: 'Ältere Einträge laden' });
  await expect(knopf).toBeVisible();
  await knopf.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `tmp-test/verlauf-knopf/${testInfo.project.name}.png` });

  const mass = await massKnopf(page);
  expect(nah(mass.hoehe, 48)).toBe(true);
  expect(nah(mass.rahmenBreite, 1)).toBe(true);
  expect(mass.rahmenStil).toBe('solid');
  expect(mass.rahmenFarbe).toBe(mass.feldrand);
  expect(mass.hintergrund).not.toBe(mass.flaeche2);
  expect(mass.hintergrund).toBe('rgba(0, 0, 0, 0)');
  expect(mass.inhaltLinks).not.toBeNull();
  expect(mass.inhaltRechts).not.toBeNull();
  expect(nah(mass.links, mass.inhaltLinks ?? 0)).toBe(true);
  expect(nah(mass.rechts, mass.inhaltRechts ?? 0)).toBe(true);

  if (testInfo.project.name === 'handy') {
    expect(nah(mass.links, 16)).toBe(true);
    expect(nah(mass.rechtsAbstand, 16)).toBe(true);
  }

  const ueberschrift = page.getByRole('heading', { name: 'Verlauf', level: 1 });
  const ueberschriftLinks = await ueberschrift.evaluate((element) => element.getBoundingClientRect().left);
  expect(nah(mass.links, ueberschriftLinks)).toBe(true);
  await ohneSeitlichenUeberlauf(page);
});
