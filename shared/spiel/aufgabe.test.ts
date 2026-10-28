import { describe, expect, it } from 'vitest';
import {
  BOSS_BRAUCHT_MEILENSTEIN,
  DEADLINE_NUR_GEGNER_ODER_BOSS,
  DEADLINE_VERGANGEN,
  GEGNER_ODER_BOSS_EINMALIG,
  GEGNER_SCHLIESST_AUS,
  PRIORITAET_FORMAT,
  UHRZEIT_BRAUCHT_DATUM,
  UHRZEIT_FORMAT,
  WIEDERHOLUNG_BRAUCHT_DATUM,
  WIEDERHOLUNG_UNBEKANNT,
  WOCHENTAG_FORMAT,
  WOCHENTAG_PFLICHT,
  ALS_NAECHSTES_TAGE,
  bereiteAufgabe,
  erscheintAlsNaechstes,
  erscheintAufHeute,
  istEinmaligErledigt,
  naechstesDatum,
  sortiereAufgaben,
  type AufgabeFelder,
  type HeuteSicht,
} from './aufgabe.ts';
import { ausTagesSchluessel, DATUM_HINWEIS, datumInZone, lokalesDatum, plusTage, uhrInZone } from './datum.ts';

const HEUTE = '2026-10-23';

function felder(teil: Partial<AufgabeFelder> = {}): AufgabeFelder {
  return {
    faelligAm: null,
    faelligUm: null,
    wiederholung: 'keine',
    wochentage: [],
    prioritaet: null,
    nurHeute: false,
    meilenstein: false,
    gegner: false,
    boss: false,
    deadline: null,
    ...teil,
  };
}

function termin(teil: Partial<AufgabeFelder> = {}, bisherigeDeadline: string | null = null) {
  return bereiteAufgabe(felder(teil), HEUTE, bisherigeDeadline);
}

describe('datumInZone', () => {
  const lokal = new Date(2026, 9, 23, 15, 45, 0);

  it('fällt ohne Zone oder bei einer ungültigen Zone auf lokalesDatum zurück', () => {
    expect(datumInZone(lokal, null)).toBe('2026-10-23');
    expect(datumInZone(lokal, '   ')).toBe(lokalesDatum(lokal));
    expect(datumInZone(lokal, 'Kein/Zone')).toBe(lokalesDatum(lokal));
  });

  it('nimmt den Kalendertag der Zone, auch über Mitternacht', () => {
    const spaet = new Date('2026-10-23T23:30:00.000Z');
    expect(datumInZone(spaet, 'UTC')).toBe('2026-10-23');
    expect(datumInZone(spaet, 'Europe/Berlin')).toBe('2026-10-24');

    const frueh = new Date('2026-10-24T02:30:00.000Z');
    expect(datumInZone(frueh, 'UTC')).toBe('2026-10-24');
    expect(datumInZone(frueh, 'America/Los_Angeles')).toBe('2026-10-23');
  });
});

describe('uhrInZone', () => {
  const sommer = new Date('2026-07-15T21:30:00.000Z');
  const winter = new Date('2026-01-15T21:30:00.000Z');

  it('fällt ohne Zone oder bei einer ungültigen Zone auf die Ortszeit zurück', () => {
    const lokal = new Date(2026, 6, 15, 9, 5, 0);
    expect(uhrInZone(lokal, null)).toEqual({ stunde: 9, minute: 5 });
    expect(uhrInZone(lokal, '   ')).toEqual({ stunde: 9, minute: 5 });
    expect(uhrInZone(lokal, 'Kein/Zone')).toEqual({ stunde: lokal.getHours(), minute: lokal.getMinutes() });
  });

  it('liest Stunde und Minute der Zone, auch über Mitternacht', () => {
    expect(uhrInZone(new Date('2026-07-15T00:00:00.000Z'), 'UTC')).toEqual({ stunde: 0, minute: 0 });
    expect(uhrInZone(new Date('2026-07-15T08:00:00.000Z'), 'UTC')).toEqual({ stunde: 8, minute: 0 });
    expect(uhrInZone(sommer, 'Europe/Berlin')).toEqual({ stunde: 23, minute: 30 });
    expect(uhrInZone(sommer, 'America/Los_Angeles')).toEqual({ stunde: 14, minute: 30 });
    expect(uhrInZone(winter, 'Europe/Berlin')).toEqual({ stunde: 22, minute: 30 });
  });
});

