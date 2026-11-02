import { inflateSync } from 'node:zlib';
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

async function passwort(): Promise<string> {
  const text = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
  const wert = text.match(/Benutzername: testvoll\s+Passwort:\s*(\S+)/)?.[1];
  if (!wert) {
    throw new Error('Testzugang fehlt.');
  }
  return wert;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: /Anmelden|Sign in/ }).click();
  await seite.getByRole('button', { name: /Eintrag loggen|Log entry/ }).waitFor();
  await seite.evaluate(async () => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funktionen: { chronik: true } }),
    });
    if (!antwort.ok) {
      throw new Error(`Einstellungen ${antwort.status}`);
    }
  });
}

function paeth(links: number, oben: number, obenLinks: number): number {
  const p = links + oben - obenLinks;
  const pa = Math.abs(p - links);
  const pb = Math.abs(p - oben);
  const pc = Math.abs(p - obenLinks);
  if (pa <= pb && pa <= pc) {
    return links;
  }
  if (pb <= pc) {
    return oben;
  }
  return obenLinks;
}

function rgbaAusPng(png: Buffer): Uint8Array {
  let offset = 8;
  let breite = 0;
  let hoehe = 0;
  let typ = 0;
  let tiefe = 0;
  const teile: Buffer[] = [];
  while (offset + 8 <= png.length) {
    const laenge = png.readUInt32BE(offset);
    const art = png.toString('ascii', offset + 4, offset + 8);
    const daten = png.subarray(offset + 8, offset + 8 + laenge);
    if (art === 'IHDR') {
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      tiefe = daten[8];
      typ = daten[9];
    } else if (art === 'IDAT') {
      teile.push(daten);
    } else if (art === 'IEND') {
      break;
    }
    offset += 12 + laenge;
  }
  if (tiefe !== 8 || (typ !== 2 && typ !== 6)) {
    throw new Error(`PNG nicht lesbar: Tiefe ${tiefe}, Typ ${typ}`);
  }
  const kanaele = typ === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(teile));
  const schritt = breite * kanaele;
  const pixel = new Uint8Array(breite * hoehe * 4);
  let quelle = 0;
  let vorher = new Uint8Array(schritt);
  for (let y = 0; y < hoehe; y += 1) {
    const filter = roh[quelle];
    quelle += 1;
    const zeile = new Uint8Array(schritt);
    for (let i = 0; i < schritt; i += 1) {
      const wert = roh[quelle + i];
      const links = i >= kanaele ? zeile[i - kanaele] : 0;
      const oben = vorher[i];
      const obenLinks = i >= kanaele ? vorher[i - kanaele] : 0;
      if (filter === 0) {
        zeile[i] = wert;
      } else if (filter === 1) {
        zeile[i] = (wert + links) & 255;
      } else if (filter === 2) {
        zeile[i] = (wert + oben) & 255;
      } else if (filter === 3) {
        zeile[i] = (wert + Math.floor((links + oben) / 2)) & 255;
      } else if (filter === 4) {
        zeile[i] = (wert + paeth(links, oben, obenLinks)) & 255;
      } else {
        throw new Error(`PNG-Filter ${filter}`);
      }
    }
    quelle += schritt;
    vorher = zeile;
    for (let x = 0; x < breite; x += 1) {
      const i = x * kanaele;
      const ziel = (y * breite + x) * 4;
      pixel[ziel] = zeile[i];
      pixel[ziel + 1] = zeile[i + 1];
      pixel[ziel + 2] = zeile[i + 2];
      pixel[ziel + 3] = kanaele === 4 ? zeile[i + 3] : 255;
    }
  }
  return pixel;
}

function istLoeschRot(r: number, g: number, b: number): boolean {
  return r > 150 && g < 140 && b < 130 && r - g > 40 && r - b > 40;
}

async function rotePixel(seite: Page, x: number, y: number, breite = 10, hoehe = 10): Promise<number> {
  const sicht = seite.viewportSize();
  if (!sicht) {
    throw new Error('Kein Viewport.');
  }
  const links = Math.round(x);
  const oben = Math.round(y);
  if (links < 0 || oben < 0 || links + breite > sicht.width || oben + hoehe > sicht.height) {
    throw new Error(`Ausschnitt außerhalb: ${links},${oben} bei ${sicht.width}x${sicht.height}`);
  }
  const bild = await seite.screenshot({ clip: { x: links, y: oben, width: breite, height: hoehe } });
  const pixel = rgbaAusPng(bild);
  let rot = 0;
  for (let i = 0; i < pixel.length; i += 4) {
    if (istLoeschRot(pixel[i] ?? 0, pixel[i + 1] ?? 0, pixel[i + 2] ?? 0)) {
      rot += 1;
    }
  }
  return rot;
}

