import { setzeZufall, zaehle, ZUFALL_VOLL } from './hilfe.ts';
import { baueVoll } from './vollAufbau.ts';
import { spieleVoll } from './vollLauf.ts';

export function fuelleVoll(): void {
  setzeZufall(ZUFALL_VOLL);
  const stand = baueVoll();
  spieleVoll(stand);
  const eintraege = zaehle('eintraege');
  const meilensteine = zaehle('eintraege', 'WHERE meilenstein = 1');
  if (eintraege < 40) {
    throw new Error(`Test Voll hat nur ${eintraege} Einträge.`);
  }
  if (meilensteine < 3) {
    throw new Error(`Test Voll hat nur ${meilensteine} Meilensteine.`);
  }
  if (zaehle('visionen') < 3 || zaehle('projekte') < 6 || zaehle('vorhaben') < 8) {
    throw new Error('Test Voll hat zu wenig Ziele.');
  }
  if (zaehle('faehigkeiten') < 2 || zaehle('projekte', 'WHERE investition = 1') < 2 || zaehle('basis_aufgaben') < 4) {
    throw new Error('Test Voll hat zu wenig Charakter-Inhalte.');
  }
  if (zaehle('rueckblicke') < 4) {
    throw new Error('Test Voll hat zu wenig Rückblicke.');
  }
}
