import { chromium } from 'playwright';
import fs from 'node:fs';

const zugang = fs.readFileSync('data/testprofile-zugang.txt', 'utf8');
const passwort = zugang.match(/Test Voll[\s\S]*?Passwort:\s*(\S+)/)?.[1];
if (!passwort) {
  throw new Error('Zugang unvollständig.');
}

const browser = await chromium.launch({ headless: true });
const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
seite.setDefaultTimeout(15000);

await seite.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await seite.locator('input[name="username"]').fill('testvoll');
await seite.locator('input[name="password"]').fill(passwort);
await seite.getByRole('button', { name: 'Anmelden' }).click();
await seite.waitForURL((url) => !url.pathname.includes('anmeld'), { timeout: 10000 }).catch(() => {});
await seite.getByRole('heading', { name: 'Übersicht' }).waitFor({ timeout: 10000 }).catch(async () => {
  console.log('URL', seite.url());
  console.log((await seite.locator('body').innerText()).slice(0, 400));
});

const vorlagen = await seite.evaluate(async () => {
  const antwort = await fetch('/api/vorlagen');
  return antwort.json();
});
console.log(
  'VORLAGEN',
  vorlagen.map((eintrag) => `${eintrag.id}:${eintrag.projektId ?? 'allg'}:${eintrag.name}`).join(' | '),
);

async function chips() {
  const dialog = seite.getByRole('dialog');
  await dialog.waitFor();
  const namen = await dialog.locator('.chip-reihe button').allInnerTexts();
  console.log('CHIPS', namen.map((name) => name.replace(/\s+/g, ' ').trim()).join(' | '));
  await seite.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
console.log('OHNE PROJEKT');
await chips();

await seite.goto('http://127.0.0.1:3000/ziele', { waitUntil: 'networkidle' });
const links = await seite.locator('a[href^="/projekte/"]').evaluateAll((knoten) =>
  knoten.map((knoten) => ({ href: knoten.getAttribute('href'), text: knoten.innerText.replace(/\s+/g, ' ').trim() })),
);
console.log('PROJEKTE', JSON.stringify(links));

for (const link of links.slice(0, 4)) {
  await seite.goto(`http://127.0.0.1:3000${link.href}`, { waitUntil: 'networkidle' });
  const titel = await seite.locator('h1').innerText();
  await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
  console.log('PROJEKT', titel);
  await chips();
}

await seite.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await seite.getByRole('button', { name: 'Eintrag loggen' }).click();
const dialog = seite.getByRole('dialog');
await dialog.waitFor();
const vorhaben = dialog.locator('button').filter({ hasText: /./ });
const texte = await dialog.locator('.flex.flex-wrap button').allInnerTexts();
console.log('VORHABEN CHIPS', texte.map((name) => name.replace(/\s+/g, ' ').trim()).join(' | '));
const erster = dialog.locator('.flex.flex-wrap button').nth(1);
if (await erster.count()) {
  const name = (await erster.innerText()).replace(/\s+/g, ' ').trim();
  await erster.click();
  const nach = await dialog.locator('.chip-reihe button').allInnerTexts();
  console.log('NACH VORHABEN', name, '->', nach.map((n) => n.replace(/\s+/g, ' ').trim()).join(' | '));
}
await seite.keyboard.press('Escape');

await seite.goto('http://127.0.0.1:3000/mehr/inhalte', { waitUntil: 'networkidle' });
const inhalte = await seite.locator('body').innerText();
const testZeile = inhalte.split('\n').filter((zeile) => /Test|Tätigkeit|Aufräumen/.test(zeile)).slice(0, 30);
console.log('INHALTE', testZeile.join(' / '));

await seite.goto('http://127.0.0.1:3000/projekte/1', { waitUntil: 'networkidle' });
await seite.getByRole('button', { name: 'Projekt bearbeiten' }).click();
const standard = seite.getByRole('dialog').locator('select').last();
const optionen = await standard.locator('option').allInnerTexts();
console.log('STANDARD KRAFT', optionen.join(' | '));
await seite.keyboard.press('Escape');

await seite.goto('http://127.0.0.1:3000/projekte/2', { waitUntil: 'networkidle' });
const seitenText = await seite.locator('body').innerText();
console.log('AUSDAUER HAT TEST', seitenText.includes('Test'));
await seite.getByRole('button', { name: 'Projekt bearbeiten' }).click();
const standard2 = seite.getByRole('dialog').locator('select').last();
console.log('STANDARD AUSDAUER', (await standard2.locator('option').allInnerTexts()).join(' | '));
await seite.keyboard.press('Escape');

await seite.goto('http://127.0.0.1:3000/chronik', { waitUntil: 'networkidle' });
const chronik = await seite.locator('.chip-reihe button').allInnerTexts();
console.log('CHRONIK', chronik.map((name) => name.replace(/\s+/g, ' ').trim()).join(' | '));
const kopf = await seite.locator('h2, h1').allInnerTexts();
console.log('CHRONIK KOPF', kopf.slice(0, 12).join(' | '));

await browser.close();
