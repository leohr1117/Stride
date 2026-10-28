import { FARBEN, GRENZEN } from '../../shared/spiel/begriffe.ts';
import type { Zielstrebigkeit } from '../../shared/spiel/profil.ts';
import { VISION } from '../../shared/spiel/xp.ts';
import { erstelleFaehigkeit } from '../features/faehigkeiten/faehigkeiten.ts';
import { eine } from '../db.ts';
import { ungueltig } from '../fehler.ts';
import { erstelleProjekt, erstelleVision } from './struktur.ts';

export type StartZielArt = 'vision' | 'projekt' | 'faehigkeit';

export function zielArtPasst(stufe: Zielstrebigkeit, art: StartZielArt): boolean {
  if (art === 'vision') {
    return stufe === 'traeumer';
  }
  if (art === 'projekt') {
    return stufe === 'macher' || stufe === 'bodenstaendig';
  }
  return stufe === 'uebung';
}

/** Ein selbst benanntes Ziel, in derselben Transaktion wie die erste Profilanlage. */
export function wendeStartZielAn(angaben: {
  startZiel?: { art: StartZielArt; name: string };
  stufe: Zielstrebigkeit | null;
  ersteAnlage: boolean;
}): void {
  if (!angaben.startZiel || !angaben.ersteAnlage) {
    return;
  }
  const name = angaben.startZiel.name.trim();
  if (name.length < 1) {
    throw ungueltig('Der Name darf nicht leer sein.');
  }
  if (name.length > GRENZEN.nameMax) {
    throw ungueltig('Der Name darf höchstens 80 Zeichen haben.');
  }
  if (!angaben.stufe || !zielArtPasst(angaben.stufe, angaben.startZiel.art)) {
    throw ungueltig('Das erste Ziel passt nicht zur Auswahl.');
  }
  if (angaben.startZiel.art === 'vision') {
    erstelleVision({
      titel: name,
      beschreibung: '',
      farbe: FARBEN[6],
      woopErgebnis: '',
      woopHindernis: '',
      woopPlan: '',
      level: VISION.standardLevel,
    });
    return;
  }
  if (angaben.startZiel.art === 'faehigkeit') {
    erstelleFaehigkeit({ name, beschreibung: '', farbe: FARBEN[1], icon: 'code' });
    return;
  }
  const vorlage = eine<{ id: number }>('SELECT id FROM vorlagen WHERE archiviert = 0 ORDER BY sortierung, id LIMIT 1');
  if (!vorlage) {
    throw ungueltig('Für ein Projekt braucht es eine Tätigkeit.');
  }
  erstelleProjekt({
    name,
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlage.id,
  });
}
