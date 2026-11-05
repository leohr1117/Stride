import fs from 'node:fs';
import path from 'node:path';
import type { Konto } from '../../../shared/api/index.ts';
import { KONFIG } from '../../config.ts';
import { mitWelt, schliesseWelt } from '../../db.ts';
import { nichtGefunden, ungueltig } from '../../fehler.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { istAdminName, legeBenutzerAn, listeKonten, loescheBenutzer, loeseWeltdatei, setzeWeltdatei } from './zugang.ts';

const NEBEN_DATEIEN = ['', '-wal', '-shm', '-journal'];

export function hauptweltdatei(): string {
  return path.basename(KONFIG.datenbankPfad);
}

function zeigeKonto(konto: { id: number; benutzername: string; rolle: Konto['rolle'] }): Konto {
  return {
    id: konto.id,
    benutzername: konto.benutzername,
    rolle: konto.rolle,
    admin: istAdminName(konto.benutzername),
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
