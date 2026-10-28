/** Feste Bedeutungsfarben. Eine Palette setzt sie nicht. Hell oder Dunkel kommt aus dem Flächenschema. */
export type FarbSchema = 'light' | 'dark';

export interface Bedeutungsfarben {
  fortschritt: string;
  streak: string;
  gefahr: string;
  gefahrText: string;
  erfolg: string;
  fokus: string;
  schalterAn: string;
  schalterKnopfAn: string;
  schalterAus: string;
  schalterKnopfAus: string;
}

const HELL: Bedeutungsfarben = {
  fortschritt: '#1d4ed8',
  streak: '#b93c0b',
  gefahr: '#c62828',
  gefahrText: '#ffffff',
  erfolg: '#166534',
  fokus: '#1d4ed8',
  schalterAn: '#1d4ed8',
  schalterKnopfAn: '#ffffff',
  schalterAus: '#ebebeb',
  schalterKnopfAus: '#767676',
};

const DUNKEL: Bedeutungsfarben = {
  fortschritt: '#60a5fa',
  streak: '#fb923c',
  gefahr: '#f87171',
  gefahrText: '#141414',
  erfolg: '#4ade80',
  fokus: '#60a5fa',
  schalterAn: '#60a5fa',
  schalterKnopfAn: '#141414',
  schalterAus: '#262626',
  schalterKnopfAus: '#949494',
};

export function bedeutungsfarben(schema: FarbSchema): Bedeutungsfarben {
  return schema === 'dark' ? DUNKEL : HELL;
}
