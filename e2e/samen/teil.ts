import { erstelleEintrag } from '../../server/features/eintraege/eintraege.ts';
import { schalteErfolgeFrei } from '../../server/features/erfolge/erfolge.ts';
import { erstelleFaehigkeit, schalteSkillFrei } from '../../server/features/faehigkeiten/faehigkeiten.ts';
import { aendereEinstellungen } from '../../server/features/einstellungen/einstellungen.ts';
import { erstelleVorhaben } from '../../server/features/ziele/vorhaben.ts';
import { erstelleProjekt } from '../../server/services/struktur.ts';
import {
  baum,
  datumVor,
  JETZT,
  legeProfilAn,
  setzeZufall,
  TAGE_TEIL,
  vorlageId,
  waehle,
  zaehle,
  zeitpunktVor,
  ZUFALL_TEIL,
  zufall,
} from './hilfe.ts';

export function fuelleTeil(): void {
  setzeZufall(ZUFALL_TEIL);
  legeProfilAn({
    profilname: 'Test Teil',
    geburtsjahr: 1998,
    zielstrebigkeit: 'bodenstaendig',
    fokus: ['lernen'],
  });
  aendereEinstellungen({
    funktionen: { faehigkeiten: true, statistiken: true },
    mobilLeiste: ['/', '/statistiken', '/ziele', '/mehr'],
  });

  const lesen = erstelleFaehigkeit({ name: 'Lesen', beschreibung: '', farbe: '#60a5fa', icon: 'book-open' });
  const leseSkills = baum(lesen.id, [
    ['Täglich eine Sitzung', null],
    ['Kurz notieren', 'Täglich eine Sitzung'],
    ['Kapitel zusammenfassen', 'Kurz notieren'],
  ]);

  const offene: number[] = [];
  const V: Record<string, number> = {};
  const lesenProjekt = erstelleProjekt({
    name: 'Lesen',
    beschreibung: '',
    visionId: null,
    organisationId: null,
    standardVorlageId: vorlageId('Lesen'),
  });

  function legeVorhabenAn(titel: string, tage: number): number {
    const id = erstelleVorhaben(lesenProjekt.id, titel, zeitpunktVor(tage, 9)).id;
    offene.push(id);
    return id;
  }

  function nimmRaus(id: number): void {
    const index = offene.indexOf(id);
    if (index >= 0) {
      offene.splice(index, 1);
    }
  }

  function trageEin(
    tage: number,
    vorlage: string,
    stunden: number | null,
    notiz: string,
    extra: { vorhabenId?: number; abschluss?: 'geschafft'; meilenstein?: boolean } = {},
  ): void {
    const vorhabenId = extra.vorhabenId ?? (offene.length > 0 && zufall() < 0.7 ? waehle(offene) : undefined);
    erstelleEintrag(
      {
        projektId: null,
        vorlageId: vorlageId(vorlage),
        vorhaben: vorhabenId === undefined ? null : { art: 'bestehend', id: vorhabenId },
        abschluss: extra.abschluss ?? null,
        erkenntnis: '',
        stunden,
        notiz,
        meilenstein: extra.meilenstein ?? false,
        faehigkeitId: lesen.id,
        datum: datumVor(tage),
      },
      JETZT,
    );
    if (extra.abschluss !== undefined && vorhabenId !== undefined) {
      nimmRaus(vorhabenId);
    }
  }

  V.woche = legeVorhabenAn('Erste Woche durchgehalten', 13);
  V.texte = legeVorhabenAn('Zehn Texte gelesen', 13);
  V.vokabeln = legeVorhabenAn('Fünfzig Vokabeln', 8);
  schalteSkillFrei(leseSkills.get('Täglich eine Sitzung') ?? 0, zeitpunktVor(10, 20));

  const notizen = ['Kapitel 1', 'Zwei Seiten Notizen', 'Text über Gewohnheiten', 'Vokabeln wiederholt', 'Beispiel abgeschrieben', ''];
  const pausen = new Set([11, 6, 3]);

  for (let tage = TAGE_TEIL; tage >= 0; tage--) {
    if (tage === 7) {
      trageEin(7, 'Lernen', 1, 'Sieben Tage in Folge gelesen', {
        vorhabenId: V.woche,
        abschluss: 'geschafft',
        meilenstein: true,
      });
    }
    if (tage === 4) {
      schalteSkillFrei(leseSkills.get('Kurz notieren') ?? 0, zeitpunktVor(4, 20));
    }
    if (pausen.has(tage)) {
      continue;
    }
    if (zufall() < 0.75 || tage === 0) {
      trageEin(tage, waehle(['Lernen', 'Lesen']), waehle([null, 0.5, 1]), waehle(notizen));
    }
  }

  schalteErfolgeFrei();

  const eintraege = zaehle('eintraege');
  if (eintraege < 8) {
    throw new Error(`Test Teil hat nur ${eintraege} Einträge.`);
  }
  if (zaehle('vorhaben') < 3) {
    throw new Error('Test Teil hat zu wenig Vorhaben.');
  }
  if (zaehle('visionen') !== 0 || zaehle('projekte') !== 1) {
    throw new Error('Test Teil braucht genau ein Projekt und keine Vision.');
  }
  if (zaehle('faehigkeiten') < 1) {
    throw new Error('Test Teil braucht eine Fähigkeit.');
  }
}
