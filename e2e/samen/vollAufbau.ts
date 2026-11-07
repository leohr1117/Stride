import { erstelleBasisAufgabe } from '../../server/features/basis/basis.ts';
import { aendereEinstellungen } from '../../server/features/einstellungen/einstellungen.ts';
import { erstelleFaehigkeit } from '../../server/features/faehigkeiten/faehigkeiten.ts';
import { erstelleInvestition } from '../../server/features/investitionen/ausruestung.ts';
import { erstelleVorlage } from '../../server/features/taetigkeiten/vorlagen.ts';
import { erstelleOrganisation, erstelleProjekt, erstelleVision } from '../../server/services/struktur.ts';
import { alleFunktionenAn, attributId, baum, legeProfilAn, vorlageId } from './hilfe.ts';

export interface VollTaetigkeit {
  projektId: number;
  vorlage: string;
  stunden: (number | null)[];
  notizen: string[];
  faehigkeitId?: number;
  gewicht: number;
}

export interface VollStand {
  fitId: number;
  appVisionId: number;
  projekte: {
    kraft: number;
    laufen: number;
    app: number;
    lernen: number;
    haushalt: number;
    job: number;
    treff: number;
  };
  kraftId: number;
  codeId: number;
  kraftSkills: Map<string, number>;
  codeSkills: Map<string, number>;
  basisAufgaben: number[];
  basisChance: number[];
  taetigkeiten: VollTaetigkeit[];
}