describe('naechstesDatum', () => {
  it('folgt den Beispielen vom 2026-10-23', () => {
    expect(naechstesDatum('taeglich', '2026-10-20', HEUTE)).toBe('2026-10-24');
    expect(naechstesDatum('woechentlich', '2026-10-21', HEUTE, [1, 3])).toBe('2026-10-26');
    expect(naechstesDatum('monatlich', '2026-10-31', HEUTE, [], 31)).toBe('2026-11-30');
    expect(naechstesDatum('keine', null, HEUTE)).toBeNull();
  });

  it('macht dieselbe Aufgabe heute nicht wieder fällig und gibt nur ein Datum zurück', () => {
    expect(naechstesDatum('taeglich', HEUTE, HEUTE)).toBe('2026-10-24');
    expect(naechstesDatum('woechentlich', '2026-10-21', '2026-10-21', [1, 3])).toBe('2026-10-26');
    expect(naechstesDatum('taeglich', '2026-10-25', HEUTE)).toBe('2026-10-26');
  });

  it('springt kalendertagsweise über Monatsgrenzen und die Zeitumstellung', () => {
    expect(naechstesDatum('taeglich', '2026-10-31', '2026-10-31')).toBe('2026-11-01');
    expect(naechstesDatum('taeglich', '2026-10-24', '2026-10-24')).toBe('2026-10-25');
    expect(naechstesDatum('taeglich', '2026-10-25', '2026-10-25')).toBe('2026-10-26');
  });

  it('nimmt bei der Woche den nächsten ISO-Tag und die Reihenfolge der Tage ist egal', () => {
    expect(naechstesDatum('woechentlich', '2026-10-23', HEUTE, [3, 1])).toBe('2026-10-26');
    expect(naechstesDatum('woechentlich', '2026-10-21', HEUTE, [3])).toBe('2026-10-28');
    expect(naechstesDatum('woechentlich', '2026-10-25', '2026-10-25', [7])).toBe('2026-11-01');
    expect(naechstesDatum('woechentlich', '2026-12-31', '2026-12-31', [1])).toBe('2027-01-04');
    expect(naechstesDatum('woechentlich', '2026-10-05', HEUTE, [1])).toBe('2026-10-26');
    expect(naechstesDatum('woechentlich', HEUTE, HEUTE, [])).toBeNull();
  });

  it('hält den Monatstag und nimmt den letzten Tag, wenn der Monat kürzer ist', () => {
    expect(naechstesDatum('monatlich', '2026-01-31', '2026-01-31', [], 31)).toBe('2026-02-28');
    expect(naechstesDatum('monatlich', '2024-01-31', '2024-01-31', [], 31)).toBe('2024-02-29');
    expect(naechstesDatum('monatlich', '2026-02-28', '2026-02-28', [], 31)).toBe('2026-03-31');
    expect(naechstesDatum('monatlich', '2024-02-29', '2024-02-29', [], 29)).toBe('2024-03-29');
    expect(naechstesDatum('monatlich', '2026-01-31', HEUTE, [], 31)).toBe('2026-10-31');
    expect(naechstesDatum('monatlich', '2026-12-31', '2026-12-31', [], 31)).toBe('2027-01-31');
    expect(naechstesDatum('monatlich', '2026-10-15', HEUTE, [], null)).toBe('2026-11-15');
    expect(naechstesDatum('monatlich', '2026-10-31', HEUTE, [], 0)).toBeNull();
  });

  it('gibt ohne gültiges Vorkommen kein Datum zurück', () => {
    expect(naechstesDatum('taeglich', null, HEUTE)).toBeNull();
    expect(naechstesDatum('taeglich', '2026-02-31', HEUTE)).toBeNull();
    expect(naechstesDatum('keine', '2026-10-23', HEUTE)).toBeNull();
  });
});

