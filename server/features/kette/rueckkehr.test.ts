import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EintragDaten } from '../../../shared/api/index.ts';
import { tagPlus } from '../../../shared/spiel/datum.ts';
import { NEUER_ANLAUF } from '../../../shared/spiel/xp.ts';
import { alle, ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereAttribut, aktiviereAttribut } from '../attribute/attribute.ts';
import { erstelleEintrag, loescheEintrag } from '../eintraege/eintraege.ts';
import { aendereEinstellungen, ladeEinstellungen, leseRueckkehrAb, schreibeSchutzVorrat } from '../einstellungen/einstellungen.ts';
import { erstelleVorlage } from '../taetigkeiten/vorlagen.ts';
import { kraft, plan, saetze, vorlage as trainingsVorlage } from '../training/einheitenHilfe.ts';
import { schliesseEinheitAb, starteEinheit } from '../training/einheiten.ts';
import { hakeSatzAb } from '../training/saetze.ts';
import { ladeKetteHeute, setzeSchutzEin } from './kette.ts';
import { erfuelleRueckkehr, pflegeRueckkehr } from './rueckkehr.ts';

const MONTAG = '2026-10-19';
const MITTWOCH = '2026-10-21';
const DONNERSTAG = '2026-10-22';
const FREITAG = '2026-10-23';
const FRIST = '2026-10-29';
const NACH_FRIST = '2026-10-30';
const SPAETER = '2026-10-26';
const BONUS = NEUER_ANLAUF.disziplin + NEUER_ANLAUF.geist;

const ordner = mkdtempSync(path.join(tmpdir(), 'stride-rueckkehr-'));
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

function roh(vorlage: number, tag: string): number {
  return ausfuehren(
    `INSERT INTO eintraege (vorlage_id, stunden, notiz, erstellt_am) VALUES (?, 1, '', ?)`,
    vorlage,
    mittag(tag).toISOString(),
  ).id;
}

function kette(vorlage: number, letzter: string, anzahl: number): void {
  for (let versatz = anzahl - 1; versatz >= 0; versatz -= 1) {
    roh(vorlage, tagPlus(letzter, -versatz));
  }
}

