import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TAGE_PRO_WOCHE } from '../../../shared/spiel/datum.ts';
import { RUECKBLICK } from '../../../shared/spiel/xp.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../../db.ts';
import { aendereAttribut } from '../attribute/attribute.ts';
import { aendereEinstellungen } from '../einstellungen/einstellungen.ts';
import { lokalesDatum, plusTage, wochenbeginn } from '../../services/zeit.ts';
import { aktuelleWoche, ladeRueckblick, speichereRueckblick } from './rueckblick.ts';

const DONNERSTAG = '2026-10-22';
const ordner = mkdtempSync(path.join(tmpdir(), 'stride-rueckblick-'));
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

function geistId(): number {
  const id = eine<{ id: number }>(`SELECT id FROM attribute WHERE kennung = 'geist'`)?.id;
  if (id === undefined) {
    throw new Error('Geist fehlt.');
  }
  return id;
}

function geistXp(): number {
  return eine<{ xp: number }>(`SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE quelle = 'rueckblick'`)?.xp ?? 0;
}

describe('Rückblick Geist-XP', () => {
  it('belohnt die laufende und die vorige Woche, eine ältere nicht', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { rueckblick: true } });
      const jetzt = mittag(DONNERSTAG);
      const laufend = aktuelleWoche(jetzt);
      const vorige = lokalesDatum(wochenbeginn(jetzt, 1));
      const aelter = lokalesDatum(wochenbeginn(jetzt, 2));

      expect(ladeRueckblick(aelter, jetzt).bonusMoeglich).toBe(false);
      expect(ladeRueckblick(vorige, jetzt).bonusMoeglich).toBe(true);
      expect(ladeRueckblick(laufend, jetzt).bonusMoeglich).toBe(true);

      const alt = speichereRueckblick(aelter, { gut: 'Vergangen', lernen: '', fokus: '' }, jetzt);
      expect(alt.belohnung).toBeNull();
      expect(alt.rueckblick.antworten.gut).toBe('Vergangen');
      expect(geistXp()).toBe(0);

      const leer = speichereRueckblick(laufend, { gut: '   ', lernen: '', fokus: '' }, jetzt);
      expect(leer.belohnung).toBeNull();
      expect(geistXp()).toBe(0);

      const vorigeBelohnung = speichereRueckblick(vorige, { gut: 'Vorige', lernen: '', fokus: '' }, jetzt);
      expect(vorigeBelohnung.belohnung).not.toBeNull();
      expect(geistXp()).toBe(RUECKBLICK.geistXp);

      const erste = speichereRueckblick(laufend, { gut: 'Gut', lernen: '', fokus: '' }, jetzt);
      expect(erste.belohnung).not.toBeNull();
      expect(erste.rueckblick.belohnt).toBe(true);
      expect(erste.rueckblick.bonusMoeglich).toBe(false);
      expect(geistXp()).toBe(RUECKBLICK.geistXp * 2);

      const nochmal = speichereRueckblick(laufend, { gut: 'Besser', lernen: '', fokus: '' }, jetzt);
      expect(nochmal.belohnung).toBeNull();
      expect(geistXp()).toBe(RUECKBLICK.geistXp * 2);
    });
  });

  it('gibt kein Geist-XP, wenn Geist archiviert ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { rueckblick: true } });
      aendereAttribut(geistId(), { archiviert: true });
      const jetzt = mittag(DONNERSTAG);
      const woche = aktuelleWoche(jetzt);

      expect(ladeRueckblick(woche, jetzt).bonusMoeglich).toBe(false);
      const gespeichert = speichereRueckblick(woche, { gut: 'Ruhig', lernen: '', fokus: '' }, jetzt);
      expect(gespeichert.belohnung).toBeNull();
      expect(gespeichert.rueckblick.bonusMoeglich).toBe(false);
      expect(gespeichert.rueckblick.antworten.gut).toBe('Ruhig');
      expect(geistXp()).toBe(0);
    });
  });

  it('gibt kein Geist-XP, wenn Können aus ist', () => {
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { rueckblick: true, koennen: false } });
      const jetzt = mittag(DONNERSTAG);
      const woche = aktuelleWoche(jetzt);

      expect(ladeRueckblick(woche, jetzt).bonusMoeglich).toBe(false);
      const gespeichert = speichereRueckblick(woche, { gut: 'Ruhig', lernen: '', fokus: '' }, jetzt);
      expect(gespeichert.belohnung).toBeNull();
      expect(gespeichert.rueckblick.bonusMoeglich).toBe(false);
      expect(geistXp()).toBe(0);
    });
  });
});

describe('Wochenvergleich', () => {
  it('zählt diese Woche und die Vorwoche wie der Rückblick, ohne Abzug und ohne die Nachbarwochen', () => {
    mitWelt(welt(), () => {
      const jetzt = mittag(DONNERSTAG);
      const beginn = wochenbeginn(jetzt);
      const vorige = plusTage(beginn, -TAGE_PRO_WOCHE);
      const naechste = plusTage(beginn, TAGE_PRO_WOCHE);
      const vorher = ladeRueckblick(aktuelleWoche(jetzt), jetzt);
      const id = geistId();

      const buche = (xp: number, zeitpunkt: Date) => {
        ausfuehren(
          `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('eintrag', ?, ?, ?)`,
          id,
          xp,
          zeitpunkt.toISOString(),
        );
      };
      buche(11, beginn);
      buche(20, jetzt);
      buche(-30, mittag('2026-10-21'));
      buche(100, naechste);
      buche(4, vorige);
      buche(7, mittag('2026-10-15'));
      buche(50, mittag('2026-10-11'));

      const nachher = ladeRueckblick(aktuelleWoche(jetzt), jetzt);
      expect(nachher.aktuelleWoche).toBe(true);
      expect(nachher.xp - vorher.xp).toBe(31);
      expect(nachher.xpVorwoche - vorher.xpVorwoche).toBe(11);
    });
  });
});
