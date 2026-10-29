import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { STIL_INFO } from '../../../../shared/features/darstellung/stile.ts';
import { sichtbareMehrBereiche, type MehrBereichId } from '../../../../shared/spiel/mehrBereiche.ts';
import { AKTUELLE_VERSION, VERSIONEN } from '../../../../shared/versionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KlassenBild } from '../../components/KlassenBild.tsx';
import { Liste, Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { sichtbareGruppen, type NavEintrag } from '../../navigation.ts';
import { kachelText } from './hinweisGeraet.ts';
import { bereicheAn, kartenStand, verbindungsKurz } from './mehrWerte.ts';

const KOPF = 'ueberschrift abschnittskopf mb-2 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case';

function seitenSymbol(eintrag: NavEintrag, klasse: string | undefined): ReactNode {
  if (eintrag.pfad === '/charakter' && klasse) {
    return <KlassenBild klasse={klasse} groesse="size-5" />;
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
    const karten = kartenStand(einstellungen.uebersichtKarten);
    werte.set('karten', tx('{n} von {gesamt}', { n: karten.an, gesamt: karten.gesamt }));
    werte.set('darstellung', tx(STIL_INFO[einstellungen.stil].label));
  }
  if (hinweise) {
    werte.set('benachrichtigungen', kachelText(hinweise.geraete));
  }

  return (
    <div className="space-y-6">
      <section data-abschnitt="seiten">
        <h2 className={KOPF}>{tx('Seiten')}</h2>
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
      <div data-abschnitt="einstellungen">
        <ZeilenGruppe titel="Einstellungen">
          {sichtbareMehrBereiche().map((bereich) => (
            <Zeile key={bereich.id} titel={tx(bereich.label)} wert={werte.get(bereich.id)} nach={bereich.pfad} />
          ))}
        </ZeilenGruppe>
      </div>
      <Versionshinweis />
    </div>
  );
}

function Versionshinweis() {
  const [offen, setOffen] = useState(false);
  return (
    <div data-version="">
      <Liste>
        <div>
          <button
            type="button"
            aria-expanded={offen}
            onClick={() => setOffen((aktuell) => !aktuell)}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1 text-base leading-6">{tx('Version {version}', { version: AKTUELLE_VERSION })}</span>
            <ChevronRight className={`size-5 shrink-0 text-leise transition ${offen ? 'rotate-90' : ''}`} aria-hidden />
          </button>
          {offen && (
            <div className="max-h-80 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
              {VERSIONEN.map((eintrag, index) => (
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
          )}
        </div>
      </Liste>
    </div>
  );
}
