import { expect, test, type Page, type TestInfo } from './uhr.ts';
import { attributVorlage } from '../shared/features/attribute/attributKatalog.ts';
import { KOENNEN_KENNUNGEN } from '../shared/spiel/begriffe.ts';
import { kontrast, MINDEST_KONTRAST } from '../shared/spiel/farben.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

async function warteAufRuhe(seite: Page): Promise<void> {
  await seite.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
      }),
  );
  await expect
    .poll(() =>
      seite.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            if (animation.playState !== 'running') {
              return false;
            }
            return animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY;
          }).length,
      ),
    )
    .toBe(0);
}

function bild(info: TestInfo, name: string): string {
  return `tmp-test/profil-zusammenfassung/${info.project.name}-${name}.png`;
}

interface AttributZeile {
  id: number;
  typ: 'attribut' | 'status';
  name: string;
  kennung: string | null;
  archiviert: boolean;
  level: { level: number; xpGesamt: number };
}

interface Farbstand {
  stil: string;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
}

interface ChipProbe {
  gruppe: string;
  name: string;
  pokal: boolean;
  klasse: string;
  farbe: string;
  grund: string;
}

interface ZeilenProbe {
  name: string;
  klasse: string;
  farbe: string;
  grund: string;
  archetypKlasse: string;
  beinameKlasse: string;
}

interface D13Probe {
  schema: string | null;
  flaeche: string;
  gefahr: string;
  haupt: string;
  leise: string;
  akzent: string;
  xp: string;
  klasseText: string;
  klasseKlasse: string;
  klasseFarbe: string;
  klasseGrund: string;
  klasseGewicht: string;
  spalten: string[];
  zeilen: ZeilenProbe[];
  chips: ChipProbe[];
  neuling: boolean;
  allrounder: boolean;
  erklaerung: boolean;
}

interface ErfolgAntwort {
  kategorien: { label: string; stufen: { name: string; erreichtAm: string | null }[] }[];
}

function gleicheFarbe(links: string, rechts: string): boolean {
  const muster = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i;
  const a = links.match(muster);
  const b = rechts.match(muster);
  if (!a?.[1] || !a[2] || !a[3] || !b?.[1] || !b[2] || !b[3]) {
    return links.replace(/\s/g, '') === rechts.replace(/\s/g, '');
  }
  return [1, 2, 3].every((index) => Math.abs(Number(a[index]) - Number(b[index])) < 1.5);
}

async function attributeListe(seite: Page): Promise<AttributZeile[]> {
  const antwort = await seite.request.get('/api/attribute');
  expect(antwort.ok()).toBe(true);
  return antwort.json() as Promise<AttributZeile[]>;
}

async function farbstand(seite: Page): Promise<Farbstand> {
  const antwort = await seite.request.get('/api/einstellungen');
  expect(antwort.ok()).toBe(true);
  const daten = (await antwort.json()) as Farbstand;
  return {
    stil: daten.stil,
    primaer: daten.primaer,
    akzent: daten.akzent,
    hintergrund: daten.hintergrund,
    glimmen: daten.glimmen,
    eigeneFarben: daten.eigeneFarben,
  };
}

async function stelleFarbenHer(seite: Page, stand: Farbstand): Promise<void> {
  const koerper = stand.eigeneFarben
    ? {
        stil: stand.stil,
        glimmen: stand.glimmen,
        primaer: stand.primaer,
        akzent: stand.akzent,
        hintergrund: stand.hintergrund,
      }
    : { stil: stand.stil, glimmen: stand.glimmen, farbenZuruecksetzen: true };
  const antwort = await seite.request.patch('/api/einstellungen', { data: koerper });
  expect(antwort.ok()).toBe(true);
}

function schwaechstesNebenDerSpitze(liste: AttributZeile[]): AttributZeile | null {
  const koennen = liste.filter((eintrag) => eintrag.typ === 'attribut' && !eintrag.archiviert && eintrag.kennung !== null);
  const nachLevel = [...koennen].sort((a, b) => b.level.level - a.level.level || b.level.xpGesamt - a.level.xpGesamt);
  const spitze = new Set(nachLevel.slice(0, 2).map((eintrag) => eintrag.id));
  const reste = koennen.filter((eintrag) => !spitze.has(eintrag.id));
  reste.sort((a, b) => a.level.xpGesamt - b.level.xpGesamt || a.level.level - b.level.level);
  return reste[0] ?? null;
}

