import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PasswortFeld } from './Formular.tsx';

function html(benutzername?: string, passwordRules?: string): string {
  return renderToStaticMarkup(
    createElement(PasswortFeld, {
      id: 'current-password',
      label: 'Bisheriges',
      name: 'current-password',
      autoComplete: 'current-password',
      benutzername,
      passwordRules,
      value: '',
      onChange: () => {},
    }),
  );
}

describe('PasswortFeld', () => {
  it('bleibt ohne Benutzername frei von einem Kontonamen', () => {
    const text = html();
    expect(text).not.toContain('name="username"');
    expect(text).not.toContain('username');
    expect(text).toContain('for="current-password"');
    expect(text).toContain('name="current-password"');
  });

  it('legt den Benutzernamen versteckt ins selbe Feld', () => {
    const text = html('testvoll');
    expect(text).toContain('type="hidden"');
    expect(text).toContain('id="username"');
    expect(text).toContain('name="username"');
    expect(text).toContain('value="testvoll"');
    expect(text).toContain('for="current-password"');
    expect(text).toContain('id="current-password"');
    expect(text.indexOf('id="current-password"')).toBeLessThan(text.indexOf('id="username"'));
  });

  it('schreibt die Passwortregel als Attribut', () => {
    const text = html(undefined, 'minlength: 10; maxlength: 200;');
    expect(text).toContain('passwordrules="minlength: 10; maxlength: 200;"');
    expect(text).not.toContain('name="username"');
  });
});