function daten(vorlage: number): EintragDaten {
  return {
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
}

function logge(vorlage: number, tag: string) {
  return erstelleEintrag(daten(vorlage), mittag(tag));
}

function protokolle(art: string): string[] {
  return alle<{ tag: string | null }>('SELECT tag FROM protokoll WHERE art = ? ORDER BY id', art).map((zeile) => zeile.tag ?? '');
}

function rueckkehrXp(): number {
  return eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE quelle = ?', 'rueckkehr')?.xp ?? 0;
}

function kleinsteRueckkehrXp(): number {
  return eine<{ xp: number }>('SELECT COALESCE(MIN(xp), 0) AS xp FROM xp_ereignisse WHERE quelle = ?', 'rueckkehr')?.xp ?? 0;
}

function zeilen(): { status: string; geoeffnetAm: string; fristAm: string; eintragId: number | null }[] {
  return alle('SELECT status, geoeffnet_am AS geoeffnetAm, frist_am AS fristAm, eintrag_id AS eintragId FROM rueckkehr ORDER BY id');
}

function bruchKette(): number {
  const vorlage = vorlageId();
  kette(vorlage, MONTAG, 5);
  return vorlage;
}

describe('Rückkehr öffnen', () => {
  it('setzt rueckkehr_ab einmal und öffnet ohne Eintrag keine Zeile', () => {
    mitWelt(welt(), () => {
      pflegeRueckkehr(mittag(DONNERSTAG));
      pflegeRueckkehr(mittag(FREITAG));
      expect(leseRueckkehrAb()).toBe(DONNERSTAG);
      expect(zeilen()).toEqual([]);
      expect(protokolle('rueckkehr_zu')).toEqual([]);
      expect(rueckkehrXp()).toBe(0);
      aendereEinstellungen({ sound: false });
      expect(leseRueckkehrAb()).toBe(DONNERSTAG);
      expect(JSON.stringify(ladeEinstellungen())).not.toContain('rueckkehr_ab');
    });
  });

  it('öffnet am Bruchtag, bleibt in der Frist bei der ersten Frist und ist danach zu', () => {
    mitWelt(welt(), () => {
      bruchKette();
      pflegeRueckkehr(mittag(DONNERSTAG));
      pflegeRueckkehr(mittag(DONNERSTAG));
      expect(zeilen()).toEqual([{ status: 'offen', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(protokolle('rueckkehr_offen')).toEqual([DONNERSTAG]);
      expect(rueckkehrXp()).toBe(0);
      expect(ladeKetteHeute(mittag(DONNERSTAG)).rueckkehr).toEqual({ fristAm: FRIST });

      pflegeRueckkehr(mittag(SPAETER));
      expect(zeilen()).toEqual([{ status: 'offen', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(protokolle('rueckkehr_offen')).toEqual([DONNERSTAG]);

      pflegeRueckkehr(mittag(NACH_FRIST));
      expect(zeilen()).toEqual([{ status: 'zu', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(protokolle('rueckkehr_offen')).toEqual([]);
      expect(protokolle('rueckkehr_zu')).toEqual([NACH_FRIST]);
      expect(rueckkehrXp()).toBe(0);
      expect(kleinsteRueckkehrXp()).toBe(0);
    });
  });

  it('schreibt bei einem Bruch vor rueckkehr_ab keine Zeile Rückkehr vorbei', () => {
    mitWelt(welt(), () => {
      roh(vorlageId(), '2026-09-01');
      pflegeRueckkehr(mittag(NACH_FRIST));
      expect(leseRueckkehrAb()).toBe(NACH_FRIST);
      expect(zeilen()).toEqual([]);
      expect(protokolle('rueckkehr_zu')).toEqual([]);
      expect(protokolle('rueckkehr_offen')).toEqual([]);
    });
  });

  it('lässt eine Brücke den Bruch aus und der Schutz löscht die am Morgen geöffnete Zeile', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      schreibeSchutzVorrat(1);
      pflegeRueckkehr(mittag(DONNERSTAG));
      expect(zeilen()).toHaveLength(1);
      setzeSchutzEin(mittag(DONNERSTAG));
      expect(zeilen()).toEqual([]);
      expect(protokolle('rueckkehr_offen')).toEqual([]);
      expect(protokolle('schutz_eingesetzt')).toEqual([MITTWOCH]);
      expect(rueckkehrXp()).toBe(0);
      pflegeRueckkehr(mittag(DONNERSTAG));
      expect(zeilen()).toEqual([]);
      expect(logge(vorlage, DONNERSTAG).belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
    });
  });
});

describe('Rückkehr erfüllen', () => {
  it('bucht am Bruchtag 35 XP ohne Momentum und kein zweites Mal', () => {
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
      const ergebnis = logge(vorlage, DONNERSTAG);
      expect(ergebnis.eintrag.faktor).toBe(1.05);
      expect(ergebnis.belohnung.xp).toBe(61);
      expect(ergebnis.eintrag.xp).toBe(61);
      const anteile = new Map(ergebnis.eintrag.anteile.map((anteil) => [anteil.attributId, anteil.xp]));
      expect(anteile.get(attributId('koerper'))).toBe(13);
      expect(anteile.get(attributId('disziplin'))).toBe(33);
      expect(anteile.get(attributId('vitalitaet'))).toBe(5);
      expect(anteile.get(attributId('geist'))).toBe(10);
      expect(ergebnis.belohnung.boni).toContainEqual({ quelle: 'rueckkehr', label: 'Rückkehr', xp: BONUS });
      expect(rueckkehrXp()).toBe(BONUS);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(protokolle('rueckkehr_offen')).toEqual([DONNERSTAG]);
      expect(
        eine<{ n: number }>('SELECT COUNT(*) AS n FROM projekt_xp WHERE quelle = ?', 'rueckkehr')?.n,
      ).toBe(0);
      const zweiter = logge(vorlage, FREITAG);
      expect(zweiter.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
      expect(rueckkehrXp()).toBe(BONUS);
      expect(zeilen()).toEqual([{ status: 'geschafft', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: ergebnis.eintrag.id }]);
    });
  });

  it('erfüllt am Fristtag und bucht nach der Frist nichts', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      pflegeRueckkehr(mittag(DONNERSTAG));
      const ergebnis = logge(vorlage, FRIST);
      expect(ergebnis.belohnung.boni).toContainEqual({ quelle: 'rueckkehr', label: 'Rückkehr', xp: BONUS });
      expect(zeilen()[0]?.status).toBe('geschafft');
    });
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      pflegeRueckkehr(mittag(MONTAG));
      const ergebnis = logge(vorlage, NACH_FRIST);
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
      expect(zeilen()).toEqual([{ status: 'zu', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(rueckkehrXp()).toBe(0);
      expect(protokolle('rueckkehr_offen')).toEqual([]);
      expect(protokolle('rueckkehr_zu')).toEqual([NACH_FRIST]);
    });
  });

  it('lässt einen Eintrag vor dem Bruch die offene Rückkehr stehen', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      pflegeRueckkehr(mittag(DONNERSTAG));
      const ergebnis = erstelleEintrag({ ...daten(vorlage), datum: MONTAG }, mittag(DONNERSTAG));
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
      expect(zeilen()).toEqual([{ status: 'offen', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(rueckkehrXp()).toBe(0);
    });
  });

  it('bucht bei nur Geist 10 und bei beiden aus 0, das Protokoll sagt geschafft', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      aendereAttribut(attributId('disziplin'), { archiviert: true });
      const ergebnis = logge(vorlage, DONNERSTAG);
      expect(ergebnis.belohnung.boni).toContainEqual({ quelle: 'rueckkehr', label: 'Rückkehr', xp: NEUER_ANLAUF.geist });
      expect(rueckkehrXp()).toBe(NEUER_ANLAUF.geist);
      expect(zeilen()[0]?.status).toBe('geschafft');
    });
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      aendereAttribut(attributId('disziplin'), { archiviert: true });
      aendereAttribut(attributId('geist'), { archiviert: true });
      const ergebnis = logge(vorlage, DONNERSTAG);
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
      expect(rueckkehrXp()).toBe(0);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(zeilen()[0]?.status).toBe('geschafft');
    });
  });

  it('gibt neben Weitermachen oder Anlauf keinen zweiten Bonus', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      ausfuehren(
        `INSERT INTO vorhaben (titel, status, abgeschlossen_am, weitermachen_eingeloest) VALUES ('Rückschlag', 'gescheitert', ?, 0)`,
        mittag(MITTWOCH).toISOString(),
      );
      const ergebnis = logge(vorlage, DONNERSTAG);
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).toContain('weitermachen');
      expect(ergebnis.belohnung.boni.map((bonus) => bonus.quelle)).not.toContain('rueckkehr');
      expect(rueckkehrXp()).toBe(0);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(zeilen()[0]?.status).toBe('geschafft');
    });
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      pflegeRueckkehr(mittag(DONNERSTAG));
      const eintragId = roh(vorlage, DONNERSTAG);
      ausfuehren(
        `INSERT INTO xp_ereignisse (quelle, attribut_id, eintrag_id, xp, erstellt_am) VALUES ('anlauf', ?, ?, ?, ?)`,
        attributId('disziplin'),
        eintragId,
        NEUER_ANLAUF.disziplin,
        mittag(DONNERSTAG).toISOString(),
      );
      expect(erfuelleRueckkehr(eintragId, DONNERSTAG, mittag(DONNERSTAG).toISOString()).xp).toBe(0);
      expect(rueckkehrXp()).toBe(0);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(zeilen()[0]).toMatchObject({ status: 'geschafft', eintragId });
    });
  });

  it('öffnet frühestens 14 Tage nach dem Schlusstag wieder', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      logge(vorlage, DONNERSTAG);
      roh(vorlage, FREITAG);
      pflegeRueckkehr(mittag('2026-10-26'));
      expect(zeilen()).toHaveLength(1);
      const naechsterBruch = tagPlus(DONNERSTAG, 14);
      roh(vorlage, tagPlus(naechsterBruch, -3));
      pflegeRueckkehr(mittag(naechsterBruch));
      expect(zeilen().map((zeile) => zeile.status)).toEqual(['geschafft', 'offen']);
      expect(zeilen()[1]).toMatchObject({ geoeffnetAm: naechsterBruch, fristAm: tagPlus(naechsterBruch, 7) });
    });
  });
});

