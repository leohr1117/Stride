export const SPRACHEN = ['de', 'en', 'es', 'fr', 'ru', 'zh', 'ja'] as const;
export type Sprache = (typeof SPRACHEN)[number];

export const ZIEL_SPRACHEN = ['en', 'es', 'fr', 'ru', 'zh', 'ja'] as const;
export type ZielSprache = (typeof ZIEL_SPRACHEN)[number];

export const FALLBACK_SPRACHE: Sprache = 'en';

/** Name in der eigenen Schrift, unabhängig von der Oberflächensprache. */
export const SPRACH_NAME: Record<Sprache, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
};

const LOCALE: Record<Sprache, string> = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

export function istSprache(wert: unknown): wert is Sprache {
  return typeof wert === 'string' && (SPRACHEN as readonly string[]).includes(wert);
}

export function istZielSprache(wert: Sprache): wert is ZielSprache {
  return wert !== 'de';
}

export function localeFuer(sprache: Sprache): string {
  return LOCALE[sprache];
}

/** Erste unterstützte Sprache, sonst Englisch. `en-US` zählt als Englisch, `zh-CN` als Chinesisch. */
export function spracheAusBrowser(liste: readonly string[]): Sprache {
  for (const eintrag of liste) {
    const code = eintrag.trim().toLowerCase().replace('_', '-').split('-')[0] ?? '';
    if (istSprache(code)) {
      return code;
    }
  }
  return FALLBACK_SPRACHE;
}

export function spracheWaehlen(gespeichert: Sprache | null, server: Sprache | null, browser: readonly string[]): Sprache {
  if (gespeichert !== null) {
    return gespeichert;
  }
  if (server !== null) {
    return server;
  }
  return spracheAusBrowser(browser);
}

export function spracheAusKopf(kopf: string | string[] | undefined): Sprache {
  const text = Array.isArray(kopf) ? kopf.join(',') : (kopf ?? '');
  const codes = text
    .split(',')
    .map((teil) => teil.split(';')[0]?.trim() ?? '')
    .filter((teil) => teil.length > 0);
  return spracheAusBrowser(codes);
}

export function platzhalter(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((treffer) => treffer[1] ?? '').sort();
}

export function fuelle(vorlage: string, werte: Record<string, string | number>): string {
  return vorlage.replace(/\{([a-zA-Z0-9]+)\}/g, (ganz, name: string) => {
    const wert = werte[name];
    return wert === undefined ? ganz : String(wert);
  });
}
