import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ALLTAG = [
  'client/src/features/statistiken/Statistiken.tsx',
  'client/src/features/vorbilder/Vorbilder.tsx',
  'client/src/features/vorbilder/VorbildProfil.tsx',
  'client/src/features/uebersicht/Uebersicht.tsx',
  'client/src/features/attribute/Charakter.tsx',
  'client/src/features/attribute/AttributVerwaltung.tsx',
  'client/src/App.tsx',
];

describe('Diagramme laden', () => {
  it('zieht recharts nicht in den Alltag, sondern erst beim Öffnen des Diagramms', () => {
    for (const datei of ALLTAG) {
      const text = readFileSync(datei, 'utf8');
      expect(text, datei).not.toMatch(/from 'recharts'/);
    }
    const lader = readFileSync('client/src/components/mitDiagramm.tsx', 'utf8');
    expect(lader).toContain("import('./Diagramme.tsx')");
    expect(lader).toContain("import('./AttributRadar.tsx')");
    expect(lader).toContain("import('./ProfilRadar.tsx')");
    expect(lader).toContain("import('./LebenswegDiagramm.tsx')");
    const attribute = readFileSync('client/src/features/attribute/AttributVerwaltung.tsx', 'utf8');
    expect(attribute).toContain('werte.length >= MIN_RADAR_ACHSEN');
    expect(attribute).toContain("from '../../components/mitDiagramm.tsx'");
    expect(readFileSync('client/src/components/Diagramme.tsx', 'utf8')).toMatch(/from 'recharts'/);
    expect(readFileSync('client/src/components/AttributRadar.tsx', 'utf8')).toMatch(/from 'recharts'/);
  });
});
