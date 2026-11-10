import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BAU_CLIENT_PFAD,
  clientPfadAus,
  datenbankPfadAus,
  KONFIG,
  kopiereDistInLeerenOrdner,
  LIVE_CLIENT_PFAD,
  stelleLiveClientBereit,
  zugangPfadAus,
} from './config.ts';
import { istEchteDatenbank } from './testpfad.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strideVorher = process.env.STRIDE_CLIENT_DIR;
const ascendVorher = process.env.ASCEND_CLIENT_DIR;

function setze(name: 'STRIDE_CLIENT_DIR' | 'ASCEND_CLIENT_DIR', wert: string | undefined): void {
  if (wert === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = wert;
  }
}

afterEach(() => {
  setze('STRIDE_CLIENT_DIR', strideVorher);
  setze('ASCEND_CLIENT_DIR', ascendVorher);
});

describe('clientPfadAus', () => {
  it('nimmt STRIDE_CLIENT_DIR vor ASCEND_CLIENT_DIR', () => {
    expect(clientPfadAus({
      STRIDE_CLIENT_DIR: path.join('relativ', 'stride'),
      ASCEND_CLIENT_DIR: path.join('relativ', 'ascend'),
    })).toBe(path.resolve(WURZEL, 'relativ', 'stride'));
  });

  it('fällt auf ASCEND_CLIENT_DIR zurück', () => {
    expect(clientPfadAus({
      ASCEND_CLIENT_DIR: path.join('relativ', 'ascend'),
    })).toBe(path.resolve(WURZEL, 'relativ', 'ascend'));
  });

  it('übergeht eine leere STRIDE_CLIENT_DIR und nimmt ASCEND_CLIENT_DIR', () => {
    expect(clientPfadAus({
      STRIDE_CLIENT_DIR: '   ',
      ASCEND_CLIENT_DIR: path.join('relativ', 'alt'),
    })).toBe(path.resolve(WURZEL, 'relativ', 'alt'));
  });

  it('ist ohne Variable der Live-Ordner und nicht der Bau-Ordner', () => {
    expect(clientPfadAus({})).toBe(LIVE_CLIENT_PFAD);
    expect(path.basename(LIVE_CLIENT_PFAD)).toBe('dist-live');
    expect(clientPfadAus({})).not.toBe(BAU_CLIENT_PFAD);
    expect(path.basename(BAU_CLIENT_PFAD)).toBe('dist');
  });

  it('lässt einen absoluten Pfad absolut', () => {
    const absolut = path.join(os.tmpdir(), 'stride-client-absolut');
    expect(clientPfadAus({ STRIDE_CLIENT_DIR: `  ${absolut}  ` })).toBe(path.normalize(absolut));
  });

  it('KONFIG.clientPfad ist die Auflösung der geladenen Umgebung', () => {
    expect(KONFIG.clientPfad).toBe(clientPfadAus());
  });

  it('lädt KONFIG aus STRIDE_CLIENT_DIR', async () => {
    const ziel = path.join(os.tmpdir(), 'stride-konfig-live');
    process.env.STRIDE_CLIENT_DIR = ziel;
    delete process.env.ASCEND_CLIENT_DIR;
    vi.resetModules();
    try {
      const neu = await import('./config.ts');
      expect(neu.KONFIG.clientPfad).toBe(path.normalize(ziel));
      expect(neu.KONFIG.clientPfad).not.toBe(neu.BAU_CLIENT_PFAD);
    } finally {
      vi.resetModules();
    }
  });
});

