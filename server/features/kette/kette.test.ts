import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { EintragDaten } from '../../../shared/api/index.ts';
import { lokalesDatum, tagPlus } from '../../../shared/spiel/datum.ts';
import { momentumFuerSerie } from '../../../shared/spiel/momentum.ts';
import { alle, ausfuehren, eine, mitWelt, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { aktiviereAttribut } from '../attribute/attribute.ts';
import { erstelleEintrag } from '../eintraege/eintraege.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../einstellungen/einstellungen.ts';
import { leseSchutzSchwelle, leseSchutzVorrat, schreibeSchutzSchwelle, schreibeSchutzVorrat } from '../einstellungen/einstellungen.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { momentumFuerTag, pausiereStreak, setzeStreakFort } from '../../services/serie.ts';
import { ladeKennzahlen } from '../erfolge/erfolge.ts';
import { ladeStatistiken } from '../statistiken/statistiken.ts';
import { pflegeRueckkehr } from './rueckkehr.ts';
import { schutzSchema } from '../../validierung.ts';
import { ladeKetteHeute, SCHUTZ_HEUTE_NEIN, setzeSchutzEin } from './kette.ts';
import { ketteRouten } from './routen.ts';

const MONTAG = '2026-10-19';
const DIENSTAG = '2026-10-20';
const MITTWOCH = '2026-10-21';
const DONNERSTAG = '2026-10-22';
const FREITAG = '2026-10-23';

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-kette-'));
const offen: string[] = [];
let nummer = 0;

function welt(): string {
  nummer += 1;
  const datei = path.join(ordner, `${nummer}.db`);
  offen.push(datei);
  return datei;
}

afterEach(() => {
  for (const datei of offen) {
    schliesseWelt(datei);
  }
  offen.length = 0;
});

function mittag(tag: string): Date {
  const [jahr, monat, tageszahl] = tag.split('-').map(Number);
  return new Date(jahr, monat - 1, tageszahl, 12, 0, 0);
}

function vorlageId(): number {
  const koerper = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', 'koerper')?.id;
  if (koerper === undefined) {
    throw new Error('Körper fehlt.');
  }
  return erstelleVorlage({ name: 'Tun', icon: 'star', gewichte: [{ attributId: koerper, gewicht: 1 }] }).id;
}

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function roh(vorlage: number, tag: string): void {
  ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
    vorlage,
    mittag(tag).toISOString(),
  );
}

function kette(vorlage: number, letzter: string, anzahl: number): void {
  for (let versatz = anzahl - 1; versatz >= 0; versatz -= 1) {
    roh(vorlage, tagPlus(letzter, -versatz));
  }
}

function logge(vorlage: number, tag: string) {
  const daten: EintragDaten = {
    projektId: null,
    vorlageId: vorlage,
    vorhaben: null,
    abschluss: null,
    erkenntnis: '',
    stunden: 1,
    notiz: '',
    meilenstein: false,
    faehigkeitId: null,
    datum: null,
  };
  return erstelleEintrag(daten, mittag(tag));
}

function protokolle(art: string): string[] {
  return alle<{ tag: string | null }>('SELECT tag FROM protokoll WHERE art = ? ORDER BY id', art).map(
    (zeile) => zeile.tag ?? '',
  );
}

function bruecken(): string[] {
  return alle<{ tag: string }>('SELECT tag FROM streak_bruecken ORDER BY tag').map((zeile) => zeile.tag);
}

function schluessel(name: string): string | undefined {
  return eine<{ wert: string }>('SELECT wert FROM einstellungen WHERE schluessel = ?', name)?.wert;
}

function xpSumme(): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse')?.xp ?? 0;
}

async function mitRouten<T>(arbeit: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof ZodError) {
      return antwort.status(400).send({ fehler: 'ungültig' });
    }
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  await app.register(ketteRouten, { prefix: '/api' });
  try {
    return await arbeit(app);
  } finally {
    await app.close();
  }
}

