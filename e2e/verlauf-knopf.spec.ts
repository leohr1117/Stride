import fs from 'node:fs';
import { expect, test, type Page } from './uhr.ts';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const HOECHSTENS_EINTRAEGE = 31;

interface ChronikAntwort {
  naechsterCursor: string | null;
}

interface AktivesProjekt {
  id: number;
  standardVorlageId: number;
}

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

async function liesJson<T>(seite: Page, pfad: string): Promise<T> {
  const antwort = await seite.request.get(pfad);
  if (!antwort.ok()) {
    throw new Error(`${pfad} fehlgeschlagen: ${antwort.status()} ${await antwort.text()}`);
  }
  return antwort.json() as Promise<T>;
}

async function aktivesProjekt(seite: Page): Promise<AktivesProjekt> {
  const auswahl = await liesJson<{ id: number }[]>(seite, '/api/projekte/auswahl');
  const erstes = auswahl[0];
  if (!erstes) {
    throw new Error('Kein aktives Projekt');
  }
  const detail = await liesJson<{ projekt: AktivesProjekt & { aktiv: boolean } }>(
    seite,
    `/api/projekte/${erstes.id}`,
  );
  if (!detail.projekt.aktiv) {
    throw new Error('Projekt ist nicht aktiv');
  }
  return detail.projekt;
}

async function chronikSeite(seite: Page): Promise<ChronikAntwort> {
  return liesJson<ChronikAntwort>(seite, '/api/eintraege?nurMeilensteine=true');
}

async function legeVerlaufsprobeAn(seite: Page, projekt: AktivesProjekt, notiz: string): Promise<number> {
  const antwort = await seite.request.post('/api/eintraege', {
    data: {
      projektId: projekt.id,
      vorlageId: projekt.standardVorlageId,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: null,
      notiz,
      meilenstein: true,
      faehigkeitId: null,
      datum: null,
    },
  });
  if (!antwort.ok()) {
    throw new Error(`Eintrag fehlgeschlagen: ${antwort.status()} ${await antwort.text()}`);
  }
  const daten = (await antwort.json()) as { eintrag: { id: number } };
  return daten.eintrag.id;
}

async function einzelnEntfernen(seite: Page, ids: readonly number[]): Promise<void> {
  let ersterFehler: unknown = null;
  for (const id of ids) {
    try {
      const antwort = await seite.request.delete(`/api/eintraege/${id}`);
      if (!antwort.ok()) {
        throw new Error(`Eintrag ${id} ließ sich nicht entfernen: ${antwort.status()} ${await antwort.text()}`);
      }
    } catch (grund) {
      if (ersterFehler === null) {
        ersterFehler = grund;
      }
    }
  }
  if (ersterFehler !== null) {
    throw ersterFehler;
  }
}

test.beforeEach(async ({ page }) => {
  await anmelden(page);
});

test('Ältere Einträge laden ist ein Zweitknopf mit Rahmen', async ({ page }, testInfo) => {
  const ids: number[] = [];
  try {
    const projekt = await aktivesProjekt(page);
    let seite = await chronikSeite(page);
    for (let n = 1; seite.naechsterCursor === null && n <= HOECHSTENS_EINTRAEGE; n += 1) {
      const id = await legeVerlaufsprobeAn(page, projekt, `Verlaufsprobe ${testInfo.project.name} ${n}`);
      ids.push(id);
      seite = await chronikSeite(page);
    }
    expect(seite.naechsterCursor).toEqual(expect.any(String));

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
  } finally {
    await einzelnEntfernen(page, ids);
  }
});
