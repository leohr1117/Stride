import { describe, expect, it } from 'vitest';
import { APP_ADRESSE_STANDARD, appAdresse, appHost, gueltigeAppAdresse } from './appAdresse.ts';
import { DATENSCHUTZ, datenschutz } from './recht/datenschutz.ts';
import { RECHT_DOKUMENTE, rechtDokumente } from './recht/dokumente.ts';
import type { RechtBlock } from './recht/arten.ts';
import { NUTZUNG, nutzung } from './recht/nutzung.ts';

const ZIEL = 'https://wupo.app';

function texte(bloecke: readonly RechtBlock[]): string {
  return bloecke
    .map((block) => {
      if (block.art === 'liste') {
        return block.punkte.join('\n');
      }
      if (block.art === 'quelle') {
        return '';
      }
      return block.text;
    })
    .join('\n');
}

describe('App-Adresse', () => {
  it('bleibt ohne Wert bei der heutigen Adresse', () => {
    expect(APP_ADRESSE_STANDARD).toBe('https://stride.leohr.de');
    expect(gueltigeAppAdresse(undefined)).toBeNull();
    expect(gueltigeAppAdresse(null)).toBeNull();
    expect(gueltigeAppAdresse('')).toBeNull();
    expect(gueltigeAppAdresse('   ')).toBeNull();
    expect(appAdresse(undefined)).toBe(APP_ADRESSE_STANDARD);
    expect(appHost(appAdresse(undefined))).toBe('stride.leohr.de');
  });

  it('nimmt https://stride.leohr.de und https://wupo.app an', () => {
    expect(gueltigeAppAdresse(APP_ADRESSE_STANDARD)).toBe('https://stride.leohr.de');
    expect(gueltigeAppAdresse(`  ${ZIEL}/  `)).toBe(ZIEL);
    expect(appAdresse(ZIEL)).toBe(ZIEL);
    expect(appHost(ZIEL)).toBe('wupo.app');
    expect(appHost(APP_ADRESSE_STANDARD)).toBe('stride.leohr.de');
  });

  it('lehnt andere Adressen ab und fällt auf den Standard zurück', () => {
    expect(gueltigeAppAdresse('http://wupo.app')).toBeNull();
    expect(gueltigeAppAdresse('https://wupo.app/pfad')).toBeNull();
    expect(gueltigeAppAdresse('https://wupo.app?x=1')).toBeNull();
    expect(gueltigeAppAdresse('https://nutzer:geheim@wupo.app')).toBeNull();
    expect(gueltigeAppAdresse('nicht-eine-url')).toBeNull();
    expect(appAdresse('http://wupo.app')).toBe(APP_ADRESSE_STANDARD);
  });

  it('setzt die Rechtstexte für beide Werte und lässt den Standard wortgleich', () => {
    expect(texte(datenschutz())).toBe(texte(DATENSCHUTZ));
    expect(texte(nutzung())).toBe(texte(NUTZUNG));
    expect(texte(rechtDokumente().datenschutz)).toBe(texte(DATENSCHUTZ));
    expect(texte(rechtDokumente().nutzung)).toBe(texte(NUTZUNG));
    expect(texte(DATENSCHUTZ)).toContain('Wupo (stride.leohr.de)');
    expect(texte(DATENSCHUTZ)).not.toContain('https://stride.leohr.de');
    expect(texte(NUTZUNG)).toContain('unter stride.leohr.de');
    expect(texte(NUTZUNG)).toContain('at stride.leohr.de');
    expect(texte(NUTZUNG)).toContain('kontakt@leohr.de');
    expect(texte(NUTZUNG)).toContain('github.com/leohr1117/Stride');

    const zielSchutz = texte(datenschutz(ZIEL));
    const zielNutzung = texte(nutzung(ZIEL));
    expect(zielSchutz).toContain('Wupo (wupo.app)');
    expect(zielSchutz).not.toContain('stride.leohr.de');
    expect(zielSchutz).not.toContain('https://wupo.app');
    expect(zielNutzung).toContain('unter wupo.app');
    expect(zielNutzung).toContain('at wupo.app');
    expect(zielNutzung).not.toContain('stride.leohr.de');
    expect(zielNutzung).toContain('kontakt@leohr.de');
    expect(texte(datenschutz('http://wupo.app'))).toContain('stride.leohr.de');
    expect(texte(rechtDokumente(ZIEL).impressum)).toBe(texte(RECHT_DOKUMENTE.impressum));
    expect(rechtDokumente(ZIEL).impressum).toBe(RECHT_DOKUMENTE.impressum);
  });
});
