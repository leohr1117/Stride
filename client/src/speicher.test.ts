import { afterEach, describe, expect, it, vi } from 'vitest';
import { SICHERUNG_APP } from '../../shared/api/daten.ts';
import { gespeicherteFarben, gespeicherterStil } from './features/darstellung/stil.ts';
import { gespeicherteRichtung, speichereRichtung } from './features/vorbilder/vorbilderAuswahl.ts';
import { gespeicherterHinweis, merkeHinweis, SPEICHER_SCHLUESSEL } from './sprache.tsx';
import {
  leseMerker,
  leseSitzung,
  leseSitzungszahl,
  leseText,
  merke,
  merkeSitzung,
  merkeText,
  vergiss,
} from './speicher.ts';

function speicher(): Storage {
  const daten = new Map<string, string>();
  return {
    get length() {
      return daten.size;
    },
    clear() {
      daten.clear();
    },
    getItem(schluessel: string) {
      return daten.has(schluessel) ? (daten.get(schluessel) ?? null) : null;
    },
    key(index: number) {
      return [...daten.keys()][index] ?? null;
    },
    removeItem(schluessel: string) {
      daten.delete(schluessel);
    },
    setItem(schluessel: string, wert: string) {
      daten.set(schluessel, wert);
    },
  };
}

function einrichten(): { local: Storage; session: Storage } {
  const local = speicher();
  const session = speicher();
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
  return { local, session };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Speicher', () => {
  it('liest den alten Schlüssel und schreibt den neuen, ohne den alten zu löschen', () => {
    const { local } = einrichten();
    local.setItem('ascend.stil', 'jade');
    expect(leseText('stride.stil')).toBe('jade');
    expect(local.getItem('stride.stil')).toBe('jade');
    expect(local.getItem('ascend.stil')).toBe('jade');
  });

  it('lässt den neuen Schlüssel vor dem alten gelten', () => {
    const { local } = einrichten();
    local.setItem('ascend.basisEingeklappt', '1');
    local.setItem('stride.basisEingeklappt', '0');
    expect(leseMerker('stride.basisEingeklappt')).toBe(false);
    expect(local.getItem('ascend.basisEingeklappt')).toBe('1');
  });

  it('schreibt einen Merker nur unter den neuen Namen', () => {
    const { local } = einrichten();
    local.setItem('ascend.taetigkeitenGesehen', '0');
    merke('stride.taetigkeitenGesehen', true);
    expect(local.getItem('stride.taetigkeitenGesehen')).toBe('1');
    expect(local.getItem('ascend.taetigkeitenGesehen')).toBe('0');
    expect(leseMerker('stride.taetigkeitenGesehen')).toBe(true);
  });

  it('entfernt beim Vergessen den alten und den neuen Merker', () => {
    const { local } = einrichten();
    local.setItem('ascend.eingeklappt.ziele-archiv', '0');
    local.setItem('stride.eingeklappt.ziele-archiv', '0');
    vergiss('stride.eingeklappt.ziele-archiv');
    expect(local.getItem('stride.eingeklappt.ziele-archiv')).toBeNull();
    expect(local.getItem('ascend.eingeklappt.ziele-archiv')).toBeNull();
    expect(leseText('stride.eingeklappt.ziele-archiv')).toBeNull();
  });

  it('liest einen alten Sitzungs-Merker und schreibt den neuen', () => {
    const { session } = einrichten();
    session.setItem('ascend.hinweisAngebot', '1');
    expect(leseSitzung('stride.hinweisAngebot')).toBe(true);
    expect(session.getItem('stride.hinweisAngebot')).toBe('1');
    expect(session.getItem('ascend.hinweisAngebot')).toBe('1');
  });

  it('schaltet einen Sitzungs-Merker mitsamt dem alten Namen aus', () => {
    const { session } = einrichten();
    session.setItem('ascend.fragen.offen', '1');
    session.setItem('stride.fragen.offen', '1');
    merkeSitzung('stride.fragen.offen', false);
    expect(session.getItem('stride.fragen.offen')).toBeNull();
    expect(session.getItem('ascend.fragen.offen')).toBeNull();
    expect(leseSitzung('stride.fragen.offen')).toBe(false);
  });

  it('übernimmt eine alte Sitzungszahl', () => {
    const { session } = einrichten();
    session.setItem('ascend.neuGeladen', '1700000000000');
    expect(leseSitzungszahl('stride.neuGeladen')).toBe(1700000000000);
    expect(session.getItem('stride.neuGeladen')).toBe('1700000000000');
    expect(session.getItem('ascend.neuGeladen')).toBe('1700000000000');
  });

  it('lässt fremde Schlüssel stehen', () => {
    const { local } = einrichten();
    local.setItem('ascend_sitzung', 'token');
    local.setItem('fremd', 'bleibt');
    expect(leseText('ascend_sitzung')).toBe('token');
    expect(leseText('fremd')).toBe('bleibt');
    expect(local.getItem('stride_sitzung')).toBeNull();
    expect(local.getItem('stride.fremd')).toBeNull();
  });

  it('schreibt Text nur unter den neuen Namen', () => {
    const { local } = einrichten();
    local.setItem('ascend.glimmen', 'an');
    merkeText('stride.glimmen', 'aus');
    expect(local.getItem('stride.glimmen')).toBe('aus');
    expect(local.getItem('ascend.glimmen')).toBe('an');
    expect(leseText('stride.glimmen')).toBe('aus');
  });
});

