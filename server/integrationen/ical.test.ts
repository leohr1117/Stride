import { describe, expect, it } from 'vitest';
import { kalenderName, termineDieEnden, termineZwischen } from './ical.ts';

function kalender(...ereignisse: string[][]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...ereignisse.flatMap((zeilen) => ['BEGIN:VEVENT', ...zeilen, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
}

const VON = new Date('2026-10-01T00:00:00Z');
const BIS = new Date('2026-11-01T00:00:00Z');

describe('kalenderName', () => {
  it('nimmt den Kalendernamen und nicht den Termintitel', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'X-WR-CALNAME:Arbeit\\, Projekt',
      'NAME:Anders',
      'BEGIN:VEVENT',
      'UID:a',
      'SUMMARY:Training',
      'DTSTART:20261005T170000Z',
      'DTEND:20261005T180000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(kalenderName(text)).toBe('Arbeit, Projekt');
  });

  it('fällt auf NAME zurück', () => {
    const text = ['BEGIN:VCALENDAR', 'NAME:Haus', 'END:VCALENDAR'].join('\r\n');
    expect(kalenderName(text)).toBe('Haus');
  });
});

describe('termineDieEnden', () => {
  it('nimmt einen Termin, der vor dem Fenster beginnt und darin endet', () => {
    const text = kalender(['UID:ende', 'SUMMARY:Ueberlappt', 'DTSTART:20261027T140000Z', 'DTEND:20261027T160000Z']);
    const von = new Date('2026-10-27T15:00:00.000Z');
    const bis = new Date('2026-10-27T18:00:00.000Z');
    const termine = termineDieEnden(text, von, bis);
    expect(termine.map((termin) => termin.titel)).toEqual(['Ueberlappt']);
    expect(termineZwischen(text, von, bis)).toEqual([]);
  });
});

describe('termineZwischen', () => {
  it('liest einen einfachen UTC-Termin mit Dauer', () => {
    const text = kalender(['UID:a', 'SUMMARY:Training', 'DTSTART:20261005T170000Z', 'DTEND:20261005T183000Z']);
    const [termin] = termineZwischen(text, VON, BIS);
    expect(termin.titel).toBe('Training');
    expect(termin.beginn.toISOString()).toBe('2026-10-05T17:00:00.000Z');
    expect((termin.ende.getTime() - termin.beginn.getTime()) / 3_600_000).toBe(1.5);
  });

  it('rechnet Zeitzonen mit Sommer- und Winterzeit um', () => {
    const text = kalender(
      ['UID:b', 'SUMMARY:Sommer', 'DTSTART;TZID=Europe/Berlin:20261019T180000', 'DURATION:PT1H'],
      ['UID:c', 'SUMMARY:Winter', 'DTSTART;TZID=Europe/Berlin:20261026T180000', 'DURATION:PT1H'],
    );
    const termine = termineZwischen(text, VON, BIS);
    expect(termine.map((termin) => termin.beginn.toISOString())).toEqual([
      '2026-10-19T16:00:00.000Z',
      '2026-10-26T17:00:00.000Z',
    ]);
  });

  it('wiederholt wöchentlich an mehreren Tagen und beachtet Ausnahmen', () => {
    const text = kalender([
      'UID:d',
      'SUMMARY:Laufen',
      'DTSTART;TZID=Europe/Berlin:20261005T070000',
      'DTEND;TZID=Europe/Berlin:20261005T080000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4',
      'EXDATE;TZID=Europe/Berlin:20261007T070000',
    ]);
    const termine = termineZwischen(text, VON, BIS);
    expect(termine.map((termin) => termin.beginn.toISOString().slice(0, 10))).toEqual(['2026-10-05', '2026-10-12', '2026-10-14']);
  });

  it('ersetzt verschobene Einzeltermine und überspringt abgesagte', () => {
    const text = kalender(
      ['UID:e', 'SUMMARY:Kurs', 'DTSTART:20261001T100000Z', 'DTEND:20261001T110000Z', 'RRULE:FREQ=DAILY;COUNT=3'],
      ['UID:e', 'SUMMARY:Kurs verschoben', 'RECURRENCE-ID:20261002T100000Z', 'DTSTART:20261002T150000Z', 'DTEND:20261002T160000Z'],
      ['UID:f', 'SUMMARY:Abgesagt', 'STATUS:CANCELLED', 'DTSTART:20261003T100000Z', 'DTEND:20261003T110000Z'],
    );
    const termine = termineZwischen(text, VON, BIS);
    expect(termine.map((termin) => `${termin.titel} ${termin.beginn.toISOString().slice(5, 16)}`)).toEqual([
      'Kurs 10-01T10:00',
      'Kurs verschoben 10-02T15:00',
      'Kurs 10-03T10:00',
    ]);
  });

  it('findet lange laufende Serien und monatliche Wochentage', () => {
    const text = kalender(
      ['UID:g', 'SUMMARY:Täglich seit Jahren', 'DTSTART:20100101T060000Z', 'DTEND:20100101T063000Z', 'RRULE:FREQ=DAILY'],
      ['UID:h', 'SUMMARY:Letzter Freitag', 'DTSTART:20260130T180000Z', 'DTEND:20260130T190000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR'],
    );
    const termine = termineZwischen(text, VON, BIS);
    expect(termine.filter((termin) => termin.titel === 'Täglich seit Jahren')).toHaveLength(31);
    expect(termine.find((termin) => termin.titel === 'Letzter Freitag')?.beginn.toISOString()).toBe('2026-10-30T18:00:00.000Z');
  });

  it('erkennt ganztägige Termine und gefaltete Zeilen', () => {
    const text = kalender(['UID:i', 'SUMMARY:Ein sehr langer', '  Titel', 'DTSTART;VALUE=DATE:20261010', 'DTEND;VALUE=DATE:20261011']);
    const [termin] = termineZwischen(text, VON, BIS);
    expect(termin.ganztags).toBe(true);
    expect(termin.titel).toBe('Ein sehr langer Titel');
  });

  it('nimmt nur Termine, die im Zeitraum begonnen und geendet haben', () => {
    const text = kalender(
      ['UID:j', 'SUMMARY:Vorher', 'DTSTART:20260930T230000Z', 'DTEND:20261001T010000Z'],
      ['UID:k', 'SUMMARY:Noch nicht vorbei', 'DTSTART:20261031T230000Z', 'DTEND:20261101T010000Z'],
    );
    expect(termineZwischen(text, VON, BIS)).toHaveLength(0);
  });
});
