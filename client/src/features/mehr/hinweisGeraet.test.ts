import { afterEach, describe, expect, it } from 'vitest';
import { setzeAktiveSprache } from '../../../../shared/sprache/index.ts';
import { einschaltKlick, iosOhneApp, istIosGeraet, kachelText, schluesselBytes, type HinweisGeraet } from './hinweisGeraet.ts';

const SCHLUESSEL = 'oeffentlich';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';

function geraet(
  userAgent: string,
  maxTouchPoints: number,
  standalone: boolean,
  berechtigung: HinweisGeraet['berechtigung'],
): HinweisGeraet {
  return { userAgent, maxTouchPoints, standalone, berechtigung };
}

describe('hinweisGeraet', () => {
  afterEach(() => {
    setzeAktiveSprache('de');
  });

  it('erkennt iPhone, iPad und ein iPad, das sich als Mac meldet', () => {
    expect(istIosGeraet(IPHONE, 0)).toBe(true);
    expect(istIosGeraet(IPAD, 0)).toBe(true);
    expect(istIosGeraet('Mozilla/5.0 (iPod touch)', 0)).toBe(true);
    expect(istIosGeraet(MAC, 5)).toBe(true);
    expect(istIosGeraet(MAC, 1)).toBe(false);
    expect(istIosGeraet(ANDROID, 5)).toBe(false);
  });

  it('lässt den iOS-Tab aus und fragt nicht', () => {
    const tab = geraet(IPHONE, 5, false, 'default');
    expect(iosOhneApp(tab)).toBe(true);
    expect(einschaltKlick(tab, SCHLUESSEL)).toBe('gesperrt');
    expect(einschaltKlick(geraet(MAC, 5, false, 'default'), SCHLUESSEL)).toBe('gesperrt');
  });

  it('lässt iOS in der App und Android den Knopf aktiv', () => {
    expect(einschaltKlick(geraet(IPHONE, 5, true, 'default'), SCHLUESSEL)).toBe('fragen');
    expect(einschaltKlick(geraet(ANDROID, 5, false, 'default'), SCHLUESSEL)).toBe('fragen');
    expect(einschaltKlick(geraet(MAC, 0, false, 'default'), SCHLUESSEL)).toBe('fragen');
  });

  it('fragt nach einer Ablehnung nicht noch einmal und meldet eine vorhandene Erlaubnis direkt an', () => {
    const abgelehnt = geraet(ANDROID, 5, false, 'denied');
    expect(einschaltKlick(abgelehnt, SCHLUESSEL)).toBe('still');
    expect(einschaltKlick(abgelehnt, SCHLUESSEL)).toBe('still');
    expect(einschaltKlick(geraet(ANDROID, 5, false, 'granted'), SCHLUESSEL)).toBe('anmelden');
  });

  it('sperrt den Knopf ohne Schlüssel und ohne Notification', () => {
    expect(einschaltKlick(geraet(ANDROID, 5, false, 'default'), null)).toBe('gesperrt');
    expect(einschaltKlick(geraet(ANDROID, 5, false, 'default'), '')).toBe('gesperrt');
    expect(einschaltKlick(geraet(ANDROID, 5, false, 'fehlt'), SCHLUESSEL)).toBe('gesperrt');
  });

  it('nennt die Kachel aus, an oder mit der Gerätezahl', () => {
    expect(kachelText(0)).toBe('Aus');
    expect(kachelText(1)).toBe('An');
    expect(kachelText(2)).toBe('2 Geräte');
    setzeAktiveSprache('en');
    expect(kachelText(0)).toBe('Off');
    expect(kachelText(1)).toBe('On');
    expect(kachelText(3)).toBe('3 devices');
  });

  it('macht aus dem öffentlichen Schlüssel Bytes', () => {
    expect([...schluesselBytes('YQ')]).toEqual([97]);
    expect([...schluesselBytes('YQ==')]).toEqual([97]);
    expect([...schluesselBytes('-A')]).toEqual([...schluesselBytes('+A')]);
  });
});