async function liesD13(seite: Page): Promise<D13Probe> {
  return seite.getByRole('dialog', { name: 'Klassen und Titel' }).evaluate((dialog) => {
    function gelesen(wert: string): { r: number; g: number; b: number; a: number } | null {
      const rgb = wert.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
      if (!rgb?.[1] || !rgb[2] || !rgb[3]) {
        return null;
      }
      return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
        a: rgb[4] === undefined ? 1 : Number(rgb[4]),
      };
    }
    function mischt(oben: string, unten: string): string {
      const vorder = gelesen(oben);
      const hinter = gelesen(unten);
      if (!vorder) {
        return unten;
      }
      if (vorder.a >= 0.99 || !hinter) {
        return `rgb(${Math.round(vorder.r)}, ${Math.round(vorder.g)}, ${Math.round(vorder.b)})`;
      }
      const kanal = (vorn: number, hinten: number) => Math.round(vorn * vorder.a + hinten * (1 - vorder.a));
      return `rgb(${kanal(vorder.r, hinter.r)}, ${kanal(vorder.g, hinter.g)}, ${kanal(vorder.b, hinter.b)})`;
    }
    function hintergrund(element: Element): string {
      const kette: Element[] = [];
      let knoten: Element | null = element;
      while (knoten) {
        kette.push(knoten);
        knoten = knoten.parentElement;
      }
      let grund = 'rgb(255, 255, 255)';
      for (let index = kette.length - 1; index >= 0; index -= 1) {
        const aktuell = kette[index];
        if (!aktuell) {
          continue;
        }
        grund = mischt(getComputedStyle(aktuell).backgroundColor, grund);
      }
      return grund;
    }
    function token(name: string): string {
      const probe = document.createElement('span');
      probe.style.color = `var(${name})`;
      document.body.append(probe);
      const farbe = getComputedStyle(probe).color;
      probe.remove();
      return farbe;
    }
    const wurzel = document.documentElement;
    const tabelle = dialog.querySelector('table');
    if (!tabelle) {
      throw new Error('Tabelle fehlt');
    }
    const klasseName = dialog.querySelector('span.font-semibold.text-akzent');
    if (!(klasseName instanceof HTMLElement)) {
      throw new Error('Klasse fehlt');
    }
    const titel = [...dialog.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent?.trim() === 'Titel');
    const behaelter = titel?.querySelector('.space-y-3');
    const chips: {
      gruppe: string;
      name: string;
      pokal: boolean;
      klasse: string;
      farbe: string;
      grund: string;
    }[] = [];
    if (behaelter) {
      for (const gruppe of behaelter.children) {
        if (!(gruppe instanceof HTMLElement)) {
          continue;
        }
        const gruppenName = gruppe.querySelector('p')?.textContent?.trim() ?? '';
        for (const chip of gruppe.querySelectorAll('span')) {
          chips.push({
            gruppe: gruppenName,
            name: chip.textContent?.trim() ?? '',
            pokal: chip.querySelector('svg') !== null,
            klasse: chip.className,
            farbe: getComputedStyle(chip).color,
            grund: hintergrund(chip),
          });
        }
      }
    }
    const zeilen = [...tabelle.querySelectorAll('tbody tr')].map((tr) => {
      const zellen = [...tr.querySelectorAll('td')];
      const nameZelle = zellen[0];
      const archetyp = zellen[1];
      const beiname = zellen[2];
      if (!(nameZelle instanceof HTMLElement) || !(archetyp instanceof HTMLElement) || !(beiname instanceof HTMLElement)) {
        throw new Error('Zeile unvollständig');
      }
      return {
        name: nameZelle.textContent?.trim() ?? '',
        klasse: tr.className,
        farbe: getComputedStyle(nameZelle).color,
        grund: hintergrund(nameZelle),
        archetypKlasse: archetyp.className,
        beinameKlasse: beiname.className,
      };
    });
    const text = dialog.textContent ?? '';
    return {
      schema: wurzel.dataset.schema ?? null,
      flaeche: getComputedStyle(wurzel).getPropertyValue('--flaeche').trim(),
      gefahr: getComputedStyle(wurzel).getPropertyValue('--gefahr').trim(),
      haupt: token('--haupt'),
      leise: token('--leise'),
      akzent: token('--akzent'),
      xp: token('--xp'),
      klasseText: klasseName.textContent?.trim() ?? '',
      klasseKlasse: klasseName.className,
      klasseFarbe: getComputedStyle(klasseName).color,
      klasseGrund: hintergrund(klasseName),
      klasseGewicht: getComputedStyle(klasseName).fontWeight,
      spalten: [...tabelle.querySelectorAll('thead th')].map((zelle) => zelle.textContent?.trim() ?? ''),
      zeilen,
      chips,
      neuling: text.includes('Neuling'),
      allrounder: text.includes('Allrounder'),
      erklaerung: text.includes('Fett ist dein stärkstes Können. Der Beiname folgt dem zweitstärksten.'),
    };
  });
}

