import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ZuNiedrigHinweis, zustandNurZeichen } from './Info.tsx';

describe('ZuNiedrigHinweis', () => {
  it('zeigt eine Zeile mit Warnzeichen statt eines Ausrufezeichens', () => {
    const html = renderToStaticMarkup(createElement(ZuNiedrigHinweis));
    expect(html).toContain('data-zustand="zu-niedrig"');
    expect(html).toContain('⚠');
    expect(html).toContain('Lvl zu niedrig');
    expect(html).toContain('text-haupt');
    expect(html).toContain('text-[13px]');
    expect(html).toContain('text-[16px]');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('>!</');
  });

  it('lässt bei wenig Platz nur das Warnzeichen mit dem Namen des Textes', () => {
    const html = renderToStaticMarkup(createElement(ZuNiedrigHinweis, { nurZeichen: true }));
    expect(html).toContain('data-zustand="zu-niedrig"');
    expect(html).toContain('aria-label="Lvl zu niedrig"');
    expect(html).toContain('<button');
    expect(html).not.toMatch(/>Lvl zu niedrig</);
    expect(html).not.toContain('>!</');
  });
});

describe('zustandNurZeichen', () => {
  const text = 96;
  const zeichen = 16;
  const luecke = 4;

  it('zeigt den Text, wenn der Name genug Platz behält', () => {
    expect(zustandNurZeichen({
      zeilenBreite: 249,
      nameBreite: 70,
      textBreite: text,
      zeichenBreite: zeichen,
      abzugBreite: 0,
      luecke,
    })).toBe(false);
  });

  it('blendet den Text aus, wenn der Name darunter zu schmal würde', () => {
    expect(zustandNurZeichen({
      zeilenBreite: 108,
      nameBreite: 90,
      textBreite: text,
      zeichenBreite: zeichen,
      abzugBreite: 0,
      luecke,
    })).toBe(true);
    expect(zustandNurZeichen({
      zeilenBreite: 174,
      nameBreite: 70,
      textBreite: text,
      zeichenBreite: zeichen,
      abzugBreite: 72,
      luecke,
    })).toBe(true);
  });

  it('lässt einen kurzen Namen ganz stehen, solange der Text daneben passt', () => {
    expect(zustandNurZeichen({
      zeilenBreite: 180,
      nameBreite: 30,
      textBreite: 90,
      zeichenBreite: zeichen,
      abzugBreite: 0,
      luecke,
    })).toBe(false);
  });
});
