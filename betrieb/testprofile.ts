import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AttributKennung } from '../shared/spiel/begriffe.ts';
import { FUNKTIONEN, type Funktionen } from '../shared/spiel/funktionen.ts';
import type { FokusId, Zielstrebigkeit } from '../shared/spiel/profil.ts';
import { KONFIG } from '../server/config.ts';
import { eine, mitWelt, schliesseWelt } from '../server/db.ts';
import { ladeAttribute } from '../server/features/attribute/attribute.ts';
import { erledigeBasisAufgabe, erstelleBasisAufgabe } from '../server/features/basis/basis.ts';
import { rechneBossangriffeAb } from '../server/features/bosse/bossangriffe.ts';
import { aendereEinstellungen } from '../server/features/einstellungen/einstellungen.ts';
import { erstelleEintrag } from '../server/features/eintraege/eintraege.ts';
import { schalteErfolgeFrei } from '../server/features/erfolge/erfolge.ts';
import { erstelleFaehigkeit, erstelleKnoten, schalteSkillFrei } from '../server/features/faehigkeiten/faehigkeiten.ts';
import { erstelleMitglied } from '../server/features/zugang/konten.ts';
import { setzeProfilZurueck } from '../server/services/profilZurueck.ts';
import { speichereRueckblick } from '../server/features/rueckblick/rueckblick.ts';
import { aendereProjekt, erstelleOrganisation, erstelleProjekt, erstelleVision } from '../server/services/struktur.ts';
import { aendereVorhaben, erstelleVorhaben, starteNeuenAnlauf } from '../server/features/ziele/vorhaben.ts';
import { erstelleVorlage, ladeVorlagen } from '../server/features/taetigkeiten/vorlagen.ts';
import {
  ersetzeZugangspasswort,
  listeKonten,
  loeseWeltdatei,
  schliesseZugang,
} from '../server/features/zugang/zugang.ts';
import { lokalesDatum, tagesbeginn, wochenbeginn } from '../server/services/zeit.ts';

const ZUGANG_DATEI = path.join(path.dirname(KONFIG.datenbankPfad), 'testprofile-zugang.txt');
const TAGE_VOLL = 35;
const TAGE_TEIL = 14;
const ZUFALL_VOLL = 20261022;
const ZUFALL_TEIL = 20261023;
const GESCHUETZTE_NAMEN = new Set(['leonardo', 'schlafkopf']);

const TESTKONTEN = {
  voll: { benutzername: 'testvoll', profilname: 'Test Voll' },
  teil: { benutzername: 'testteil', profilname: 'Test Teil' },
} as const;

const JETZT = new Date();

let zustandZufall = 0;

function setzeZufall(start: number): void {
  zustandZufall = start;
}

function zufall(): number {
  zustandZufall = (zustandZufall + 0x6d2b79f5) | 0;
  let t = Math.imul(zustandZufall ^ (zustandZufall >>> 15), 1 | zustandZufall);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | zustandZufall)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function waehle<T>(liste: T[]): T {
  if (liste.length === 0) {
    throw new Error('Die Liste ist leer.');
  }
  return liste[Math.floor(zufall() * liste.length)];
}

function nameNorm(benutzername: string): string {
  return benutzername.trim().toLocaleLowerCase('de-DE');
}

function tagVor(tage: number): string {
  return lokalesDatum(tagesbeginn(JETZT, tage));
}

function zeitpunktVor(tage: number, stunde: number): Date {
  const zeitpunkt = tagesbeginn(JETZT, tage);
  zeitpunkt.setHours(stunde);
  return zeitpunkt;
}

function datumVor(tage: number): string | null {
  return tage === 0 ? null : tagVor(tage);
}

function neuesPasswort(): string {
  const feste = path.join(path.dirname(KONFIG.datenbankPfad), 'testpasswort.txt');
  if (fs.existsSync(feste)) return fs.readFileSync(feste, 'utf8').trim();
  return randomBytes(12).toString('base64url');
}

function alleFunktionenAn(): Funktionen {
  const funktionen = {} as Funktionen;
  for (const funktion of FUNKTIONEN) {
    funktionen[funktion] = true;
  }
  return funktionen;
}

