import { describe, expect, it } from 'vitest';
import { elternZiel, HERKUNFT_MAX, herkunftsLabel, herkunftsZiel, istHauptseite, schiebeHerkunft, seiteZeigtEigenenZurueck, trainingZurueck, zurueckPasst } from './herkunft.ts';
import { LEISTE_STANDARD } from './leiste.ts';

const MEHR = { pfad: '/mehr', label: 'Mehr' };

describe('schiebeHerkunft', () => {
  it('merkt den Weg und nimmt ihn beim Zurückgehen wieder weg', () => {
    const handbuch = schiebeHerkunft([], '/handbuch');
    const chronik = schiebeHerkunft(handbuch, '/chronik');
    const basis = schiebeHerkunft(chronik, '/basis');
    expect(basis).toEqual(['/handbuch', '/chronik', '/basis']);
    expect(schiebeHerkunft(basis, '/chronik')).toEqual(['/handbuch', '/chronik']);
    expect(schiebeHerkunft(basis, '/basis')).toBe(basis);
  });

  it('lässt Umleitungen und unbekannte Pfade aus', () => {
    const stapel = schiebeHerkunft([], '/handbuch');
    expect(schiebeHerkunft(stapel, '/demnaechst')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/konto')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/inhalte/taetigkeiten')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/profil/unbekannt')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/profil/stufen')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/training/plaene/neu')).toEqual([...stapel, '/training/plaene/neu']);
  });

  it('behält nur die letzten Einträge', () => {
    let stapel: readonly string[] = [];
    for (let index = 0; index < HERKUNFT_MAX + 3; index += 1) {
      stapel = schiebeHerkunft(stapel, `/projekte/${index}`);
    }
    expect(stapel).toHaveLength(HERKUNFT_MAX);
    expect(stapel.at(-1)).toBe(`/projekte/${HERKUNFT_MAX + 2}`);
    expect(stapel[0]).toBe('/projekte/3');
  });
});

describe('elternZiel', () => {
  it('führt Unterseiten zur Elternseite und lässt Haupt-Tabs ohne Pfeil', () => {
    expect(istHauptseite('/')).toBe(true);
    expect(istHauptseite('/mehr')).toBe(true);
    expect(istHauptseite('/vorbilder')).toBe(true);
    expect(istHauptseite('/mehr/darstellung')).toBe(false);
    expect(elternZiel('/')).toBeNull();
    expect(elternZiel('/mehr')).toBeNull();
    expect(elternZiel('/ziele')).toBeNull();
    expect(elternZiel('/charakter')).toEqual({ pfad: '/', label: 'Übersicht' });
    expect(elternZiel('/mehr/darstellung')).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/mehr/darstellung/leiste')).toEqual({ pfad: '/mehr/darstellung', label: 'Darstellung' });
    expect(elternZiel('/mehr/darstellung/ansicht')).toBeNull();
    expect(elternZiel('/mehr/profil/fokus')).toEqual({ pfad: '/mehr/profil', label: 'Profil' });
    expect(elternZiel('/mehr/inhalte/verbindungen')).toEqual({ pfad: '/mehr/funktionen', label: 'App & Verbindungen' });
    expect(elternZiel('/projekte/4')).toEqual({ pfad: '/ziele', label: 'Ziele' });
    expect(elternZiel('/faehigkeiten/2')).toEqual({ pfad: '/charakter', label: 'Charakter' });
    expect(elternZiel('/vorbilder/ronaldo')).toEqual({ pfad: '/vorbilder', label: 'Vorbilder' });
    expect(istHauptseite('/training')).toBe(false);
    expect(elternZiel('/training')).toBeNull();
    expect(elternZiel('/training/plaene/neu')).toEqual({ pfad: '/training', label: 'Training' });
    expect(elternZiel('/training/plaene/4')).toEqual({ pfad: '/training', label: 'Training' });
    expect(elternZiel('/training/einheiten/8')).toEqual({ pfad: '/training', label: 'Training' });
    expect(elternZiel('/training/einheiten/8', { von: '/' })).toEqual({ pfad: '/', label: 'Übersicht' });
    expect(elternZiel('/training/einheiten/8', { von: '/ziele' })).toEqual({ pfad: '/training', label: 'Training' });
    expect(elternZiel('/training/uebungen/3')).toEqual({ pfad: '/training', label: 'Training' });
    expect(elternZiel('/training/uebungen/3', { einheit: '/training/einheiten/8', planName: 'Unterkörper' })).toEqual({
      pfad: '/training/einheiten/8',
      label: 'Unterkörper',
    });
    expect(elternZiel('/training/uebungen/3', { einheit: '/training/einheiten/8', planName: '  ' })).toEqual({
      pfad: '/training',
      label: 'Training',
    });
    expect(trainingZurueck('/training/uebungen/3/', { einheit: '/training/einheiten/8/', planName: 'Unterkörper' })).toEqual({
      pfad: '/training/einheiten/8',
      label: 'Unterkörper',
    });
  });
});

