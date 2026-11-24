import path from 'node:path';
import { RECHT_FASSUNG } from '../shared/recht/fassung.ts';
import { ATTRIBUT_KENNUNGEN, type AttributKennung, type KoennenKennung } from '../shared/spiel/begriffe.ts';
import { attributVorlage } from '../shared/features/attribute/attributKatalog.ts';
import { bestimmeKlasse } from '../shared/spiel/klassen.ts';
import { berechneLevel, LEVEL_KURVEN, xpBisLevel } from '../shared/spiel/level.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../server/db.ts';
import { ladeAttribute, ladeCharakterLevel, ladeKlasse } from '../server/features/attribute/attribute.ts';
import { aendereEinstellungen, schreibeBewertungNie } from '../server/features/einstellungen/einstellungen.ts';
import { schreibeHinweisAngebotGesehen } from '../server/features/einstellungen/hinweisSchluessel.ts';
import { schalteErfolgeFrei } from '../server/features/erfolge/erfolge.ts';
import { erstelleFaehigkeit, erstelleKnoten } from '../server/features/faehigkeiten/faehigkeiten.ts';
import { erstelleEintrag } from '../server/features/eintraege/eintraege.ts';
import { aendereVorlage, erstelleVorlage, ladeVorlagen } from '../server/features/taetigkeiten/vorlagen.ts';
import { erstelleMitglied } from '../server/features/zugang/konten.ts';
import { listeKonten, loeseWeltdatei, schliesseZugang, setzeZustimmungsFassung } from '../server/features/zugang/zugang.ts';
import { bucheAttributXp, bucheFaehigkeitXp, bucheProjektXp } from '../server/services/fortschritt.ts';
import { erstelleProjekt, erstelleVision, ladeProjekt } from '../server/services/struktur.ts';
import { datumPlus, leseJetzt, setzeTestzeit } from '../server/services/zeit.ts';
import { aendereVorhaben, erstelleVorhaben } from '../server/features/ziele/vorhaben.ts';
import { TEST_PASSWORT } from './testdaten.ts';

const HEUTE = '2026-11-10';
const PROFIL = 'Alex';
const KLASSE = 'Starker Krieger';
const LEVEL = 24;
const EINTRAEGE = 7;
const KOENNEN_REIHE = [
  'koerper',
  'disziplin',
  'vitalitaet',
  'geist',
  'intellekt',
  'soziales',
  'kreativitaet',
  'motorik',
  'mut',
  'fuehrung',
] as const satisfies readonly KoennenKennung[];
const ZIEL_LEVEL: Record<KoennenKennung, number> = {
  koerper: 11,
  disziplin: 14,
  vitalitaet: 10,
  geist: 3,
  intellekt: 3,
  soziales: 3,
  kreativitaet: 3,
  motorik: 3,
  mut: 5,
  fuehrung: 3,
};
const STATUS_SICHTBAR = ['einfluss', 'ressourcen', 'autoritaet', 'reichweite', 'ansehen'] as const satisfies readonly AttributKennung[];

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

async function legeAn(): Promise<string> {
  const angelegt = await erstelleMitglied({
    benutzername: 'testvoll',
    passwort: TEST_PASSWORT,
    profilname: PROFIL,
    zustimmung: new Date(),
  });
  setzeZustimmungsFassung(angelegt.id, RECHT_FASSUNG);
  const konto = listeKonten().find((eintrag) => eintrag.benutzername === 'testvoll');
  if (!konto || path.basename(konto.weltdatei) !== '1.db') {
    throw new Error(`Das Konto testvoll liegt in ${konto?.weltdatei ?? 'nirgends'}.`);
  }
  return weltVon('testvoll');
}

function attributId(kennung: AttributKennung): number {
  const attribut = ladeAttribute(false).find((eintrag) => eintrag.kennung === kennung);
  if (!attribut) {
    throw new Error(`Attribut ${kennung} fehlt.`);
  }
  return attribut.id;
}

function gewicht(kennung: AttributKennung, wert: number): { attributId: number; gewicht: number } {
  return { attributId: attributId(kennung), gewicht: wert };
}