describe('Live-Ordner beim Start', () => {
  it('kopiert den Bau in einen leeren Live-Ordner und lässt einen gefüllten stehen', () => {
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'stride-client-'));
    try {
      const quelle = path.join(wurzel, 'dist');
      const ziel = path.join(wurzel, 'dist-live');
      fs.mkdirSync(path.join(quelle, 'unter'), { recursive: true });
      fs.writeFileSync(path.join(quelle, 'index.html'), 'erste');
      fs.writeFileSync(path.join(quelle, 'unter', 'app.js'), 'code');
      expect(stelleLiveClientBereit(ziel, quelle, ziel, false)).toBe(true);
      expect(fs.readFileSync(path.join(ziel, 'index.html'), 'utf8')).toBe('erste');
      expect(fs.readFileSync(path.join(ziel, 'unter', 'app.js'), 'utf8')).toBe('code');
      fs.writeFileSync(path.join(quelle, 'index.html'), 'zweite');
      expect(stelleLiveClientBereit(ziel, quelle, ziel, false)).toBe(false);
      expect(fs.readFileSync(path.join(ziel, 'index.html'), 'utf8')).toBe('erste');
    } finally {
      fs.rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('kopiert nicht auf die Quelle und nicht ohne index.html', () => {
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'stride-client-'));
    try {
      const quelle = path.join(wurzel, 'dist');
      fs.mkdirSync(quelle);
      expect(kopiereDistInLeerenOrdner(quelle, quelle)).toBe(false);
      const ziel = path.join(wurzel, 'dist-live');
      expect(kopiereDistInLeerenOrdner(ziel, quelle)).toBe(false);
      expect(fs.existsSync(ziel)).toBe(false);
    } finally {
      fs.rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it('schreibt im Testlauf nicht in den echten Live-Ordner', () => {
    const index = path.join(LIVE_CLIENT_PFAD, 'index.html');
    const vorher = fs.existsSync(index);
    expect(stelleLiveClientBereit()).toBe(false);
    expect(fs.existsSync(index)).toBe(vorher);
  });

  it('lässt einen anderen Ordner ungeändert', () => {
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'stride-client-'));
    try {
      const quelle = path.join(wurzel, 'dist');
      const ziel = path.join(wurzel, 'woanders');
      fs.mkdirSync(quelle);
      fs.writeFileSync(path.join(quelle, 'index.html'), 'x');
      expect(stelleLiveClientBereit(ziel, quelle, path.join(wurzel, 'dist-live'), false)).toBe(false);
      expect(fs.existsSync(ziel)).toBe(false);
    } finally {
      fs.rmSync(wurzel, { recursive: true, force: true });
    }
  });
});

describe('Datenbankpfade', () => {
  const prodApp = path.join(WURZEL, 'data', 'app.db');
  const prodZugang = path.join(WURZEL, 'data', 'zugang.db');
  const isoliertApp = path.join(os.tmpdir(), 'stride-pfad-app.db');
  const isoliertAlt = path.join(os.tmpdir(), 'stride-pfad-alt.db');
  const isoliertZugang = path.join(os.tmpdir(), 'stride-pfad-zugang.db');
  const isoliertZugangAlt = path.join(os.tmpdir(), 'stride-pfad-zugang-alt.db');

  it('löst ohne Namen die Standards auf und öffnet sie nicht', () => {
    expect(datenbankPfadAus({}, false)).toBe(prodApp);
    expect(zugangPfadAus(prodApp, {}, false)).toBe(prodZugang);
  });

  it('nimmt jeden Namen allein und lässt den neuen gewinnen', () => {
    expect(datenbankPfadAus({ STRIDE_DB_PFAD: isoliertApp }, true)).toBe(path.resolve(isoliertApp));
    expect(datenbankPfadAus({ DB_PFAD: isoliertAlt }, true)).toBe(path.resolve(isoliertAlt));
    expect(datenbankPfadAus({ STRIDE_DB_PFAD: isoliertApp, DB_PFAD: isoliertAlt }, true)).toBe(path.resolve(isoliertApp));
    const datenbank = datenbankPfadAus({ DB_PFAD: isoliertAlt }, true);
    expect(zugangPfadAus(datenbank, { STRIDE_ZUGANG_PFAD: isoliertZugang }, true)).toBe(path.resolve(isoliertZugang));
    expect(zugangPfadAus(datenbank, { ZUGANG_PFAD: isoliertZugangAlt }, true)).toBe(path.resolve(isoliertZugangAlt));
    expect(zugangPfadAus(datenbank, { STRIDE_ZUGANG_PFAD: isoliertZugang, ZUGANG_PFAD: isoliertZugangAlt }, true)).toBe(path.resolve(isoliertZugang));
  });

  it('lässt den Zugang neben der Datenbank, wenn nur die Datenbank gesetzt ist', () => {
    const datenbank = datenbankPfadAus({ STRIDE_DB_PFAD: isoliertApp, ZUGANG_PFAD: isoliertZugangAlt }, false);
    expect(datenbank).toBe(isoliertApp);
    expect(zugangPfadAus(datenbank, { DB_PFAD: isoliertAlt }, false)).toBe(path.join(path.dirname(isoliertApp), 'zugang.db'));
  });

  it('verweigert Produktionspfade im Test, bevor eine Datei geöffnet wird', () => {
    expect(istEchteDatenbank(prodApp)).toBe(true);
    expect(() => datenbankPfadAus({}, true)).toThrow('DB_PFAD');
    expect(() => datenbankPfadAus({ STRIDE_DB_PFAD: prodApp }, true)).toThrow(path.resolve(prodApp));
    expect(() => datenbankPfadAus({ DB_PFAD: prodApp }, true)).toThrow(path.resolve(prodApp));
    const datenbank = datenbankPfadAus({ STRIDE_DB_PFAD: isoliertApp }, true);
    expect(() => zugangPfadAus(datenbank, { STRIDE_ZUGANG_PFAD: prodZugang }, true)).toThrow(path.resolve(prodZugang));
    expect(() => zugangPfadAus(datenbank, { ZUGANG_PFAD: prodZugang }, true)).toThrow(path.resolve(prodZugang));
    expect(() => zugangPfadAus(prodApp, {}, true)).toThrow(path.resolve(prodZugang));
  });

  it('bindet KONFIG an die isolierten Namen dieses Laufs', () => {
    expect(KONFIG.datenbankPfad).toBe(process.env.STRIDE_DB_PFAD);
    expect(KONFIG.zugangPfad).toBe(process.env.STRIDE_ZUGANG_PFAD);
    expect(istEchteDatenbank(KONFIG.datenbankPfad)).toBe(false);
    expect(istEchteDatenbank(KONFIG.zugangPfad)).toBe(false);
  });
});

