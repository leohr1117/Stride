import { Link } from 'react-router';
import { karteGewaehlt, kartenWahl, UEBERSICHT_KARTEN } from '../../../../shared/spiel/uebersichtKarten.ts';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { Bereich, useEinstellungen } from './rahmen.tsx';

const INFO = 'Hier legst du fest, welche Karten die Übersicht zeigt. Den Bereich schaltest du unter App & Verbindungen.';

export function MehrUebersichtSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  if (isPending) {
    return <Bereich titel={tx("Übersicht")} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Übersicht")} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <Bereich
      titel={tx("Übersicht")}
      info={INFO}
      kinder={
        <>
          <ZeilenGruppe titel="Karten">
            {UEBERSICHT_KARTEN.map((karte) => (
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
                neben={
                  karte.nach ? (
                    <Link
                      to={karte.nach}
                      aria-label={tx('Bereich für {name}', { name: tx(karte.label) })}
                      className="shrink-0 text-xs font-medium text-akzent"
                    >
                      {tx('Bereich')}
                    </Link>
                  ) : null
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