function sichereKatalog(): void {
  const vorhanden = new Set(
    alle<{ kennung: string | null }>('SELECT kennung FROM attribute')
      .map((zeile) => zeile.kennung)
      .filter((kennung): kennung is string => kennung !== null),
  );
  let sortierung =
    eine<{ naechste: number }>('SELECT COALESCE(MAX(sortierung), 0) AS naechste FROM attribute')?.naechste ?? 0;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    if (vorhanden.has(kennung)) {
      continue;
    }
    sortierung += 1;
    const vorlage = attributVorlage(kennung);
    ausfuehren(
      `INSERT INTO attribute (typ, kennung, name, beschreibung, farbe, icon, sortierung)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      vorlage.typ,
      vorlage.kennung,
      vorlage.name,
      vorlage.beschreibung,
      vorlage.farbe,
      vorlage.icon,
      sortierung,
    );
  }
}

function sortiere(): void {
  KOENNEN_REIHE.forEach((kennung, index) => {
    ausfuehren('UPDATE attribute SET sortierung = ? WHERE kennung = ?', index + 1, kennung);
  });
  STATUS_SICHTBAR.forEach((kennung, index) => {
    ausfuehren('UPDATE attribute SET sortierung = ? WHERE kennung = ?', 101 + index, kennung);
  });
  const sichtbar = new Set<string>(STATUS_SICHTBAR);
  const rest = ladeAttribute(false).filter((eintrag) => eintrag.typ === 'status' && !sichtbar.has(eintrag.kennung ?? ''));
  rest.forEach((eintrag, index) => {
    ausfuehren('UPDATE attribute SET sortierung = ? WHERE id = ?', 201 + index, eintrag.id);
  });
}

function taetigkeit(
  name: string,
  icon: string,
  anteile: readonly (readonly [AttributKennung, number])[],
): number {
  return erstelleVorlage({
    name,
    icon,
    festeAnteile: true,
    gewichte: anteile.map(([kennung, wert]) => gewicht(kennung, wert)),
  }).id;
}

function hebeAttribut(id: number, ziel: number, zeitpunkt: string): void {
  const stand = ladeAttribute(false).find((eintrag) => eintrag.id === id);
  const aktuell = stand?.level.xpGesamt ?? 0;
  const delta = ziel - aktuell;
  if (delta < 0) {
    throw new Error(`Attribut ${id} hat schon ${aktuell} XP, Ziel ist ${ziel}.`);
  }
  if (delta === 0) {
    return;
  }
  bucheAttributXp({ quelle: 'eintrag', attributId: id, xp: delta, eintragId: null, vorhabenId: null }, zeitpunkt);
}

function hebeProjekt(projektId: number, zeitpunkt: string): void {
  const ziel = xpBisLevel(2, LEVEL_KURVEN.projekt);
  const aktuell = ladeProjekt(projektId).level.xpGesamt;
  if (aktuell >= ziel) {
    return;
  }
  bucheProjektXp({ quelle: 'eintrag', projektId, xp: ziel - aktuell, eintragId: null, vorhabenId: null }, zeitpunkt);
}

function legeInhaltAn(): void {
  aendereEinstellungen({
    sprache: 'de',
    charakterName: PROFIL,
    profilAngelegt: true,
    funktionen: { faehigkeiten: true, bossAngriffe: true, verfallKoennen: false, verfallHaben: false },
  });
  sichereKatalog();
  ausfuehren('UPDATE attribute SET erschoepfung = 0, verfall_zeit = ?', 'aus');
  sortiere();
  for (const vorlage of ladeVorlagen()) {
    if (!vorlage.archiviert) {
      aendereVorlage(vorlage.id, { archiviert: true });
    }
  }

  const laufen = taetigkeit('Laufen', 'bike', [
    ['koerper', 50],
    ['vitalitaet', 30],
    ['disziplin', 20],
  ]);
  const spanisch = taetigkeit('Spanisch', 'languages', [
    ['intellekt', 60],
    ['disziplin', 40],
  ]);
  taetigkeit('Lesen', 'book-open', [
    ['intellekt', 70],
    ['geist', 30],
  ]);
  const ruecken = taetigkeit('Rücken', 'heart-pulse', [
    ['koerper', 70],
    ['disziplin', 30],
  ]);
  const haushalt = taetigkeit('Haushalt', 'sparkles', [
    ['disziplin', 60],
    ['geist', 20],
    ['koerper', 20],
  ]);

  const vision = erstelleVision({
    titel: 'Fit im Alltag',
    beschreibung: 'Laufen, Rücken und ein klarer Kopf.',
    farbe: '#34d399',
    woopErgebnis: '',
    woopHindernis: '',
    woopPlan: '',
    level: null,
  });
  const projekt = (name: string, vorlageId: number) =>
    erstelleProjekt({
      name,
      beschreibung: '',
      visionId: vision.id,
      organisationId: null,
      standardVorlageId: vorlageId,
    }).id;
  const projekte = {
    laufen: projekt('Laufen', laufen),
    ruecken: projekt('Rücken', ruecken),
    lernen: projekt('Lernen', spanisch),
    haushalt: projekt('Haushalt', haushalt),
  };

  const faehigkeit = erstelleFaehigkeit({ name: 'Laufen', beschreibung: '', farbe: '#34d399', icon: 'bike' });
  const wurzel = erstelleKnoten(faehigkeit.id, { titel: 'Locker laufen', beschreibung: '', elternId: null });
  const wurzelId = wurzel.knoten.find((knoten) => knoten.titel === 'Locker laufen')?.id ?? null;
  if (wurzelId === null) {
    throw new Error('Der erste Skill fehlt.');
  }
  erstelleKnoten(faehigkeit.id, { titel: 'Fünf Kilometer', beschreibung: '', elternId: wurzelId });
  erstelleKnoten(faehigkeit.id, { titel: 'Rücken schonen', beschreibung: '', elternId: null });

  const boss = (projektId: number, titel: string, deadline: string) => {
    const vorhaben = erstelleVorhaben(projektId, titel);
    aendereVorhaben(vorhaben.id, { boss: { deadline } });
  };
  boss(projekte.laufen, 'Zehn Kilometer', '2026-12-15');
  boss(projekte.ruecken, 'Rücken ruhig', '2026-12-20');
  boss(projekte.haushalt, 'Küche leer', '2026-12-28');
  erstelleVorhaben(projekte.lernen, 'Kapitel 3');
  erstelleVorhaben(projekte.haushalt, 'Lüften');

  for (let tage = EINTRAEGE - 1; tage >= 0; tage -= 1) {
    erstelleEintrag({
      projektId: projekte.laufen,
      vorlageId: laufen,
      vorhaben: null,
      abschluss: null,
      erkenntnis: '',
      stunden: 0.5,
      notiz: '',
      meilenstein: false,
      faehigkeitId: tage === 0 ? faehigkeit.id : null,
      datum: datumPlus(HEUTE, -tage),
    });
  }

  const zeitpunkt = leseJetzt().toISOString();
  for (const kennung of KOENNEN_REIHE) {
    hebeAttribut(attributId(kennung), xpBisLevel(ZIEL_LEVEL[kennung], LEVEL_KURVEN.attribut), zeitpunkt);
  }
  for (const kennung of STATUS_SICHTBAR) {
    hebeAttribut(attributId(kennung), xpBisLevel(2, LEVEL_KURVEN.status), zeitpunkt);
  }
  for (const projektId of Object.values(projekte)) {
    hebeProjekt(projektId, zeitpunkt);
  }
  const skillZiel = xpBisLevel(2, LEVEL_KURVEN.faehigkeit);
  const skillXp = eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM faehigkeit_xp WHERE faehigkeit_id = ?', faehigkeit.id)?.xp ?? 0;
  if (skillXp < skillZiel) {
    bucheFaehigkeitXp({ quelle: 'eintrag', faehigkeitId: faehigkeit.id, xp: skillZiel - skillXp, eintragId: null }, zeitpunkt);
  }
  schalteErfolgeFrei();
  schreibeBewertungNie();
  schreibeHinweisAngebotGesehen();
  pruefeStand();
}

function pruefeStand(): void {
  const level = ladeCharakterLevel();
  if (level.level !== LEVEL) {
    throw new Error(`Level ist ${level.level} bei ${level.xpGesamt} XP.`);
  }
  const klasse = ladeKlasse();
  if (klasse !== KLASSE) {
    throw new Error(`Klasse ist ${klasse}.`);
  }
  const koennen = ladeAttribute(false).filter((eintrag) => eintrag.typ === 'attribut');
  const reihe = koennen.slice(0, 3).map((eintrag) => eintrag.kennung).join(',');
  if (reihe !== 'koerper,disziplin,vitalitaet') {
    throw new Error(`Reihenfolge ist ${reihe}.`);
  }
  for (const eintrag of koennen) {
    if (eintrag.level.level < 2) {
      throw new Error(`${eintrag.kennung ?? eintrag.name} ist Level ${eintrag.level.level}.`);
    }
  }
  const status = ladeAttribute(false).filter((eintrag) => eintrag.typ === 'status').slice(0, 5);
  for (const eintrag of status) {
    if (eintrag.level.level < 2) {
      throw new Error(`${eintrag.kennung ?? eintrag.name} ist Level ${eintrag.level.level}.`);
    }
  }
  const eintraege = eine<{ n: number }>('SELECT COUNT(*) AS n FROM eintraege WHERE nur_abzug = 0')?.n ?? 0;
  if (eintraege !== EINTRAEGE) {
    throw new Error(`Einträge sind ${eintraege}.`);
  }
  const werte = koennen.flatMap((eintrag) =>
    eintrag.kennung === null ? [] : [{ kennung: eintrag.kennung, level: eintrag.level.level }],
  );
  const erwartet = bestimmeKlasse(werte);
  const summe = berechneLevel(level.xpGesamt, LEVEL_KURVEN.charakter).level;
  if (erwartet !== KLASSE || summe !== LEVEL) {
    throw new Error(`Prüfung ist ${erwartet}, Level ${summe}.`);
  }
}

async function main(): Promise<void> {
  setzeTestzeit(HEUTE);
  const welt = await legeAn();
  try {
    mitWelt(welt, legeInhaltAn);
  } finally {
    schliesseWelt(welt);
    schliesseZugang();
  }
}

if (path.basename(process.argv[1] ?? '') === 'infoseite-saat.ts') {
  main().catch((fehler: unknown) => {
    console.error(fehler instanceof Error ? fehler.message : fehler);
    process.exit(1);
  });
}