describe('bereiteAufgabe', () => {
  it('leert mit Nur heute Datum, Uhrzeit, Wiederholung, Wochentage und Monatstag', () => {
    const ergebnis = termin({
      nurHeute: true,
      faelligAm: '2026-10-27',
      faelligUm: '09:00',
      wiederholung: 'woechentlich',
      wochentage: [1, 3],
      deadline: '2026-10-30',
      gegner: true,
    });
    expect(ergebnis).toEqual({
      ok: true,
      termin: {
        faelligAm: null,
        faelligUm: null,
        wiederholung: 'keine',
        wochentage: [],
        monatstag: null,
        prioritaet: null,
        nurHeuteAm: HEUTE,
        meilenstein: false,
        gegner: true,
        boss: false,
        deadline: '2026-10-30',
      },
    });
  });

  it('leert die Nadel, sobald ein Datum gesetzt ist', () => {
    const ergebnis = termin({ faelligAm: '2026-10-27', faelligUm: ' 09:00 ', wiederholung: 'monatlich' });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) {
      return;
    }
    expect(ergebnis.termin.nurHeuteAm).toBeNull();
    expect(ergebnis.termin.faelligAm).toBe('2026-10-27');
    expect(ergebnis.termin.faelligUm).toBe('09:00');
    expect(ergebnis.termin.monatstag).toBe(27);
    expect(ergebnis.termin.wochentage).toEqual([]);
  });

  it('übernimmt bei monatlich den Tag des Datums und sortiert die Wochentage', () => {
    const monat = termin({ faelligAm: '2026-10-31', wiederholung: 'monatlich', wochentage: [1] });
    const woche = termin({ faelligAm: '2026-10-27', wiederholung: 'woechentlich', wochentage: [3, 1, 1] });
    expect(monat.ok && monat.termin.monatstag).toBe(31);
    expect(monat.ok && monat.termin.wochentage).toEqual([]);
    expect(woche.ok && woche.termin.wochentage).toEqual([1, 3]);
    expect(woche.ok && woche.termin.monatstag).toBeNull();
  });

  it('lässt einen Meilenstein wiederholen und eine Uhrzeit nur mit Datum zu', () => {
    expect(termin({ faelligAm: '2026-10-27', wiederholung: 'taeglich', meilenstein: true }).ok).toBe(true);
    expect(termin({ faelligAm: '2026-10-27', faelligUm: '18:30', gegner: true, deadline: '2026-10-28' }).ok).toBe(true);
    expect(termin({ faelligAm: '2026-10-20', meilenstein: true, boss: true, deadline: HEUTE }).ok).toBe(true);
  });

  it('lehnt eine Uhrzeit ohne Datum ab', () => {
    expect(termin({ faelligUm: '09:00' })).toEqual({ ok: false, fehler: UHRZEIT_BRAUCHT_DATUM });
    expect(termin({ faelligUm: '9:00' })).toEqual({ ok: false, fehler: UHRZEIT_FORMAT });
    expect(termin({ faelligAm: '2026-10-27', faelligUm: '24:00' })).toEqual({ ok: false, fehler: UHRZEIT_FORMAT });
  });

  it('lehnt Wiederholung ohne Datum und eine Woche ohne Tag ab', () => {
    expect(termin({ wiederholung: 'taeglich' })).toEqual({ ok: false, fehler: WIEDERHOLUNG_BRAUCHT_DATUM });
    expect(termin({ wiederholung: 'woechentlich', faelligAm: '2026-10-27' })).toEqual({ ok: false, fehler: WOCHENTAG_PFLICHT });
    expect(termin({ wiederholung: 'woechentlich', faelligAm: '2026-10-27', wochentage: [0, 8] })).toEqual({
      ok: false,
      fehler: WOCHENTAG_FORMAT,
    });
    expect(termin({ faelligAm: '2026-02-31' })).toEqual({ ok: false, fehler: 'Das Datum 2026-02-31 existiert nicht.' });
    expect(termin({ faelligAm: '27.10.2026' })).toEqual({ ok: false, fehler: DATUM_HINWEIS });
  });

  it('lehnt Priorität außerhalb 1 bis 4 und eine unbekannte Wiederholung ab', () => {
    expect(termin({ prioritaet: 0 })).toEqual({ ok: false, fehler: PRIORITAET_FORMAT });
    expect(termin({ prioritaet: 5 })).toEqual({ ok: false, fehler: PRIORITAET_FORMAT });
    expect(termin({ prioritaet: 1 }).ok).toBe(true);
    const unbekannt = felder();
    (unbekannt as { wiederholung: string }).wiederholung = 'jaehrlich';
    expect(bereiteAufgabe(unbekannt, HEUTE)).toEqual({ ok: false, fehler: WIEDERHOLUNG_UNBEKANNT });
  });

  it('schließt Gegner gegen Meilenstein und Boss aus und lässt ihn nur einmal zu', () => {
    expect(termin({ gegner: true, meilenstein: true })).toEqual({ ok: false, fehler: GEGNER_SCHLIESST_AUS });
    expect(termin({ gegner: true, boss: true, meilenstein: true })).toEqual({ ok: false, fehler: GEGNER_SCHLIESST_AUS });
    expect(termin({ gegner: true, faelligAm: '2026-10-27', wiederholung: 'woechentlich', wochentage: [1] })).toEqual({
      ok: false,
      fehler: GEGNER_ODER_BOSS_EINMALIG,
    });
    expect(termin({ gegner: true }).ok).toBe(true);
  });

  it('verlangt für einen Boss einen Meilenstein und eine einmalige Wiederholung', () => {
    expect(termin({ boss: true })).toEqual({ ok: false, fehler: BOSS_BRAUCHT_MEILENSTEIN });
    expect(termin({ boss: true, meilenstein: true, faelligAm: '2026-10-27', wiederholung: 'taeglich' })).toEqual({
      ok: false,
      fehler: GEGNER_ODER_BOSS_EINMALIG,
    });
  });

  it('lässt eine Deadline nur bei Gegner oder Boss zu und keine neue in der Vergangenheit', () => {
    expect(termin({ deadline: '2026-10-30' })).toEqual({ ok: false, fehler: DEADLINE_NUR_GEGNER_ODER_BOSS });
    expect(termin({ meilenstein: true, deadline: '2026-10-30' })).toEqual({ ok: false, fehler: DEADLINE_NUR_GEGNER_ODER_BOSS });
    expect(termin({ gegner: true, deadline: '2026-10-22' })).toEqual({ ok: false, fehler: DEADLINE_VERGANGEN });
    expect(termin({ gegner: true, deadline: '2026-10-20' }, '2026-10-20').ok).toBe(true);
    expect(termin({ gegner: true, deadline: '2026-10-22' }, '2026-10-20')).toEqual({ ok: false, fehler: DEADLINE_VERGANGEN });
    expect(termin({ boss: true, meilenstein: true, deadline: '' }).ok).toBe(true);
    expect(termin({ gegner: true, deadline: '2026-02-31' })).toEqual({
      ok: false,
      fehler: 'Das Datum 2026-02-31 existiert nicht.',
    });
  });
});

