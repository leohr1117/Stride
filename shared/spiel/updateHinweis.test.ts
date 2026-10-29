import { describe, expect, it } from 'vitest';
import { AKTUELLE_VERSION, VERSIONEN } from '../versionen.ts';
import { entscheideUpdateHinweis, neuereVersionen, versionKleiner } from './updateHinweis.ts';

describe('updateHinweis', () => {
  it('zeigt bei mehreren verpassten Versionen genau eine Snackbar und keinen Punkt nach dem Changelog', () => {
    const verpasst = entscheideUpdateHinweis({ benachrichtigt: '3.33.0', gesehen: '3.33.0' }, AKTUELLE_VERSION, false);
    expect(verpasst.snackbar).toBe(true);
    expect(verpasst.badge).toBe(true);
    expect(verpasst.schreiben).toEqual({ benachrichtigt: AKTUELLE_VERSION });

    const danach = entscheideUpdateHinweis({ benachrichtigt: AKTUELLE_VERSION, gesehen: '3.33.0' }, AKTUELLE_VERSION, false);
    expect(danach.snackbar).toBe(false);
    expect(danach.badge).toBe(true);
    expect(danach.schreiben).toBeNull();

    const gelesen = entscheideUpdateHinweis(
      { benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION },
      AKTUELLE_VERSION,
      false,
    );
    expect(gelesen.snackbar).toBe(false);
    expect(gelesen.badge).toBe(false);

    const neu = neuereVersionen(VERSIONEN, '3.33.0');
    expect(neu.length).toBeGreaterThan(1);
    expect(neu[0]?.version).toBe(AKTUELLE_VERSION);
    expect(neu.some((eintrag) => eintrag.version === '3.33.0')).toBe(false);
    expect(neu.every((eintrag) => versionKleiner('3.33.0', eintrag.version))).toBe(true);
  });

  it('zeigt bei der Erstinstallation keine Snackbar und setzt beide Werte', () => {
    const frisch = entscheideUpdateHinweis({ benachrichtigt: null, gesehen: null }, AKTUELLE_VERSION, true);
    expect(frisch.snackbar).toBe(false);
    expect(frisch.badge).toBe(false);
    expect(frisch.schreiben).toEqual({ benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION });

    const gesetzt = entscheideUpdateHinweis(
      { benachrichtigt: AKTUELLE_VERSION, gesehen: AKTUELLE_VERSION },
      AKTUELLE_VERSION,
      true,
    );
    expect(gesetzt.schreiben).toBeNull();
  });

  it('behandelt ein bestehendes Profil ohne Werte als ein Update', () => {
    const alt = entscheideUpdateHinweis({ benachrichtigt: null, gesehen: null }, AKTUELLE_VERSION, false);
    expect(alt.snackbar).toBe(true);
    expect(alt.badge).toBe(true);
    expect(alt.schreiben).toEqual({ benachrichtigt: AKTUELLE_VERSION });
  });
});
