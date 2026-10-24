import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mitWelt, schliesseWelt } from '../db.ts';
import { erstelleMitglied, entferneKonto } from '../features/zugang/konten.ts';
import { aendereEinstellungen, ladeEinstellungen } from '../features/einstellungen/einstellungen.ts';
import { legeBenutzerAn, listeKonten, schliesseZugang, setzeSperrenZurueck, verwendeZugang } from '../features/zugang/zugang.ts';

const ordner = mkdtempSync(path.join(tmpdir(), 'ascend-welten-'));
let nummer = 0;

beforeEach(() => {
  nummer += 1;
  verwendeZugang(path.join(ordner, `${nummer}-zugang.db`));
  setzeSperrenZurueck();
});

afterAll(() => {
  schliesseZugang();
});

describe('welten', () => {
  it('hält zwei Welten auseinander', () => {
    const anna = path.join(ordner, 'anna.db');
    const ben = path.join(ordner, 'ben.db');
    mitWelt(anna, () => aendereEinstellungen({ charakterName: 'Anna' }));
    mitWelt(ben, () => aendereEinstellungen({ charakterName: 'Ben' }));
    expect(mitWelt(anna, () => ladeEinstellungen().charakterName)).toBe('Anna');
    expect(mitWelt(ben, () => ladeEinstellungen().charakterName)).toBe('Ben');
    schliesseWelt(anna);
    schliesseWelt(ben);
  });

  it('löscht mit dem Account auch die Weltdatei', () => {
    legeBenutzerAn({ benutzername: 'Inhaber', passwort: 'geheimes-passwort', rolle: 'inhaber', weltdatei: 'app.db' });
    const mitglied = erstelleMitglied({ benutzername: 'Gast', passwort: 'anderes-passwort', profilname: 'Gast' });
    const datei = path.join(ordner, 'welten', `${mitglied.id}.db`);
    expect(fs.existsSync(datei)).toBe(true);
    expect(mitWelt(datei, () => ladeEinstellungen().charakterName)).toBe('Gast');
    entferneKonto(mitglied.id);
    expect(fs.existsSync(datei)).toBe(false);
    expect(listeKonten().map((konto) => konto.benutzername)).toEqual(['Inhaber']);
    expect(() => entferneKonto(listeKonten()[0].id)).toThrow('bleibt');
  });
});