describe('Sprache im Speicher', () => {
  it('nennt den neuen Schlüssel und liest den alten', () => {
    const { local } = einrichten();
    expect(SPEICHER_SCHLUESSEL).toBe('stride-sprache');
    local.setItem('ascend-sprache', 'ja');
    expect(gespeicherterHinweis()).toBe('ja');
    expect(local.getItem('stride-sprache')).toBe('ja');
    expect(local.getItem('ascend-sprache')).toBe('ja');
  });

  it('schreibt die gewählte Sprache unter den neuen Schlüssel', () => {
    const { local } = einrichten();
    local.setItem('ascend-sprache', 'de');
    merkeHinweis('en');
    expect(local.getItem('stride-sprache')).toBe('en');
    expect(local.getItem('ascend-sprache')).toBe('de');
    expect(gespeicherterHinweis()).toBe('en');
  });

  it('löscht beim Zurücksetzen den alten und den neuen Sprach-Schlüssel', () => {
    const { local } = einrichten();
    local.setItem('ascend-sprache', 'fr');
    local.setItem('stride-sprache', 'fr');
    merkeHinweis(null);
    expect(local.getItem('stride-sprache')).toBeNull();
    expect(local.getItem('ascend-sprache')).toBeNull();
    expect(gespeicherterHinweis()).toBeNull();
  });

  it('nimmt einen ungültigen Eintrag nicht als Sprache', () => {
    const { local } = einrichten();
    local.setItem('ascend-sprache', 'kein');
    expect(gespeicherterHinweis()).toBeNull();
    expect(local.getItem('stride-sprache')).toBe('kein');
  });

  it('gibt null zurück, wenn der Speicher fehlt', () => {
    vi.stubGlobal('window', {});
    expect(gespeicherterHinweis()).toBeNull();
    merkeHinweis('de');
    expect(gespeicherterHinweis()).toBeNull();
  });
});

describe('Ansicht und Vorbilder', () => {
  it('liest die frühere Ansicht', () => {
    const { local } = einrichten();
    local.setItem('ascend.stil', 'jade');
    expect(gespeicherterStil()).toBe('jade');
    expect(local.getItem('stride.stil')).toBe('jade');
    expect(local.getItem('ascend.stil')).toBe('jade');
  });

  it('liest frühere eigene Farben', () => {
    const { local } = einrichten();
    local.setItem('ascend.primaer', '#112233');
    local.setItem('ascend.akzent', '#445566');
    local.setItem('ascend.hintergrund', '#778899');
    expect(gespeicherteFarben()).toEqual({ primaer: '#112233', akzent: '#445566', hintergrund: '#778899' });
    expect(local.getItem('stride.primaer')).toBe('#112233');
    expect(local.getItem('stride.akzent')).toBe('#445566');
    expect(local.getItem('stride.hintergrund')).toBe('#778899');
    expect(local.getItem('ascend.primaer')).toBe('#112233');
  });

  it('behält die Vorbild-Richtung aus dem alten Sitzungs-Schlüssel', () => {
    const { session } = einrichten();
    session.setItem('ascend.vorbilder.richtung', 'Körper');
    expect(gespeicherteRichtung()).toBe('Körper');
    expect(session.getItem('stride.vorbilder.richtung')).toBe('Körper');
    expect(session.getItem('ascend.vorbilder.richtung')).toBe('Körper');
    speichereRichtung('alle');
    expect(session.getItem('stride.vorbilder.richtung')).toBeNull();
    expect(session.getItem('ascend.vorbilder.richtung')).toBeNull();
  });
});

describe('Namen, die bleiben', () => {
  it('lässt den Sicherungsnamen unverändert', () => {
    expect(SICHERUNG_APP).toBe('ascend');
  });
});
