import { expect, test } from '@playwright/test';
import { anmelden, ohneSeitlichenUeberlauf } from './helfer.ts';

test('Dialoge stehen in fester Reihenfolge', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const bild = (name: string) => page.screenshot({ path: `tmp-test/dialoge/${testInfo.project.name}-${name}.png` });
  await anmelden(page);

  await page.getByRole('button', { name: 'Eintrag loggen' }).click();
  const neu = page.getByRole('dialog', { name: 'Was hast du getan?' });
  await expect(neu.getByText('Wofür?', { exact: true })).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('eintrag-neu');
  await neu.getByRole('button', { name: 'Schließen' }).click();

  await page.goto('/chronik');
  await page.locator('section').filter({ hasText: 'XP' }).getByRole('button').first().click();
  const detail = page.getByRole('dialog', { name: 'Eintrag', exact: true });
  await expect(detail.getByText('Tätigkeit', { exact: true })).toBeVisible();
  await expect(detail.getByText('Datum', { exact: true })).toBeVisible();
  await expect(detail.getByText(/\+[\d.]+ XP/)).toBeVisible();
  await detail.getByRole('button', { name: /Aktionen für/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await ohneSeitlichenUeberlauf(page);
  await bild('eintrag');
  await detail.getByRole('button', { name: 'Schließen' }).click();

  await page.goto('/ziele');
  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Vision', exact: true }).click();
  const vision = page.getByRole('dialog', { name: 'Vision', exact: true });
  await expect(vision.getByText(/XP beim Erreichen:/)).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('vision');
  await vision.getByRole('button', { name: 'Schließen' }).click();

  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Organisation', exact: true }).click();
  const organisation = page.getByRole('dialog', { name: 'Organisation', exact: true });
  await expect(organisation.getByRole('combobox', { name: 'Vision' })).toBeVisible();
  await organisation.getByRole('button', { name: 'Schließen' }).click();

  await page.getByRole('button', { name: 'Fit und belastbar', exact: true }).click();
  const visionDetail = page.getByRole('dialog', { name: 'Fit und belastbar' });
  await expect(visionDetail.getByText('Plan', { exact: true })).toBeVisible();
  await expect(visionDetail.getByText(/Beute/)).toBeVisible();
  await ohneSeitlichenUeberlauf(page);
  await bild('vision-detail');
  await visionDetail.getByRole('button', { name: 'Schließen' }).click();

  const projekt = await page.evaluate(async () => {
    const antwort = await fetch('/api/ziele');
    const daten = (await antwort.json()) as { projekte: { id: number; name: string; aktiv: boolean }[] };
    return daten.projekte.find((eintrag) => eintrag.aktiv && eintrag.name === 'App bauen') ?? null;
  });
  expect(projekt).toBeTruthy();
  if (!projekt) {
    return;
  }

  await page.goto(`/projekte/${projekt.id}`);
  await page.getByRole('button', { name: `Aktionen für ${projekt.name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Bearbeiten', exact: true }).click();
  const projektDialog = page.getByRole('dialog', { name: 'Projekt', exact: true });
  await expect(projektDialog.getByText('Vorauswahl beim Eintragen')).toBeVisible();
  await expect(projektDialog.getByText('Tätigkeit beim Abschluss')).toBeVisible();
  await expect(projektDialog.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('projekt');
  await projektDialog.getByRole('button', { name: 'Schließen' }).click();

  await page.getByRole('button', { name: '+ Tätigkeit nur für dieses Projekt', exact: true }).click();
  const taetigkeit = page.getByRole('dialog', { name: 'Tätigkeit anlegen' });
  await expect(taetigkeit.getByText('Gilt für', { exact: true })).toBeVisible();
  await expect(taetigkeit.getByText('Stärkt', { exact: true })).toBeVisible();
  await taetigkeit.getByRole('button', { name: 'Alle Projekte', exact: true }).click();
  await ohneSeitlichenUeberlauf(page);
  await bild('taetigkeit');
  await taetigkeit.getByRole('button', { name: 'Schließen' }).click();
  const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
  await expect(frage).toBeVisible();
  await frage.getByRole('button', { name: 'Verwerfen', exact: true }).click();

  await page.goto('/mehr/inhalte');
  await page.getByRole('button', { name: 'Aktionen', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reihenfolge', exact: true }).click();
  const reihe = page.getByRole('dialog', { name: 'Reihenfolge' });
  await expect(reihe.getByText('Oben steht zuerst, auch beim Eintragen.')).toBeVisible();
  await expect(reihe.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('reihenfolge');
  await reihe.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(reihe).toBeHidden();

  const boss = await page.evaluate(async () => {
    const antwort = await fetch('/api/laufend');
    const daten = (await antwort.json()) as { bosse: { projektId: number | null; titel: string }[] };
    return daten.bosse.find((eintrag) => eintrag.projektId !== null) ?? null;
  });
  expect(boss?.projektId).toBeTruthy();
  if (boss?.projektId) {
    await page.goto(`/projekte/${boss.projektId}`);
    await page.getByRole('button', { name: `Aktionen für ${boss.titel}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Boss bearbeiten', exact: true }).click();
    const bossDialog = page.getByRole('dialog', { name: 'Boss', exact: true });
    await expect(bossDialog.getByText('Deadline')).toBeVisible();
    await ohneSeitlichenUeberlauf(page);
    await bild('boss');
    await bossDialog.getByRole('button', { name: 'Schließen' }).click();
  }

  await page.goto(`/projekte/${projekt.id}`);
  await page.getByRole('button', { name: 'Investition', exact: true }).click();
  const investition = page.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(investition.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('projekt-investition');
  await investition.getByRole('button', { name: 'Schließen' }).click();

  await page.goto('/investitionen');
  await page.getByRole('button', { name: /Investition anlegen/ }).first().click();
  const anlegen = page.getByRole('dialog', { name: 'Investition', exact: true });
  await expect(anlegen.getByRole('textbox', { name: 'Name' })).toBeVisible();
  await expect(anlegen.getByText('Symbol')).toBeVisible();
  await expect(anlegen.getByRole('button', { name: 'Speichern' })).toBeVisible();
  await expect(anlegen.getByRole('button', { name: /^Info/ })).toHaveCount(0);
  await ohneSeitlichenUeberlauf(page);
  await bild('investition');
  await anlegen.getByRole('button', { name: 'Schließen' }).click();

  await page.goto('/charakter');
  await expect(page.getByRole('button', { name: 'Erfolge', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Profil bearbeiten', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/profil$/);
  await page.getByRole('link', { name: 'Titel', exact: true }).click();
  await expect(page).toHaveURL(/\/mehr\/profil\/titel$/);
});