describe('sortiereAufgaben', () => {
  it('stellt Zeilen mit Uhrzeit vor die übrigen und sortiert sie nach Datum, Uhrzeit und Name', () => {
    const zeilen = [
      { name: 'Steuerunterlagen', faelligAm: '2026-10-20', faelligUm: null, prioritaet: 1 },
      { name: 'Blumen gießen', faelligAm: null, faelligUm: null, prioritaet: null },
      { name: 'Angebot schicken', faelligAm: HEUTE, faelligUm: '18:30', prioritaet: null },
      { name: 'Arzt anrufen', faelligAm: HEUTE, faelligUm: '09:00', prioritaet: 1 },
    ];
    expect(sortiereAufgaben(zeilen).map((zeile) => zeile.name)).toEqual([
      'Arzt anrufen',
      'Angebot schicken',
      'Steuerunterlagen',
      'Blumen gießen',
    ]);
    expect(zeilen.map((zeile) => zeile.name)[0]).toBe('Steuerunterlagen');
  });

  it('sortiert ohne Uhrzeit nach Priorität, Datum und Name, NULL hinten', () => {
    const zeilen = [
      { name: 'Später', faelligAm: '2026-10-28', faelligUm: null, prioritaet: 1 },
      { name: 'Ohne', faelligAm: '2026-10-01', faelligUm: null, prioritaet: null },
      { name: 'Beta', faelligAm: '2026-10-20', faelligUm: null, prioritaet: 2 },
      { name: 'Alpha', faelligAm: '2026-10-20', faelligUm: null, prioritaet: 2 },
      { name: 'Früh', faelligAm: '2026-10-01', faelligUm: null, prioritaet: 1 },
      { name: 'Offen', faelligAm: null, faelligUm: null, prioritaet: 1 },
    ];
    expect(sortiereAufgaben(zeilen).map((zeile) => zeile.name)).toEqual(['Früh', 'Später', 'Offen', 'Alpha', 'Beta', 'Ohne']);
  });

  it('lässt die Priorität in der Uhrzeit-Gruppe unbeachtet und stellt Überfälliges ohne Uhrzeit dahinter', () => {
    const zeilen = [
      { name: 'Überfällig', faelligAm: '2026-10-01', faelligUm: null, prioritaet: 1 },
      { name: 'Spät wichtig', faelligAm: HEUTE, faelligUm: '18:30', prioritaet: 1 },
      { name: 'Früh unwichtig', faelligAm: HEUTE, faelligUm: '09:00', prioritaet: 4 },
      { name: 'Gestern', faelligAm: '2026-10-22', faelligUm: '18:00', prioritaet: null },
    ];
    expect(sortiereAufgaben(zeilen).map((zeile) => zeile.name)).toEqual([
      'Gestern',
      'Früh unwichtig',
      'Spät wichtig',
      'Überfällig',
    ]);
  });
});