async function warteAufTitelChips(seite: Page): Promise<void> {
  const dialog = seite.getByRole('dialog', { name: 'Klassen und Titel' });
  const chips = dialog
    .locator('section')
    .filter({ has: seite.getByRole('heading', { name: 'Titel', exact: true }) })
    .locator('.space-y-3 span');
  await expect.poll(async () => chips.count()).toBeGreaterThan(0);
}

async function pruefeD13(seite: Page, schema: 'light' | 'dark', liste: AttributZeile[]): Promise<D13Probe> {
  await warteAufTitelChips(seite);
  const probe = await liesD13(seite);
  expect(probe.schema).toBe(schema);
  expect(probe.flaeche).toBe(schema === 'light' ? '#ffffff' : '#202020');
  if (schema === 'light') {
    expect(probe.gefahr).toBe('#c62828');
  }
  expect(probe.spalten).toEqual(['Können', 'Archetyp', 'Beiname']);
  expect(probe.erklaerung).toBe(true);
  expect(probe.neuling).toBe(true);
  expect(probe.allrounder).toBe(true);
  expect(probe.klasseKlasse).toContain('font-semibold');
  expect(probe.klasseKlasse).toContain('text-akzent');
  expect(Number(probe.klasseGewicht)).toBeGreaterThanOrEqual(600);
  expect(gleicheFarbe(probe.klasseFarbe, probe.akzent)).toBe(true);
  expect(kontrast(probe.klasseFarbe, probe.klasseGrund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);

  const erwartet = KOENNEN_KENNUNGEN.map((kennung) => {
    const treffer = [...liste].reverse().find((eintrag) => eintrag.kennung === kennung);
    return {
      name: treffer?.name ?? attributVorlage(kennung).name,
      aktiv: liste.some((eintrag) => eintrag.kennung === kennung && eintrag.typ === 'attribut' && !eintrag.archiviert),
    };
  });
  expect(probe.zeilen.map((zeile) => zeile.name)).toEqual(erwartet.map((zeile) => zeile.name));
  for (let index = 0; index < erwartet.length; index += 1) {
    const zeile = erwartet[index];
    const ist = probe.zeilen[index];
    expect(zeile && ist).toBeTruthy();
    if (!zeile || !ist) {
      continue;
    }
    expect(ist.klasse).toContain(zeile.aktiv ? 'text-haupt' : 'text-leise');
    expect(gleicheFarbe(ist.farbe, zeile.aktiv ? probe.haupt : probe.leise)).toBe(true);
    expect(kontrast(ist.farbe, ist.grund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
    if (ist.archetypKlasse.includes('font-semibold')) {
      expect(ist.archetypKlasse).toContain('text-akzent');
    }
    if (ist.beinameKlasse.includes('font-semibold')) {
      expect(ist.beinameKlasse).toContain('text-akzent');
    }
  }
  expect(probe.zeilen.some((zeile) => zeile.archetypKlasse.includes('font-semibold'))).toBe(true);
  expect(probe.zeilen.some((zeile) => zeile.beinameKlasse.includes('font-semibold'))).toBe(true);

  const erfolgeAntwort = await seite.request.get('/api/erfolge');
  expect(erfolgeAntwort.ok()).toBe(true);
  const erfolge = (await erfolgeAntwort.json()) as ErfolgAntwort;
  const apiStufen = erfolge.kategorien.flatMap((kategorie) =>
    kategorie.stufen.map((stufe) => ({ name: stufe.name, erreichtAm: stufe.erreichtAm, gruppe: kategorie.label })),
  );
  let cursor = 0;
  expect(probe.chips.length).toBeGreaterThan(0);
  for (const chip of probe.chips) {
    const fund = apiStufen.findIndex((stufe, index) => index >= cursor && stufe.name === chip.name);
    expect(fund, chip.name).toBeGreaterThanOrEqual(0);
    const stufe = apiStufen[fund];
    expect(stufe).toBeTruthy();
    if (!stufe) {
      continue;
    }
    cursor = fund + 1;
    expect(chip.gruppe).toBe(stufe.gruppe);
    expect(chip.pokal).toBe(stufe.erreichtAm !== null);
    if (chip.pokal) {
      expect(chip.klasse).toContain('text-haupt');
      expect(chip.klasse).not.toContain('text-xp');
      expect(chip.klasse).toContain('font-medium');
      expect(gleicheFarbe(chip.farbe, probe.haupt)).toBe(true);
      expect(gleicheFarbe(chip.farbe, probe.xp)).toBe(false);
    } else {
      expect(chip.klasse).toContain('text-leise');
      expect(chip.klasse).not.toContain('text-haupt');
      expect(gleicheFarbe(chip.farbe, probe.leise)).toBe(true);
    }
    expect(kontrast(chip.farbe, chip.grund)).toBeGreaterThanOrEqual(MINDEST_KONTRAST);
  }
  expect(probe.chips.some((chip) => chip.pokal)).toBe(true);
  expect(probe.chips.some((chip) => !chip.pokal)).toBe(true);
  return probe;
}

async function kastenMitteY(seite: Page, selektor: string): Promise<number[]> {
  return seite.locator(selektor).evaluateAll((knoten) =>
    knoten.map((knoten) => {
      const kasten = knoten.getBoundingClientRect();
      return kasten.y + kasten.height / 2;
    }),
  );
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => {
    void dialog.dismiss();
    throw new Error(`Unerwartetes Browser-Fenster: ${dialog.type()}`);
  });
  await anmelden(page);
});

test('Profil fasst Level, Kennzahlen, Blätter und Spektren zusammen', async ({ page }, info) => {
  await page.goto('/charakter');
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(page.locator('main [data-levelring]')).toBeVisible();
  const ringBreite = await page.locator('main [data-levelring]').evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(ringBreite).toBe(104);
  await expect(page.locator('main .kopfblock-name')).toHaveClass(/text-2xl/);

  const kennzahlen = page.locator('[data-kennzahlen]');
  await expect(kennzahlen.getByText('Einträge', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Meilensteine', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Kleine Ziele geschafft', { exact: true })).toBeVisible();
  await expect(kennzahlen.getByText('Aktive Tage', { exact: true })).toBeVisible();
  const mitten = await kastenMitteY(page, '[data-kennzahlen] p.zahl');
  expect(mitten.length).toBe(4);
  expect(Math.max(...mitten) - Math.min(...mitten)).toBeLessThan(6);

  const koennen = page.locator('[data-spektrum="attribut"]');
  const haben = page.locator('[data-spektrum="status"]');
  await expect(koennen).toBeVisible();
  await expect(haben).toBeVisible();
  const koennenKasten = await koennen.boundingBox();
  const habenKasten = await haben.boundingBox();
  expect(koennenKasten && habenKasten).toBeTruthy();
  if (koennenKasten && habenKasten) {
    expect(Math.abs(koennenKasten.y - habenKasten.y)).toBeLessThan(12);
    expect(habenKasten.x).toBeGreaterThan(koennenKasten.x + 40);
  }
  await expect(page.getByRole('button', { name: 'Attribut hinzufügen', exact: true })).toHaveCount(0);
  await expect(page.locator('main').getByRole('link', { name: 'Können', exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'profil'), fullPage: true });

  await expect(page.getByRole('button', { name: 'Erfolge', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Erfolge/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
  const klassen = page.getByRole('dialog', { name: 'Klassen und Titel' });
  await expect(klassen).toBeVisible();
  const zeichen = klassen.locator('.klassenbild');
  await expect(zeichen).not.toHaveClass(/profilbild/);
  const liste = await zeichen.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--flaeche-2)';
    document.body.append(probe);
    const flaeche = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(element).backgroundColor === flaeche;
  });
  expect(liste).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('data-schema', 'light');
  await expect
    .poll(async () => page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--flaeche').trim()))
    .toBe('#ffffff');
  await warteAufRuhe(page);
  await klassen.screenshot({ path: bild(info, 'klassen') });
  const koennenListe = await attributeListe(page);
  const hell = await pruefeD13(page, 'light', koennenListe);
  await klassen.getByRole('heading', { name: 'Titel', exact: true }).scrollIntoViewIfNeeded();
  await warteAufRuhe(page);
  await klassen.screenshot({ path: bild(info, 'klassen-titel') });
  await page.keyboard.press('Escape');
  await expect(klassen).toHaveCount(0);

  const stand = await farbstand(page);
  const schwach = schwaechstesNebenDerSpitze(koennenListe);
  expect(schwach).toBeTruthy();
  if (schwach === null) {
    throw new Error('kein schwaches Können');
  }
  let farbenGeaendert = false;
  const archiv = await page.request.patch(`/api/attribute/${schwach.id}`, { data: { archiviert: true } });
  expect(archiv.ok()).toBe(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
    const ohne = page.getByRole('dialog', { name: 'Klassen und Titel' });
    await expect(ohne).toBeVisible();
    const inaktiv = await pruefeD13(page, 'light', await attributeListe(page));
    expect(inaktiv.klasseText).toBe(hell.klasseText);
    const zeile = inaktiv.zeilen.find((eintrag) => eintrag.name === schwach.name);
    expect(zeile?.klasse).toContain('text-leise');
    await warteAufRuhe(page);
    await ohne.screenshot({ path: bild(info, 'klassen-inaktiv') });
    await page.keyboard.press('Escape');

    const dunkel = await page.request.patch('/api/einstellungen', {
      data: { stil: 'standard', primaer: '#f2f2f2', akzent: '#8a8a8a', hintergrund: '#141414', glimmen: stand.glimmen },
    });
    expect(dunkel.ok()).toBe(true);
    farbenGeaendert = true;
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-schema', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'standard');
    await expect
      .poll(async () => page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--flaeche').trim()))
      .toBe('#202020');
    await page.getByRole('button', { name: 'Klassen und Titel', exact: true }).click();
    const dunkelDialog = page.getByRole('dialog', { name: 'Klassen und Titel' });
    await expect(dunkelDialog).toBeVisible();
    await pruefeD13(page, 'dark', await attributeListe(page));
    await warteAufRuhe(page);
    await dunkelDialog.screenshot({ path: bild(info, 'klassen-dunkel') });
    await dunkelDialog.getByRole('heading', { name: 'Titel', exact: true }).scrollIntoViewIfNeeded();
    await warteAufRuhe(page);
    await dunkelDialog.screenshot({ path: bild(info, 'klassen-dunkel-titel') });
    await page.keyboard.press('Escape');
  } finally {
    const zurueck = await page.request.patch(`/api/attribute/${schwach.id}`, { data: { archiviert: false } });
    expect(zurueck.ok()).toBe(true);
    if (farbenGeaendert) {
      await stelleFarbenHer(page, stand);
    }
  }

  const aus = await page.request.patch('/api/einstellungen', { data: { funktionen: { koennen: false } } });
  expect(aus.ok()).toBe(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Erfolge', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Klassen und Titel', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Titel', exact: true }).click();
    const titelBlatt = page.getByRole('dialog', { name: 'Titel', exact: true });
    await expect(titelBlatt).toBeVisible();
    await expect(titelBlatt.getByRole('heading', { name: 'Klassen', exact: true })).toHaveCount(0);
    await expect(titelBlatt.locator('table')).toHaveCount(0);
    await expect(titelBlatt.getByRole('banner').getByRole('heading', { name: 'Titel', exact: true })).toBeVisible();
    await expect(titelBlatt.locator('section').getByRole('heading', { name: 'Titel', exact: true })).toBeVisible();
    await expect(titelBlatt.getByText('Charakter-Level', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(titelBlatt).toHaveCount(0);
  } finally {
    const an = await page.request.patch('/api/einstellungen', { data: { funktionen: { koennen: true } } });
    expect(an.ok()).toBe(true);
  }

  await page.getByRole('link', { name: 'Profil bearbeiten', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/profil$/);
  await expect(page.locator('main').getByRole('link', { name: 'Profilname', exact: true })).toBeVisible();
  const zurueck = page.locator('a[data-zurueck]');
  await expect(zurueck).toHaveAttribute('aria-label', 'Zurück zu Profil');
  await zurueck.click();
  await expect(page).toHaveURL(/\/charakter$/);
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
});

test('An einer Fähigkeit liegt das Menü im Kopf', async ({ page }, info) => {
  const faehigkeit = await page.evaluate(async () => {
    const antwort = await fetch('/api/faehigkeiten');
    if (!antwort.ok) {
      throw new Error('Fähigkeiten nicht geladen');
    }
    const liste = (await antwort.json()) as { id: number; name: string; archiviert: boolean; knoten: unknown[] }[];
    return liste.find((eintrag) => eintrag.name === 'Programmieren' && !eintrag.archiviert) ?? liste.find((eintrag) => !eintrag.archiviert) ?? null;
  });
  expect(faehigkeit).toBeTruthy();
  if (!faehigkeit) {
    return;
  }

  await page.goto(`/faehigkeiten/${faehigkeit.id}`);
  await expect(page.getByRole('heading', { name: faehigkeit.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fähigkeit bearbeiten', exact: true })).toHaveCount(0);
  await expect(page.locator('.baum-karte')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'faehigkeit'), fullPage: true });

  await page.getByRole('button', { name: `Aktionen für ${faehigkeit.name}`, exact: true }).click();
  const menue = page.getByRole('menu');
  await expect(menue.getByRole('menuitem', { name: 'Bearbeiten', exact: true })).toBeVisible();
  expect(await menue.getByRole('menuitem').count()).toBeGreaterThan(1);
  await page.screenshot({ path: bild(info, 'faehigkeit-menue'), fullPage: true });
  await menue.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Fähigkeit', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Vorbilder sind eine Liste mit seitlichen Richtungen', async ({ page }, info) => {
  await page.goto('/vorbilder');
  await expect(page.getByRole('heading', { name: 'Vorbilder', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ähnlich', exact: true })).toBeVisible();
  const hinweis = page.getByRole('button', { name: /^Info zu / });
  await hinweis.click();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft. Ein ~ oder ein hohler Punkt im Radar heißt: Dazu gibt es kaum verlässliche Infos.',
  );
  await page.keyboard.press('Escape');

  const alle = page.getByRole('button', { name: /^Alle/ });
  await expect(alle).toHaveAttribute('aria-pressed', 'true');
  await expect(alle.locator('svg')).toHaveCount(1);
  await page.getByRole('button', { name: /^Wettkampf/ }).click();
  await expect(page).toHaveURL(/richtung=Wettkampf/);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'vorbilder'), fullPage: true });

  await page.getByRole('link', { name: /^Muhammad Ali etwa .+ geschätzt$/ }).click();
  await expect(page).toHaveURL(/\/vorbilder\/ali$/);
  await expect(page.getByRole('heading', { name: 'Muhammad Ali', exact: true })).toBeVisible();
  const kopf = page.locator('.vorbild-kopf');
  await expect(kopf).toBeVisible();
  await expect(kopf.locator('[data-vorbild-herkunft]')).toBeVisible();
  await expect(kopf.locator('[data-vorbild-stand]')).toContainText('Lvl');
  await expect(kopf.getByText('Muhammad Ali', { exact: true })).toHaveCount(0);
  await expect(page.locator('.profil-name')).toHaveCount(0);
  await expect(page.locator('main .karte')).toHaveCount(0);
  const vergleich = page.getByRole('heading', { name: 'Profil im Vergleich', exact: true });
  await expect(vergleich).toBeVisible();
  await page.getByRole('button', { name: /^Info zu / }).click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: bild(info, 'vorbild'), fullPage: true });
});
