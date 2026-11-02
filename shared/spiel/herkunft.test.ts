import { describe, expect, it } from 'vitest';
import {
  elternZiel,
  HERKUNFT_MAX,
  herkunftsLabel,
  herkunftsZiel,
  istHauptseite,
  istLeistenplatz,
  ketteUnter,
  schiebeHerkunft,
} from './herkunft.ts';
import {
  anfangDesPlatzes,
  leererStapel,
  oeffneImStapel,
  stapelNachLaden,
  wechslePlatz,
} from './herkunftStapel.ts';
import { LEISTE_STANDARD } from './leiste.ts';

const LEISTE = ['/', '/ziele', '/mehr'] as const;

describe('schiebeHerkunft', () => {
  it('merkt den Weg und nimmt ihn beim Zurückgehen wieder weg', () => {
    const handbuch = schiebeHerkunft([], '/handbuch');
    const chronik = schiebeHerkunft(handbuch, '/chronik');
    const basis = schiebeHerkunft(chronik, '/basis');
    expect(basis).toEqual(['/handbuch', '/chronik', '/basis']);
    expect(schiebeHerkunft(basis, '/chronik')).toEqual(['/handbuch', '/chronik']);
    expect(schiebeHerkunft(basis, '/basis')).toBe(basis);
  });

  it('lässt Umleitungen, Training und unbekannte Pfade aus', () => {
    const stapel = schiebeHerkunft([], '/handbuch');
    expect(schiebeHerkunft(stapel, '/demnaechst')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/konto')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/training/plaene/neu')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/training/einheiten/8')).toBe(stapel);
    expect(schiebeHerkunft(stapel, '/mehr/benachrichtigungen')).toEqual([...stapel, '/mehr/benachrichtigungen']);
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
  it('nimmt die neuen Eltern und lässt einen Leistenplatz ohne Eltern', () => {
    expect(istHauptseite('/')).toBe(true);
    expect(elternZiel('/')).toBeNull();
    expect(elternZiel('/mehr', { leiste: LEISTE })).toBeNull();
    expect(elternZiel('/mehr', { leiste: ['/'] })).toEqual({ pfad: '/', label: 'Heute' });
    expect(elternZiel('/ziele', { leiste: LEISTE })).toBeNull();
    expect(elternZiel('/ziele', { leiste: ['/', '/mehr'] })).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/charakter', { leiste: ['/'] })).toEqual({ pfad: '/', label: 'Heute' });
    expect(elternZiel('/charakter', { leiste: ['/', '/charakter'] })).toBeNull();
    expect(elternZiel('/laufend', { leiste: ['/'] })).toEqual({ pfad: '/ziele', label: 'Ziele' });
    expect(elternZiel('/vorbilder', { leiste: ['/'] })).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/chronik', { leiste: LEISTE_STANDARD })).toBeNull();
    expect(elternZiel('/chronik', { leiste: ['/', '/ziele', '/mehr'] })).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/rueckblick', { leiste: ['/'], verlaufAn: true })).toEqual({ pfad: '/chronik', label: 'Verlauf' });
    expect(elternZiel('/statistiken', { leiste: ['/'], verlaufAn: false })).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/mehr/darstellung/leiste')).toEqual({ pfad: '/mehr/darstellung', label: 'Darstellung' });
    expect(elternZiel('/mehr/darstellung/ansicht')).toBeNull();
    expect(elternZiel('/mehr/profil/fokus')).toEqual({ pfad: '/mehr/profil', label: 'Konto' });
    expect(elternZiel('/mehr/profil/benutzernamen')).toBeNull();
    expect(elternZiel('/mehr/profil/benutzernamen/4')).toBeNull();
    expect(schiebeHerkunft(['/mehr/profil'], '/mehr/profil/benutzernamen')).toEqual(['/mehr/profil']);
    expect(schiebeHerkunft(['/mehr/profil'], '/mehr/profil/benutzernamen/4')).toEqual(['/mehr/profil']);
    expect(elternZiel('/mehr/inhalte/verbindungen')).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/mehr/uebersicht')).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/mehr/neu')).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/projekte/4')).toEqual({ pfad: '/ziele', label: 'Ziele' });
    expect(elternZiel('/faehigkeiten')).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(elternZiel('/faehigkeiten', { leiste: ['/', '/faehigkeiten'] })).toBeNull();
    expect(elternZiel('/koennen')).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(elternZiel('/haben')).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(elternZiel('/investitionen')).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(elternZiel('/koennen', { leiste: ['/', '/koennen'] })).toBeNull();
    expect(elternZiel('/haben', { leiste: ['/', '/haben'] })).toBeNull();
    expect(elternZiel('/investitionen', { leiste: ['/', '/investitionen'] })).toBeNull();
    expect(elternZiel('/faehigkeiten/2')).toEqual({ pfad: '/faehigkeiten', label: 'Fähigkeiten' });
    expect(elternZiel('/mehr/inhalte')).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(elternZiel('/mehr/inhalte', { leiste: ['/', '/mehr/inhalte'] })).toBeNull();
    expect(elternZiel('/vorbilder/ronaldo')).toEqual({ pfad: '/vorbilder', label: 'Vorbilder' });
    expect(elternZiel('/training')).toBeNull();
  });
});

