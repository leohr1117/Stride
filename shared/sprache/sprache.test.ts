import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ATTRIBUT_KATALOG } from '../features/attribute/attributKatalog.ts';
import { ebenenSperre, funktionsSperre } from '../spiel/abhaengigkeiten.ts';
import {
  ATTRIBUT_TYP_INFO,
  DAUER_OPTIONEN,
  DREYFUS_STUFEN,
  VORHABEN_STATUS_LABEL,
} from '../spiel/begriffe.ts';
import { ZIEL_MARKE } from '../spiel/ebenen.ts';
import { ERFOLGE } from '../spiel/erfolge.ts';
import { FUNKTION_BLOECKE } from '../spiel/funktionen.ts';
import { MEHR_BEREICHE } from '../spiel/mehrBereiche.ts';
import { UEBERSICHT_KARTEN } from '../spiel/uebersichtKarten.ts';
import { ARCHETYP, KLASSE } from '../spiel/klassen.ts';
import { VISION_BEISPIELE } from '../spiel/orientierung.ts';
import { FOKUS_IDS, FOKUS_LISTE, FOKUS_PFLICHT, START_TAETIGKEITEN, startTaetigkeiten, ZIEL_FRAGE, ZIELSTREBIGKEIT_INFO, ZIELSTREBIGKEITEN } from '../spiel/profil.ts';
import { VERFALL_STUFE_LABEL, VERFALL_STUFEN } from '../spiel/belastung.ts';
import { STIL_INFO, STILE } from '../features/darstellung/stile.ts';
import { PERSONEN, RICHTUNGEN } from '../features/vorbilder/vorbildKatalog.ts';
import { NAMEN_INFO } from '../spiel/aufgabe.ts';
import {
  BOSS_BELOHNUNG_INFO,
  BOSS_DATUM_INFO,
  BOSS_SCHALTER,
  GEGNER_INFO,
  INVESTITION_INFO,
  MEILENSTEIN_INFO,
  RESSOURCEN_INFO,
  RESSOURCEN_SCHALTER,
} from '../spiel/xp.ts';
import { ABSCHNITTE, VERSIONEN } from '../versionen.ts';
import { localeFuer, platzhalter, SPRACH_NAME, spracheAusBrowser, spracheAusKopf, ZIEL_SPRACHEN } from './kern.ts';
import { MENGEN_PAARE } from './menge.ts';
import {
  allePaare,
  gleicherKatalogtext,
  hatSchluessel,
  klasseAnzeigen,
  setzeAktiveSprache,
  texteDer,
  zeige,
  zeigeAttributName,
  zeigeKatalogname,
} from './index.ts';

const WURZEL = join(import.meta.dirname, '../..');

