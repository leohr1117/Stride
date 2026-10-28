import type { EigenePalette, PaletteEingabe } from '../features/darstellung/eigenePaletten.ts';
import type { Farbtrio } from '../features/darstellung/paletten.ts';
import type { Stil } from '../features/darstellung/stile.ts';
import type { Ebenen, EbenenZahlen } from '../spiel/ebenen.ts';
import type { Funktionen } from '../spiel/funktionen.ts';
import type { FokusId, Zielstrebigkeit } from '../spiel/profil.ts';
import type { FunktionsAttribute } from '../spiel/sichtbarkeit.ts';
import type { GewichtEinheit } from '../spiel/training.ts';
import type { UebersichtKartenWahl } from '../spiel/uebersichtKarten.ts';
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
  /** True, wenn die aktuelle Ansicht eigene Farben hat. Sonst gilt ihre Standardpalette. */
  eigeneFarben: boolean;
  /** Eigene Farben je Ansicht. Ansichten ohne Eintrag nutzen die Standardpalette. */
  ansichtFarben: Partial<Record<Stil, Farbtrio>>;
  /** Benannte Farbtrios. Auswählen kopiert sie in die aktuelle Ansicht. */
  paletten: readonly EigenePalette[];
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
  gewichtEinheit: GewichtEinheit;
  /** Welche Karten die Übersicht zeigt. Ein fehlender Eintrag gilt als an. */
  uebersichtKarten: UebersichtKartenWahl;
}

/** PATCH-Körper. `farbenZuruecksetzen` löscht die eigenen Farben der Zielansicht. */
export type EinstellungenAenderung = Partial<Omit<Einstellungen, 'paletten'>> & {
  farbenZuruecksetzen?: boolean;
  paletteNeu?: PaletteEingabe;
  paletteAendern?: PaletteEingabe & { id: string };
  paletteLoeschen?: string;
  /** Erstes Ziel, nur zusammen mit der ersten Profilanlage. */
  startZiel?: { art: 'vision' | 'projekt' | 'faehigkeit'; name: string };
};
