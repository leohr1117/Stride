import type { Ebenen, EbenenZahlen } from '../spiel/ebenen.ts';
import type { Funktionen } from '../spiel/funktionen.ts';
import type { FokusId, Zielstrebigkeit } from '../spiel/profil.ts';
import type { FunktionsAttribute } from '../spiel/sichtbarkeit.ts';
import type { Stil } from '../features/darstellung/stile.ts';
import type { Sprache } from '../sprache/kern.ts';

export interface Einstellungen {
  charakterName: string;
  sound: boolean;
  geburtsjahr: number | null;
  zielstrebigkeit: Zielstrebigkeit | null;
  fokus: FokusId[];
  profilAngelegt: boolean;
  weltLeer: boolean;
  stil: Stil;
  primaer: string;
  akzent: string;
  hintergrund: string;
  glimmen: boolean;
  eigeneFarben: boolean;
  funktionen: Funktionen;
  mobilLeiste: string[];
  ebenen: Ebenen;
  ebenenZahlen: EbenenZahlen;
  /** Abgeleitete Abhängigkeit. Wird nicht gespeichert. */
  attribute: FunktionsAttribute;
  /** Null, solange noch nichts gewählt ist. Dann gilt die Browsersprache. */
  sprache: Sprache | null;
  /** IANA-Zone des Geräts. Null, bis der Client sie meldet. */
  zeitzone: string | null;
}
