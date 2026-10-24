import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bossBeute, bossLevelAusKampfXp } from '../../shared/spiel/xp.ts';
import { ausfuehren, eine, mitWelt, schliesseWelt } from '../db.ts';
import { ladeAttribute } from '../features/attribute/attribute.ts';
import { erstelleEintrag } from '../features/eintraege/eintraege.ts';
import { aendereEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { erstelleProjekt } from './struktur.ts';
import { erstelleVorlage } from '../features/taetigkeiten/vorlagen.ts';
import { aendereVorhaben, erstelleVorhaben } from '../features/ziele/vorhaben.ts';
import { lokalesDatum } from './zeit.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-hoechst-'));
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

function attributId(kennung: string): number {
  const id = eine<{ id: number }>('SELECT id FROM attribute WHERE kennung = ?', kennung)?.id;
  if (id === undefined) {
    throw new Error(`${kennung} fehlt.`);
  }
  return id;
}

function buche(quelle: string, id: number, xp: number, zeit: string): void {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES (?, ?, ?, ?)`,
    quelle,
    id,
    xp,
    zeit,
  );
}

describe('Höchststand eines Attributs', () => {
  it('merkt sich die Spitze und vergisst sie, sobald der Stand sie überholt', () => {
    mitWelt(welt(), () => {
      const koerper = attributId('koerper');
      buche('verfall', koerper, -20, '2026-02-02T10:00:00.000Z');
      buche('eintrag', koerper, 80, '2026-02-01T10:00:00.000Z');
      buche('bossangriff', koerper, -15, '2026-02-03T10:00:00.000Z');
      buche('investition', koerper, -5, '2026-02-04T10:00:00.000Z');

      const vorher = ladeAttribute(false).find((attribut) => attribut.id === koerper);
      expect(vorher?.level.xpGesamt).toBe(40);
      expect(vorher?.hoechstXp).toBe(80);

      buche('eintrag', koerper, 50, '2026-02-05T10:00:00.000Z');
      const nachher = ladeAttribute(false).find((attribut) => attribut.id === koerper);
      expect(nachher?.level.xpGesamt).toBe(90);
      expect(nachher?.hoechstXp).toBe(90);
    });
  });
});

describe('Boss-Sieg in der Chronik', () => {
  it('hängt Level, Kampf-XP und Beute nur an den siegreichen Eintrag', () => {
    const jetzt = new Date(2026, 9, 22, 12, 0, 0);
    mitWelt(welt(), () => {
      aendereEinstellungen({ funktionen: { bossAngriffe: true } });
      const koerper = attributId('koerper');
      const vorlageId = erstelleVorlage({
        name: 'Kämpfen',
        icon: 'swords',
        gewichte: [{ attributId: koerper, gewicht: 1 }],
      }).id;
      const projekt = erstelleProjekt({
        name: 'Arena',
        beschreibung: '',
        visionId: null,
        organisationId: null,
        standardVorlageId: vorlageId,
      });
      const boss = erstelleVorhaben(projekt.id, 'Drache', jetzt);
      aendereVorhaben(boss.id, { boss: { deadline: lokalesDatum(jetzt) } }, jetzt);

      const schlag = {
        projektId: projekt.id,
        vorlageId,
        abschluss: null as null,
        erkenntnis: '',
        stunden: 8,
        notiz: '',
        meilenstein: false,
        faehigkeitId: null,
        datum: null,
      };
      const vorher = erstelleEintrag({ ...schlag, vorhaben: { art: 'bestehend', id: boss.id } }, jetzt);
      expect(vorher.eintrag.bossSieg).toBeNull();

      const sieg = erstelleEintrag(
        { ...schlag, vorhaben: { art: 'bestehend', id: boss.id }, abschluss: 'geschafft' },
        new Date(2026, 9, 22, 18, 0, 0),
      );
      const kampfXp =
        eine<{ xp: number }>(
          'SELECT COALESCE(SUM(boss_schaden), 0) AS xp FROM eintraege WHERE vorhaben_id = ?',
          boss.id,
        )?.xp ?? 0;
      const level = bossLevelAusKampfXp(kampfXp);
      expect(sieg.eintrag.bossSieg).toEqual({ level, kampfXp, beute: bossBeute(level) });
      expect(sieg.eintrag.bossSieg?.beute).toBeGreaterThan(0);
      expect(sieg.belohnung.boss).toEqual({ titel: 'Drache', level, kampfXp });
      expect(sieg.belohnung.boni.some((bonus) => bonus.quelle === 'beute')).toBe(true);

      const normal = erstelleVorhaben(projekt.id, 'Nebenbei', jetzt);
      const geschafft = erstelleEintrag(
        { ...schlag, vorhaben: { art: 'bestehend', id: normal.id }, abschluss: 'geschafft', stunden: 1 },
        new Date(2026, 9, 22, 19, 0, 0),
      );
      expect(geschafft.eintrag.bossSieg).toBeNull();
    });
  });
});
