import { anfrage } from './kern.ts';

export interface KontaktNachricht {
  name: string;
  email: string;
  nachricht: string;
  website: string;
}

export const kontaktApi = {
  kontaktStatus: () => anfrage<{ verfuegbar: boolean }>('/kontakt'),
  kontaktSenden: (daten: KontaktNachricht) => anfrage<{ ok: boolean }>('/kontakt', 'POST', daten),
};