function dateien(ordner: string, endung: RegExp): string[] {
  const ergebnis: string[] = [];
  for (const name of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, name.name);
    if (name.isDirectory()) {
      ergebnis.push(...dateien(pfad, endung));
    } else if (endung.test(name.name) && !name.name.includes('.test.')) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

function stringLiterale(text: string, aufruf: string, mitStatus = false): string[] {
  const fund: string[] = [];
  const prefix = mitStatus ? '(?:\\d+\\s*,\\s*)?' : '';
  const muster = new RegExp(`\\b${aufruf}\\(\\s*${prefix}(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 'g');
  for (const treffer of text.matchAll(muster)) {
    fund.push(treffer[2] ?? '');
  }
  return fund;
}

function katalogTexte(): string[] {
  const texte: string[] = [...ABSCHNITTE];
  for (const eintrag of VERSIONEN) {
    texte.push(...eintrag.seiten.split(', '));
    if (eintrag.behoben) {
      texte.push(...eintrag.behoben.split(', '));
    }
    for (const abschnitt of eintrag.abschnitte) {
      texte.push(abschnitt.titel, ...abschnitt.punkte);
    }
  }
  for (const vorlage of ATTRIBUT_KATALOG) {
    texte.push(vorlage.name, vorlage.beschreibung);
  }
  for (const person of PERSONEN) {
    texte.push(person.bekanntFuer, person.beschreibung);
    for (const station of person.stationen) {
      texte.push(station[2]);
    }
  }
  texte.push(...RICHTUNGEN);
  for (const erfolg of ERFOLGE) {
    texte.push(erfolg.label);
    for (const stufe of erfolg.stufen) {
      texte.push(stufe.name);
    }
  }
  for (const block of FUNKTION_BLOECKE) {
    texte.push(block.seite);
    for (const eintrag of block.eintraege) {
      texte.push(eintrag.label);
    }
  }
  texte.push(ZIEL_FRAGE, FOKUS_PFLICHT);
  for (const id of ZIELSTREBIGKEITEN) {
    texte.push(ZIELSTREBIGKEIT_INFO[id].titel, ZIELSTREBIGKEIT_INFO[id].text);
  }
  for (const fokus of FOKUS_LISTE) {
    texte.push(fokus.label, fokus.text);
  }
  texte.push(...startTaetigkeiten(FOKUS_IDS).map((taetigkeit) => taetigkeit.name));
  for (const marke of Object.values(ZIEL_MARKE)) {
    texte.push(marke.name, marke.mehrzahl, marke.kuerzel, marke.leer);
  }
  texte.push(...Object.values(VORHABEN_STATUS_LABEL));
  texte.push(...DAUER_OPTIONEN.map((option) => option.label));
  texte.push(...DREYFUS_STUFEN.map((stufe) => stufe.name));
  for (const info of Object.values(ATTRIBUT_TYP_INFO)) {
    texte.push(info.label, info.mehrzahl);
  }
  texte.push(KLASSE.startKlasse, KLASSE.ausgeglichen);
  for (const archetyp of Object.values(ARCHETYP)) {
    texte.push(archetyp.name, archetyp.beiname);
  }
  texte.push(...VISION_BEISPIELE.map((beispiel) => beispiel.titel));
  for (const stil of STILE) {
    texte.push(STIL_INFO[stil].label);
  }
  for (const stufe of VERFALL_STUFEN) {
    texte.push(VERFALL_STUFE_LABEL[stufe]);
  }
  texte.push(
    MEILENSTEIN_INFO,
    BOSS_SCHALTER,
    BOSS_DATUM_INFO,
    BOSS_BELOHNUNG_INFO,
    GEGNER_INFO,
    NAMEN_INFO,
    INVESTITION_INFO,
    RESSOURCEN_INFO,
    RESSOURCEN_SCHALTER,
  );
  texte.push(
    'Tägliche Aufgaben zum Abhaken.',
    'Ungenutzte Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
    'Speichern ergänzt fehlende Attribute, archiviert andere und legt fehlende Starter-Tätigkeiten an.',
    'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.',
  );
  const funktionen = {
    koennen: true,
    status: false,
    faehigkeiten: false,
    ausruestung: false,
    basis: false,
    chronik: false,
    vorbilder: false,
    rueckblick: false,
    statistiken: false,
    handbuch: false,
    bossAngriffe: true,
    verfallKoennen: true,
    verfallHaben: true,
  };
  const ebenen = { visionen: true, organisationen: true, projekte: false, vorhaben: false };
  for (const funktion of Object.keys(funktionen) as (keyof typeof funktionen)[]) {
    const text = funktionsSperre(funktion, funktionen, ebenen, { disziplin: false, ressourcen: false });
    if (text) {
      texte.push(text);
    }
  }
  const organisation = ebenenSperre('organisationen', ebenen);
  if (organisation) {
    texte.push(organisation);
  }
  texte.push('Karten');
  for (const bereich of MEHR_BEREICHE) {
    texte.push(bereich.label);
  }
  for (const karte of UEBERSICHT_KARTEN) {
    texte.push(karte.label);
  }
  return texte;
}

describe('sprachen', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('erkennt die Browsersprache und fällt sonst auf Deutsch zurück', () => {
    expect(spracheAusBrowser(['it-IT', 'en-GB'])).toBe('en');
    expect(spracheAusBrowser(['de-AT,de;q=0.9'])).toBe('de');
    expect(spracheAusBrowser(['fr-FR', 'en-GB'])).toBe('fr');
    expect(spracheAusBrowser(['es-MX'])).toBe('es');
    expect(spracheAusBrowser(['ru'])).toBe('ru');
    expect(spracheAusBrowser(['zh-Hans', 'en'])).toBe('zh');
    expect(spracheAusBrowser(['ja-JP'])).toBe('ja');
    expect(spracheAusBrowser(['pt-BR', 'it'])).toBe('de');
    expect(spracheAusKopf('en-US,en;q=0.8')).toBe('en');
    expect(spracheAusKopf('fr-CH, en;q=0.8')).toBe('fr');
    expect(localeFuer('en')).toBe('en-US');
    expect(localeFuer('de')).toBe('de-DE');
    expect(localeFuer('es')).toBe('es-ES');
    expect(localeFuer('fr')).toBe('fr-FR');
    expect(localeFuer('ru')).toBe('ru-RU');
    expect(localeFuer('zh')).toBe('zh-CN');
    expect(localeFuer('ja')).toBe('ja-JP');
    expect(SPRACH_NAME.es).toBe('Español');
    expect(SPRACH_NAME.fr).toBe('Français');
    expect(SPRACH_NAME.ru).toBe('Русский');
    expect(SPRACH_NAME.zh).toBe('中文');
    expect(SPRACH_NAME.ja).toBe('日本語');
  });

  it('hat für jeden deutschen Text jede Sprache mit denselben Platzhaltern', () => {
    const deutsch = [...allePaare()];
    expect(deutsch.length).toBeGreaterThan(100);
    for (const sprache of ZIEL_SPRACHEN) {
      const texte = texteDer(sprache);
      const fehlend: string[] = [];
      for (const [schluessel, englisch] of deutsch) {
        expect(schluessel.trim()).toBe(schluessel);
        expect(englisch.trim()).toBe(englisch);
        const text = texte.get(schluessel);
        if (!text) {
          fehlend.push(schluessel);
          continue;
        }
        expect(text.trim()).toBe(text);
        expect(text.length).toBeGreaterThan(0);
        expect(platzhalter(text)).toEqual(platzhalter(schluessel));
      }
      expect(fehlend).toEqual([]);
    }
  });

  it('übersetzt bekannte Texte und lässt Nutzdaten stehen', () => {
    setzeAktiveSprache('en');
    expect(zeige('Übersicht')).toBe('Overview');
    expect(zeige('Mein eigenes Projekt')).toBe('Mein eigenes Projekt');
    expect(zeige('Anfrage fehlgeschlagen (Status {status}).', 'en', { status: 500 })).toBe('Request failed (status 500).');
    expect(zeige('Anfrage fehlgeschlagen (Status 500).')).toBe('Request failed (status 500).');
    expect(zeige('Ansehen', 'en')).toBe('View');
    expect(zeige('Status Ansehen', 'en')).toBe('Reputation');
    expect(zeigeKatalogname('Ansehen', 'de')).toBe('Ansehen');
    expect(zeigeKatalogname('Ansehen', 'en')).toBe('Reputation');
    expect(zeigeKatalogname('Ansehen', 'es')).toBe('Reputación');
    expect(gleicherKatalogtext('Ansehen', 'View')).toBe(true);
    expect(gleicherKatalogtext('Ansehen', 'Reputation')).toBe(true);
    expect(zeigeAttributName({ kennung: 'ansehen', name: 'Ansehen' }, 'en')).toBe('Reputation');
    expect(zeigeAttributName({ kennung: 'ansehen', name: 'Reputation' }, 'de')).toBe('Ansehen');
    expect(zeigeAttributName({ kennung: 'ansehen', name: 'View' }, 'de')).toBe('Ansehen');
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Körper' })).toBe('Body');
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Krafttraining' })).toBe('Krafttraining');
    expect(zeigeAttributName({ name: 'Eigenes Attribut' })).toBe('Eigenes Attribut');
    expect(klasseAnzeigen('Besonnener Athlet')).toBe('Steady Athlete');
    expect(klasseAnzeigen('Besonnener Athlet', 'es')).toBe(`${zeige('Athlet', 'es')} ${zeige('Besonnener', 'es')}`);
    expect(klasseAnzeigen('Besonnener Athlet', 'fr')).toBe(`${zeige('Athlet', 'fr')} ${zeige('Besonnener', 'fr')}`);
    expect(klasseAnzeigen('Besonnener Athlet', 'ru')).toBe(`${zeige('Besonnener', 'ru')} ${zeige('Athlet', 'ru')}`);
    expect(klasseAnzeigen('Besonnener Athlet', 'zh')).toBe(`${zeige('Besonnener', 'zh')}的${zeige('Athlet', 'zh')}`);
    expect(klasseAnzeigen('Besonnener Athlet', 'ja')).toBe(`${zeige('Besonnener', 'ja')}${zeige('Athlet', 'ja')}`);
    expect(klasseAnzeigen('Eigene Klasse')).toBe('Eigene Klasse');
    setzeAktiveSprache('de');
    expect(zeige('Übersicht')).toBe('Übersicht');
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Körper' })).toBe('Körper');
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Body' }, 'de')).toBe('Körper');
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Body' }, 'fr')).toBe(zeige('Körper', 'fr'));
    expect(zeigeAttributName({ kennung: 'koerper', name: 'Krafttraining' }, 'en')).toBe('Krafttraining');
    expect(zeige('Laufen', 'en')).toBe('Running');
    expect(zeige('Laufen', 'fr')).toBe('Courir');
    expect(zeige('Training', 'es')).toBe('Entrenamiento');
    expect(zeige('Sparen', 'zh')).toBe('存钱');
    expect(zeige('Dehnen', 'ja')).toBe('ストレッチ');
    expect(zeige('Anfangen', 'ru')).toBe('Начать');
  });

  it('hält jede Start-Tätigkeit in jeder Sprache eindeutig', () => {
    for (const sprache of ['de', ...ZIEL_SPRACHEN] as const) {
      const namen = startTaetigkeiten(FOKUS_IDS).map((taetigkeit) => zeige(taetigkeit.name, sprache));
      expect(new Set(namen).size, sprache).toBe(namen.length);
    }
    expect(START_TAETIGKEITEN.lernen.some((taetigkeit) => taetigkeit.name === 'Lernen')).toBe(true);
  });

  it('deckt Katalog, Changelog, Vorbilder und jede tx-Stelle in jeder Sprache ab', () => {
    const fehlend = new Set<string>();
    let aufrufe = 0;
    for (const text of katalogTexte()) {
      if (!hatSchluessel(text)) {
        fehlend.add(text);
        continue;
      }
      for (const sprache of ZIEL_SPRACHEN) {
        const ziel = texteDer(sprache).get(text);
        if (!ziel) {
          fehlend.add(`${sprache}: ${text}`);
        } else {
          expect(platzhalter(ziel)).toEqual(platzhalter(text));
        }
      }
    }
    const wurzeln = [join(WURZEL, 'client/src'), join(WURZEL, 'server')];
    for (const wurzel of wurzeln) {
      for (const datei of dateien(wurzel, /\.tsx?$/)) {
        const quelle = readFileSync(datei, 'utf8');
        const aufruf = [...stringLiterale(quelle, 'tx'), ...stringLiterale(quelle, 'zeige')];
        aufrufe += aufruf.length;
        for (const text of aufruf) {
          if (!hatSchluessel(text)) {
            fehlend.add(text);
          }
        }
        for (const text of [...stringLiterale(quelle, 'AppFehler', true), ...stringLiterale(quelle, 'TodoistFehler', true)]) {
          if (!text.includes('${') && !hatSchluessel(text)) {
            fehlend.add(text);
          }
        }
      }
    }
    expect(aufrufe).toBeGreaterThan(100);
    expect([...fehlend].sort()).toEqual([]);
  });

  it('übersetzt zusammengesetzte Beschriftungen', () => {
    expect(zeige('Archiv anzeigen (4)', 'en')).toBe('Show archive (4)');
    expect(zeige('Alle anzeigen (3)', 'en')).toBe('Show all (3)');
    expect(zeige('Level · Beute 120 XP', 'en')).toBe('Level · loot 120 XP');
    expect(zeige('KW 12', 'en')).toBe('Week 12');
    expect(zeige('KW {woche} · ab {datum}', 'en', { woche: 12, datum: '1. Jan.' })).toBe('Week 12 · from 1. Jan.');
    expect(zeige('Bester Tag · {datum}', 'en', { datum: '1. Jan.' })).toBe('Best day · 1. Jan.');
    expect(zeige('Abgeglichen {zeit}', 'es', { zeit: '12:00' })).toBe('Sincronizado 12:00');
    expect(zeige('Aktiv · {bonus}', 'fr', { bonus: '+10 %' })).toBe('Actif · +10 %');
    expect(zeige('Freigeschaltet am {datum}', 'en', { datum: '1. Jan.' })).toBe('Unlocked on 1. Jan.');
    expect(zeige('{aktion} · ca. +{xp} XP', 'en', { aktion: 'Log', xp: '40' })).toBe('Log · about +40 XP');
    expect(zeige('{aktion} · ca. +{xp} XP + Meilenstein', 'en', { aktion: 'Log', xp: '40' })).toBe(
      'Log · about +40 XP + milestone',
    );
    expect(zeige('Speichern · +{xp} {name}', 'en', { xp: '50', name: 'Mind' })).toBe('Save · +50 Mind');
    expect(zeige('Neue {name}', 'es', { name: zeige('Vision', 'es') })).toBe('Nueva Visión');
    expect(zeige('Neues {name}', 'fr', { name: zeige('Projekt', 'fr') })).toBe('Nouveau Projet');
    expect(zeige('{name} bearbeiten', 'en', { name: 'Run' })).toBe('Edit Run');
    expect(zeige('{name} in {organisation}', 'ja', { name: zeige('Projekt', 'ja'), organisation: 'Haus' })).toBe(
      'Hausのプロジェクト',
    );
    const schluessel = [
      'Gesamt',
      'Di',
      'Do',
      'Sa',
      'So',
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
      'Sonntag',
    ];
    for (const sprache of ZIEL_SPRACHEN) {
      for (const text of schluessel) {
        expect(zeige(text, sprache), `${sprache} ${text}`).not.toBe(text);
      }
    }
    expect(zeige('Gesamt', 'en')).toBe('All');
    expect(zeige('Di', 'en')).toBe('Tue');
    expect(zeige('Sonntag', 'ja')).toBe('日曜日');
  });

  it('verlangt zu jeder Mengen-Mehrzahl eine Einzahl', () => {
    const muster = /\{[a-zA-Z0-9]+\} (Tage|Monate|Jahre|Einträge|Stunden)\b/;
    const paare = new Map(MENGEN_PAARE.map((paar) => [paar.mehrzahl, paar.einzahl]));
    const ohne: string[] = [];
    for (const [schluessel] of allePaare()) {
      if (!muster.test(schluessel)) continue;
      const einzahl = paare.get(schluessel);
      if (!einzahl || einzahl === schluessel || !hatSchluessel(einzahl) || muster.test(einzahl)) {
        ohne.push(schluessel);
      }
    }
    expect(ohne).toEqual([]);
  });
});