describe('Kette heute', () => {
  it('verbraucht den freien Pausentag nicht und zeigt am Folgetag die angeschlagene Länge', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), MONTAG, 5);
      schreibeSchutzVorrat(1);
      expect(ladeKetteHeute(mittag(DIENSTAG))).toEqual({
        schutz: false,
        schutzLaenge: null,
        rueckkehr: null,
        angeschlagen: null,
        heuteErfasst: false,
        serie: { laenge: 5, angeknackst: false },
      });
      expect(ladeKetteHeute(mittag(MITTWOCH))).toEqual({
        schutz: false,
        schutzLaenge: null,
        rueckkehr: null,
        angeschlagen: { laenge: 5 },
        heuteErfasst: false,
        serie: { laenge: 5, angeknackst: true },
      });
      expect(leseSchutzVorrat()).toBe(1);
      expect(bruecken()).toEqual([]);
      expect(protokolle('schutz_eingesetzt')).toEqual([]);
    });
  });

  it('blendet eine angeschlagene Länge von 1 aus', () => {
    mitWelt(welt(), () => {
      roh(vorlageId(), MONTAG);
      schreibeSchutzVorrat(1);
      expect(ladeKetteHeute(mittag(MITTWOCH)).angeschlagen).toBeNull();
    });
  });

  it('zeigt den Schutz nur am Bruchtag mit Vorrat und ohne Brücke', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), MONTAG, 5);
      expect(ladeKetteHeute(mittag(DONNERSTAG)).schutz).toBe(false);
      schreibeSchutzVorrat(1);
      expect(ladeKetteHeute(mittag(DONNERSTAG))).toEqual({
        schutz: true,
        schutzLaenge: 5,
        rueckkehr: null,
        angeschlagen: null,
        heuteErfasst: false,
        serie: { laenge: 0, angeknackst: false },
      });
      expect(leseSchutzSchwelle()).toBeNull();
      expect(protokolle('schutz_verdient')).toEqual([]);
    });
  });

  it('liest eine offene Rückkehr und ignoriert eine geschlossene', () => {
    mitWelt(welt(), () => {
      ausfuehren(
        `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('zu', '2026-10-01', '2026-10-08')`,
      );
      expect(ladeKetteHeute(mittag(DONNERSTAG)).rueckkehr).toBeNull();
      ausfuehren(
        `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('offen', '2026-10-22', '2026-10-29')`,
      );
      expect(ladeKetteHeute(mittag(DONNERSTAG)).rueckkehr).toEqual({ fristAm: '2026-10-29' });
    });
  });

  it('legt beim Lesen keine Schwelle an', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), MONTAG, 8);
      ladeKetteHeute(mittag(MONTAG));
      expect(schluessel('schutz_schwelle_verbraucht')).toBeUndefined();
      expect(schluessel('schutz_vorrat')).toBeUndefined();
    });
  });
});

