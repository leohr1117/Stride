import { expect, test, type Page } from '@playwright/test';
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
  const angriff = page.locator('a.rounded-2xl, div.rounded-2xl').filter({ hasText: erwachtTitel });
  await expect(angriff).toContainText(/Erwacht · seit \d+\. [A-Za-zäöüÄÖÜ]+\./);
  await expect(angriff).toContainText('Disziplin');
  await expect(angriff).not.toHaveClass(/gefahr/);
  await expect(angriff.locator('.text-gefahr')).toHaveCount(1);
  await expect(angriff.locator('.text-gefahr')).toContainText('Disziplin');
  const striche = await angriff.locator('svg circle').evaluateAll((kreise) => kreise.map((kreis) => kreis.getAttribute('stroke')));
  expect(striche.length).toBeGreaterThan(0);
  for (const strich of striche) {
    expect(strich).toBe('var(--haupt)');
  }
  const datumSichtbar = await angriff.locator('p', { hasText: 'Erwacht' }).evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(datumSichtbar).toBe(true);
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
