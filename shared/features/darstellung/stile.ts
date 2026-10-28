export const STILE = ['standard', 'minimal', 'jade', 'holo', 'antik'] as const;
export type Stil = (typeof STILE)[number];

export const STANDARD_STIL = 'standard' satisfies Stil;

export const STIL_INFO: Record<Stil, { label: string }> = {
  standard: { label: 'Standard' },
  minimal: { label: 'Minimal' },
  jade: { label: 'Jade' },
  holo: { label: 'Hologramm' },
  antik: { label: 'Antik' },
};

export function istStil(wert: unknown): wert is Stil {
  return typeof wert === 'string' && (STILE as readonly string[]).includes(wert);
}

/** Gespeichertes „schlicht“ ist die Ansicht Standard. Kein Schreibzugriff auf die Datenbank. */
export function gelesenerStil(wert: unknown): Stil | undefined {
  if (wert === 'schlicht') {
    return STANDARD_STIL;
  }
  return istStil(wert) ? wert : undefined;
}