describe('Rückkehr löschen', () => {
  it('öffnet wieder, solange die Frist läuft, und schreibt keine negative XP', () => {
    mitWelt(welt(), () => {
      const ergebnis = logge(bruchKette(), DONNERSTAG);
      loescheEintrag(ergebnis.eintrag.id, mittag(FREITAG));
      expect(zeilen()).toEqual([{ status: 'offen', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(protokolle('rueckkehr_geschafft')).toEqual([]);
      expect(protokolle('rueckkehr_offen')).toEqual([DONNERSTAG]);
      expect(rueckkehrXp()).toBe(0);
      expect(kleinsteRueckkehrXp()).toBe(0);
    });
  });

  it('hängt auf den frühesten übrigen Eintrag um und bucht nur ohne Anlauf und Weitermachen', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      const erster = logge(vorlage, DONNERSTAG);
      const zweiter = logge(vorlage, FREITAG);
      loescheEintrag(erster.eintrag.id, mittag(FREITAG));
      expect(zeilen()).toEqual([
        { status: 'geschafft', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: zweiter.eintrag.id },
      ]);
      expect(rueckkehrXp()).toBe(BONUS);
      expect(kleinsteRueckkehrXp()).toBeGreaterThan(0);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
    });
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      const erster = logge(vorlage, DONNERSTAG);
      ausfuehren(
        `INSERT INTO vorhaben (titel, status, abgeschlossen_am, weitermachen_eingeloest) VALUES ('Rückschlag', 'gescheitert', ?, 0)`,
        mittag(DONNERSTAG).toISOString(),
      );
      const zweiter = logge(vorlage, FREITAG);
      expect(zweiter.belohnung.boni.map((bonus) => bonus.quelle)).toContain('weitermachen');
      loescheEintrag(erster.eintrag.id, mittag(FREITAG));
      expect(zeilen()[0]?.eintragId).toBe(zweiter.eintrag.id);
      expect(rueckkehrXp()).toBe(0);
      expect(kleinsteRueckkehrXp()).toBe(0);
      expect(zeilen()[0]?.status).toBe('geschafft');
    });
  });

  it('lässt einen anderen Eintrag stehen und setzt nach der Frist auf zu', () => {
    mitWelt(welt(), () => {
      const vorlage = bruchKette();
      const erster = logge(vorlage, DONNERSTAG);
      const zweiter = logge(vorlage, DONNERSTAG);
      loescheEintrag(zweiter.eintrag.id, mittag(DONNERSTAG));
      expect(zeilen()[0]?.eintragId).toBe(erster.eintrag.id);
      expect(rueckkehrXp()).toBe(BONUS);
    });
    mitWelt(welt(), () => {
      const ergebnis = logge(bruchKette(), DONNERSTAG);
      loescheEintrag(ergebnis.eintrag.id, mittag(NACH_FRIST));
      expect(zeilen()).toEqual([{ status: 'zu', geoeffnetAm: DONNERSTAG, fristAm: FRIST, eintragId: null }]);
      expect(protokolle('rueckkehr_geschafft')).toEqual([]);
      expect(protokolle('rueckkehr_offen')).toEqual([]);
      expect(protokolle('rueckkehr_zu')).toEqual([NACH_FRIST]);
      expect(rueckkehrXp()).toBe(0);
      expect(kleinsteRueckkehrXp()).toBe(0);
    });
  });
});