function heute(teil: Partial<HeuteSicht> = {}): HeuteSicht {
  return {
    archiviert: false,
    faelligAm: null,
    nurHeuteAm: null,
    wiederholung: 'keine',
    heuteEintragId: null,
    ...teil,
  };
}

describe('erscheintAufHeute', () => {
  it('zeigt Fälliges, Überfälliges und die Nadel, nicht die Zukunft und nicht ohne Datum', () => {
    expect(erscheintAufHeute(heute({ faelligAm: HEUTE }), HEUTE)).toBe(true);
    expect(erscheintAufHeute(heute({ faelligAm: '2026-10-20' }), HEUTE)).toBe(true);
    expect(erscheintAufHeute(heute({ faelligAm: '2026-10-28' }), HEUTE)).toBe(false);
    expect(erscheintAufHeute(heute(), HEUTE)).toBe(false);
    expect(erscheintAufHeute(heute({ nurHeuteAm: HEUTE }), HEUTE)).toBe(true);
    expect(erscheintAufHeute(heute({ nurHeuteAm: '2026-10-22' }), HEUTE)).toBe(false);
    expect(erscheintAufHeute(heute({ faelligAm: HEUTE, archiviert: true }), HEUTE)).toBe(false);
  });

  it('hält eine erledigte einmalige Aufgabe nur am Fälligkeitstag und eine Wiederholung mit heutigem Kreis', () => {
    const erledigt = heute({ faelligAm: HEUTE, heuteEintragId: 4 });
    expect(istEinmaligErledigt(erledigt)).toBe(true);
    expect(erscheintAufHeute(erledigt, HEUTE)).toBe(true);
    expect(erscheintAufHeute(heute({ faelligAm: '2026-10-20', heuteEintragId: 4 }), HEUTE)).toBe(false);
    expect(erscheintAufHeute(heute({ heuteEintragId: 4 }), HEUTE)).toBe(false);
    const wiederholung = heute({
      faelligAm: '2026-10-24',
      wiederholung: 'taeglich',
      heuteEintragId: 8,
    });
    expect(istEinmaligErledigt(wiederholung)).toBe(false);
    expect(erscheintAufHeute(wiederholung, HEUTE)).toBe(true);
    expect(erscheintAufHeute(heute({ faelligAm: '2026-10-24', wiederholung: 'taeglich' }), HEUTE)).toBe(false);
  });
});

function plusIso(iso: string, tage: number): string {
  return lokalesDatum(plusTage(ausTagesSchluessel(iso), tage));
}

describe('erscheintAlsNaechstes', () => {
  it('nimmt nur die nächsten sieben Tage, nicht heute, nicht überfällig und nicht ohne Datum', () => {
    expect(ALS_NAECHSTES_TAGE).toBe(7);
    expect(erscheintAlsNaechstes({ faelligAm: null }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: '' }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: HEUTE }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: '2026-10-22' }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: plusIso(HEUTE, 1) }, HEUTE)).toBe(true);
    expect(erscheintAlsNaechstes({ faelligAm: plusIso(HEUTE, ALS_NAECHSTES_TAGE) }, HEUTE)).toBe(true);
    expect(erscheintAlsNaechstes({ faelligAm: plusIso(HEUTE, ALS_NAECHSTES_TAGE + 1) }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: 'kein-datum' }, HEUTE)).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: plusIso(HEUTE, 1) }, '2026-02-31')).toBe(false);
  });

  it('rechnet über den Jahreswechsel und den Schalttag', () => {
    expect(erscheintAlsNaechstes({ faelligAm: '2027-01-04' }, '2026-12-28')).toBe(true);
    expect(erscheintAlsNaechstes({ faelligAm: '2027-01-05' }, '2026-12-28')).toBe(false);
    expect(erscheintAlsNaechstes({ faelligAm: '2024-03-04' }, '2024-02-26')).toBe(true);
    expect(erscheintAlsNaechstes({ faelligAm: '2024-03-05' }, '2024-02-26')).toBe(false);
  });
});
