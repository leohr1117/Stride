import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KurzListe } from '../../components/Ausklappbar.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste } from '../../components/Zeile.tsx';
import { ReihenfolgeKnopf } from '../taetigkeiten/Reihenfolge.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { useFunktionen } from '../../funktionen.ts';
import { tx } from '../../text.ts';

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
  const wirksameGewichte = (vorlage: Vorlage) => vorlage.gewichte.filter((gewicht) => attributeNachId.has(gewicht.attributId));

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
                  <div className={`flex min-h-12 items-center gap-3 px-4 py-3 ${vorlage.archiviert ? 'opacity-50' : ''}`}>
                    <Icon name={vorlage.icon} className="size-5 shrink-0 text-leise" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{vorlage.name}</p>
                      {vorlage.projektName ? (
                        <p className="truncate text-xs text-leise">{tx('Nur für {name}', { name: vorlage.projektName })}</p>
                      ) : null}
                      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-flaeche-2">
                        {gewichte.map((gewicht) => (
                          <span
                            key={gewicht.attributId}
                            style={{ flexGrow: gewicht.gewicht, backgroundColor: attributeNachId.get(gewicht.attributId)?.farbe }}
                          />
                        ))}
                      </div>
                      <p className="mt-1 truncate text-xs text-leise">
                        {gewichte.map((gewicht) => `${attributeNachId.get(gewicht.attributId)?.name ?? '?'} ${gewicht.gewicht}`).join(' · ')}
                      </p>
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
