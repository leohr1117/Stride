import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VERBINDUNGS_ARTEN,
  artAusSatz,
  artAusSpeicher,
  istVerbindungsFehlerArt,
  kurzgrund,
  loesung,
  type VerbindungsFehlerArt,
} from './verbindungsFehler.ts';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

const ALTSATZ: Record<string, VerbindungsFehlerArt> = {
  'Todoist lehnt den Token ab. Prüfe ihn in den Todoist-Einstellungen.': 'abgelehnt',
  'Todoist ist gerade nicht erreichbar.': 'netz',
  'Der Kalender ist gerade nicht erreichbar.': 'netz',
  'Todoist bremst gerade zu viele Anfragen. Der nächste Abgleich versucht es erneut.': 'bremse',
  'Der Kalender bremst gerade zu viele Anfragen. Der nächste Abgleich versucht es erneut.': 'bremse',
  'Todoist hat die Anfrage abgelehnt. Der nächste Abgleich versucht es erneut.': 'gegenstelle',
  'Todoist hat keine lesbare Antwort geschickt.': 'gegenstelle',
  'Todoist hat in einem unerwarteten Format geantwortet.': 'gegenstelle',
  'Der Kalender hat die Anfrage abgelehnt.': 'gegenstelle',
  'Die Kalender-Adresse ist keine gültige Internetadresse.': 'adresse',
  'Die Kalender-Adresse muss mit https:// oder webcal:// beginnen.': 'adresse',
  'Der Kalender lehnt den Zugriff ab. Prüfe die Adresse.': 'zugriff',
  'Unter dieser Adresse liegt kein Kalender.': 'fehlt',
  'Unter dieser Adresse liegt kein Kalender im iCal-Format.': 'kein_ics',
  'Der Kalender ist zu groß.': 'zu_gross',
};

function wuerfe(quelle: string, name: string): { satz: string; rest: string }[] {
  const muster = new RegExp(`\\b${name}\\(\\s*(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 'g');
  const fund: { satz: string; rest: string }[] = [];
  for (const treffer of quelle.matchAll(muster)) {
    const start = (treffer.index ?? 0) + treffer[0].length;
    const ende = quelle.indexOf(')', start);
    fund.push({ satz: treffer[2] ?? '', rest: quelle.slice(start, ende) });
  }
  return fund;
}

function artImRest(rest: string): string[] {
  return [...rest.matchAll(/art:\s*'([a-z_]+)'/g)].map((treffer) => treffer[1] ?? '');
}

describe('Fehlerart an der Wurfstelle', () => {
  it('trägt bei Todoist genau eine Art und erkennt den Satz als Rückfall', () => {
    const quelle = readFileSync(join(WURZEL, 'server/integrationen/todoist.ts'), 'utf8');
    const fund = wuerfe(quelle, 'TodoistFehler');
    expect(fund.length).toBeGreaterThan(0);
    for (const wurf of fund) {
      const arten = artImRest(wurf.rest);
      expect(arten).toHaveLength(1);
      expect(VERBINDUNGS_ARTEN).toContain(arten[0]);
      expect(artAusSatz(wurf.satz)).toBe(arten[0]);
    }
  });

  it('trägt beim Kalender genau eine Art als zweites Argument', () => {
    const quelle = readFileSync(join(WURZEL, 'server/features/verbindungen/kalender.ts'), 'utf8');
    const fund = wuerfe(quelle, 'ungueltig');
    expect(fund.length).toBeGreaterThan(0);
    for (const wurf of fund) {
      const treffer = /^,\s*'([a-z_]+)'$/.exec(wurf.rest.trim());
      expect(treffer?.[1]).toBeTruthy();
      expect(VERBINDUNGS_ARTEN).toContain(treffer?.[1]);
      expect(artAusSatz(wurf.satz)).toBe(treffer?.[1]);
    }
  });
});

describe('Rückfall über den Altsatz', () => {
  it('trifft jeden gespeicherten Satz genau einmal, auch mit Namen und Folgezeile', () => {
    expect(Object.keys(ALTSATZ).length).toBe(15);
    for (const [satz, art] of Object.entries(ALTSATZ)) {
      expect(artAusSatz(satz)).toBe(art);
      expect(artAusSatz(`Post: ${satz}`)).toBe(art);
      expect(artAusSatz(`${satz}\nweiter`)).toBe(art);
      expect(VERBINDUNGS_ARTEN.filter((kandidat) => artAusSatz(satz) === kandidat)).toEqual([art]);
    }
  });

  it('lässt Unbekanntes ohne Art und bevorzugt die gespeicherte Art', () => {
    expect(artAusSatz(null)).toBeNull();
    expect(artAusSatz('')).toBeNull();
    expect(artAusSatz('Unerwarteter Fehler beim Abgleich mit Todoist.')).toBeNull();
    expect(artAusSatz('Unerwarteter Fehler beim Abgleich mit dem Kalender.')).toBeNull();
    expect(artAusSpeicher('bremse', 'Todoist ist gerade nicht erreichbar.')).toBe('bremse');
    expect(artAusSpeicher(null, 'Todoist ist gerade nicht erreichbar.')).toBe('netz');
    expect(artAusSpeicher('schluessel', 'Todoist ist gerade nicht erreichbar.')).toBe('schluessel');
    expect(artAusSpeicher('foo', 'keine bekannte Meldung')).toBeNull();
    expect(istVerbindungsFehlerArt('schluessel')).toBe(true);
    expect(istVerbindungsFehlerArt('foo')).toBe(false);
    expect(istVerbindungsFehlerArt('netz')).toBe(true);
  });

  it('nennt zu jeder Art Kurzgrund und Lösung', () => {
    for (const art of VERBINDUNGS_ARTEN) {
      expect(kurzgrund(art).length).toBeGreaterThan(0);
      expect(loesung(art).length).toBeGreaterThan(0);
      expect(kurzgrund(art)).not.toBe(loesung(art));
    }
  });

  it('erkennt einen zu kurzen oder zu langen Token als Eingabe', () => {
    expect(artAusSatz('Der Todoist-Token ist zu kurz.')).toBe('eingabe');
    expect(artAusSatz('Der Todoist-Token ist zu lang.')).toBe('eingabe');
    expect(kurzgrund('eingabe')).toBe('Token unvollständig');
    expect(loesung('eingabe')).toBe('Kopiere den ganzen Token aus Todoist.');
    expect(istVerbindungsFehlerArt('eingabe')).toBe(true);
  });
});
