export const STILE = ['minimal', 'jade', 'holo', 'antik'] as const;
export type Stil = (typeof STILE)[number];

export const STANDARD_STIL = 'minimal' satisfies Stil;

export const STIL_INFO: Record<Stil, { label: string }> = {
  minimal: { label: 'Minimal' },
  jade: { label: 'Jade' },
  holo: { label: 'Hologramm' },
  antik: { label: 'Antik' },
};

export function istStil(wert: unknown): wert is Stil {
  return typeof wert === 'string' && (STILE as readonly string[]).includes(wert);
}