describe('Schutz einsetzen', () => {
  it('hält die Länge, gibt keine XP und lässt einen zweiten Aufruf stehen', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), MONTAG, 5);
      schreibeSchutzVorrat(1);
      const erste = setzeSchutzEin(mittag(DONNERSTAG));
      expect(erste).toEqual({ serie: { laenge: 5, angeknackst: false }, schutz: false });
      expect(bruecken()).toEqual([MITTWOCH]);
      expect(leseSchutzVorrat()).toBe(0);
      expect(protokolle('schutz_eingesetzt')).toEqual([MITTWOCH]);
      expect(xpSumme()).toBe(0);
      expect(setzeSchutzEin(mittag(DONNERSTAG))).toEqual(erste);
      expect(bruecken()).toEqual([MITTWOCH]);
      expect(protokolle('schutz_eingesetzt')).toEqual([MITTWOCH]);
      expect(ladeKetteHeute(mittag(FREITAG))).toEqual({
        schutz: false,
        schutzLaenge: null,
        rueckkehr: null,
        angeschlagen: null,
        heuteErfasst: false,
        serie: { laenge: 0, angeknackst: false },
      });
      expect(momentumFuerTag(FREITAG)).toBe(1.05);
    });
  });

  it('schreibt bei leerem Vorrat oder falschem Abstand nichts', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), MONTAG, 5);
      expect(() => setzeSchutzEin(mittag(DONNERSTAG))).toThrow(SCHUTZ_HEUTE_NEIN);
      schreibeSchutzVorrat(1);
      expect(() => setzeSchutzEin(mittag(MITTWOCH))).toThrow(AppFehler);
      expect(() => setzeSchutzEin(mittag(DIENSTAG))).toThrow(SCHUTZ_HEUTE_NEIN);
      ausfuehren(`INSERT INTO streak_bruecken (tag) VALUES (?)`, MITTWOCH);
      expect(() => setzeSchutzEin(mittag(FREITAG))).toThrow(SCHUTZ_HEUTE_NEIN);
      expect(bruecken()).toEqual([MITTWOCH]);
      expect(protokolle('schutz_eingesetzt')).toEqual([]);
      expect(leseSchutzVorrat()).toBe(1);
    });
  });

  it('löscht die am selben Morgen geöffnete Rückkehr ohne Eintrag', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      kette(vorlage, MONTAG, 5);
      schreibeSchutzVorrat(1);
      const alt = rohUndId(vorlage, '2026-10-01');
      ausfuehren(
        `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am, eintrag_id) VALUES ('offen', ?, '2026-10-29', ?)`,
        DONNERSTAG,
        alt,
      );
      ausfuehren(
        `INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('offen', ?, '2026-10-29'), ('offen', '2026-10-21', '2026-10-28')`,
        DONNERSTAG,
      );
      ausfuehren(
        `INSERT INTO protokoll (art, tag) VALUES ('rueckkehr_offen', ?), ('rueckkehr_offen', '2026-10-21'), ('schutz_verdient', '2026-10-01')`,
        DONNERSTAG,
      );
      setzeSchutzEin(mittag(DONNERSTAG));
      const zeilen = alle<{ tag: string; eintragId: number | null }>(
        'SELECT geoeffnet_am AS tag, eintrag_id AS eintragId FROM rueckkehr ORDER BY id',
      );
      expect(zeilen).toEqual([
        { tag: DONNERSTAG, eintragId: alt },
        { tag: '2026-10-21', eintragId: null },
      ]);
      expect(protokolle('rueckkehr_offen')).toEqual(['2026-10-21']);
      expect(protokolle('schutz_verdient')).toEqual(['2026-10-01']);
      expect(protokolle('schutz_eingesetzt')).toEqual([MITTWOCH]);
    });
  });

  it('nimmt einen leeren Körper und lehnt einen gefüllten ab', async () => {
    const datei = welt();
    await mitWeltAsync(datei, async () => {
      const heute = lokalesDatum(new Date());
      const letzter = tagPlus(heute, -3);
      kette(vorlageId(), letzter, 5);
      schreibeSchutzVorrat(1);
      expect(schutzSchema.parse({})).toEqual({});
      expect(() => schutzSchema.parse({ extra: true })).toThrow(ZodError);
      await mitRouten(async (app) => {
        const leer = await app.inject({ method: 'POST', url: '/api/kette/schutz', payload: {} });
        expect(leer.statusCode).toBe(200);
        expect(leer.json()).toEqual({ serie: { laenge: 5, angeknackst: false }, schutz: false });
        const stand = await app.inject({ method: 'GET', url: '/api/kette/heute' });
        expect(stand.statusCode).toBe(200);
        expect(stand.json()).toEqual({
          schutz: false,
          schutzLaenge: null,
          rueckkehr: null,
          angeschlagen: null,
          heuteErfasst: false,
          serie: { laenge: 5, angeknackst: false },
        });
        const voll = await app.inject({ method: 'POST', url: '/api/kette/schutz', payload: { extra: true } });
        expect(voll.statusCode).toBe(400);
        expect(bruecken()).toEqual([tagPlus(heute, -1)]);
      });
    });
  });
});

describe('Schutz verdienen', () => {
  it('setzt eine fehlende Schwelle ohne Vorrat und ohne Protokoll', () => {
    mitWelt(welt(), () => {
      logge(vorlageId(), MONTAG);
      expect(leseSchutzSchwelle()).toBe(0);
      expect(schluessel('schutz_vorrat')).toBeUndefined();
      expect(protokolle('schutz_verdient')).toEqual([]);
      expect(JSON.stringify(ladeEinstellungen())).not.toContain('schutz_');
    });
  });

  it('vergibt den Schritt von 6 auf 7 nur einmal, wenn der Vorrat leer ist', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      kette(vorlage, tagPlus(DONNERSTAG, -1), 6);
      logge(vorlage, DONNERSTAG);
      expect(leseSchutzSchwelle()).toBe(7);
      expect(leseSchutzVorrat()).toBe(1);
      expect(protokolle('schutz_verdient')).toEqual([DONNERSTAG]);
      expect(schluessel('schutz_vorrat')).toBe('1');
      logge(vorlage, DONNERSTAG);
      expect(protokolle('schutz_verdient')).toEqual([DONNERSTAG]);
      expect(
        alle<{ quelle: string }>('SELECT DISTINCT quelle FROM xp_ereignisse ORDER BY quelle').map((zeile) => zeile.quelle),
      ).toEqual(['bestaendigkeit', 'eintrag']);
    });
  });

  it('vergibt eine gespeicherte 7 bei Länge 8 nicht', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      schreibeSchutzSchwelle(7);
      kette(vorlage, tagPlus(DONNERSTAG, -1), 7);
      logge(vorlage, DONNERSTAG);
      expect(leseSchutzSchwelle()).toBe(7);
      expect(leseSchutzVorrat()).toBe(0);
      expect(protokolle('schutz_verdient')).toEqual([]);
    });
  });

  it('hebt bei vollem Vorrat nur die Schwelle', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      schreibeSchutzVorrat(1);
      schreibeSchutzSchwelle(7);
      kette(vorlage, tagPlus(DONNERSTAG, -1), 13);
      logge(vorlage, DONNERSTAG);
      expect(leseSchutzSchwelle()).toBe(14);
      expect(leseSchutzVorrat()).toBe(1);
      expect(protokolle('schutz_verdient')).toEqual([]);
      aendereEinstellungen({ sound: false });
      expect(leseSchutzVorrat()).toBe(1);
      expect(leseSchutzSchwelle()).toBe(14);
    });
  });
});

