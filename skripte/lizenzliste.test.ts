import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  behaeltPaket,
  erzeugeLizenztext,
  leseCommit,
  parseNpmLs,
  robotoEintrag,
  sammleProduktionspakete,
  type NpmKnoten,
} from './lizenzliste.ts';

function wurzelAn(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stride-lizenz-'));
}

function schreibeWurzel(ordner: string, dependencies: Record<string, string>): void {
  fs.writeFileSync(path.join(ordner, 'package.json'), JSON.stringify({ name: 'stride', version: '1.0.0', dependencies }));
}

function schreibePaket(
  ordner: string,
  name: string,
  version: string,
  felder: Record<string, unknown>,
  dateien: Record<string, string>,
): void {
  fs.mkdirSync(ordner, { recursive: true });
  fs.writeFileSync(path.join(ordner, 'package.json'), JSON.stringify({ name, version, ...felder }));
  for (const [datei, inhalt] of Object.entries(dateien)) {
    fs.writeFileSync(path.join(ordner, datei), inhalt);
  }
}

describe('lizenzliste', () => {
  it('nennt Name, Version, SPDX, Copyright und den vollen Text, bei Apache auch NOTICE', () => {
    const wurzel = wurzelAn();
    const alpha = path.join(wurzel, 'pakete', 'alpha');
    const beta = path.join(wurzel, 'pakete', 'beta');
    const gamma = path.join(wurzel, 'pakete', 'gamma');
    schreibeWurzel(wurzel, { alpha: '1.0.0', beta: '2.0.0', gamma: '3.0.0' });
    schreibePaket(alpha, 'm-paket', '1.2.3', { license: 'MIT' }, {
      LICENSE: 'MIT License\n\nPermission is hereby granted, free of charge, EINMALIG-MIT.\n<!-- weg -->',
      NOTICE: 'Copyright (c) 1999 AusNotice\nNICHT_ANHAENGEN',
    });
    schreibePaket(beta, 'a-paket', '9.0.0', { license: 'Apache-2.0' }, {
      'LICENSE.txt': 'APACHE-LIZENZ-KOERPER',
      NOTICE: 'Copyright (c) 2001 Hinweis\nNOTICE-KOERPER-EINMALIG',
    });
    schreibePaket(gamma, 'c-paket', '0.1.0', { license: 'ISC', author: 'Ada Lovelace' }, {
      LICENCE: 'LIZENZ-OHNE-ZEICHEN',
    });
    const baum: NpmKnoten = {
      dependencies: {
        alpha: {
          path: alpha,
          dependencies: {
            alias: { path: alpha },
            werkzeug: { dev: true, path: path.join(wurzel, 'pakete', 'dev') },
          },
        },
        beta: { path: beta },
        gamma: { path: gamma },
      },
    };
    schreibePaket(path.join(wurzel, 'pakete', 'dev'), 'vitest', '1.0.0', { license: 'MIT' }, {
      LICENSE: 'NUR_DEV_PAKET',
    });
    const sha = 'ab'.repeat(20);
    const text = erzeugeLizenztext(sammleProduktionspakete(wurzel, baum), sha, robotoEintrag('Copyright 2011 Roboto\nVOLLTEXT-OFL'));
    expect(text).toContain('## m-paket@1.2.3');
    expect(text).toContain('Lizenz: MIT');
    expect(text).toContain('Copyright (c) 1999 AusNotice');
    expect(text).toContain('EINMALIG-MIT');
    expect(text).not.toContain('NICHT_ANHAENGEN');
    expect(text).not.toContain('<!--');
    expect(text).toContain('## a-paket@9.0.0');
    expect(text).toContain('Lizenz: Apache-2.0');
    expect(text).toContain('APACHE-LIZENZ-KOERPER');
    expect(text).toContain('NOTICE-KOERPER-EINMALIG');
    expect(text).toContain('Copyright (c) 2001 Hinweis');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('## c-paket@0.1.0');
    expect(text).not.toContain('NUR_DEV_PAKET');
    expect(text).not.toContain('## stride@');
    expect(text).not.toContain('## vitest@');
    expect(text.indexOf('## a-paket@')).toBeLessThan(text.indexOf('## c-paket@'));
    expect(text.indexOf('## c-paket@')).toBeLessThan(text.indexOf('## m-paket@'));
    expect(text.split('## m-paket@').length - 1).toBe(1);
    expect(text.startsWith(`Open-Source-Komponenten von Stride\nCommit: ${sha}\n`)).toBe(true);
  });

  it('wirft, wenn die Lizenzdatei fehlt', () => {
    const wurzel = wurzelAn();
    const ordner = path.join(wurzel, 'pakete', 'nackt');
    schreibeWurzel(wurzel, { nackt: '1.0.0' });
    schreibePaket(ordner, 'ohne-lizenz', '1.0.0', {}, {});
    expect(() => sammleProduktionspakete(wurzel, { dependencies: { nackt: { path: ordner } } })).toThrow(/ohne-lizenz/);
  });

  it('nennt SPDX und Autor, wenn keine Lizenzdatei vorliegt', () => {
    const wurzel = wurzelAn();
    const ordner = path.join(wurzel, 'pakete', 'feld');
    schreibeWurzel(wurzel, { feld: '1.0.0' });
    schreibePaket(ordner, 'nur-feld', '4.0.0', { license: 'MIT', author: 'Nur Feld' }, {});
    const text = erzeugeLizenztext(
      sammleProduktionspakete(wurzel, { dependencies: { feld: { path: ordner } } }),
      '',
      robotoEintrag('Copyright 2011 Roboto\nOFL'),
    );
    expect(text).toContain('## nur-feld@4.0.0');
    expect(text).toContain('Lizenz: MIT');
    expect(text).toContain('Nur Feld');
    expect(text).toContain('keine Lizenzdatei');
  });

  it('findet eine kleingeschriebene Lizenzdatei', () => {
    const wurzel = wurzelAn();
    const ordner = path.join(wurzel, 'pakete', 'klein');
    schreibeWurzel(wurzel, { klein: '1.0.0' });
    schreibePaket(ordner, 'klein-paket', '1.0.0', { license: 'MIT' }, { license: 'KLEIN-LIZENZ' });
    const text = erzeugeLizenztext(
      sammleProduktionspakete(wurzel, { dependencies: { klein: { path: ordner } } }),
      '',
      robotoEintrag('Copyright 2011 Roboto\nOFL'),
    );
    expect(text).toContain('KLEIN-LIZENZ');
  });

  it('bricht ab, wenn eine direkte Abhängigkeit fehlt', () => {
    const wurzel = wurzelAn();
    schreibeWurzel(wurzel, { weg: '1.0.0' });
    expect(() => sammleProduktionspakete(wurzel, { dependencies: { weg: { missing: true } } })).toThrow(/weg/);
    expect(() => sammleProduktionspakete(wurzel, { dependencies: {} })).toThrow(/weg/);
  });

  it('verwirft Dev-Knoten', () => {
    expect(behaeltPaket({ dev: true })).toBe(false);
    expect(behaeltPaket({})).toBe(true);
  });

  it('liest Exit-Code 1, solange das JSON gilt', () => {
    expect(parseNpmLs('Hinweis\n{"dependencies":{"a":{}}}', 1).dependencies?.a).toEqual({});
    expect(() => parseNpmLs('kein json', 1)).toThrow(/ohne JSON/);
  });

  it('nimmt Roboto aus dem OFL-Text, nicht aus npm', () => {
    const ofl = 'Copyright 2011 The Roboto Project Authors\n\nSIL Open Font License\nVOLLTEXT-OFL';
    const eintrag = robotoEintrag(ofl);
    expect(eintrag.name).toBe('Roboto');
    expect(eintrag.lizenz).toBe('OFL-1.1');
    expect(eintrag.text).toContain('VOLLTEXT-OFL');
    expect(eintrag.text).toContain('SIL Open Font License');
    const text = erzeugeLizenztext([], '', eintrag);
    expect(text).toContain('## Roboto@3.015');
    expect(text).toContain('Commit: keiner');
    expect(text).toContain('VOLLTEXT-OFL');
  });

  it('nimmt den Git-Stand und nur ersatzweise 40 Hex aus der Umgebung', () => {
    const sha = 'ab'.repeat(20);
    const andere = 'cd'.repeat(20);
    expect(leseCommit({ STRIDE_COMMIT: andere }, () => `${sha}\n`)).toBe(sha);
    expect(leseCommit({ STRIDE_COMMIT: sha }, () => { throw new Error('kein git'); })).toBe(sha);
    expect(leseCommit({ STRIDE_COMMIT: 'kurz' }, () => { throw new Error('kein git'); })).toBe('');
    expect(leseCommit({}, () => { throw new Error('kein git'); })).toBe('');
    expect(leseCommit({ STRIDE_COMMIT: sha }, () => 'kein-sha')).toBe(sha);
  });
});
