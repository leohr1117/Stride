import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Einstellungen, EinstellungenAenderung } from '../../../../shared/api/index.ts';
import { favoritDazu, favoritWeg } from '../../../../shared/features/vorbilder/favoriten.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { tx } from '../../text.ts';

/** Eine Kette, damit zwei schnelle Tipps sich nicht mit der jeweils alten Liste überschreiben. */
export function useVorbildFavoriten() {
  const client = useQueryClient();
  const schnell = useSchnellAktion();
  const kette = useRef(Promise.resolve());
  const stand = useRef(0);

  const liste = (): string[] => client.getQueryData<Einstellungen>(SCHLUESSEL.einstellungen)?.vorbildFavoriten ?? [];

  const setze = (naechste: string[]) => {
    client.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, (alt) => (alt ? { ...alt, vorbildFavoriten: naechste } : alt));
  };

  const sende = (aenderung: EinstellungenAenderung, mein: number) => {
    const lauf = kette.current.then(
      () => api.aendereEinstellungen(aenderung),
      () => api.aendereEinstellungen(aenderung),
    );
    kette.current = lauf.then(
      () => undefined,
      () => undefined,
    );
    return lauf.then(
      (daten) => {
        if (stand.current === mein) {
          client.setQueryData(SCHLUESSEL.einstellungen, daten);
        }
      },
      () => {
        if (stand.current === mein) {
          void client.invalidateQueries({ queryKey: SCHLUESSEL.einstellungen });
        }
      },
    );
  };

  const dazu = (schluessel: string, index?: number) => {
    const mein = ++stand.current;
    setze(favoritDazu(liste(), schluessel, index));
    const aenderung: EinstellungenAenderung =
      index === undefined
        ? { vorbildFavoritDazu: schluessel }
        : { vorbildFavoritDazu: schluessel, vorbildFavoritIndex: index };
    return sende(aenderung, mein);
  };

  const weg = (schluessel: string) => {
    const vorher = liste();
    const index = vorher.indexOf(schluessel);
    if (index < 0) {
      return;
    }
    const mein = ++stand.current;
    setze(favoritWeg(vorher, schluessel));
    void sende({ vorbildFavoritWeg: schluessel }, mein);
    schnell.melde(tx('Aus Favoriten entfernt'), () => {
      void dazu(schluessel, index);
    });
  };

  return { dazu, weg };
}