describe('Momentum mit Brücke', () => {
  it('bucht den rettenden Eintrag mit Faktor 1,22 und lässt die Beständigkeit 0', () => {
    mitWelt(welt(), () => {
      aktiviereAttribut('vitalitaet', 'behalten', null);
      const vorlage = erstelleVorlage({
        name: 'Training',
        icon: 'dumbbell',
        gewichte: [
          { attributId: attributId('koerper'), gewicht: 50 },
          { attributId: attributId('disziplin'), gewicht: 30 },
          { attributId: attributId('vitalitaet'), gewicht: 20 },
        ],
      }).id;
      kette(vorlage, MONTAG, 5);
      expect(momentumFuerTag(DONNERSTAG)).toBe(momentumFuerSerie(1));
      expect(momentumFuerTag(DONNERSTAG)).toBe(1.05);
      ausfuehren(`INSERT INTO streak_bruecken (tag) VALUES (?)`, MITTWOCH);
      expect(momentumFuerTag(DONNERSTAG)).toBe(1.22);
      const ergebnis = logge(vorlage, DONNERSTAG);
      expect(ergebnis.eintrag.faktor).toBe(1.22);
      expect(ergebnis.eintrag.xp).toBe(31);
      const anteile = new Map(ergebnis.eintrag.anteile.map((anteil) => [anteil.attributId, anteil.xp]));
      expect(anteile.get(attributId('koerper'))).toBe(16);
      expect(anteile.get(attributId('disziplin'))).toBe(9);
      expect(anteile.get(attributId('vitalitaet'))).toBe(6);
      expect(ergebnis.eintrag.boni).not.toContain('bestaendigkeit');
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('bestaendigkeit');
      expect(
        eine<{ anzahl: number }>(
          `SELECT COUNT(*) AS anzahl FROM xp_ereignisse WHERE eintrag_id = ? AND quelle = 'bestaendigkeit'`,
          ergebnis.eintrag.id,
        )?.anzahl,
      ).toBe(0);
    });
  });

  it('lässt eine Lücke von einem Tag ohne Brücke wie bisher', () => {
    mitWelt(welt(), () => {
      roh(vorlageId(), MONTAG);
      expect(momentumFuerTag(DIENSTAG)).toBe(momentumFuerSerie(2));
      expect(ladeKetteHeute(mittag(DIENSTAG)).angeschlagen).toBeNull();
    });
  });
});

