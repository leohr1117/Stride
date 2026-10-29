import { karteGewaehlt, kartenWahl, karteSichtbar, UEBERSICHT_KARTEN } from '../../../../shared/spiel/uebersichtKarten.ts';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { Bereich, useEinstellungen } from './rahmen.tsx';

const INFO = 'Hier legst du fest, welche Karten die Übersicht zeigt. Den Bereich schaltest du unter App & Verbindungen.';

export function MehrUebersichtSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  if (isPending) {
    return <Bereich titel={tx('Übersicht')} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx('Übersicht')} kinder={<Fehlermeldung fehler={error} />} />;
  }
  const karten = UEBERSICHT_KARTEN.filter((karte) => karteSichtbar(karte.id, data));
  return (
    <Bereich
      titel={tx('Übersicht')}
      info={INFO}
      kinder={
        <>
          <ZeilenGruppe titel="Karten">
            {karten.map((karte) => (
              <ZeileSchalter
                key={karte.id}
                id={`uebersicht-karte-${karte.id}`}
                titel={tx(karte.label)}
                untertitel={tx(karte.regel)}
                info={karte.info}
                an={karteGewaehlt(karte.id, data.uebersichtKarten)}
                deaktiviert={speichern.isPending}
                onAendern={(an) =>
                  speichern.mutate({ uebersichtKarten: kartenWahl({ ...data.uebersichtKarten, [karte.id]: an }) })
                }
              />
            ))}
          </ZeilenGruppe>
          <Fehlermeldung fehler={speichern.error} />
        </>
      }
    />
  );
}
