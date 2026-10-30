import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { anteileInProzent } from '../../../../shared/spiel/anteile.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KurzListe } from '../../components/Ausklappbar.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste } from '../../components/Zeile.tsx';
import { prozentPunkte } from '../../format.ts';
import { ReihenfolgeKnopf } from '../taetigkeiten/Reihenfolge.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { useFunktionen } from '../../funktionen.ts';
import { attributName, tx } from '../../text.ts';

const TAETIGKEITEN_SICHTBAR = 6;

export function VorlagenVerwaltung({ onBearbeiten }: { onBearbeiten: (vorlage: Vorlage | null) => void }) {
  const { data: vorlagen, error, isPending } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const funktionen = useFunktionen();
  const attributeNachId = new Map(
    attribute
      .filter((attribut) => !attribut.archiviert && istTypAktiv(funktionen, attribut.typ))
      .map((attribut) => [attribut.id, attribut]),
  );
  const wirksameGewichte = (vorlage: Vorlage) =>
    vorlage.gewichte.filter((gewicht) => gewicht.gewicht > 0 && attributeNachId.has(gewicht.attributId));

  return (
    <div className="space-y-3">
      <ReihenfolgeKnopf vorlagen={vorlagen ?? []} />
      <Liste>
        {isPending && (
          <div className="px-4">
            <Ladeanzeige />
          </div>
        )}
        {error ? (
          <div className="px-4 py-3">
            <Fehlermeldung fehler={error} />
          </div>
        ) : null}
        {vorlagen?.length === 0 && <Leer text={tx("Noch keine Tätigkeit.")} />}
        {vorlagen && vorlagen.length > 0 && (
        <KurzListe
          eintraege={vorlagen ?? []}
          anzahl={TAETIGKEITEN_SICHTBAR}
          className="divide-y divide-rand"
          darstellen={(vorlage) => {
            const gewichte = wirksameGewichte(vorlage);
            const prozente = anteileInProzent(gewichte.map((gewicht) => gewicht.gewicht));
            return (
              <SchnellZeile
                key={vorlage.id}
                ziel={{
                  art: 'vorlage',
                  id: vorlage.id,
                  name: vorlage.name,
                  archiviert: vorlage.archiviert,
                  loeschbar: vorlage.loeschbar,
                }}
              >
                {(menue) => (
                  <div
                    data-taetigkeit={vorlage.name}
                    className={`flex min-h-12 items-center gap-3 px-4 py-3 ${vorlage.archiviert ? 'opacity-50' : ''}`}
                  >
                    <Icon name={vorlage.icon} className="size-5 shrink-0 text-leise" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{vorlage.name}</p>
                      {vorlage.projektName ? (
                        <p className="truncate text-xs text-leise">{tx('Nur für {name}', { name: vorlage.projektName })}</p>
                      ) : null}
                      {gewichte.length > 0 ? (
                        <div data-anteile="" className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-flaeche-2">
                          {gewichte.map((gewicht, index) => {
                            const attribut = attributeNachId.get(gewicht.attributId);
                            const farbe = attribut?.farbe;
                            const naechste = attributeNachId.get(gewichte[index + 1]?.attributId ?? -1)?.farbe;
                            return (
                              <span
                                key={gewicht.attributId}
                                data-anteil={prozente[index] ?? 0}
                                data-farbe={farbe ?? ''}
                                style={{
                                  width: `${prozente[index] ?? 0}%`,
                                  flexGrow: 0,
                                  flexShrink: 0,
                                  minWidth: 0,
                                  backgroundColor: farbe,
                                  // Gleiche Farbe daneben liefe sonst zu einem Stück zusammen.
                                  boxShadow: farbe && farbe === naechste ? 'inset -2px 0 0 var(--flaeche-2)' : undefined,
                                }}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                      {gewichte.length > 0 ? (
                        <p data-anteile-text="" className="mt-1 truncate text-xs text-leise">
                          {gewichte
                            .map((gewicht, index) => {
                              const attribut = attributeNachId.get(gewicht.attributId);
                              const name = attribut ? attributName(attribut) : '?';
                              return `${name} ${prozentPunkte(prozente[index] ?? 0)}`;
                            })
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {menue}
                    {vorlage.archiviert ? null : (
                      <Knopf
                        variante="leise"
                        className="shrink-0 p-2"
                        aria-label={tx('{name} bearbeiten', { name: vorlage.name })}
                        onClick={() => onBearbeiten(vorlage)}
                      >
                        <Pencil className="size-4" />
                      </Knopf>
                    )}
                  </div>
                )}
              </SchnellZeile>
            );
          }}
        />
        )}
        {vorlagen && <AnlegeZeile text="Tätigkeit anlegen" onKlick={() => onBearbeiten(null)} />}
      </Liste>
    </div>
  );
}
