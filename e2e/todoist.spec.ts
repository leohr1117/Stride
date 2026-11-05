import { expect, test, type Page } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

const TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';

async function trennenFallsVerbunden(seite: Page): Promise<void> {
  await seite.getByRole('heading', { name: 'Todoist' }).waitFor();
  const trennen = seite.getByRole('button', { name: 'Aktionen für Todoist' });
  if ((await trennen.count()) === 0) {
    return;
  }
  await trennen.click();
  await seite.getByRole('menuitem', { name: 'Trennen' }).click();
  await seite.getByRole('button', { name: 'Trennen' }).click();
  await seite.getByRole('textbox', { name: 'API-Token' }).waitFor();
}

function zeile(seite: Page, anfang: RegExp) {
  return seite.locator('.zeile').filter({ has: seite.getByRole('button', { name: anfang }) });
}

async function waehleZaehltAls(seite: Page, dialogName: string, index: number): Promise<string> {
  const blatt = seite.getByRole('dialog', { name: dialogName });
  await blatt.getByRole('combobox', { name: 'Zählt als' }).click();
  const wahl = seite.getByRole('dialog', { name: 'Zählt als' });
  const option = wahl.getByRole('option').nth(index);
  const name = ((await option.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  await option.click();
  await expect(wahl).toBeHidden();
  return name;
}

async function ueberschrift(seite: Page, abschnitt: string, titel: string, hinweis: string): Promise<void> {
  const probleme = await seite.locator(`#${abschnitt} .abschnitt-kopf`).evaluate(
    (kopf, erwartung) => {
      const fund: string[] = [];
      const probe = document.createElement('span');
      probe.style.color = 'var(--leise)';
      document.body.append(probe);
      const leise = getComputedStyle(probe).color;
      probe.remove();
      const h2 = kopf.querySelector('h2');
      const p = [...kopf.children].find((kind) => kind.tagName === 'P');
      if (!h2 || h2.textContent?.trim() !== erwartung.titel) {
        fund.push('titel');
      }
      if (h2) {
        const stil = getComputedStyle(h2);
        if (stil.fontSize !== '13px') fund.push(`schrift ${stil.fontSize}`);
        if (stil.fontWeight !== '600') fund.push(`gewicht ${stil.fontWeight}`);
        if (stil.textTransform !== 'none') fund.push(`schreibung ${stil.textTransform}`);
        const sperrung = stil.letterSpacing;
        if (sperrung !== 'normal' && parseFloat(sperrung) !== 0) fund.push(`sperrung ${sperrung}`);
        if (stil.color !== leise) fund.push('farbe');
        if (document.documentElement.clientWidth < 768 && Math.abs(h2.getBoundingClientRect().x - 32) > 1) {
          fund.push(`x ${Math.round(h2.getBoundingClientRect().x)}`);
        }
      }
      if (!(p instanceof HTMLElement) || p.textContent?.trim() !== erwartung.hinweis) {
        fund.push('hinweis');
      }
      if (p instanceof HTMLElement) {
        const stil = getComputedStyle(p);
        if (stil.fontSize !== '13px') fund.push(`hinweis-schrift ${stil.fontSize}`);
        if (stil.color !== leise) fund.push('hinweis-farbe');
        if (p.closest('[data-flaeche]')) fund.push('hinweis in der flaeche');
      }
      const flaeche = kopf.closest('section')?.querySelector('[data-flaeche]');
      if (!flaeche) {
        fund.push('ohne flaeche');
      } else {
        const abstand = Math.round(flaeche.getBoundingClientRect().top - kopf.getBoundingClientRect().bottom);
        if (abstand !== 8) fund.push(`abstand ${abstand}`);
      }
      return fund;
    },
    { titel, hinweis },
  );
  expect(probleme).toEqual([]);
}

async function fertig(seite: Page, dialogName: string): Promise<void> {
  const blatt = seite.getByRole('dialog', { name: dialogName });
  await blatt.getByRole('button', { name: 'Fertig' }).click();
  await expect(blatt).toBeHidden();
}

test('Todoist-Zuordnung bleibt auf Handy und Desktop lesbar', async ({ page }, info) => {
  await anmelden(page);
  await page.goto('/mehr/inhalte/verbindungen');
  await trennenFallsVerbunden(page);

  await expect(page.getByText('Öffne die Entwicklerseite in Todoist.')).toBeVisible();
  await expect(page.getByText('Kopiere den API-Token.')).toBeVisible();
  await expect(page.getByText('Füge ihn hier ein und tippe auf Verbinden.')).toBeVisible();
  await ueberschrift(page, 'todoist', 'Todoist', 'Jede erledigte Aufgabe wird ein Eintrag mit XP.');
  await ueberschrift(page, 'kalender', 'Kalender', 'Jeder vergangene Termin wird ein Eintrag mit XP.');
  const link = page.getByRole('link', { name: 'Token in Todoist öffnen' });
  await expect(link).toHaveAttribute('href', TOKEN_SEITE);
  const linkKasten = await link.boundingBox();
  expect(linkKasten).toBeTruthy();
  if (linkKasten) {
    expect(linkKasten.height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: `tmp-test/todoist/todoist-token-${info.project.name}.png`, fullPage: true });

  const token = page.getByRole('textbox', { name: 'API-Token' });
  const verbinden = page.getByRole('button', { name: 'Verbinden', exact: true });
  await expect(verbinden).toBeEnabled();
  await expect(verbinden).toHaveCSS('opacity', '1');
  await verbinden.click();
  await expect(token).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('darf nicht leer sein');
  await expect(token).toBeFocused();
  const knopfKasten = await verbinden.boundingBox();
  const feldKasten = await token.boundingBox();
  expect(knopfKasten && feldKasten).toBeTruthy();
  if (knopfKasten && feldKasten) {
    expect(Math.abs(knopfKasten.height - 48)).toBeLessThanOrEqual(1);
    expect(Math.abs(knopfKasten.x - feldKasten.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(knopfKasten.width - feldKasten.width)).toBeLessThanOrEqual(2);
    expect(knopfKasten.width).toBeGreaterThan(200);
  }
  const aktionGleich = await verbinden.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--aktion)';
    document.body.append(probe);
    const soll = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(element).backgroundColor === soll;
  });
  expect(aktionGleich).toBe(true);

  const vorschauAufrufe: string[] = [];
  page.on('request', (anfrage) => {
    if (anfrage.url().includes('/todoist/vorschau')) {
      vorschauAufrufe.push(anfrage.url());
    }
  });

  await page.getByRole('textbox', { name: 'API-Token' }).fill('e2e-todoist-token');
  await page.getByRole('button', { name: 'Verbinden', exact: true }).click();

  const todoist = page.locator('#todoist');
  await expect(page.getByText('Verbunden als Todoist Test')).toBeVisible();
  await expect(page.getByText('Noch nicht abgeglichen')).toBeVisible();
  await expect(page.getByText('Jede erledigte Aufgabe wird ein Eintrag mit XP.')).toBeVisible();
  await expect(todoist.getByText('Erledigt in', { exact: true })).toBeVisible();
  await expect(todoist.getByText('zählt als', { exact: true })).toBeVisible();
  await expect(todoist.getByRole('switch')).toHaveCount(2);
  await expect(todoist.getByRole('switch', { name: 'Posteingang zählt mit' })).not.toBeChecked();
  await expect(page.getByText('Aufgaben ohne Zuordnung')).toHaveCount(0);
  await expect(page.getByText('Ordne das Todoist-Projekt')).toHaveCount(0);
  await expect(page.getByText(/XP für die letzten/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jetzt abgleichen' })).toHaveCount(1);

  const post = zeile(page, /^Erledigt in Posteingang/);
  await expect(post).toContainText('Zählt nicht');
  await expect(post.locator('.text-haupt')).toHaveCount(0);

  await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  await expect(page.getByText('Keine neuen Einträge.')).toBeVisible();
  expect(vorschauAufrufe).toEqual([]);

  await page.getByRole('button', { name: /^Erledigt in Standard/ }).click();
  const standardBlatt = page.getByRole('dialog', { name: 'Standard' });
  await expect(standardBlatt.getByText('Gehört zu')).toHaveCount(0);
  await expect(standardBlatt.getByRole('button', { name: 'Weiteres' })).toHaveCount(0);
  const standardName = await waehleZaehltAls(page, 'Standard', 1);
  expect(standardName.length).toBeGreaterThan(0);
  await fertig(page, 'Standard');

  const standardZeile = zeile(page, /^Erledigt in Standard/);
  await expect(standardZeile.locator('.text-haupt')).toContainText(standardName);
  await expect(post).toContainText('Zählt nicht');
  await expect(post.locator('.text-haupt')).toHaveCount(0);
  await post.getByRole('switch', { name: 'Posteingang zählt mit' }).click();
  await expect(post).toContainText(standardName);
  await expect(post.locator('.text-haupt')).toHaveCount(0);

  await page.getByRole('button', { name: /^Erledigt in Posteingang/ }).click();
  await page.getByRole('dialog', { name: 'Posteingang' }).getByRole('combobox', { name: 'Zählt als' }).click();
  const wahl = page.getByRole('dialog', { name: 'Zählt als' });
  const optionen = wahl.getByRole('option');
  const anzahl = await optionen.count();
  let eigene = '';
  let index = -1;
  for (let i = 1; i < anzahl; i += 1) {
    const text = ((await optionen.nth(i).textContent()) ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text !== standardName && !text.startsWith('Standard')) {
      eigene = text;
      index = i;
      break;
    }
  }
  expect(index).toBeGreaterThan(0);
  await optionen.nth(index).click();
  await fertig(page, 'Posteingang');
  await expect(post.locator('.text-haupt')).toContainText(eigene);

  await page.getByRole('button', { name: /^Erledigt in Posteingang/ }).click();
  const geerbt = await waehleZaehltAls(page, 'Posteingang', 0);
  await fertig(page, 'Posteingang');
  await expect(post.locator('.text-haupt')).toHaveCount(0);
  await expect(post).toContainText(geerbt.includes('Standard') ? standardName : 'Zählt nicht');

  await expect(page.getByRole('button', { name: /^Mit Label Lesen/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Mit Label Lesen/ })).toBeVisible();
  await page.locator('#todoist-labels').getByRole('button', { name: /^Info/ }).click();
  await expect(page.getByRole('tooltip')).toContainText('oberste');
  await page.keyboard.press('Escape');

  const labels = page.locator('#todoist-labels');
  for (const name of ['Lesen', 'Sport']) {
    await labels.getByRole('switch', { name: `${name} zählt mit` }).click();
    await page.getByRole('button', { name: new RegExp(`^Mit Label ${name}`) }).click();
    await waehleZaehltAls(page, name, 1);
    await fertig(page, name);
  }
  await page.getByRole('button', { name: 'Reihenfolge' }).click();
  const reihe = page.getByRole('dialog', { name: 'Reihenfolge' });
  await reihe.getByRole('button', { name: 'Sport nach oben' }).click();
  await reihe.getByRole('button', { name: 'Fertig' }).click();
  await expect(reihe).toBeHidden();

  await page.getByRole('button', { name: /^Mit Label Lesen/ }).click();
  const lesen = page.getByRole('dialog', { name: 'Lesen' });
  await lesen.getByRole('button', { name: 'Weiteres' }).click();
  await lesen.getByRole('button', { name: /^Info/ }).click();
  await expect(page.getByRole('tooltip')).toContainText('Gegner');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `tmp-test/todoist/todoist-blatt-${info.project.name}.png` });
  await ohneSeitlichenUeberlauf(page);
  await fertig(page, 'Lesen');

  expect(vorschauAufrufe).toEqual([]);
  await ohneSeitlichenUeberlauf(page);
  await page.screenshot({ path: `tmp-test/todoist/todoist-${info.project.name}.png`, fullPage: true });
});
