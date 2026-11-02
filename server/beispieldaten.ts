import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FARBE, type AttributKennung, type IconName } from '../shared/spiel/begriffe.ts';

const ERSETZEN = process.argv.includes('--ersetzen');
const DATENBANK = process.env.DB_PFAD ?? path.resolve(import.meta.dirname, '..', 'data', 'app.db');
const SIMULIERTE_TAGE = 70;
const STARTWERT_ZUFALL = 20261019;

function sichereUndEntferne(pfad: string): void {
  const zeitstempel = new Date().toISOString().replace(/[:.]/g, '-');
  const ordner = path.join(path.dirname(pfad), 'sicherungen');
  const sicherung = path.join(ordner, `app-${zeitstempel}.db`);
  fs.mkdirSync(ordner, { recursive: true });

  const quelle = new DatabaseSync(pfad);
  quelle.exec(`VACUUM INTO '${sicherung.replace(/'/g, "''")}'`);
  quelle.close();

  try {
    for (const datei of [pfad, `${pfad}-wal`, `${pfad}-shm`]) {
      fs.rmSync(datei, { force: true });
    }
  } catch (fehler) {
    throw new Error('Die Datenbank ist noch geöffnet. Bitte zuerst die App stoppen (Strg + C).', { cause: fehler });
  }
  console.log(`Alte Datenbank gesichert: ${sicherung}`);
}

if (fs.existsSync(DATENBANK)) {
  if (!ERSETZEN) {
    console.error('Es gibt schon eine Datenbank. Mit "npm run beispieldaten -- --ersetzen" wird sie gesichert und ersetzt.');
    process.exit(1);
  }
  sichereUndEntferne(DATENBANK);
}

process.env.DB_PFAD = DATENBANK;

const { aktiviereAttribut, ladeAttribute } = await import('./features/attribute/attribute.ts');
const { aendereEinstellungen } = await import('./features/einstellungen/einstellungen.ts');
const { erstelleVorlage, ladeVorlagen } = await import('./features/taetigkeiten/vorlagen.ts');
const struktur = await import('./services/struktur.ts');
const vorhabenDienst = await import('./features/ziele/vorhaben.ts');
const { erstelleEintrag } = await import('./features/eintraege/eintraege.ts');
const { schreibeBewertungNie } = await import('./features/bewertung/bewertung.ts');
const faehigkeiten = await import('./features/faehigkeiten/faehigkeiten.ts');
const basis = await import('./features/basis/basis.ts');
const { rechneBossangriffeAb } = await import('./features/bosse/bossangriffe.ts');
const { lokalesDatum, tagesbeginn } = await import('./services/zeit.ts');
const { schliesseDatenbank } = await import('./db.ts');

let zustandZufall = STARTWERT_ZUFALL;
function schalteBeispielEin(kennungen: readonly AttributKennung[]): void {
  aendereEinstellungen({
    funktionen: {
      koennen: true,
      status: true,
      faehigkeiten: true,
      basis: true,
      ausruestung: true,
      bossAngriffe: true,
    },
    ebenen: {
      visionen: true,
      organisationen: true,
      projekte: true,
      vorhaben: true,
    },
  });
  const aktiv = new Set<string>();
  for (const attribut of ladeAttribute(false)) {
    if (attribut.kennung !== null) {
      aktiv.add(attribut.kennung);
    }
  }
  for (const kennung of kennungen) {
    if (!aktiv.has(kennung)) {
      aktiviereAttribut(kennung, 'behalten', null);
    }
  }
}