describe('herkunftsLabel', () => {
  it('nennt die neuen Namen nur als Ziel des Pfeils', () => {
    expect(herkunftsLabel('/')).toBe('Heute');
    expect(herkunftsLabel('/charakter')).toBe('Profil');
    expect(herkunftsLabel('/mehr/profil')).toBe('Konto');
    expect(herkunftsLabel('/chronik')).toBe('Verlauf');
    expect(herkunftsLabel('/statistiken')).toBe('Statistik');
    expect(herkunftsLabel('/mehr/uebersicht')).toBe('Karten auf Heute');
    expect(herkunftsLabel('/mehr/funktionen')).toBe('Bereiche');
    expect(herkunftsLabel('/mehr/neu')).toBe('Was ist neu');
    expect(herkunftsLabel('/faehigkeiten')).toBe('Fähigkeiten');
    expect(herkunftsLabel('/koennen')).toBe('Können');
    expect(herkunftsLabel('/haben')).toBe('Haben');
    expect(herkunftsLabel('/investitionen')).toBe('Investitionen');
  });
});

describe('herkunftsZiel', () => {
  it('nimmt die Herkunft aus dem Stapel, nicht die Elternseite', () => {
    const nav = oeffneImStapel(leererStapel('/', '/'), '/projekte/4');
    expect(herkunftsZiel(nav.orte['/'] ?? [], '/projekte/4', [...LEISTE], { pfad: '/ziele', label: 'Ziele' })).toEqual({
      pfad: '/',
      label: 'Heute',
    });
  });

  it('fällt ohne Herkunft auf die Elternseite und lässt Leistenplätze ohne Pfeil', () => {
    expect(herkunftsZiel([], '/projekte/4', [...LEISTE], null)).toEqual({ pfad: '/ziele', label: 'Ziele' });
    expect(herkunftsZiel([], '/vorbilder', ['/'], null)).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(herkunftsZiel(['/vorbilder'], '/vorbilder', ['/'], null, { leiste: ['/'], seitenleiste: ['/vorbilder'] })).toBeNull();
    expect(istLeistenplatz('/ziele', LEISTE, [])).toBe(true);
    expect(herkunftsZiel(['/'], '/ziele', [...LEISTE], null)).toBeNull();
    expect(herkunftsZiel(['/mehr', '/mehr/uebersicht', '/mehr/funktionen'], '/mehr/funktionen', [...LEISTE], null)).toEqual({
      pfad: '/mehr/uebersicht',
      label: 'Karten auf Heute',
    });
    expect(herkunftsZiel([], '/mehr/inhalte', [...LEISTE], null)).toEqual({ pfad: '/mehr', label: 'Mehr' });
    expect(herkunftsZiel(['/mehr/inhalte'], '/mehr/inhalte', [...LEISTE], null, { leiste: [...LEISTE], seitenleiste: ['/mehr/inhalte'] })).toBeNull();
    expect(herkunftsZiel([], '/koennen', [...LEISTE], null)).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(herkunftsZiel([], '/haben', [...LEISTE], null)).toEqual({ pfad: '/charakter', label: 'Profil' });
    expect(herkunftsZiel([], '/investitionen', [...LEISTE], null)).toEqual({ pfad: '/charakter', label: 'Profil' });
  });
});

describe('stapel', () => {
  it('behält andere Plätze und setzt den Anfang auf die Platzseite', () => {
    let stand = oeffneImStapel(leererStapel('/ziele', '/ziele'), '/projekte/5');
    const heute = wechslePlatz(stand, '/');
    stand = oeffneImStapel(heute.nav, '/projekte/9');
    const zurueck = wechslePlatz(stand, '/ziele');
    expect(zurueck.adresse).toBe('/projekte/5');
    expect(zurueck.nav.aktiv).toBe('/ziele');
    const anfang = anfangDesPlatzes(zurueck.nav);
    expect(anfang.adresse).toBe('/ziele');
    expect(anfang.nav.orte['/']).toEqual(['/', '/projekte/9']);
  });

  it('setzt beim Direktaufruf nur den passenden Platz zurück', () => {
    const alt = oeffneImStapel(leererStapel('/', '/'), '/projekte/3');
    const neu = stapelNachLaden(alt, '/vorbilder/ronaldo', '/mehr');
    expect(neu.aktiv).toBe('/mehr');
    expect(neu.orte['/mehr']).toEqual(['/vorbilder/ronaldo']);
    expect(neu.orte['/']).toEqual(['/', '/projekte/3']);
    expect(stapelNachLaden(neu, '/vorbilder/ronaldo', '/')).toBe(neu);
  });
});

describe('ketteUnter', () => {
  it('legt Heute unter jeden anderen Platz', () => {
    expect(ketteUnter('/', { leiste: [...LEISTE] })).toEqual(['/']);
    expect(ketteUnter('/ziele', { leiste: [...LEISTE] })).toEqual(['/', '/ziele']);
    expect(ketteUnter('/projekte/5', { leiste: [...LEISTE] })).toEqual(['/', '/ziele', '/projekte/5']);
    expect(ketteUnter('/vorbilder', { leiste: ['/', '/mehr'] })).toEqual(['/', '/mehr', '/vorbilder']);
    expect(ketteUnter('/koennen', { leiste: [...LEISTE] })).toEqual(['/', '/charakter', '/koennen']);
    expect(ketteUnter('/mehr/inhalte', { leiste: [...LEISTE] })).toEqual(['/', '/mehr', '/mehr/inhalte']);
    expect(ketteUnter('/mehr/inhalte', { leiste: [...LEISTE], seitenleiste: ['/mehr/inhalte'] })).toEqual(['/', '/mehr/inhalte']);
  });
});
