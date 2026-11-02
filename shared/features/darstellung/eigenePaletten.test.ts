import { describe, expect, it } from 'vitest';
import {
  PALETTEN_MAX,
  PalettenFehler,
  lesePaletten,
  paletteAendern,
  paletteAnlegen,
  paletteLoeschen,
  palettenDerAnsicht,
} from './eigenePaletten.ts';

const farben = { primaer: '#112233', akzent: '#445566', hintergrund: '#778899' };

describe('eigene Paletten', () => {
  it('legt an, ändert den Namen und löscht wiederholbar', () => {
    const angelegt = paletteAnlegen([], { name: '  Morgenrot ', ...farben }, 'a');
    expect(angelegt).toEqual([{ id: 'a', name: 'Morgenrot', ...farben }]);
    expect(() => paletteAnlegen(angelegt, { name: 'morgenrot', ...farben }, 'b')).toThrow(PalettenFehler);
    const umbenannt = paletteAendern(angelegt, 'a', {
      name: 'Abendrot',
      primaer: '#AABBCC',
      akzent: '#445566',
      hintergrund: '#778899',
    });
    expect(umbenannt[0]).toEqual({ id: 'a', name: 'Abendrot', primaer: '#aabbcc', akzent: '#445566', hintergrund: '#778899' });
    expect(paletteLoeschen(umbenannt, 'fehlt')).toEqual(umbenannt);
    expect(paletteLoeschen(umbenannt, 'a')).toEqual([]);
  });

  it('verwirft ungültige und doppelte Einträge und stoppt bei 24', () => {
    expect(
      lesePaletten([
        { id: 'a', name: 'Eins', ...farben },
        { id: 'a', name: 'Zwo', ...farben },
        { id: 'b', name: 'eins', ...farben },
        { id: '', name: 'Leer', ...farben },
        'kaputt',
      ]).map((palette) => palette.id),
    ).toEqual(['a']);
    const voll = Array.from({ length: 30 }, (_, index) => ({
      id: `id-${index}`,
      name: `Name ${index}`,
      ...farben,
    }));
    expect(lesePaletten(voll)).toHaveLength(PALETTEN_MAX);
    expect(() => paletteAnlegen(lesePaletten(voll), { name: 'Mehr', ...farben }, 'neu')).toThrow(/Höchstens 24/);
  });

  it('meldet einen fehlenden Eintrag beim Ändern', () => {
    expect(() => paletteAendern([], 'x', { name: 'A', ...farben })).toThrow(/Die Palette wurde nicht gefunden/);
  });

  it('behält selbst erstellte Paletten in ihrer Ansicht und zeigt alte ohne Ansicht überall', () => {
    const angelegt = paletteAnlegen([], { name: 'Morgenrot', ...farben, stil: 'jade' }, 'a');
    expect(angelegt[0]?.stil).toBe('jade');
    const umbenannt = paletteAendern(angelegt, 'a', { name: 'Abendrot', ...farben, stil: 'antik' });
    expect(umbenannt[0]?.stil).toBe('jade');
    const gelesen = lesePaletten([
      { id: 'a', name: 'Jade', ...farben, stil: 'jade' },
      { id: 'b', name: 'Alt', ...farben },
      { id: 'c', name: 'Kaputt', ...farben, stil: 'schlicht' },
    ]);
    expect(gelesen.find((palette) => palette.id === 'c')?.stil).toBeUndefined();
    expect(palettenDerAnsicht(gelesen, 'jade').map((palette) => palette.id)).toEqual(['a', 'b', 'c']);
    expect(palettenDerAnsicht(gelesen, 'minimal').map((palette) => palette.id)).toEqual(['b', 'c']);
  });
});
