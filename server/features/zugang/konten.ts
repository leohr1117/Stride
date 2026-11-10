import fs from 'node:fs';
import path from 'node:path';
import type { Konto } from '../../../shared/api/index.ts';
import { KONFIG } from '../../config.ts';
import { mitWelt, schliesseWelt } from '../../db.ts';
import { AppFehler, nichtGefunden, ungueltig } from '../../fehler.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { setzeProfilZurueck } from '../../services/profilZurueck.ts';
import { istAdmin, legeBenutzerAn, listeKonten, loescheBenutzer, loeseWeltdatei, setzeWeltdatei } from './zugang.ts';

const NEBEN_DATEIEN = ['', '-wal', '-shm', '-journal'];

export function hauptweltdatei(): string {
  return path.basename(KONFIG.datenbankPfad);
}

function zeigeKonto(konto: { id: number; benutzername: string; rolle: Konto['rolle'] }): Konto {
  return {
    id: konto.id,
    benutzername: konto.benutzername,
    rolle: konto.rolle,
    admin: istAdmin(konto.id),
  };
}

export function konten(): Konto[] {
  return listeKonten().map(zeigeKonto);
}

function entferneDatei(absolut: string): void {
  schliesseWelt(absolut);
  for (const endung of NEBEN_DATEIEN) {
    fs.rmSync(`${absolut}${endung}`, { force: true });
  }
}

export function erstelleMitglied(daten: { benutzername: string; passwort: string; profilname?: string }): Konto {
  const profilname = (daten.profilname ?? daten.benutzername).trim();
  const angelegt = legeBenutzerAn({
    benutzername: daten.benutzername,
    passwort: daten.passwort,
    rolle: 'mitglied',
    weltdatei: path.join('welten', 'offen.db'),
  });
  const relativ = path.join('welten', `${angelegt.id}.db`);
  const absolut = loeseWeltdatei(relativ);
  try {
    setzeWeltdatei(angelegt.id, relativ);
    mitWelt(absolut, () => {
      aendereEinstellungen({ charakterName: profilname });
    });
  } catch (fehler) {
    entferneDatei(absolut);
    loescheBenutzer(angelegt.id);
    throw fehler;
  }
  return zeigeKonto(angelegt);
}

export function entferneKonto(id: number): void {
  const konto = listeKonten().find((eintrag) => eintrag.id === id);
  if (!konto) {
    throw nichtGefunden('Der Account');
  }
  if (konto.rolle === 'inhaber') {
    throw ungueltig('Der Inhaber bleibt.');
  }
  const absolut = loeseWeltdatei(konto.weltdatei);
  if (path.resolve(absolut) === path.resolve(KONFIG.datenbankPfad)) {
    throw ungueltig('Die Hauptwelt bleibt.');
  }
  entferneDatei(absolut);
  loescheBenutzer(id);
}

let loeschabbruchEinmal = false;

/** Der nächste Aufruf leert die Welt und bricht vor dem Löschen des Kontos ab. */
export function setzeLoeschabbruchEinmal(an: boolean): void {
  loeschabbruchEinmal = an;
}

function gleicheDatei(links: string, rechts: string): boolean {
  return path.resolve(links) === path.resolve(rechts);
}

function raeumeWelt(relativ: string, einziges: boolean): void {
  const eigene = loeseWeltdatei(relativ);
  const haupt = loeseWeltdatei(hauptweltdatei());
  const istHaupt = gleicheDatei(eigene, haupt) || gleicheDatei(eigene, KONFIG.datenbankPfad);
  if (!istHaupt) {
    entferneDatei(eigene);
  }
  if (einziges) {
    mitWelt(haupt, () => {
      setzeProfilZurueck();
    });
  }
}

export function loescheEigenesKonto(id: number): void {
  const alle = listeKonten();
  const konto = alle.find((eintrag) => eintrag.id === id);
  if (!konto) {
    throw nichtGefunden('Der Account');
  }
  const inhaber = alle.filter((eintrag) => eintrag.rolle === 'inhaber').length;
  if (konto.rolle === 'inhaber' && alle.length > 1 && inhaber < 2) {
    throw new AppFehler(409, 'Du bist der einzige Inhaber. Solange es andere Accounts gibt, kannst du dein Konto nicht löschen.');
  }
  raeumeWelt(konto.weltdatei, alle.length === 1);
  if (loeschabbruchEinmal) {
    loeschabbruchEinmal = false;
    throw new Error('Löschen abgebrochen');
  }
  loescheBenutzer(id);
}