describe('Trainingseinheit', () => {
  it('erfüllt beim ersten Arbeitssatz und bucht beim Abschluss nicht noch einmal', () => {
    mitWelt(welt(), () => {
      bruchKette();
      const angelegt = plan(
        'Unterkörper',
        [kraft('Kniebeuge', { zielSaetze: 1, aufwaermSaetze: 1, aufwaermWiederholungen: 5, aufwaermGewichtG: 20000 })],
        trainingsVorlage('Kraft'),
      );
      const einheit = starteEinheit(angelegt.id, mittag(DONNERSTAG));
      const aufwaermen = saetze(einheit).find((satz) => satz.aufwaermen);
      const arbeit = saetze(einheit).find((satz) => !satz.aufwaermen);
      hakeSatzAb(aufwaermen?.id ?? 0, true, mittag(DONNERSTAG));
      expect(protokolle('rueckkehr_geschafft')).toEqual([]);
      expect(rueckkehrXp()).toBe(0);
      hakeSatzAb(arbeit?.id ?? 0, true, mittag(DONNERSTAG));
      expect(rueckkehrXp()).toBe(BONUS);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(zeilen()[0]?.status).toBe('geschafft');
      schliesseEinheitAb(einheit.id, mittag(DONNERSTAG));
      expect(rueckkehrXp()).toBe(BONUS);
      expect(protokolle('rueckkehr_geschafft')).toEqual([DONNERSTAG]);
      expect(kleinsteRueckkehrXp()).toBeGreaterThan(0);
      expect(zeilen()).toHaveLength(1);
    });
  });
});