describe('Doku zum Client-Pfad', () => {
  it('nennt STRIDE_CLIENT_DIR in README und .env.example', () => {
    const readme = fs.readFileSync(path.join(WURZEL, 'README.md'), 'utf8');
    const beispiel = fs.readFileSync(path.join(WURZEL, '.env.example'), 'utf8');
    expect(readme).toContain('STRIDE_CLIENT_DIR');
    expect(readme).toContain('ASCEND_CLIENT_DIR');
    expect(readme).toContain('client/dist-live');
    expect(readme).toContain('client/dist');
    expect(beispiel).toContain('STRIDE_CLIENT_DIR');
    expect(beispiel).toContain('ASCEND_CLIENT_DIR');
    expect(beispiel).toContain('client/dist-live');
  });

  it('nennt STRIDE_TOKEN_SCHLUESSEL in README und .env.example', () => {
    const readme = fs.readFileSync(path.join(WURZEL, 'README.md'), 'utf8');
    const beispiel = fs.readFileSync(path.join(WURZEL, '.env.example'), 'utf8');
    expect(readme).toContain('STRIDE_TOKEN_SCHLUESSEL');
    expect(readme).toContain('ASCEND_TOKEN_SCHLUESSEL');
    expect(readme).toContain('unverschlüsselt');
    expect(beispiel).toContain('STRIDE_TOKEN_SCHLUESSEL');
    expect(beispiel).toContain('ASCEND_TOKEN_SCHLUESSEL');
    expect(beispiel).toContain('unverschlüsselt');
    expect(beispiel).not.toMatch(/^STRIDE_TOKEN_SCHLUESSEL=\S/m);
    expect(beispiel).not.toMatch(/^ASCEND_TOKEN_SCHLUESSEL=\S/m);
  });

  it('nennt die neuen Datenbanknamen vor den alten', () => {
    const readme = fs.readFileSync(path.join(WURZEL, 'README.md'), 'utf8');
    const beispiel = fs.readFileSync(path.join(WURZEL, '.env.example'), 'utf8');
    const setup = fs.readFileSync(path.join(WURZEL, 'vitest.setup.ts'), 'utf8');
    const start = fs.readFileSync(path.join(WURZEL, 'e2e', 'global-setup.ts'), 'utf8');
    expect(readme).toContain('STRIDE_DB_PFAD');
    expect(readme).toContain('STRIDE_ZUGANG_PFAD');
    expect(readme).toContain('DB_PFAD');
    expect(readme).toContain('ZUGANG_PFAD');
    expect(beispiel).toContain('STRIDE_DB_PFAD=data/app.db');
    expect(beispiel).toContain('STRIDE_ZUGANG_PFAD=data/zugang.db');
    expect(beispiel).not.toMatch(/^DB_PFAD=/m);
    expect(beispiel).not.toMatch(/^ZUGANG_PFAD=/m);
    expect(setup).toContain("schreibePfadVariable('DB_PFAD'");
    expect(setup).toContain("schreibePfadVariable('ZUGANG_PFAD'");
    expect(start).toContain('mitDatenbankPfaden(');
  });
});
