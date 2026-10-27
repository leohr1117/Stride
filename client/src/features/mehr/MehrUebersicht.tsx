import { UEBERSICHT_KARTEN } from '../../../../shared/spiel/uebersichtKarten.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { Bereich } from './rahmen.tsx';

export function MehrUebersichtSeite() {
  return (
    <Bereich
      titel={tx("Übersicht")}
      info="Jede Karte folgt dem Bereich, der sie einschaltet. Identität und Aktivität bleiben."
      kinder={
        <ZeilenGruppe titel="Karten">
          {UEBERSICHT_KARTEN.map((karte) => (
            <Zeile
              key={karte.id}
              titel={tx(karte.label)}
              wert={tx(karte.regel)}
              info={karte.info}
              nach={karte.nach}
            />
          ))}
        </ZeilenGruppe>
      }
    />
  );
}