export function baueVoll(): VollStand {
  legeProfilAn({
    profilname: 'Test Voll',
    geburtsjahr: 1992,
    zielstrebigkeit: 'traeumer',
    fokus: ['sport', 'gesundheit', 'lernen', 'erfolg', 'kreativitaet', 'geld'],
  });
  aendereEinstellungen({
    funktionen: alleFunktionenAn(),
    ebenen: { visionen: true, organisationen: true, projekte: true, vorhaben: true },
    mobilLeiste: ['/', '/laufend', '/chronik', '/mehr'],
  });

  erstelleVorlage({
    name: 'Aufräumen',
    icon: 'sparkles',
    gewichte: [
      { attributId: attributId('disziplin'), gewicht: 70 },
      { attributId: attributId('geist'), gewicht: 30 },
    ],
  });

  const fit = erstelleVision({
    titel: 'Fit und belastbar',
    beschreibung: 'Ein Körper, der den Alltag trägt.',
    farbe: '#34d399',
    woopErgebnis: 'Morgens ohne Widerstand loslegen',
    woopHindernis: 'Abends zu müde fürs Training',
    woopPlan: 'Wenn ich nach Hause komme, dann ziehe ich zuerst die Trainingsachen an.',
    level: 200,
  });
  const appVision = erstelleVision({
    titel: 'Eigene App veröffentlichen',
    beschreibung: 'Ein kleines Produkt, das andere wirklich nutzen.',
    farbe: '#60a5fa',
    woopErgebnis: 'Die erste Version ist draußen',
    woopHindernis: 'Abends lieber etwas Leichtes machen',
    woopPlan: 'Wenn ich auf der Couch sitze, dann öffne ich zuerst das Projekt für 25 Minuten.',
    level: 400,
  });
  const alltag = erstelleVision({
    titel: 'Ruhiger Alltag',
    beschreibung: 'Wohnung und Routine, die mich tragen.',
    farbe: '#fb923c',
    woopErgebnis: '',
    woopHindernis: '',
    woopPlan: '',
    level: null,
  });
  const arbeit = erstelleOrganisation({ name: 'Arbeit', beschreibung: '', farbe: '#60a5fa', visionId: null });
  const lauftreff = erstelleOrganisation({
    name: 'Lauftreff',
    beschreibung: '',
    farbe: '#2dd4bf',
    visionId: fit.id,
  });

  function projekt(name: string, standard: string, zuordnung: { visionId?: number; organisationId?: number }): number {
    return erstelleProjekt({
      name,
      beschreibung: '',
      visionId: zuordnung.visionId ?? null,
      organisationId: zuordnung.organisationId ?? null,
      standardVorlageId: vorlageId(standard),
    }).id;
  }

  const projekte = {
    kraft: projekt('Krafttraining', 'Training', { visionId: fit.id }),
    laufen: projekt('Ausdauer', 'Laufen', { visionId: fit.id }),
    app: projekt('App bauen', 'Erschaffen', { visionId: appVision.id }),
    lernen: projekt('Handwerk vertiefen', 'Lernen', { visionId: appVision.id }),
    haushalt: projekt('Wohnung in Ordnung', 'Aufräumen', { visionId: alltag.id }),
    job: projekt('Kundenprojekt', 'Liefern', { organisationId: arbeit.id }),
    treff: projekt('Gruppenläufe', 'Laufen', { organisationId: lauftreff.id }),
  };

  erstelleVorlage({
    name: 'App-Feinschliff',
    icon: 'code',
    projektId: projekte.app,
    gewichte: [
      { attributId: attributId('disziplin'), gewicht: 60 },
      { attributId: attributId('geist'), gewicht: 40 },
    ],
  });

  const kraft = erstelleFaehigkeit({ name: 'Kraft', beschreibung: '', farbe: '#f87171', icon: 'dumbbell' });
  const kraftSkills = baum(kraft.id, [
    ['Kniebeuge sauber', null],
    ['80 Kilo Kniebeuge', 'Kniebeuge sauber'],
    ['Kreuzheben', null],
    ['Bankdrücken', 'Kniebeuge sauber'],
    ['Hantelreihe', 'Kreuzheben'],
  ]);
  const code = erstelleFaehigkeit({ name: 'Programmieren', beschreibung: '', farbe: '#60a5fa', icon: 'code' });
  const codeSkills = baum(code.id, [
    ['TypeScript Alltag', null],
    ['React-Komponenten', 'TypeScript Alltag'],
    ['Tests schreiben', 'TypeScript Alltag'],
    ['API anbinden', 'React-Komponenten'],
    ['Release bauen', 'API anbinden'],
  ]);

  const basisAufgaben = [
    erstelleBasisAufgabe({ name: 'Zehn Kniebeugen', icon: 'dumbbell', projektId: projekte.kraft, vorlageId: null, stunden: null }).id,
    erstelleBasisAufgabe({ name: 'Seite lesen', icon: 'book-open', projektId: projekte.lernen, vorlageId: vorlageId('Lesen'), stunden: 0.5 }).id,
    erstelleBasisAufgabe({ name: 'Spüle leeren', icon: 'sparkles', projektId: projekte.haushalt, vorlageId: null, stunden: null }).id,
    erstelleBasisAufgabe({ name: 'Kurz dehnen', icon: 'heart-pulse', projektId: projekte.laufen, vorlageId: vorlageId('Dehnen'), stunden: null }).id,
  ];

  const taetigkeiten: VollTaetigkeit[] = [
    {
      projektId: projekte.kraft,
      vorlage: 'Training',
      stunden: [1, 1.5, 2],
      gewicht: 4,
      faehigkeitId: kraft.id,
      notizen: ['Kniebeuge und Zug', 'Bank und Rudern', 'Beine schwer', 'Oberkörper, saubere Form', ''],
    },
    {
      projektId: projekte.laufen,
      vorlage: 'Laufen',
      stunden: [0.5, 1],
      gewicht: 2,
      notizen: ['Runde um den Block', 'Lockerer Dauerlauf', 'Intervalle', ''],
    },
    {
      projektId: projekte.app,
      vorlage: 'Erschaffen',
      stunden: [1, 2, 4],
      gewicht: 4,
      faehigkeitId: code.id,
      notizen: ['Formular gebaut', 'Liste gefiltert', 'Fehler im Speichern gefixt', 'Layout auf dem Handy', ''],
    },
    {
      projektId: projekte.lernen,
      vorlage: 'Lernen',
      stunden: [1, 2],
      gewicht: 2,
      faehigkeitId: code.id,
      notizen: ['Kapitel zu Tests', 'Video zu TypeScript', 'Beispiel nachgebaut', ''],
    },
    {
      projektId: projekte.job,
      vorlage: 'Liefern',
      stunden: [2, 4, 8],
      gewicht: 5,
      notizen: ['Ticket abgeschlossen', 'Rückfrage beantwortet', 'Review gemacht', 'Deploy vorbereitet', ''],
    },
    {
      projektId: projekte.haushalt,
      vorlage: 'Aufräumen',
      stunden: [null, 0.5, 1],
      gewicht: 2,
      notizen: ['Küche leer', 'Wäsche weggelegt', 'Schreibtisch frei', ''],
    },
    {
      projektId: projekte.kraft,
      vorlage: 'Ausgeschlafen',
      stunden: [null],
      gewicht: 1,
      notizen: ['Vor 23 Uhr im Bett', 'Durchgeschlafen', ''],
    },
    {
      projektId: projekte.treff,
      vorlage: 'Laufen',
      stunden: [1],
      gewicht: 1,
      notizen: ['Mit der Gruppe gelaufen', ''],
    },
    {
      projektId: projekte.job,
      vorlage: 'Präsentieren',
      stunden: [1, 2],
      gewicht: 1,
      notizen: ['Stand vorgestellt', 'Demo für den Kunden', ''],
    },
    {
      projektId: projekte.app,
      vorlage: 'Brainstormen',
      stunden: [0.5, 1],
      gewicht: 1,
      faehigkeitId: code.id,
      notizen: ['Ablauf skizziert', 'Namen für die Felder', ''],
    },
  ];

  return {
    fitId: fit.id,
    appVisionId: appVision.id,
    projekte,
    kraftId: kraft.id,
    codeId: code.id,
    kraftSkills,
    codeSkills,
    basisAufgaben,
    basisChance: [0.55, 0.4, 0.35, 0.3],
    taetigkeiten,
  };
}

export function legeTrainingsbankAn(visionId: number): void {
  erstelleInvestition({
    name: 'Trainingsbank',
    icon: 'dumbbell',
    groesse: 1,
    attributId: attributId('koerper'),
    ziel: { art: 'vision', id: visionId },
  });
}
