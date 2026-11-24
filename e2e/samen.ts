import path from 'node:path';
import { RECHT_FASSUNG } from '../shared/recht/fassung.ts';
import { mitWelt, schliesseWelt } from '../server/db.ts';
import { erstelleMitglied } from '../server/features/zugang/konten.ts';
import { listeKonten, loeseWeltdatei, schliesseZugang, setzeZustimmungsFassung } from '../server/features/zugang/zugang.ts';
import { setzeTestzeit } from '../server/services/zeit.ts';
import { TESTDATUM } from './uhr.ts';
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

async function legeAn(benutzername: string, profilname: string, dateiname: string): Promise<string> {
  const angelegt = await erstelleMitglied({
    benutzername,
    passwort: TEST_PASSWORT,
    profilname,
    zustimmung: new Date(),
  });
  setzeZustimmungsFassung(angelegt.id, RECHT_FASSUNG);
  const konto = listeKonten().find((eintrag) => eintrag.benutzername === benutzername);
  if (!konto || path.basename(konto.weltdatei) !== dateiname) {
    throw new Error(`Das Konto ${benutzername} liegt in ${konto?.weltdatei ?? 'nirgends'}, erwartet ist welten/${dateiname}.`);
  }
  return weltVon(benutzername);
}

async function main(): Promise<void> {
  setzeTestzeit(TESTDATUM);
  const vollWelt = await legeAn('testvoll', 'Test Voll', '1.db');
  const teilWelt = await legeAn('testteil', 'Test Teil', '2.db');
  try {
    mitWelt(vollWelt, fuelleVoll);
    mitWelt(teilWelt, fuelleTeil);
  } finally {
    schliesseWelt(vollWelt);
    schliesseWelt(teilWelt);
    schliesseZugang();
  }
}

main().catch((fehler: unknown) => {
  console.error(fehler instanceof Error ? fehler.message : fehler);
  process.exit(1);
});