function attributId(kennung: AttributKennung): number {
  const attribut = ladeAttribute(false).find((eintrag) => eintrag.kennung === kennung);
  if (attribut === undefined) {
    throw new Error(`Attribut "${kennung}" ist nicht aktiv.`);
  }
  return attribut.id;
}

function vorlageId(name: string): number {
  const vorlage = ladeVorlagen().find((eintrag) => eintrag.name === name);
  if (vorlage === undefined) {
    throw new Error(`Tätigkeit "${name}" fehlt.`);
  }
  return vorlage.id;
}

function zaehle(tabelle: string, extra = ''): number {
  return eine<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabelle} ${extra}`)?.n ?? 0;
}

function versuche(aktion: () => void): void {
  try {
    aktion();
  } catch (fehler) {
    if (!(fehler instanceof Error) || !fehler.message.includes('schon')) {
      throw fehler;
    }
  }
}

function legeProfilAn(daten: {
  profilname: string;
  geburtsjahr: number;
  zielstrebigkeit: Zielstrebigkeit;
  fokus: readonly FokusId[];
}): void {
  aendereEinstellungen({
    geburtsjahr: daten.geburtsjahr,
    charakterName: daten.profilname,
    zielstrebigkeit: daten.zielstrebigkeit,
    fokus: [...daten.fokus],
    profilAngelegt: true,
  });
}

function baum(faehigkeitId: number, knoten: [string, string | null][]): Map<string, number> {
  const ids = new Map<string, number>();
  for (const [titel, eltern] of knoten) {
    const faehigkeit = erstelleKnoten(faehigkeitId, {
      titel,
      beschreibung: '',
      elternId: eltern === null ? null : (ids.get(eltern) ?? null),
    });
    const neu = faehigkeit.knoten.find((eintrag) => eintrag.titel === titel);
    if (neu) {
      ids.set(titel, neu.id);
    }
  }
  return ids;
}

function istGeschuetzt(konto: { benutzername: string; rolle: string; weltdatei: string }): boolean {
  if (konto.rolle === 'inhaber') {
    return true;
  }
  if (GESCHUETZTE_NAMEN.has(nameNorm(konto.benutzername))) {
    return true;
  }
  const welt = path.resolve(loeseWeltdatei(konto.weltdatei));
  if (welt === path.resolve(KONFIG.datenbankPfad)) {
    return true;
  }
  const schlafkopf = listeKonten().find((eintrag) => nameNorm(eintrag.benutzername) === 'schlafkopf');
  return schlafkopf !== undefined && welt === path.resolve(loeseWeltdatei(schlafkopf.weltdatei));
}

function holeOderLegeAn(benutzername: string, profilname: string, passwort: string): string {
  const vorhanden = listeKonten().find((konto) => nameNorm(konto.benutzername) === nameNorm(benutzername));
  if (vorhanden) {
    if (istGeschuetzt(vorhanden)) {
      throw new Error(`Das Konto ${benutzername} darf nicht überschrieben werden.`);
    }
    const welt = loeseWeltdatei(vorhanden.weltdatei);
    ersetzeZugangspasswort(passwort, vorhanden.benutzername);
    mitWelt(welt, () => setzeProfilZurueck());
    return welt;
  }
  const angelegt = erstelleMitglied({ benutzername, passwort, profilname });
  const konto = listeKonten().find((eintrag) => eintrag.id === angelegt.id);
  if (!konto) {
    throw new Error(`Das Konto ${benutzername} wurde nicht gefunden.`);
  }
  if (istGeschuetzt(konto)) {
    throw new Error(`Das neue Konto ${benutzername} zeigt auf eine geschützte Welt.`);
  }
  return loeseWeltdatei(konto.weltdatei);
}

function fuelleVoll(): void {
  setzeZufall(ZUFALL_VOLL);
  legeProfilAn({
    profilname: TESTKONTEN.voll.profilname,
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

  const P = {
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
    projektId: P.app,
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
    erstelleBasisAufgabe({ name: 'Zehn Kniebeugen', icon: 'dumbbell', projektId: P.kraft, vorlageId: null, stunden: null }).id,
    erstelleBasisAufgabe({ name: 'Seite lesen', icon: 'book-open', projektId: P.lernen, vorlageId: vorlageId('Lesen'), stunden: 0.5 }).id,
    erstelleBasisAufgabe({ name: 'Spüle leeren', icon: 'sparkles', projektId: P.haushalt, vorlageId: null, stunden: null }).id,
    erstelleBasisAufgabe({ name: 'Kurz dehnen', icon: 'heart-pulse', projektId: P.laufen, vorlageId: vorlageId('Dehnen'), stunden: null }).id,
  ];
  const basisChance = [0.55, 0.4, 0.35, 0.3];

  interface Taetigkeit {
    projektId: number;
    vorlage: string;
    stunden: (number | null)[];
    notizen: string[];
    faehigkeitId?: number;
    gewicht: number;
  }

  const TAETIGKEITEN: Taetigkeit[] = [
    {
      projektId: P.kraft,
      vorlage: 'Training',
      stunden: [1, 1.5, 2],
      gewicht: 4,
      faehigkeitId: kraft.id,
      notizen: ['Kniebeuge und Zug', 'Bank und Rudern', 'Beine schwer', 'Oberkörper, saubere Form', ''],
    },
    {
      projektId: P.laufen,
      vorlage: 'Laufen',
      stunden: [0.5, 1],
      gewicht: 2,
      notizen: ['Runde um den Block', 'Lockerer Dauerlauf', 'Intervalle', ''],
    },
    {
      projektId: P.app,
      vorlage: 'Erschaffen',
      stunden: [1, 2, 4],
      gewicht: 4,
      faehigkeitId: code.id,
      notizen: ['Formular gebaut', 'Liste gefiltert', 'Fehler im Speichern gefixt', 'Layout auf dem Handy', ''],
    },
    {
      projektId: P.lernen,
      vorlage: 'Lernen',
      stunden: [1, 2],
      gewicht: 2,
      faehigkeitId: code.id,
      notizen: ['Kapitel zu Tests', 'Video zu TypeScript', 'Beispiel nachgebaut', ''],
    },
    {
      projektId: P.job,
      vorlage: 'Liefern',
      stunden: [2, 4, 8],
      gewicht: 5,
      notizen: ['Ticket abgeschlossen', 'Rückfrage beantwortet', 'Review gemacht', 'Deploy vorbereitet', ''],
    },
    {
      projektId: P.haushalt,
      vorlage: 'Aufräumen',
      stunden: [null, 0.5, 1],
      gewicht: 2,
      notizen: ['Küche leer', 'Wäsche weggelegt', 'Schreibtisch frei', ''],
    },
    {
      projektId: P.kraft,
      vorlage: 'Ausgeschlafen',
      stunden: [null],
      gewicht: 1,
      notizen: ['Vor 23 Uhr im Bett', 'Durchgeschlafen', ''],
    },
    {
      projektId: P.treff,
      vorlage: 'Laufen',
      stunden: [1],
      gewicht: 1,
      notizen: ['Mit der Gruppe gelaufen', ''],
    },
    {
      projektId: P.job,
      vorlage: 'Präsentieren',
      stunden: [1, 2],
      gewicht: 1,
      notizen: ['Stand vorgestellt', 'Demo für den Kunden', ''],
    },
    {
      projektId: P.app,
      vorlage: 'Brainstormen',
      stunden: [0.5, 1],
      gewicht: 1,
      faehigkeitId: code.id,
      notizen: ['Ablauf skizziert', 'Namen für die Felder', ''],
    },
  ];

  function waehleTaetigkeit(): Taetigkeit {
    let summe = 0;
    for (const taetigkeit of TAETIGKEITEN) {
      summe += taetigkeit.gewicht;
    }
    let wurf = zufall() * summe;
    for (const taetigkeit of TAETIGKEITEN) {
      wurf -= taetigkeit.gewicht;
      if (wurf <= 0) {
        return taetigkeit;
      }
    }
    return TAETIGKEITEN[0];
  }

  const offeneVorhaben = new Map<number, number[]>();
  const V: Record<string, number> = {};

  function legeVorhabenAn(
    projektId: number,
    titel: string,
    tage: number,
    boss?: { deadlineIn: number },
  ): number {
    const zeitpunkt = zeitpunktVor(tage, 8);
    const id = erstelleVorhaben(projektId, titel, zeitpunkt).id;
    if (boss) {
      aendereVorhaben(id, { boss: { deadline: tagVor(tage - boss.deadlineIn) } }, zeitpunkt);
    }
    offeneVorhaben.set(projektId, [...(offeneVorhaben.get(projektId) ?? []), id]);
    return id;
  }

  function schliesseVorhaben(projektId: number, vorhabenId: number): void {
    offeneVorhaben.set(
      projektId,
      (offeneVorhaben.get(projektId) ?? []).filter((id) => id !== vorhabenId),
    );
  }

  function trageEin(
    tage: number,
    taetigkeit: { projektId: number; vorlage: string; faehigkeitId?: number },
    stunden: number | null,
    notiz: string,
    extra: {
      vorhabenId?: number;
      abschluss?: 'geschafft' | 'gescheitert';
      erkenntnis?: string;
      meilenstein?: boolean;
    } = {},
  ): void {
    const kandidaten = offeneVorhaben.get(taetigkeit.projektId) ?? [];
    const vorhabenId =
      extra.vorhabenId ?? (kandidaten.length > 0 && zufall() < 0.55 ? waehle(kandidaten) : undefined);
    erstelleEintrag(
      {
        projektId: taetigkeit.projektId,
        vorlageId: vorlageId(taetigkeit.vorlage),
        vorhaben: vorhabenId === undefined ? null : { art: 'bestehend', id: vorhabenId },
        abschluss: extra.abschluss ?? null,
        erkenntnis: extra.erkenntnis ?? '',
        stunden,
        notiz,
        meilenstein: extra.meilenstein ?? false,
        faehigkeitId: taetigkeit.faehigkeitId ?? null,
        datum: datumVor(tage),
      },
      JETZT,
    );
    if (extra.abschluss !== undefined && vorhabenId !== undefined) {
      schliesseVorhaben(taetigkeit.projektId, vorhabenId);
    }
  }

  const ereignisse = new Map<number, (() => void)[]>();
  function amTag(tage: number, aktion: () => void): void {
    ereignisse.set(tage, [...(ereignisse.get(tage) ?? []), aktion]);
  }

  amTag(34, () => {
    V.kniebeuge = legeVorhabenAn(P.kraft, 'Kniebeuge-Technik', 34);
    V.login = legeVorhabenAn(P.app, 'Anmeldung bauen', 34);
    V.ticket = legeVorhabenAn(P.job, 'Erstes Ticket der Woche', 34);
  });
  amTag(32, () => schalteSkillFrei(kraftSkills.get('Kniebeuge sauber') ?? 0, zeitpunktVor(32, 19)));
  amTag(30, () => schalteSkillFrei(codeSkills.get('TypeScript Alltag') ?? 0, zeitpunktVor(30, 20)));
  amTag(28, () => {
    V.kueche = legeVorhabenAn(P.haushalt, 'Küche komplett', 28);
    V.react = legeVorhabenAn(P.lernen, 'React-Grundlagen', 28);
  });
  amTag(26, () =>
    trageEin(26, { projektId: P.job, vorlage: 'Liefern' }, 4, 'Ticket geschlossen und Review drin', {
      vorhabenId: V.ticket,
      abschluss: 'geschafft',
    }),
  );
  amTag(25, () => schalteSkillFrei(codeSkills.get('React-Komponenten') ?? 0, zeitpunktVor(25, 20)));
  amTag(24, () =>
    trageEin(24, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: code.id }, 3, 'Login mit Speichern fertig', {
      vorhabenId: V.login,
      abschluss: 'geschafft',
    }),
  );
  amTag(23, () => {
    V.release = legeVorhabenAn(P.app, 'Erste Version raus', 23, { deadlineIn: 10 });
    V.bank = legeVorhabenAn(P.kraft, 'Bankdrücken 60 Kilo', 23);
  });
  amTag(22, () => schalteSkillFrei(kraftSkills.get('Bankdrücken') ?? 0, zeitpunktVor(22, 19)));
  amTag(20, () =>
    trageEin(20, { projektId: P.haushalt, vorlage: 'Aufräumen' }, 2, 'Küche leer und Schränke sortiert', {
      vorhabenId: V.kueche,
      abschluss: 'geschafft',
    }),
  );
  amTag(19, () => {
    aendereProjekt(
      P.kraft,
      {
        investition: true,
        investitionZiel: { art: 'vision', id: fit.id },
        investitionRessourcen: true,
        geschafft: true,
      },
      zeitpunktVor(19, 8),
    );
  });
  amTag(18, () =>
    trageEin(18, { projektId: P.laufen, vorlage: 'Laufen' }, 1, 'Fünf Kilometer ohne Pause', { meilenstein: true }),
  );
  amTag(17, () => schalteSkillFrei(codeSkills.get('Tests schreiben') ?? 0, zeitpunktVor(17, 21)));
  amTag(16, () =>
    trageEin(16, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: kraft.id }, 1.5, 'Kniebeuge sitzt, Gewicht erhöht', {
      vorhabenId: V.kniebeuge,
      abschluss: 'geschafft',
    }),
  );
  amTag(15, () => {
    V.gruppenlauf = legeVorhabenAn(P.treff, 'Samstagslauf organisieren', 15);
    V.kreuz = legeVorhabenAn(P.kraft, 'Kreuzheben 100 Kilo', 15, { deadlineIn: 18 });
    schalteSkillFrei(kraftSkills.get('Kreuzheben') ?? 0, zeitpunktVor(15, 19));
  });
  amTag(14, () =>
    trageEin(14, { projektId: P.lernen, vorlage: 'Lernen', faehigkeitId: code.id }, 2, 'Erste eigene Komponente ohne Vorlage', {
      vorhabenId: V.react,
      abschluss: 'geschafft',
    }),
  );
  amTag(13, () => {
    V.liste = legeVorhabenAn(P.app, 'Einträge filtern', 13);
    schalteSkillFrei(codeSkills.get('API anbinden') ?? 0, zeitpunktVor(13, 20));
  });
  amTag(12, () =>
    trageEin(12, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: kraft.id }, 1, '60 Kilo Bankdrücken geschafft', {
      vorhabenId: V.bank,
      abschluss: 'geschafft',
      meilenstein: true,
    }),
  );
  amTag(11, () =>
    trageEin(11, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: kraft.id }, 1.5, 'Kreuzheben abgebrochen, Rücken zu müde', {
      vorhabenId: V.kreuz,
      abschluss: 'gescheitert',
      erkenntnis: 'Weniger Sätze, Form zuerst.',
    }),
  );
  amTag(10, () => {
    aendereProjekt(
      P.app,
      {
        investition: true,
        investitionZiel: { art: 'vision', id: appVision.id },
      },
      zeitpunktVor(10, 9),
    );
  });
  amTag(9, () => {
    V.kreuz2 = starteNeuenAnlauf(V.kreuz, zeitpunktVor(9, 8)).vorhaben.id;
    offeneVorhaben.set(P.kraft, [...(offeneVorhaben.get(P.kraft) ?? []), V.kreuz2]);
  });
  amTag(8, () =>
    trageEin(8, { projektId: P.treff, vorlage: 'Laufen' }, 1, 'Treffpunkt und Runde stehen', {
      vorhabenId: V.gruppenlauf,
      abschluss: 'geschafft',
    }),
  );
  amTag(7, () =>
    trageEin(7, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: code.id }, 3, 'Filter und Suche funktionieren', {
      vorhabenId: V.liste,
      abschluss: 'geschafft',
    }),
  );
  amTag(6, () => {
    V.sparplan = legeVorhabenAn(P.job, 'Monatsbericht', 6);
    schalteSkillFrei(kraftSkills.get('80 Kilo Kniebeuge') ?? 0, zeitpunktVor(6, 19));
  });
  amTag(4, () =>
    trageEin(4, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: kraft.id }, 2, 'Kniebeuge 80 Kilo, drei Sätze', {
      meilenstein: true,
    }),
  );
  amTag(3, () => schalteSkillFrei(kraftSkills.get('Hantelreihe') ?? 0, zeitpunktVor(3, 19)));
  amTag(2, () => {
    V.demo = legeVorhabenAn(P.job, 'Kundendemo', 2, { deadlineIn: 10 });
  });
  amTag(1, () =>
    trageEin(1, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: code.id }, 4, 'Erste Version intern lauffähig', {
      meilenstein: true,
    }),
  );

  const pausen = new Set([29, 21, 14]);

  for (let tage = TAGE_VOLL; tage >= 0; tage--) {
    for (const aktion of ereignisse.get(tage) ?? []) {
      aktion();
    }
    if (pausen.has(tage)) {
      continue;
    }
    const anzahl = tage === 0 ? 1 : 1 + Math.floor(zufall() * 3);
    for (let index = 0; index < anzahl; index++) {
      const taetigkeit = waehleTaetigkeit();
      trageEin(tage, taetigkeit, waehle(taetigkeit.stunden), waehle(taetigkeit.notizen));
    }
    for (let index = 0; index < basisAufgaben.length; index++) {
      if (tage > 0 && zufall() < basisChance[index]) {
        versuche(() => erledigeBasisAufgabe(basisAufgaben[index], JETZT, datumVor(tage)));
      }
    }
  }

  for (let woche = 4; woche >= 1; woche--) {
    const texte = [
      {
        gut: 'Training lag die Woche über fast immer vor der Couch.',
        lernen: 'Abends noch ein Ticket aufzureißen kostet den nächsten Morgen.',
        fokus: 'Kraft zuerst, danach die App.',
      },
      {
        gut: 'Die Anmeldung der App steht und ich habe sie selbst benutzt.',
        lernen: 'Zu große Vorhaben bleiben liegen. Kleiner schneiden.',
        fokus: 'Ein Filter, der wirklich hilft.',
      },
      {
        gut: 'Lauftreff hat stattgefunden, ohne dass ich alles allein organisiert habe.',
        lernen: 'Kreuzheben mit müdem Rücken war dumm.',
        fokus: 'Form vor Kilo.',
      },
      {
        gut: 'Küche bleibt zwei Tage hintereinander leer.',
        lernen: 'Wenn die Spüle morgens voll ist, rutscht der Tag.',
        fokus: 'Spüle leer, bevor der Rechner aufgeht.',
      },
    ][woche - 1];
    if (texte) {
      speichereRueckblick(lokalesDatum(wochenbeginn(JETZT, woche)), texte, JETZT);
    }
  }

  rechneBossangriffeAb(JETZT);
  schalteErfolgeFrei();

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

function fuelleTeil(): void {
  setzeZufall(ZUFALL_TEIL);
  legeProfilAn({
    profilname: TESTKONTEN.teil.profilname,
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

  const notizen = [
    'Kapitel 1',
    'Zwei Seiten Notizen',
    'Text über Gewohnheiten',
    'Vokabeln wiederholt',
    'Beispiel abgeschrieben',
    '',
  ];
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

function schreibeZugang(zeilen: { profilname: string; benutzername: string; passwort: string }[]): void {
  const text = zeilen
    .map(
      (zeile) =>
        `${zeile.profilname}\nBenutzername: ${zeile.benutzername}\nPasswort: ${zeile.passwort}\n`,
    )
    .join('\n');
  fs.writeFileSync(ZUGANG_DATEI, text, 'utf8');
}

function istHauptdatei(): boolean {
  const eintrag = process.argv[1];
  if (!eintrag) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(eintrag)).href;
}

function main(): void {
  const vollPasswort = neuesPasswort();
  const teilPasswort = neuesPasswort();
  const vollWelt = holeOderLegeAn(TESTKONTEN.voll.benutzername, TESTKONTEN.voll.profilname, vollPasswort);
  const teilWelt = holeOderLegeAn(TESTKONTEN.teil.benutzername, TESTKONTEN.teil.profilname, teilPasswort);
  try {
    mitWelt(vollWelt, fuelleVoll);
    mitWelt(teilWelt, fuelleTeil);
    schreibeZugang([
      { ...TESTKONTEN.voll, passwort: vollPasswort },
      { ...TESTKONTEN.teil, passwort: teilPasswort },
    ]);
  } finally {
    schliesseWelt(vollWelt);
    schliesseWelt(teilWelt);
    schliesseZugang();
  }
  console.log('Testprofile neu befüllt. Zugangsdaten stehen in data/testprofile-zugang.txt.');
}

if (istHauptdatei()) {
  main();
}