async function ruhePunkt(karte: Locator): Promise<{ x: number; y: number }> {
  await karte.scrollIntoViewIfNeeded();
  const kasten = await karte.boundingBox();
  if (!kasten) {
    throw new Error('Karte nicht sichtbar.');
  }
  return { x: kasten.x + kasten.width - 120, y: kasten.y + 10 };
}

async function wischen(seite: Page, ziel: Locator): Promise<void> {
  await ziel.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const kasten = await ziel.boundingBox();
  if (!kasten) {
    throw new Error('Zeile nicht sichtbar.');
  }
  const startX = kasten.x + kasten.width - 110;
  const startY = kasten.y + kasten.height / 2;
  const dx = -100;
  const session = await seite.context().newCDPSession(seite);
  const punkt = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(startX, startY) });
  const schritte = 8;
  for (let schritt = 1; schritt <= schritte; schritt += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: punkt(startX + (dx * schritt) / schritte, startY),
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test('Chronik zeigt Löschen nur beim Wischen', async ({ page }, testInfo) => {
  fs.mkdirSync('tmp-test/chronik-wischen', { recursive: true });
  const handy = testInfo.project.name === 'handy';
  await anmelden(page);
  await page.goto('/chronik');
  await expect(page.getByRole('heading', { name: /Verlauf|History/ })).toBeVisible();
  const karten = page.locator('[data-schnell]');
  await expect(karten.first()).toBeVisible();
  const bild = (name: string) => page.screenshot({ path: `tmp-test/chronik-wischen/${testInfo.project.name}-${name}.png` });

  const pruefeRuhe = async (name: string) => {
    const anzahl = Math.min(await karten.count(), 4);
    expect(anzahl).toBeGreaterThan(0);
    for (let index = 0; index < anzahl; index += 1) {
      const karte = karten.nth(index);
      const punkt = await ruhePunkt(karte);
      const rot = await rotePixel(page, punkt.x, punkt.y);
      expect(rot, `${name} Karte ${index}`).toBe(0);
      await expect(karte.getByRole('button', { name: /^(Löschen|Delete)$/ })).toHaveCount(0);
      await expect(karte.getByRole('button', { name: /Aktionen für|Actions for/ })).toBeVisible();
      await expect(karte.locator('.zahl')).toBeVisible();
    }
    await bild(name);
  };

  await pruefeRuhe('meilenstein');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const blatt = page.getByRole('dialog', { name: 'Filter' });
  await blatt.getByRole('switch', { name: /Nur Meilensteine|Milestones only/ }).click();
  await blatt.getByRole('button', { name: /Anwenden|Apply/ }).click();
  await expect(blatt).toBeHidden();
  await expect(karten.first()).toBeVisible();
  await pruefeRuhe('alle');

  const erste = karten.first();
  await erste.getByRole('button', { name: /Aktionen für|Actions for/ }).click();
  await expect(page.getByRole('menuitem', { name: /^(Löschen|Delete)$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  const nachMenue = await ruhePunkt(erste);
  expect(await rotePixel(page, nachMenue.x, nachMenue.y)).toBe(0);

  if (!handy) {
    return;
  }

  const karte = karten.first();
  await wischen(page, karte);
  await expect(karte.getByRole('button', { name: /^(Löschen|Delete)$/ })).toBeVisible();
  const offen = await karte.boundingBox();
  if (!offen) {
    throw new Error('Karte nach dem Wischen nicht sichtbar.');
  }
  await expect.poll(async () => rotePixel(page, offen.x + offen.width - 20, offen.y + 8)).toBeGreaterThan(0);
  await bild('gewischt');
  await page.getByRole('heading', { name: /Verlauf|History/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(karte.getByRole('button', { name: /^(Löschen|Delete)$/ })).toHaveCount(0);
  const zu = await ruhePunkt(karte);
  await expect.poll(async () => rotePixel(page, zu.x, zu.y)).toBe(0);
});