describe('herkunftsZiel', () => {
  it('nimmt die Elternseite, nicht die zuletzt besuchte Seite', () => {
    expect(herkunftsZiel(['/chronik'], '/chronik', LEISTE_STANDARD, MEHR)).toBeNull();
    expect(herkunftsZiel(['/handbuch', '/chronik'], '/chronik', LEISTE_STANDARD, MEHR)).toBeNull();
    expect(herkunftsZiel(['/handbuch', '/mehr/inhalte'], '/mehr/inhalte', LEISTE_STANDARD, MEHR)).toEqual(MEHR);
    expect(herkunftsZiel(['/ziele', '/projekte/4'], '/projekte/4', LEISTE_STANDARD, { pfad: '/ziele', label: 'Ziele' })).toEqual({
      pfad: '/ziele',
      label: 'Ziele',
    });
    expect(herkunftsZiel(['/mehr/darstellung/leiste', '/'], '/mehr/darstellung/leiste', LEISTE_STANDARD, MEHR)).toEqual({
      pfad: '/mehr/darstellung',
      label: 'Darstellung',
    });
  });

  it('zeigt auf Haupt-Tabs keinen Pfeil', () => {
    expect(herkunftsZiel(['/', '/ziele'], '/ziele', LEISTE_STANDARD, null)).toBeNull();
    expect(herkunftsZiel(['/handbuch', '/ziele'], '/ziele', ['/', '/handbuch', '/ziele', '/mehr'], null)).toBeNull();
    expect(herkunftsZiel(['/handbuch', '/ziele'], '/ziele', LEISTE_STANDARD, null)).toBeNull();
    expect(herkunftsZiel(['/mehr/darstellung', '/'], '/', LEISTE_STANDARD, MEHR)).toBeNull();
  });

  it('benennt bekannte Seiten', () => {
    expect(herkunftsLabel('/mehr/profil/fokus')).toBe('Fokus');
    expect(herkunftsLabel('/mehr/profil/ziel')).toBe('Was willst du erreichen?');
    expect(herkunftsLabel('/faehigkeiten/2')).toBe('Fähigkeit');
    expect(herkunftsLabel('/vorbilder/ada')).toBe('Vorbild');
    expect(herkunftsLabel('/verbindungen')).toBeNull();
    expect(herkunftsLabel('/training')).toBeNull();
    expect(herkunftsLabel('/training/plaene/neu')).toBe('Plan');
    expect(herkunftsLabel('/training/einheiten/8')).toBe('Einheit');
    expect(herkunftsLabel('/training/uebungen/3')).toBe('Übung');
    expect(seiteZeigtEigenenZurueck('/mehr/inhalte')).toBe(true);
    expect(seiteZeigtEigenenZurueck('/ziele')).toBe(false);
    expect(seiteZeigtEigenenZurueck('/mehr')).toBe(false);
    expect(seiteZeigtEigenenZurueck('/training')).toBe(false);
    expect(seiteZeigtEigenenZurueck('/training/plaene/4')).toBe(true);
    expect(seiteZeigtEigenenZurueck('/training/einheiten/8')).toBe(true);
    expect(seiteZeigtEigenenZurueck('/training/uebungen/3')).toBe(true);
    expect(zurueckPasst('/training/einheiten/8', '/training')).toBe(true);
    expect(zurueckPasst('/training/einheiten/8', '/')).toBe(true);
    expect(zurueckPasst('/training/einheiten/8', '/mehr')).toBe(false);
    expect(zurueckPasst('/training/uebungen/3', '/training/einheiten/8')).toBe(true);
    expect(zurueckPasst('/training/uebungen/3', '/mehr')).toBe(false);
    expect(zurueckPasst('/training/plaene/neu', '/')).toBe(false);
    expect(zurueckPasst('/training/plaene/neu', '/training')).toBe(true);
    expect(herkunftsZiel(['/'], '/training/einheiten/8', LEISTE_STANDARD, null, { von: '/' })).toEqual({
      pfad: '/',
      label: 'Übersicht',
    });
    expect(herkunftsZiel(['/training'], '/training', LEISTE_STANDARD, null)).toBeNull();
  });
});