describe('Pause der Tageskette', () => {
  it('lässt fünf Tage ohne Eintrag die Länge stehen und öffnet keine Rückkehr', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      roh(vorlage, '2026-04-28');
      roh(vorlage, '2026-04-29');
      roh(vorlage, '2026-04-30');
      pausiereStreak('2026-05-01');
      setzeStreakFort('2026-05-06');
      expect(ladeKetteHeute(mittag('2026-05-03')).serie).toEqual({ laenge: 3, angeknackst: false });
      expect(ladeKetteHeute(mittag('2026-05-06')).serie).toEqual({ laenge: 3, angeknackst: false });
      expect(momentumFuerTag('2026-05-03')).toBe(1);
      roh(vorlage, '2026-05-03');
      expect(ladeKetteHeute(mittag('2026-05-06')).serie).toEqual({ laenge: 3, angeknackst: false });
      pflegeRueckkehr(mittag('2026-05-06'));
      expect(alle('SELECT id FROM rueckkehr')).toEqual([]);
      const gebucht = logge(vorlage, '2026-05-06');
      expect(gebucht.eintrag.faktor).toBe(momentumFuerSerie(4));
      expect(ladeKetteHeute(mittag('2026-05-06')).serie).toEqual({ laenge: 4, angeknackst: false });
      expect(alle('SELECT id FROM rueckkehr')).toEqual([]);
    });
  });

  it('behält Faktor und XP der Buchung vor der Pause', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      roh(vorlage, '2026-04-28');
      roh(vorlage, '2026-04-29');
      const erste = logge(vorlage, '2026-04-30');
      const faktor = erste.eintrag.faktor;
      const xp = eine<{ xp: number }>(
        'SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE eintrag_id = ?',
        erste.eintrag.id,
      )?.xp;
      expect(faktor).toBe(momentumFuerSerie(3));
      pausiereStreak('2026-04-30');
      expect(momentumFuerTag('2026-04-30')).toBe(1);
      expect(momentumFuerTag('2026-05-01')).toBe(1);
      const zweite = logge(vorlage, '2026-05-01');
      expect(zweite.eintrag.faktor).toBe(1);
      expect(eine<{ faktor: number }>('SELECT faktor FROM eintraege WHERE id = ?', erste.eintrag.id)?.faktor).toBe(faktor);
      expect(
        eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE eintrag_id = ?', erste.eintrag.id)?.xp,
      ).toBe(xp);
    });
  });

  it('wirft den Schutz in der Pause und schreibt keine Brücke', () => {
    mitWelt(welt(), () => {
      kette(vorlageId(), '2026-04-30', 5);
      schreibeSchutzVorrat(1);
      pausiereStreak('2026-05-01');
      expect(() => setzeSchutzEin(mittag('2026-05-03'))).toThrow(SCHUTZ_HEUTE_NEIN);
      expect(bruecken()).toEqual([]);
      expect(leseSchutzVorrat()).toBe(1);
      expect(protokolle('schutz_eingesetzt')).toEqual([]);
    });
  });

  it('lässt eine offene Frist über die Pause offen, ohne frist_am umzuschreiben', () => {
    mitWelt(welt(), () => {
      roh(vorlageId(), '2026-04-30');
      pausiereStreak('2026-05-01');
      setzeStreakFort('2026-05-06');
      ausfuehren(`INSERT INTO rueckkehr (status, geoeffnet_am, frist_am) VALUES ('offen', '2026-04-26', '2026-05-03')`);
      pflegeRueckkehr(mittag('2026-05-06'));
      expect(
        alle<{ status: string; geoeffnetAm: string; fristAm: string }>(
          'SELECT status, geoeffnet_am AS geoeffnetAm, frist_am AS fristAm FROM rueckkehr',
        ),
      ).toEqual([{ status: 'offen', geoeffnetAm: '2026-04-26', fristAm: '2026-05-03' }]);
      expect(ladeKetteHeute(mittag('2026-05-06')).rueckkehr).toEqual({ fristAm: '2026-05-03' });
    });
  });

  it('löscht die offene Zeile am selben Tag und lässt den zweiten Aufruf stehen', () => {
    mitWelt(welt(), () => {
      pausiereStreak('2026-05-06');
      pausiereStreak('2026-05-06');
      expect(eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM streak_pausen')?.anzahl).toBe(1);
      setzeStreakFort('2026-05-06');
      expect(eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM streak_pausen')?.anzahl).toBe(0);
      setzeStreakFort('2026-05-06');
      expect(eine<{ anzahl: number }>('SELECT COUNT(*) AS anzahl FROM streak_pausen')?.anzahl).toBe(0);
      pausiereStreak('2026-05-01');
      setzeStreakFort('2026-05-06');
      expect(alle<{ von: string; bis: string }>('SELECT von, bis FROM streak_pausen')).toEqual([
        { von: '2026-05-01', bis: '2026-05-05' },
      ]);
      setzeStreakFort('2026-05-08');
      expect(alle<{ von: string; bis: string }>('SELECT von, bis FROM streak_pausen')).toEqual([
        { von: '2026-05-01', bis: '2026-05-05' },
      ]);
    });
  });

  it('lässt die Streak-Kennzahl ruhen und zählt den Pausentag bei den aktiven Tagen', () => {
    mitWelt(welt(), () => {
      const vorlage = vorlageId();
      roh(vorlage, '2026-04-28');
      roh(vorlage, '2026-04-29');
      roh(vorlage, '2026-04-30');
      roh(vorlage, '2026-05-03');
      pausiereStreak('2026-05-01');
      setzeStreakFort('2026-05-06');
      const kennzahlen = ladeKennzahlen();
      expect(kennzahlen.streak).toBe(3);
      expect(kennzahlen.aktiveTage).toBe(4);
      const statistik = ladeStatistiken('gesamt', mittag('2026-05-06')).kennzahlen;
      expect(statistik.laengsterStreak).toBe(3);
      expect(statistik.aktiveTage).toBe(4);
    });
  });
});

function rohUndId(vorlage: number, tag: string): number {
  return ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
    vorlage,
    mittag(tag).toISOString(),
  ).id;
}
