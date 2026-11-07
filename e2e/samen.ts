import path from 'node:path';
import { mitWelt, schliesseWelt } from '../server/db.ts';
import { erstelleMitglied } from '../server/features/zugang/konten.ts';
import { listeKonten, loeseWeltdatei, schliesseZugang } from '../server/features/zugang/zugang.ts';
import { TEST_PASSWORT } from './testdaten.ts';
import { fuelleTeil } from './samen/teil.ts';
import { fuelleVoll } from './samen/voll.ts';

function weltVon(benutzername: string): string {
  const konto = listeKonten().find((eintrag) => eintrag.benutzername === benutzername);
  if (!konto) {
    throw new Error(`Das Konto ${benutzername} fehlt.`);
  }
  const ordner = path.basename(path.dirname(konto.weltdatei));
  if (ordner !== 'welten') {
    throw new Error(`Das Konto ${benutzername} liegt in ${konto.weltdatei}.`);
  }
  return loeseWeltdatei(konto.weltdatei);
}

function legeAn(benutzername: string, profilname: string, dateiname: string): string {
  erstelleMitglied({ benutzername, passwort: TEST_PASSWORT, profilname });
  const konto = listeKonten().find((eintrag) => eintrag.benutzername === benutzername);
  if (!konto || path.basename(konto.weltdatei) !== dateiname) {
    throw new Error(`Das Konto ${benutzername} liegt in ${konto?.weltdatei ?? 'nirgends'}, erwartet ist welten/${dateiname}.`);
  }
  return weltVon(benutzername);
}

function main(): void {
  const vollWelt = legeAn('testvoll', 'Test Voll', '1.db');
  const teilWelt = legeAn('testteil', 'Test Teil', '2.db');
  try {
    mitWelt(vollWelt, fuelleVoll);
    mitWelt(teilWelt, fuelleTeil);
  } finally {
    schliesseWelt(vollWelt);
    schliesseWelt(teilWelt);
    schliesseZugang();
  }
}

main();
