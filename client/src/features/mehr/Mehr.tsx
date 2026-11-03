import { tx } from '../../text.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { STIL_INFO } from '../../../../shared/features/darstellung/stile.ts';
import { sichtbareMehrBereiche, type MehrBereichId } from '../../../../shared/spiel/mehrBereiche.ts';
import { neuereVersionen } from '../../../../shared/spiel/updateHinweis.ts';
import type { Einstellungen } from '../../../../shared/api/einstellungen.ts';
import { AKTUELLE_VERSION, VERSIONEN, type Versionseintrag } from '../../../../shared/versionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { ProfilBild } from '../../components/ProfilBild.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { sichtbareGruppen, type NavEintrag } from '../../navigation.ts';
import { AbschnittKopf, Flaeche, Ladeanzeige } from '../../ui/index.ts';
import { useNeuMarkierung, verbindeVersionsstand } from '../../updateHinweis.tsx';
import { kachelText } from './hinweisGeraet.ts';
import { bereicheAn, kartenStand, verbindungsKurz } from './mehrWerte.ts';

function seitenSymbol(eintrag: NavEintrag, klasse: string | undefined): ReactNode {
  if (eintrag.pfad === '/charakter' && klasse) {
    return <ProfilBild klasse={klasse} groesse="size-5" />;
  }
  const Icon = eintrag.icon;
  return <Icon aria-hidden />;
}

export function MehrSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const gruppen = sichtbareGruppen(sichtbarkeit.funktionen, sichtbarkeit.ebenen);
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: zugang } = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const { data: verbindungen } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const { data: hinweise } = useQuery({ queryKey: SCHLUESSEL.hinweise, queryFn: api.hinweise });
  const werte = new Map<MehrBereichId, string>();
  if (zugang?.benutzername) {
    werte.set('konto', zugang.benutzername);
  }
  if (verbindungen) {
    werte.set('verbindungen', verbindungsKurz(verbindungen));
  }
  if (einstellungen) {
    werte.set('bereiche', tx('{n} an', { n: bereicheAn(einstellungen) }));
    const karten = kartenStand(einstellungen.uebersichtKarten, einstellungen);
    werte.set('karten', tx('{n} von {gesamt}', { n: karten.an, gesamt: karten.gesamt }));
    werte.set('darstellung', tx(STIL_INFO[einstellungen.stil].label));
  }
  if (hinweise) {
    werte.set('benachrichtigungen', kachelText(hinweise.geraete));
  }

  return (
    <div>
      <section data-abschnitt="seiten">
        <AbschnittKopf titel={tx('Seiten')} />
        <div className="space-y-2">
          {gruppen.map((gruppe) => (
            <div key={gruppe.eintraege[0]?.pfad} data-seitenliste="">
              <Liste>
                {gruppe.eintraege.map((eintrag) => (
                  <Zeile
                    key={eintrag.pfad}
                    titel={tx(eintrag.label)}
                    symbol={seitenSymbol(eintrag, uebersicht?.klasse)}
                    nach={eintrag.pfad}
                  />
                ))}
              </Liste>
            </div>
          ))}
        </div>
      </section>
      <section data-abschnitt="einstellungen">
        <AbschnittKopf titel={tx('Einstellungen')} />
        <Liste>
          {sichtbareMehrBereiche().map((bereich) => (
            <Zeile key={bereich.id} titel={tx(bereich.label)} wert={werte.get(bereich.id)} nach={bereich.pfad} />
          ))}
        </Liste>
      </section>
      <WasNeuZeile />
    </div>
  );
}

function WasNeuZeile() {
  const neu = useNeuMarkierung();
  return (
    <div className="mt-6" data-version="">
      <Liste>
        <Zeile
          name={tx('Was ist neu')}
          nach="/mehr/neu"
          wert={AKTUELLE_VERSION}
          titel={
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 break-words">{tx('Was ist neu')}</span>
              {neu ? <span data-neu="" className="shrink-0 text-[13px] font-semibold text-fortschritt">{tx('Neu')}</span> : null}
            </span>
          }
        />
      </Liste>
    </div>
  );
}

function VersionsListe({ eintraege }: { eintraege: readonly Versionseintrag[] }) {
  return (
    <div className="space-y-3">
      {eintraege.map((eintrag, index) => (
        <section
          key={eintrag.version}
          aria-label={`Version ${eintrag.version}`}
          className={index > 0 ? 'border-t border-rand pt-3' : undefined}
        >
          <p className="text-sm font-medium">{eintrag.version}</p>
          <p className="mt-0.5 text-xs leading-snug text-leise">
            <span className="block">
              {tx('Seiten')}: {eintrag.seiten.split(', ').map((teil) => tx(teil)).join(', ')}
            </span>
            {eintrag.behoben ? (
              <span className="block">
                {tx('Behoben')}: {eintrag.behoben.split(', ').map((teil) => tx(teil)).join(', ')}
              </span>
            ) : null}
          </p>
          <div className="mt-2 space-y-2">
            {eintrag.abschnitte
              .filter((abschnitt) => abschnitt.punkte.length > 0)
              .map((abschnitt) => (
                <div key={abschnitt.titel}>
                  <p className="text-xs font-semibold">{tx(abschnitt.titel)}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {abschnitt.punkte.map((text) => (
                      <li key={text} className="text-sm leading-snug text-leise break-words">
                        {tx(text)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Changelog. Öffnen merkt die aktuelle Version und nimmt Punkt und Neu-Markierung weg. */
export function WasNeuSeite() {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const [gesehen, setGesehen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!data || gesehen !== undefined) {
      return;
    }
    setGesehen(data.versionHinweis.gesehen);
    if (data.versionHinweis.gesehen === AKTUELLE_VERSION) {
      return;
    }
    void api.merkeVersionHinweis({ gesehen: AKTUELLE_VERSION }).then((neu) => {
      client.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, (alt) => verbindeVersionsstand(alt, neu));
    });
  }, [data, gesehen, client]);

  if (gesehen === undefined) {
    return <Ladeanzeige />;
  }
  const neu = neuereVersionen(VERSIONEN, gesehen);
  const neuSatz = new Set(neu.map((eintrag) => eintrag.version));
  const rest = VERSIONEN.filter((eintrag) => !neuSatz.has(eintrag.version));
  return (
    <div data-changelog="">
      {neu.length > 0 ? (
        <section data-neu-seit="">
          <AbschnittKopf titel={tx('Neu seit deinem letzten Besuch')} />
          <Flaeche>
            <div className="px-4 py-3">
              <VersionsListe eintraege={neu} />
            </div>
          </Flaeche>
        </section>
      ) : null}
      {rest.length > 0 ? (
        <div className="mt-6" data-version-rest="">
          <VersionsListe eintraege={rest} />
        </div>
      ) : null}
    </div>
  );
}
