import { inflateSync } from 'node:zlib';
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { kontrast } from '../shared/spiel/farben.ts';
import { TEST_PASSWORT } from './testdaten.ts';

async function passwort(): Promise<string> {
  return TEST_PASSWORT;
}

async function anmelden(seite: Page): Promise<void> {
  await seite.goto('/');
  await seite.locator('input[name="username"]').fill('testvoll');
  await seite.locator('input[name="password"]').fill(await passwort());
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).waitFor();
}

async function ohneSeitlichenUeberlauf(seite: Page): Promise<void> {
  const ueberlauf = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(ueberlauf).toBe(false);
}

async function setzeArchiv(seite: Page, kennung: string, archiviert: boolean): Promise<void> {
  const status = await seite.evaluate(
    async ({ kennung, archiviert }) => {
      const liste = (await fetch('/api/attribute').then((antwort) => antwort.json())) as {
        id: number;
        kennung: string | null;
      }[];
      const attribut = liste.find((eintrag) => eintrag.kennung === kennung);
      if (!attribut) {
        return 404;
      }
      const antwort = await fetch(`/api/attribute/${attribut.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archiviert }),
      });
      return antwort.status;
    },
    { kennung, archiviert },
  );
  expect(status).toBe(200);
}

const RING_D = 36;
const RING_KONTRAST = 3;
const HELL = { stil: 'standard', primaer: '#141414', akzent: '#707070', hintergrund: '#f2f2f2' };
const DUNKEL = { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414' };

interface RingMass {
  breite: number;
  hoehe: number;
  strich: number;
  symbol: number | null;
  symbolLayout: number | null;
  symbolStrich: number | null;
  links: number;
  oben: number;
  rechts: number;
  unten: number;
  strichFarbe: string;
  flaeche: string;
}

interface Farbstand {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
}

async function missRing(ring: Locator): Promise<RingMass> {
  return ring.evaluate((element) => {
    const kasten = element.getBoundingClientRect();
    const kreis = element.querySelector('circle.bossring-bogen');
    const symbol = element.querySelector('.boss-ring-symbol');
    const klinge = element.querySelector('.lucide-swords');
    if (!(kreis instanceof SVGCircleElement)) {
      throw new Error('Ring fehlt');
    }
    const stil = getComputedStyle(kreis);
    const radius = Number.parseFloat(stil.r);
    const strich = Number.parseFloat(stil.strokeWidth);
    const cx = Number.parseFloat(stil.cx);
    const cy = Number.parseFloat(stil.cy);
    let knoten: Element | null = element;
    let flaeche = getComputedStyle(document.body).backgroundColor;
    while (knoten) {
      const farbe = getComputedStyle(knoten).backgroundColor;
      if (farbe && farbe !== 'rgba(0, 0, 0, 0)' && farbe !== 'transparent') {
        flaeche = farbe;
        break;
      }
      knoten = knoten.parentElement;
    }
    const symbolKasten = symbol instanceof Element ? symbol.getBoundingClientRect() : null;
    const symbolStil = symbol instanceof Element ? getComputedStyle(symbol) : null;
    const symbolStrich = klinge instanceof Element ? Number.parseFloat(getComputedStyle(klinge).strokeWidth) : null;
    return {
      breite: kasten.width,
      hoehe: kasten.height,
      strich,
      symbol: symbolKasten ? symbolKasten.width : null,
      symbolLayout: symbolStil ? Number.parseFloat(symbolStil.width) : null,
      symbolStrich,
      links: cx - radius - strich / 2,
      oben: cy - radius - strich / 2,
      rechts: cx + radius + strich / 2,
      unten: cy + radius + strich / 2,
      strichFarbe: stil.stroke,
      flaeche,
    };
  });
}

function pruefeRing(mass: RingMass): void {
  expect(Math.round(mass.breite)).toBe(RING_D);
  expect(Math.round(mass.hoehe)).toBe(RING_D);
  expect(mass.strich).toBeCloseTo(RING_D * 0.06, 1);
  expect(mass.links).toBeGreaterThanOrEqual(-0.75);
  expect(mass.oben).toBeGreaterThanOrEqual(-0.75);
  expect(mass.rechts).toBeLessThanOrEqual(mass.breite + 0.75);
  expect(mass.unten).toBeLessThanOrEqual(mass.hoehe + 0.75);
  expect(kontrast(mass.strichFarbe, mass.flaeche)).toBeGreaterThanOrEqual(RING_KONTRAST);
  expect(mass.symbolLayout).toBeCloseTo(RING_D / 2, 1);
  expect(mass.symbol).not.toBeNull();
  expect(mass.symbol ?? 0).toBeLessThanOrEqual(mass.breite);
  expect(mass.symbolStrich).toBeCloseTo(RING_D * 0.06, 1);
}

async function leseFarben(seite: Page): Promise<Farbstand> {
  return seite.evaluate(async () => {
    const daten = (await fetch('/api/einstellungen').then((antwort) => antwort.json())) as Farbstand;
    return {
      stil: daten.stil,
      primaer: daten.primaer,
      akzent: daten.akzent,
      hintergrund: daten.hintergrund,
      glimmen: daten.glimmen,
      eigeneFarben: daten.eigeneFarben,
    };
  });
}

async function setzeFarben(seite: Page, daten: Record<string, unknown>): Promise<void> {
  const ok = await seite.evaluate(async (koerper) => {
    const antwort = await fetch('/api/einstellungen', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return antwort.ok;
  }, daten);
  expect(ok).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Bosse zeigen Ring und Datum, das Level erst nach dem Sieg', async ({ page }, testInfo) => {
  const bild = (name: string) => page.screenshot({ path: `tmp-test/bosse/${testInfo.project.name}-${name}.png` });
  const erwachtTitel = 'Erste Version raus';
  const still = await page.evaluate(async (titel) => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { id: number; titel: string; projektId: number | null }[];
    };
    const boss = laufend.bosse.find((eintrag) => eintrag.titel === titel);
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlage = vorlagen.find(
      (eintrag) => !eintrag.archiviert && (eintrag.projektId === null || eintrag.projektId === boss?.projektId),
    );
    if (!boss || !vorlage || boss.projektId === null) {
      return { ok: false as const };
    }
    const antwort = await fetch('/api/eintraege', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projektId: boss.projektId,
        vorlageId: vorlage.id,
        vorhaben: { art: 'bestehend', id: boss.id },
        abschluss: null,
        erkenntnis: '',
        stunden: 1,
        notiz: '',
        meilenstein: false,
        faehigkeitId: null,
        datum: null,
      }),
    });
    if (!antwort.ok) {
      return { ok: false as const, status: antwort.status };
    }
    const daten = (await antwort.json()) as { belohnung: { boss: unknown } };
    return { ok: true as const, boss: daten.belohnung.boss, projektId: boss.projektId };
  }, erwachtTitel);
  expect(still.ok).toBe(true);
  if (!still.ok) {
    return;
  }
  expect(still.boss).toBeNull();

  const kreuz = await page.evaluate(async () => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { id: number; titel: string; boss: { deadline: string } | null }[];
    };
    const fund = laufend.bosse.find((eintrag) => eintrag.titel === 'Kreuzheben 100 Kilo');
    if (!fund?.boss) {
      return null;
    }
    const morgen = new Date();
    morgen.setDate(morgen.getDate() + 14);
    const deadline = `${morgen.getFullYear()}-${String(morgen.getMonth() + 1).padStart(2, '0')}-${String(morgen.getDate()).padStart(2, '0')}`;
    const antwort = await fetch(`/api/vorhaben/${fund.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ boss: { deadline } }),
    });
    return antwort.ok ? { id: fund.id, vorher: fund.boss.deadline } : null;
  });
  expect(kreuz).not.toBeNull();

  try {
  await page.goto('/laufend');
  const erwacht = page.locator('.zeile', { hasText: erwachtTitel });
  const entsteht = page.locator('.zeile', { hasText: 'Kreuzheben 100 Kilo' });
  await expect(erwacht).toContainText(/Erwacht · seit /);
  await expect(entsteht).toContainText(/Entsteht · /);
  await expect(erwacht.getByText(/\d[\d.]* XP/)).toHaveCount(0);
  await expect(entsteht.getByText(/\d[\d.]* XP/)).toHaveCount(0);
  await expect(page.getByText('HP')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('laufend');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bosse greifen an' })).toBeVisible();
  const angriff = page.locator('.zeile', { hasText: erwachtTitel });
  await expect(angriff).toContainText(/seit \d+\. [A-Za-zäöüÄÖÜ]+\./);
  await expect(angriff).not.toContainText('Erwacht');
  await expect(angriff).toContainText('Disziplin');
  await expect(angriff).not.toHaveClass(/gefahr/);
  const disziplin = angriff.locator('.text-gefahr', { hasText: 'Disziplin' });
  await expect(disziplin).toHaveCount(1);
  await expect(angriff.locator('.lucide-swords')).toHaveCount(1);
  await expect(angriff.locator('.lucide-swords')).toHaveClass(/text-gefahr/);
  await expect(angriff.locator('.text-gefahr')).toHaveCount(2);
  const gefahrStimmt = await disziplin.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--gefahr)';
    document.body.append(probe);
    const soll = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(element).color === soll;
  });
  expect(gefahrStimmt).toBe(true);
  const striche = await angriff.locator('svg circle').evaluateAll((kreise) => kreise.map((kreis) => getComputedStyle(kreis).stroke));
  const gefahrFarbe = await angriff.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--gefahr)';
    document.body.append(probe);
    const soll = getComputedStyle(probe).color;
    probe.remove();
    return soll;
  });
  expect(striche.length).toBeGreaterThan(0);
  for (const strich of striche) {
    expect(strich).toBe(gefahrFarbe);
  }
  const nebenZeilen = await angriff.locator('.zeile-neben').evaluate((element) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(element);
    return bereich.getClientRects().length;
  });
  expect(nebenZeilen).toBe(1);
  await expect(page.getByText('Kreuzheben 100 Kilo')).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('angriff');
  } finally {
    if (kreuz) {
      await page.evaluate(async ({ id, vorher }) => {
        await fetch(`/api/vorhaben/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ boss: { deadline: vorher } }),
        });
      }, kreuz);
    }
  }

  await page.goto(`/projekte/${still.projektId}`);
  const bossZeile = page.locator('.rounded-2xl', { hasText: erwachtTitel });
  await bossZeile.getByRole('button', { name: `Aktionen für ${erwachtTitel}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Boss bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[type="date"]')).toBeVisible();
  await expect(dialog.locator('input[type="number"]')).toHaveCount(0);
  await expect(dialog).toHaveCSS('opacity', '1');
  const speichernSichtbar = await dialog.getByRole('button', { name: 'Speichern' }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const mitte = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element.contains(mitte);
  });
  expect(speichernSichtbar).toBe(true);
  await ohneSeitlichenUeberlauf(page);
  await bild('formular');
  await dialog.getByRole('button', { name: /^Info/ }).click();
  await expect(page.getByText('Bis zum Datum entsteht er. Danach greift er an.')).toBeVisible();
  await page.keyboard.press('Escape');

  const siegTitel = `Prüfboss ${testInfo.project.name} ${Date.now()}`;
  const sieg = await page.evaluate(async (titel) => {
    const ziele = (await fetch('/api/ziele').then((antwort) => antwort.json())) as {
      projekte: { id: number; aktiv: boolean }[];
    };
    const projekt = ziele.projekte.find((eintrag) => eintrag.aktiv);
    const vorlagen = (await fetch('/api/vorlagen').then((antwort) => antwort.json())) as {
      id: number;
      archiviert: boolean;
      projektId: number | null;
    }[];
    const vorlage = vorlagen.find(
      (eintrag) => !eintrag.archiviert && (eintrag.projektId === null || eintrag.projektId === projekt?.id),
    );
    if (!projekt || !vorlage) {
      return { ok: false as const };
    }
    const heute = new Date();
    heute.setDate(heute.getDate() + 14);
    const deadline = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
    const angelegt = await fetch('/api/vorhaben', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projektId: projekt.id, titel }),
    });
    if (!angelegt.ok) {
      return { ok: false as const };
    }
    const vorhaben = (await angelegt.json()) as { id: number };
    const alsBoss = await fetch(`/api/vorhaben/${vorhaben.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ boss: { deadline } }),
    });
    if (!alsBoss.ok) {
      return { ok: false as const };
    }
    const antwort = await fetch('/api/eintraege', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projektId: projekt.id,
        vorlageId: vorlage.id,
        vorhaben: { art: 'bestehend', id: vorhaben.id },
        abschluss: 'geschafft',
        erkenntnis: '',
        stunden: 1,
        notiz: '',
        meilenstein: false,
        faehigkeitId: null,
        datum: null,
      }),
    });
    if (!antwort.ok) {
      return { ok: false as const };
    }
    const daten = (await antwort.json()) as { belohnung: { boss: { level: number; kampfXp: number } | null } };
    return { ok: true as const, projektId: projekt.id, boss: daten.belohnung.boss };
  }, siegTitel);
  expect(sieg.ok).toBe(true);
  if (!sieg.ok || sieg.boss === null) {
    expect(sieg.ok && sieg.boss).toBeTruthy();
    return;
  }
  expect(sieg.boss.level).toBeGreaterThanOrEqual(1);
  expect(sieg.boss.kampfXp).toBeGreaterThan(0);

  await page.goto(`/projekte/${sieg.projektId}`);
  await page.getByRole('button', { name: /Abgeschlossen/ }).click();
  const siegKarte = page.locator('.rounded-2xl', { hasText: siegTitel });
  await expect(siegKarte).toContainText(/Boss besiegt · Level \d+ · [\d.]+ XP/);
  await ohneSeitlichenUeberlauf(page);
  await bild('sieg');

  try {
    await setzeArchiv(page, 'disziplin', true);
    await setzeArchiv(page, 'ressourcen', true);
    await page.goto('/laufend');
    await expect(page.getByText(erwachtTitel)).toBeVisible();
    await expect(page.getByText(/Erwacht|Entsteht/)).toHaveCount(0);
    await page.goto('/mehr/funktionen');
    const bosse = page.locator('#funktion-bossAngriffe');
    const investitionen = page.locator('#funktion-ausruestung');
    await expect(bosse.getByRole('switch', { name: 'Bosse' })).toBeDisabled();
    await expect(bosse.getByRole('switch', { name: 'Bosse' })).toHaveAttribute('aria-checked', 'false');
    await expect(investitionen.getByRole('switch', { name: 'Investitionen' })).toBeDisabled();
    await expect(investitionen.getByRole('switch', { name: 'Investitionen' })).toHaveAttribute('aria-checked', 'false');
    await bosse.scrollIntoViewIfNeeded();
    await ohneSeitlichenUeberlauf(page);
    await bild('schalter');
    await expect(bosse).toContainText('Erst Disziplin einschalten.');
    await expect(investitionen).toContainText('Erst Ressourcen einschalten.');
  } finally {
    await setzeArchiv(page, 'disziplin', false);
    await setzeArchiv(page, 'ressourcen', false);
  }
});

test('offene Boss-Zeilen zeigen denselben Ring', async ({ page }, testInfo) => {
  const fund = await page.evaluate(async () => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { titel: string; projektId: number | null; boss: { phase: string } | null }[];
    };
    const boss = laufend.bosse.find((eintrag) => eintrag.boss?.phase === 'erwacht' && eintrag.projektId !== null);
    if (boss?.projektId == null) {
      return null;
    }
    return { titel: boss.titel, projektId: boss.projektId };
  });
  expect(fund).not.toBeNull();
  if (!fund) {
    return;
  }

  async function ringAuf(pfad: string, rahmen: string, bild: string): Promise<RingMass> {
    await page.goto(pfad);
    const ring = page.locator(rahmen, { hasText: fund.titel }).locator('[data-boss-ring]').first();
    await expect(ring).toBeVisible();
    await page.screenshot({ path: `tmp-test/bosse/${testInfo.project.name}-${bild}.png` });
    return missRing(ring);
  }

  const heute = await ringAuf('/', '.zeile', 'ring-heute');
  const laufend = await ringAuf('/laufend', '.zeile', 'ring-laufend');
  const projekt = await ringAuf(`/projekte/${fund.projektId}`, '.rounded-2xl', 'ring-projekt');
  pruefeRing(heute);
  pruefeRing(laufend);
  pruefeRing(projekt);
  expect(Math.round(heute.breite)).toBe(Math.round(laufend.breite));
  expect(Math.round(heute.breite)).toBe(Math.round(projekt.breite));
  expect(Math.round(heute.symbol ?? 0)).toBe(Math.round(laufend.symbol ?? 0));
  expect(Math.round(heute.symbol ?? 0)).toBe(Math.round(projekt.symbol ?? 0));

  await page.goto('/');
  const ring = page.locator('.zeile', { hasText: fund.titel }).locator('[data-boss-ring]').first();
  await ring.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const quelle = document.querySelector('[data-boss-ring]');
    if (!(quelle instanceof HTMLElement)) {
      return;
    }
    const kasten = document.createElement('div');
    kasten.id = 'ring-lupe';
    kasten.style.cssText =
      'position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:var(--flaeche);';
    const zoom = quelle.cloneNode(true) as HTMLElement;
    zoom.style.transform = 'scale(4)';
    kasten.append(zoom);
    document.body.append(kasten);
  });
  await page.screenshot({ path: `tmp-test/bosse/${testInfo.project.name}-ring-4x.png` });
  await page.evaluate(() => document.getElementById('ring-lupe')?.remove());

  const original = await leseFarben(page);
  try {
    await setzeFarben(page, { ...HELL, glimmen: original.glimmen });
    await page.goto('/');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--grund').trim().toLowerCase()))
      .toBe(HELL.hintergrund);
    const hell = await missRing(page.locator('.zeile', { hasText: fund.titel }).locator('[data-boss-ring]').first());
    expect(kontrast(hell.strichFarbe, hell.flaeche)).toBeGreaterThanOrEqual(RING_KONTRAST);

    await setzeFarben(page, { ...DUNKEL, glimmen: original.glimmen });
    await page.goto('/');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--grund').trim().toLowerCase()))
      .toBe(DUNKEL.hintergrund);
    const dunkel = await missRing(page.locator('.zeile', { hasText: fund.titel }).locator('[data-boss-ring]').first());
    expect(kontrast(dunkel.strichFarbe, dunkel.flaeche)).toBeGreaterThanOrEqual(RING_KONTRAST);
    expect(dunkel.strichFarbe).not.toBe(hell.strichFarbe);
  } finally {
    if (original.eigeneFarben) {
      await setzeFarben(page, {
        stil: original.stil,
        primaer: original.primaer,
        akzent: original.akzent,
        hintergrund: original.hintergrund,
        glimmen: original.glimmen,
      });
    } else {
      await setzeFarben(page, { stil: original.stil, glimmen: original.glimmen, farbenZuruecksetzen: true });
    }
  }
});

interface RingBild {
  breite: number;
  hoehe: number;
  pixel: Uint8Array;
}

interface SchwertMitte {
  dx: number;
  dy: number;
  kreisDx: number;
  kreisDy: number;
  svgDy: number;
  breite: number;
  ring: number;
  voll: boolean;
  strich: number;
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

function pngLesen(png: Buffer): RingBild {
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
      tiefe = daten[8] ?? 0;
      typ = daten[9] ?? 0;
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
    const filter = roh[quelle] ?? 0;
    quelle += 1;
    const zeile = new Uint8Array(schritt);
    for (let i = 0; i < schritt; i += 1) {
      const wert = roh[quelle + i] ?? 0;
      const links = i >= kanaele ? (zeile[i - kanaele] ?? 0) : 0;
      const oben = vorher[i] ?? 0;
      const obenLinks = i >= kanaele ? (vorher[i - kanaele] ?? 0) : 0;
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
      pixel[ziel] = zeile[i] ?? 0;
      pixel[ziel + 1] = zeile[i + 1] ?? 0;
      pixel[ziel + 2] = zeile[i + 2] ?? 0;
      pixel[ziel + 3] = kanaele === 4 ? (zeile[i + 3] ?? 0) : 255;
    }
  }
  return { breite, hoehe, pixel };
}

function pixelRot(pixel: Uint8Array, index: number): boolean {
  const rot = pixel[index] ?? 0;
  const gruen = pixel[index + 1] ?? 0;
  const blau = pixel[index + 2] ?? 0;
  const alpha = pixel[index + 3] ?? 0;
  return alpha > 140 && rot > 90 && rot > gruen + 20 && rot > blau + 20;
}

function roteInnen(
  bild: RingBild,
  mitteX: number,
  mitteY: number,
  innen: number,
  radius: number,
): { dx: number; dy: number; sx: number; sy: number; anzahl: number; geschlossen: boolean } {
  const { breite, hoehe, pixel } = bild;
  let summeX = 0;
  let summeY = 0;
  let anzahl = 0;
  for (let y = 0; y < hoehe; y += 1) {
    for (let x = 0; x < breite; x += 1) {
      const abX = x + 0.5 - mitteX;
      const abY = y + 0.5 - mitteY;
      if (abX * abX + abY * abY > innen * innen) {
        continue;
      }
      const index = (y * breite + x) * 4;
      if (!pixelRot(pixel, index)) {
        continue;
      }
      summeX += x + 0.5;
      summeY += y + 0.5;
      anzahl += 1;
    }
  }
  if (anzahl < 40) {
    throw new Error(`Zu wenig rote Pixel im Ring: ${anzahl}`);
  }
  const px = Math.min(breite - 1, Math.max(0, Math.floor(mitteX)));
  const py = Math.min(hoehe - 1, Math.max(0, Math.floor(mitteY - radius)));
  let geschlossen = true;
  for (const versatz of [-2, 0, 2]) {
    const x = Math.min(breite - 1, Math.max(0, px + versatz));
    if (!pixelRot(pixel, (py * breite + x) * 4)) {
      geschlossen = false;
    }
  }
  const sx = summeX / anzahl - mitteX;
  const sy = summeY / anzahl - mitteY;
  return {
    dx: Math.abs(sx),
    dy: Math.abs(sy),
    sx,
    sy,
    anzahl,
    geschlossen,
  };
}

async function ringAufnahme(
  seite: Page,
  ring: Locator,
  strich: number,
): Promise<{ bild: RingBild; mitteX: number; mitteY: number; innen: number; radius: number }> {
  const kasten = await ring.boundingBox();
  const sicht = seite.viewportSize();
  if (!kasten || !sicht) {
    throw new Error('Ring nicht messbar');
  }
  const rand = 8;
  const x = Math.max(0, kasten.x - rand);
  const y = Math.max(0, kasten.y - rand);
  const rechts = Math.min(sicht.width, kasten.x + kasten.width + rand);
  const unten = Math.min(sicht.height, kasten.y + kasten.height + rand);
  const clip = { x, y, width: Math.max(1, rechts - x), height: Math.max(1, unten - y) };
  const bild = pngLesen(await seite.screenshot({ clip }));
  const massstabX = bild.breite / clip.width;
  const massstabY = bild.hoehe / clip.height;
  const mitteX = (kasten.x - x + kasten.width / 2) * massstabX;
  const mitteY = (kasten.y - y + kasten.height / 2) * massstabY;
  return {
    bild,
    mitteX,
    mitteY,
    innen: ((kasten.width / 2 - strich - 3) / kasten.width) * kasten.width * massstabX,
    radius: ((kasten.width - strich) / 2) * massstabY,
  };
}

async function missMitte(ring: Locator): Promise<SchwertMitte> {
  return ring.evaluate((element) => {
    const kreis = element.querySelector('circle.bossring-bogen');
    const schwert = element.querySelector('.boss-symbol');
    if (!(kreis instanceof SVGCircleElement) || !(schwert instanceof SVGElement)) {
      throw new Error('Ring oder Schwert fehlt');
    }
    const kasten = kreis.getBoundingClientRect();
    const elementKasten = element.getBoundingClientRect();
    const kx = kasten.left + kasten.width / 2;
    const ky = kasten.top + kasten.height / 2;
    const pfade = [...schwert.querySelectorAll('path')];
    if (pfade.length === 0) {
      throw new Error('Schwert ohne Pfad');
    }
    let links = Number.POSITIVE_INFINITY;
    let oben = Number.POSITIVE_INFINITY;
    let rechts = Number.NEGATIVE_INFINITY;
    let unten = Number.NEGATIVE_INFINITY;
    for (const pfad of pfade) {
      const box = pfad.getBoundingClientRect();
      links = Math.min(links, box.left);
      oben = Math.min(oben, box.top);
      rechts = Math.max(rechts, box.right);
      unten = Math.max(unten, box.bottom);
    }
    const schwertKasten = schwert.getBoundingClientRect();
    const stil = getComputedStyle(kreis);
    const px = (links + rechts) / 2;
    const py = (oben + unten) / 2;
    const sx = schwertKasten.left + schwertKasten.width / 2;
    const sy = schwertKasten.top + schwertKasten.height / 2;
    return {
      dx: Math.abs(px - kx),
      dy: py - ky,
      kreisDx: Math.abs(kx - (elementKasten.left + elementKasten.width / 2)),
      kreisDy: ky - (elementKasten.top + elementKasten.height / 2),
      svgDy: sy - ky,
      breite: schwertKasten.width,
      ring: elementKasten.width,
      voll: kreis.getAttribute('stroke-dasharray') === null && stil.strokeDasharray === 'none',
      strich: Number.parseFloat(stil.strokeWidth),
    };
  });
}

async function stelleFarbenWiederHer(seite: Page, original: Farbstand): Promise<void> {
  if (original.eigeneFarben) {
    await setzeFarben(seite, {
      stil: original.stil,
      primaer: original.primaer,
      akzent: original.akzent,
      hintergrund: original.hintergrund,
      glimmen: original.glimmen,
    });
    return;
  }
  await setzeFarben(seite, { stil: original.stil, glimmen: original.glimmen, farbenZuruecksetzen: true });
}

test('Schwert und Kreis haben dieselbe Mitte', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const fund = await page.evaluate(async () => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { titel: string; projektId: number | null; boss: { phase: string } | null }[];
    };
    const boss = laufend.bosse.find((eintrag) => eintrag.boss?.phase === 'erwacht' && eintrag.projektId !== null);
    if (boss?.projektId == null) {
      return null;
    }
    return { titel: boss.titel, projektId: boss.projektId };
  });
  expect(fund).not.toBeNull();
  if (!fund) {
    return;
  }
  const orte = [
    { pfad: '/', rahmen: '.zeile' },
    { pfad: '/laufend', rahmen: '.zeile' },
    { pfad: `/projekte/${fund.projektId}`, rahmen: '.rounded-2xl' },
  ];
  const original = await leseFarben(page);
  let lupe = false;
  try {
    for (const breite of [390, 1280]) {
      await page.setViewportSize({ width: breite, height: breite === 390 ? 844 : 900 });
      for (const thema of [HELL, DUNKEL]) {
        await setzeFarben(page, { ...thema, glimmen: original.glimmen });
        for (const ort of orte) {
          await page.goto(ort.pfad);
          await expect
            .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--grund').trim().toLowerCase()))
            .toBe(thema.hintergrund);
          const ring = page.locator(ort.rahmen, { hasText: fund.titel }).locator('[data-boss-ring]').first();
          await expect(ring).toBeVisible();
          await ring.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
          const masse = await missMitte(ring);
          expect(masse.dx, `Pfad x ${masse.dx}`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(masse.dy), `Pfad y ${masse.dy} Svg y ${masse.svgDy} Kreis y ${masse.kreisDy}`).toBeLessThanOrEqual(0.5);
          expect(masse.kreisDx, `Kreis x ${masse.kreisDx}`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(masse.kreisDy), `Kreis y ${masse.kreisDy}`).toBeLessThanOrEqual(0.5);
          expect(masse.breite).toBeCloseTo(RING_D / 2, 0);
          expect(masse.voll).toBe(true);
          expect(masse.strich).toBeCloseTo(RING_D * 0.06, 1);
          const aufnahme = await ringAufnahme(page, ring, masse.strich);
          const rot = roteInnen(aufnahme.bild, aufnahme.mitteX, aufnahme.mitteY, aufnahme.innen, aufnahme.radius);
          expect(rot.dx, `Pixel x ${rot.sx}`).toBeLessThanOrEqual(1);
          expect(rot.dy, `Pixel y ${rot.sy} Pfad y ${masse.dy}`).toBeLessThanOrEqual(1);
          expect(rot.geschlossen, 'Kerbe auf 12 Uhr').toBe(true);
          if (!lupe && breite === 390) {
            fs.mkdirSync('tmp-test/bosse', { recursive: true });
            await ring.evaluate((element) => {
              const kasten = document.createElement('div');
              kasten.id = 'ring-lupe';
              kasten.style.cssText =
                'position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:var(--flaeche);';
              const zoom = element.cloneNode(true) as HTMLElement;
              zoom.style.transformOrigin = 'center';
              zoom.style.transform = 'scale(4)';
              kasten.append(zoom);
              document.body.append(kasten);
            });
            const gezoomt = pngLesen(
              await page.locator('#ring-lupe [data-boss-ring]').screenshot({
                path: `tmp-test/bosse/${testInfo.project.name}-ring-mitte-4x.png`,
              }),
            );
            const faktor = await page.evaluate(() => window.devicePixelRatio);
            expect(gezoomt.breite).toBeGreaterThan(RING_D * faktor * 3);
            const naht = roteInnen(
              gezoomt,
              gezoomt.breite / 2,
              gezoomt.hoehe / 2,
              gezoomt.hoehe * ((masse.ring / 2 - masse.strich - 3) / masse.ring),
              gezoomt.hoehe * ((masse.ring - masse.strich) / (2 * masse.ring)),
            );
            expect(naht.geschlossen, '4×-Zoom hat eine Kerbe').toBe(true);
            await page.evaluate(() => document.getElementById('ring-lupe')?.remove());
            lupe = true;
          }
        }
      }
    }
  } finally {
    await stelleFarbenWiederHer(page, original);
  }
});

async function warteAufHelleFlaeche(seite: Page): Promise<void> {
  await expect
    .poll(() =>
      seite.evaluate(() => {
        const wurzel = getComputedStyle(document.documentElement);
        const karte = document.querySelector('[data-flaeche]');
        const schrift = document.querySelector('h1, .zeile p');
        return {
          flaeche: wurzel.getPropertyValue('--flaeche').trim().toLowerCase(),
          haupt: wurzel.getPropertyValue('--haupt').trim().toLowerCase(),
          leise: wurzel.getPropertyValue('--leise').trim().toLowerCase(),
          gefahr: wurzel.getPropertyValue('--gefahr').trim().toLowerCase(),
          grund: wurzel.getPropertyValue('--grund').trim().toLowerCase(),
          karte: karte instanceof HTMLElement ? getComputedStyle(karte).backgroundColor : '',
          schrift: schrift instanceof HTMLElement ? getComputedStyle(schrift).color : '',
        };
      }),
    )
    .toEqual({
      flaeche: '#ffffff',
      haupt: '#141414',
      leise: '#666666',
      gefahr: '#c62828',
      grund: '#f2f2f2',
      karte: 'rgb(255, 255, 255)',
      schrift: 'rgb(20, 20, 20)',
    });
  await seite.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await seite.waitForTimeout(500);
}

async function tippeMitte(seite: Page, ziel: Locator): Promise<void> {
  const kasten = await ziel.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return;
  }
  await seite.mouse.click(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
}

async function mindestTreffer(ziel: Locator): Promise<void> {
  const kasten = await ziel.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return;
  }
  expect(kasten.width).toBeGreaterThanOrEqual(48);
  expect(kasten.height).toBeGreaterThanOrEqual(48);
}

async function schliesseDialog(seite: Page, name: string): Promise<void> {
  const dialog = seite.getByRole('dialog', { name, exact: true });
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function pruefeBossZeile(seite: Page, zeile: Locator, titel: string, mitMenue: boolean): Promise<void> {
  await zeile.scrollIntoViewIfNeeded();
  const oeffnen = zeile.getByRole('button', { name: titel, exact: true });
  const weiter = zeile.getByRole('button', { name: 'Weiter', exact: true });
  await expect(oeffnen).toBeVisible();
  await mindestTreffer(weiter);
  const boss = seite.getByRole('dialog', { name: 'Boss', exact: true });

  if (mitMenue) {
    const menue = zeile.getByRole('button', { name: `Aktionen für ${titel}`, exact: true });
    await mindestTreffer(menue);
    await menue.click();
    await expect(seite.getByRole('menuitem', { name: 'Boss bearbeiten', exact: true })).toBeVisible();
    await expect(boss).toHaveCount(0);
    await seite.keyboard.press('Escape');
    await expect(seite.getByRole('menu')).toHaveCount(0);
  }

  await tippeMitte(seite, zeile.getByText(titel, { exact: true }));
  await expect(boss.locator('input[type="date"]')).toBeVisible();
  await schliesseDialog(seite, 'Boss');

  const kasten = await zeile.boundingBox();
  expect(kasten).not.toBeNull();
  if (!kasten) {
    return;
  }
  await seite.mouse.click(kasten.x + 8, kasten.y + kasten.height / 2);
  await expect(boss.locator('input[type="date"]')).toBeVisible();
  await schliesseDialog(seite, 'Boss');

  await oeffnen.focus();
  await seite.keyboard.press('Shift+Tab');
  await expect(oeffnen).not.toBeFocused();
  await seite.keyboard.press('Tab');
  await expect(oeffnen).toBeFocused();
  await seite.keyboard.press('Enter');
  await expect(boss.locator('input[type="date"]')).toBeVisible();
  await schliesseDialog(seite, 'Boss');

  await weiter.click();
  const eintrag = seite.getByRole('dialog', { name: 'Was hast du getan?', exact: true });
  await expect(eintrag).toBeVisible();
  await expect(boss).toHaveCount(0);
  await schliesseDialog(seite, 'Was hast du getan?');
}

test('die Boss-Zeile öffnet das Blatt, Weiter und Menü bleiben eigene Ziele', async ({ page }, testInfo) => {
  const fund = await page.evaluate(async () => {
    const laufend = (await fetch('/api/laufend').then((antwort) => antwort.json())) as {
      bosse: { titel: string; projektId: number | null }[];
    };
    const boss = laufend.bosse.find((eintrag) => eintrag.titel === 'Erste Version raus' && eintrag.projektId !== null)
      ?? laufend.bosse.find((eintrag) => eintrag.projektId !== null);
    if (boss?.projektId == null) {
      return null;
    }
    return { titel: boss.titel, projektId: boss.projektId };
  });
  expect(fund).not.toBeNull();
  if (!fund) {
    return;
  }

  const original = await leseFarben(page);
  try {
    await setzeFarben(page, { ...HELL, glimmen: original.glimmen });
    await page.goto('/laufend');
    await expect(page.getByRole('heading', { name: 'Laufend', level: 1 })).toBeVisible();
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-schema', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
    await warteAufHelleFlaeche(page);
    await page.evaluate(() => document.fonts.ready);
    const laufendZeile = page.locator('.zeile', { hasText: fund.titel }).first();
    await expect(laufendZeile).toBeVisible();
    if (testInfo.project.name === 'handy') {
      fs.mkdirSync('tmp-test/boss-zeile', { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: 'tmp-test/boss-zeile/nachher-390-laufend.png' });
      await page.screenshot({ path: 'tmp-test/boss-zeile/nachher-390-laufend-ganz.png', fullPage: true });
    }
    await pruefeBossZeile(page, laufendZeile, fund.titel, false);

    await page.goto(`/projekte/${fund.projektId}`);
    await expect(page.getByText('Lädt …')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-schema', 'light');
    await warteAufHelleFlaeche(page);
    const projektZeile = page.locator('.rounded-2xl', { hasText: fund.titel }).first();
    await expect(projektZeile).toBeVisible();
    if (testInfo.project.name === 'handy') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: 'tmp-test/boss-zeile/nachher-390-projekt.png' });
      await page.screenshot({ path: 'tmp-test/boss-zeile/nachher-390-projekt-ganz.png', fullPage: true });
    }
    await pruefeBossZeile(page, projektZeile, fund.titel, true);
  } finally {
    await stelleFarbenWiederHer(page, original);
  }
});
