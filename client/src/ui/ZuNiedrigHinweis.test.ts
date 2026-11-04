import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ZuNiedrigHinweis } from './Info.tsx';

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
});