function zufall(): number {
  zustandZufall = (zustandZufall + 0x6d2b79f5) | 0;
  let t = Math.imul(zustandZufall ^ (zustandZufall >>> 15), 1 | zustandZufall);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function waehle<T>(liste: T[]): T {
  return liste[Math.floor(zufall() * liste.length)];
}

const JETZT = new Date();

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

const GRUNDTAETIGKEITEN: { name: string; icon: IconName; gewichte: [AttributKennung, number][] }[] = [
  { name: 'Umsetzen', icon: 'hammer', gewichte: [['disziplin', 60], ['intellekt', 40]] },
  { name: 'Lernen', icon: 'book-open', gewichte: [['intellekt', 80], ['disziplin', 20]] },
  { name: 'Sport', icon: 'dumbbell', gewichte: [['koerper', 80], ['disziplin', 20]] },
  { name: 'Hobby', icon: 'palette', gewichte: [['geist', 70], ['koerper', 30]] },
  { name: 'Erholung', icon: 'battery-charging', gewichte: [['geist', 60], ['koerper', 40]] },
  { name: 'Netzwerken', icon: 'users', gewichte: [['soziales', 70], ['einfluss', 30]] },
  { name: 'Organisieren', icon: 'clipboard-list', gewichte: [['disziplin', 50], ['soziales', 30], ['autoritaet', 20]] },
  { name: 'Veröffentlichen', icon: 'rocket', gewichte: [['reichweite', 50], ['disziplin', 30], ['soziales', 20]] },
  { name: 'Aufräumen', icon: 'sparkles', gewichte: [['disziplin', 70], ['geist', 30]] },
  { name: 'Arbeiten', icon: 'briefcase', gewichte: [['ressourcen', 50], ['disziplin', 30], ['intellekt', 20]] },
  { name: 'Erschaffen', icon: 'lightbulb', gewichte: [['kreativitaet', 70], ['disziplin', 30]] },
];

schalteBeispielEin([...new Set(GRUNDTAETIGKEITEN.flatMap((grund) => grund.gewichte.map(([kennung]) => kennung)))]);

const attributIds = new Map<AttributKennung, number>();
for (const attribut of ladeAttribute(false)) {
  if (attribut.kennung !== null) {
    attributIds.set(attribut.kennung, attribut.id);
  }
}
function attributId(kennung: AttributKennung): number {
  const id = attributIds.get(kennung);
  if (id === undefined) {
    throw new Error(`Attribut "${kennung}" ist nicht aktiv.`);
  }
  return id;
}

for (const grundtaetigkeit of GRUNDTAETIGKEITEN) {
  erstelleVorlage({
    name: grundtaetigkeit.name,
    icon: grundtaetigkeit.icon,
    gewichte: grundtaetigkeit.gewichte.map(([kennung, gewicht]) => ({ attributId: attributId(kennung), gewicht })),
  });
}

const vorlagen = new Map(ladeVorlagen().map((vorlage) => [vorlage.name, vorlage.id]));
function vorlage(name: string): number {
  const id = vorlagen.get(name);
  if (id === undefined) {
    throw new Error(`Vorlage "${name}" fehlt.`);
  }
  return id;
}

const gesund = struktur.erstelleVision({
  titel: 'Gesund & ausgeglichen',
  beschreibung: 'Ein Körper und ein Geist, die mich tragen.',
  farbe: FARBE.gruen,
  woopErgebnis: 'Energie für alles, was mir wichtig ist',
  woopHindernis: 'Abends zu müde für Sport',
  woopPlan: 'Wenn ich nach der Arbeit heimkomme, dann ziehe ich sofort die Laufschuhe an.',
  level: 300,
});
const fundament = struktur.erstelleVision({
  titel: 'Fundament',
  beschreibung: 'Ordnung und Alltag, auf denen alles andere aufbaut.',
  farbe: FARBE.blau,
  woopErgebnis: '',
  woopHindernis: '',
  woopPlan: '',
  level: null,
});
const cafe = struktur.erstelleVision({
  titel: 'Eigenes Café eröffnen',
  beschreibung: 'Ein Ort, an dem Menschen gern Zeit verbringen.',
  farbe: FARBE.orange,
  woopErgebnis: 'Jeden Morgen in meinem eigenen Laden stehen',
  woopHindernis: 'Angst vor dem finanziellen Risiko',
  woopPlan: 'Wenn mich Zweifel packen, dann rechne ich ein konkretes Szenario im Finanzplan durch.',
  level: 800,
});
const buehne = struktur.erstelleVision({
  titel: 'Auf der Bühne spielen',
  beschreibung: 'Eigene Songs vor Publikum.',
  farbe: FARBE.violett,
  woopErgebnis: 'Applaus nach dem ersten eigenen Song',
  woopHindernis: 'Lampenfieber',
  woopPlan: 'Wenn ich nervös werde, dann spiele ich die ersten Takte für eine Person zur Probe.',
  level: 400,
});
const arbeit = struktur.erstelleOrganisation({ name: 'Arbeit', beschreibung: '', farbe: FARBE.blau, visionId: null });
const verein = struktur.erstelleOrganisation({ name: 'Sportverein', beschreibung: '', farbe: FARBE.tuerkis, visionId: gesund.id });

function projekt(name: string, standard: string, zuordnung: { visionId?: number; organisationId?: number }) {
  return struktur.erstelleProjekt({
    name,
    beschreibung: '',
    visionId: zuordnung.visionId ?? null,
    organisationId: zuordnung.organisationId ?? null,
    standardVorlageId: vorlage(standard),
  }).id;
}

const P = {
  erholung: projekt('Erholung', 'Erholung', { visionId: gesund.id }),
  sport: projekt('Sport', 'Sport', { visionId: gesund.id }),
  ordnung: projekt('Ordnung', 'Aufräumen', { visionId: fundament.id }),
  businessplan: projekt('Businessplan', 'Umsetzen', { visionId: cafe.id }),
  barista: projekt('Barista-Kurs', 'Lernen', { visionId: cafe.id }),
  gitarre: projekt('Gitarre', 'Hobby', { visionId: buehne.id }),
  auftritt: projekt('Erster Auftritt', 'Veröffentlichen', { visionId: buehne.id }),
  portal: projekt('Kundenportal', 'Arbeiten', { organisationId: arbeit.id }),
  cloud: projekt('Weiterbildung Cloud', 'Lernen', { organisationId: arbeit.id }),
  jugend: projekt('Jugendtraining', 'Organisieren', { organisationId: verein.id }),
};

function baum(faehigkeitId: number, knoten: [string, string | null][]): Map<string, number> {
  const ids = new Map<string, number>();
  for (const [titel, eltern] of knoten) {
    const faehigkeit = faehigkeiten.erstelleKnoten(faehigkeitId, {
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

const gitarre = faehigkeiten.erstelleFaehigkeit({ name: 'Gitarre', beschreibung: '', farbe: FARBE.violett, icon: 'guitar' });
const gitarrenSkills = baum(gitarre.id, [
  ['Grundakkorde', null],
  ['Akkordwechsel', 'Grundakkorde'],
  ['Barré-Akkorde', 'Akkordwechsel'],
  ['F-Dur sauber', 'Barré-Akkorde'],
  ['Strumming-Muster', 'Akkordwechsel'],
  ['Fingerpicking', 'Strumming-Muster'],
  ['Travis Picking', 'Fingerpicking'],
  ['Rhythmusgefühl', null],
  ['Metronom 120 bpm', 'Rhythmusgefühl'],
  ['Eigener Song', 'Metronom 120 bpm'],
]);
const barista = faehigkeiten.erstelleFaehigkeit({ name: 'Barista', beschreibung: '', farbe: FARBE.orange, icon: 'chef-hat' });
const baristaSkills = baum(barista.id, [
  ['Espresso einstellen', null],
  ['Milchschaum', 'Espresso einstellen'],
  ['Latte Art: Herz', 'Milchschaum'],
  ['Latte Art: Rosetta', 'Latte Art: Herz'],
  ['Latte Art: Tulpe', 'Latte Art: Herz'],
  ['Bohnenkunde', null],
  ['Eigene Röstung', 'Bohnenkunde'],
]);
const code = faehigkeiten.erstelleFaehigkeit({ name: 'Programmieren', beschreibung: '', farbe: FARBE.blau, icon: 'code' });
const codeSkills = baum(code.id, [
  ['TypeScript', null],
  ['React', 'TypeScript'],
  ['State-Management', 'React'],
  ['Node.js', 'TypeScript'],
  ['SQL', 'Node.js'],
  ['Cloud-Deployment', 'Node.js'],
]);

const BASIS_AUFGABEN: { name: string; icon: IconName; projektId: number; stunden: number | null; chance: number }[] = [
  { name: 'Meditieren', icon: 'leaf', projektId: P.erholung, stunden: null, chance: 0.6 },
  { name: 'Akkorde üben', icon: 'guitar', projektId: P.gitarre, stunden: 0.5, chance: 0.5 },
  { name: 'Zuhause Mobility', icon: 'dumbbell', projektId: P.sport, stunden: 0.5, chance: 0.35 },
  { name: 'Fachbuch lesen', icon: 'book-open', projektId: P.cloud, stunden: 0.5, chance: 0.4 },
  { name: 'Zimmer aufräumen', icon: 'sparkles', projektId: P.ordnung, stunden: null, chance: 0.25 },
  { name: 'Pflanzen gießen', icon: 'sprout', projektId: P.ordnung, stunden: null, chance: 0.3 },
];
const basisAufgaben = BASIS_AUFGABEN.map((aufgabe) => ({
  id: basis.erstelleBasisAufgabe({
    name: aufgabe.name,
    icon: aufgabe.icon,
    projektId: aufgabe.projektId,
    vorlageId: null,
    stunden: aufgabe.stunden,
  }).id,
  chance: aufgabe.chance,
}));

interface Taetigkeit {
  projektId: number;
  vorlage: string;
  stunden: (number | null)[];
  notizen: string[];
  faehigkeitId?: number;
  gewicht: number;
}

const TAETIGKEITEN: Taetigkeit[] = [
  { projektId: P.portal, vorlage: 'Arbeiten', stunden: [2, 4, 8], gewicht: 5, faehigkeitId: code.id,
    notizen: ['API-Endpunkte gebaut', 'Code-Review gemacht', 'Bug im Login gefixt', 'Datenbank-Migration geschrieben', ''] },
  { projektId: P.cloud, vorlage: 'Lernen', stunden: [1, 2], gewicht: 2, faehigkeitId: code.id,
    notizen: ['Kapitel über Container', 'Übungsaufgaben gemacht', 'Video-Kurs weitergeschaut', ''] },
  { projektId: P.businessplan, vorlage: 'Umsetzen', stunden: [1, 2, null], gewicht: 3,
    notizen: ['Mitbewerber angeschaut', 'Kostenaufstellung', 'Mit Bank telefoniert', 'Zielgruppe definiert', ''] },
  { projektId: P.businessplan, vorlage: 'Netzwerken', stunden: [1, 2], gewicht: 1,
    notizen: ['Kaffee mit einer Café-Besitzerin', 'Gründerstammtisch besucht'] },
  { projektId: P.barista, vorlage: 'Lernen', stunden: [2, 4], gewicht: 2, faehigkeitId: barista.id,
    notizen: ['Extraktionszeiten geübt', 'Milch aufschäumen', 'Theorie zu Bohnen', ''] },
  { projektId: P.gitarre, vorlage: 'Hobby', stunden: [0.5, 1, 2], gewicht: 3, faehigkeitId: gitarre.id,
    notizen: ['Neues Riff gelernt', 'Akkordwechsel geübt', 'Song aufgenommen', ''] },
  { projektId: P.gitarre, vorlage: 'Erschaffen', stunden: [1, 2], gewicht: 1, faehigkeitId: gitarre.id,
    notizen: ['Eigenen Song geschrieben', 'Melodie komponiert', 'Text überarbeitet'] },
  { projektId: P.auftritt, vorlage: 'Veröffentlichen', stunden: [1, 2], gewicht: 1, faehigkeitId: gitarre.id,
    notizen: ['Setlist geschrieben', 'Video hochgeladen', 'Veranstalter angeschrieben'] },
  { projektId: P.sport, vorlage: 'Sport', stunden: [1, 2], gewicht: 2,
    notizen: ['Krafttraining', 'Intervalle', 'Fußball mit Freunden', ''] },
  { projektId: P.jugend, vorlage: 'Organisieren', stunden: [1, 2], gewicht: 1,
    notizen: ['Trainingsplan erstellt', 'Elternabend vorbereitet', ''] },
  { projektId: P.erholung, vorlage: 'Erholung', stunden: [null, 1, 2], gewicht: 2,
    notizen: ['Spaziergang ohne Handy', 'Sauna', 'Früh schlafen gegangen', 'Lesen im Park'] },
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
function legeVorhabenAn(
  projektId: number,
  titel: string,
  tage: number,
  boss?: { deadlineIn: number },
): number {
  const zeitpunkt = zeitpunktVor(tage, 8);
  const id = vorhabenDienst.erstelleVorhaben(projektId, titel, zeitpunkt).id;
  if (boss) {
    vorhabenDienst.aendereVorhaben(id, { boss: { deadline: tagVor(tage - boss.deadlineIn) } }, zeitpunkt);
  }
  offeneVorhaben.set(projektId, [...(offeneVorhaben.get(projektId) ?? []), id]);
  return id;
}

function schliesseVorhaben(projektId: number, vorhabenId: number): void {
  offeneVorhaben.set(projektId, (offeneVorhaben.get(projektId) ?? []).filter((id) => id !== vorhabenId));
}

function trageEin(
  tage: number,
  taetigkeit: { projektId: number; vorlage: string; faehigkeitId?: number },
  stunden: number | null,
  notiz: string,
  extra: { vorhabenId?: number; abschluss?: 'geschafft' | 'gescheitert'; erkenntnis?: string; meilenstein?: boolean } = {},
): void {
  const vorhabenId =
    extra.vorhabenId ?? (zufall() < 0.6 ? waehle(offeneVorhaben.get(taetigkeit.projektId) ?? [undefined]) : undefined);
  erstelleEintrag(
    {
      projektId: taetigkeit.projektId,
      vorlageId: vorlage(taetigkeit.vorlage),
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

const V: Record<string, number> = {};
const EREIGNISSE = new Map<number, (() => void)[]>();
function amTag(tage: number, aktion: () => void): void {
  EREIGNISSE.set(tage, [...(EREIGNISSE.get(tage) ?? []), aktion]);
}

amTag(68, () => {
  V.marktanalyse = legeVorhabenAn(P.businessplan, 'Marktanalyse', 68);
  V.login = legeVorhabenAn(P.portal, 'Login-Seite', 68);
  V.wonderwall = legeVorhabenAn(P.gitarre, 'Wonderwall komplett', 68);
});
amTag(66, () => faehigkeiten.schalteSkillFrei(gitarrenSkills.get('Grundakkorde') ?? 0, zeitpunktVor(66, 19)));
amTag(64, () => faehigkeiten.schalteSkillFrei(codeSkills.get('TypeScript') ?? 0, zeitpunktVor(64, 19)));
amTag(62, () => faehigkeiten.schalteSkillFrei(codeSkills.get('React') ?? 0, zeitpunktVor(62, 19)));
amTag(60, () => {
  V.saison = legeVorhabenAn(P.jugend, 'Saisonplanung', 60);
  V.kurs = legeVorhabenAn(P.barista, 'Kurs abschließen', 60, { deadlineIn: 45 });
});
amTag(55, () => faehigkeiten.schalteSkillFrei(baristaSkills.get('Espresso einstellen') ?? 0, zeitpunktVor(55, 19)));
amTag(52, () => trageEin(52, { projektId: P.portal, vorlage: 'Arbeiten', faehigkeitId: code.id }, 4, 'Login inklusive Passwort-Reset fertig', { vorhabenId: V.login, abschluss: 'geschafft' }));
amTag(50, () => trageEin(50, { projektId: P.businessplan, vorlage: 'Umsetzen' }, 2, 'Drei Standorte verglichen, Zielgruppe steht', { vorhabenId: V.marktanalyse, abschluss: 'geschafft' }));
amTag(49, () => {
  V.release = legeVorhabenAn(P.portal, 'Release 1.0', 49, { deadlineIn: 70 });
  V.finanzplan = legeVorhabenAn(P.businessplan, 'Finanzplan', 49, { deadlineIn: 63 });
});
amTag(47, () => faehigkeiten.schalteSkillFrei(gitarrenSkills.get('Akkordwechsel') ?? 0, zeitpunktVor(47, 20)));
amTag(44, () => faehigkeiten.schalteSkillFrei(gitarrenSkills.get('Rhythmusgefühl') ?? 0, zeitpunktVor(44, 20)));
amTag(38, () => faehigkeiten.schalteSkillFrei(baristaSkills.get('Milchschaum') ?? 0, zeitpunktVor(38, 19)));
amTag(36, () => trageEin(36, { projektId: P.jugend, vorlage: 'Organisieren' }, 2, 'Saisonplan an alle Eltern verschickt', { vorhabenId: V.saison, abschluss: 'geschafft' }));
amTag(34, () => trageEin(34, { projektId: P.gitarre, vorlage: 'Hobby', faehigkeitId: gitarre.id }, 1, 'Zum ersten Mal ohne Fehler durchgespielt', { vorhabenId: V.wonderwall, abschluss: 'geschafft' }));
amTag(33, () => {
  V.blackbird = legeVorhabenAn(P.gitarre, 'Blackbird', 33);
  faehigkeiten.schalteSkillFrei(codeSkills.get('Node.js') ?? 0, zeitpunktVor(33, 20));
});
amTag(30, () => trageEin(30, { projektId: P.sport, vorlage: 'Sport' }, 1, '10 km zum ersten Mal unter einer Stunde', { meilenstein: true }));
amTag(28, () => faehigkeiten.schalteSkillFrei(gitarrenSkills.get('Strumming-Muster') ?? 0, zeitpunktVor(28, 20)));
amTag(25, () => {
  struktur.aendereProjekt(
    P.gitarre,
    { investition: true, investitionZiel: { art: 'vision', id: buehne.id } },
    zeitpunktVor(25, 7),
  );
});
amTag(22, () => faehigkeiten.schalteSkillFrei(baristaSkills.get('Latte Art: Herz') ?? 0, zeitpunktVor(22, 19)));
amTag(20, () => {
  trageEin(20, { projektId: P.barista, vorlage: 'Lernen', faehigkeitId: barista.id }, 4, 'Prüfung bestanden', { vorhabenId: V.kurs, abschluss: 'geschafft' });
  struktur.aendereProjekt(
    P.barista,
    {
      investition: true,
      investitionZiel: { art: 'vision', id: cafe.id },
      investitionRessourcen: true,
      geschafft: true,
    },
    zeitpunktVor(20, 21),
  );
});
amTag(18, () => trageEin(18, { projektId: P.gitarre, vorlage: 'Hobby', faehigkeitId: gitarre.id }, 1, '', { vorhabenId: V.blackbird, abschluss: 'gescheitert', erkenntnis: 'Fingerpicking fehlt mir noch, erst die Technik sauber lernen.' }));
amTag(16, () => {
  V.auftritt = legeVorhabenAn(P.auftritt, 'Open-Mic-Abend', 16, { deadlineIn: 12 });
  V.standort = legeVorhabenAn(P.businessplan, 'Standort finden', 16);
});
amTag(12, () => {
  V.blackbird2 = vorhabenDienst.starteNeuenAnlauf(V.blackbird, zeitpunktVor(12, 9)).vorhaben.id;
  offeneVorhaben.set(P.gitarre, [...(offeneVorhaben.get(P.gitarre) ?? []), V.blackbird2]);
  faehigkeiten.schalteSkillFrei(gitarrenSkills.get('Fingerpicking') ?? 0, zeitpunktVor(12, 20));
});
amTag(9, () => faehigkeiten.schalteSkillFrei(codeSkills.get('SQL') ?? 0, zeitpunktVor(9, 20)));
amTag(6, () => {
  V.turnier = legeVorhabenAn(P.jugend, 'Turnier organisieren', 6);
  V.zertifikat = legeVorhabenAn(P.cloud, 'Zertifikat', 6);
});
amTag(3, () => faehigkeiten.schalteSkillFrei(baristaSkills.get('Bohnenkunde') ?? 0, zeitpunktVor(3, 19)));
amTag(1, () => trageEin(1, { projektId: P.portal, vorlage: 'Arbeiten', faehigkeitId: code.id }, 8, 'Großes Refactoring abgeschlossen', { meilenstein: true }));

const PAUSEN = new Set([45, 44, 43, 27]);

function versuche(aktion: () => void): void {
  try {
    aktion();
  } catch (fehler) {
    if (!(fehler instanceof Error) || !fehler.message.includes('schon')) {
      throw fehler;
    }
  }
}

schreibeBewertungNie();

for (let tage = SIMULIERTE_TAGE; tage >= 0; tage--) {
  for (const aktion of EREIGNISSE.get(tage) ?? []) {
    aktion();
  }
  if (PAUSEN.has(tage)) {
    continue;
  }

  const anzahl = tage === 0 ? 1 : 1 + Math.floor(zufall() * 3);
  for (let index = 0; index < anzahl; index++) {
    const taetigkeit = waehleTaetigkeit();
    trageEin(tage, taetigkeit, waehle(taetigkeit.stunden), waehle(taetigkeit.notizen));
  }

  for (const aufgabe of basisAufgaben) {
    if (tage > 0 && zufall() < aufgabe.chance) {
      versuche(() => basis.erledigeBasisAufgabe(aufgabe.id, JETZT, datumVor(tage)));
    }
  }
}

rechneBossangriffeAb(JETZT);
schliesseDatenbank();
console.log('Beispieldaten angelegt.');
