import { useQuery } from '@tanstack/react-query';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useEbenen } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Karte, Ueberschrift } from '../../ui/index.ts';

export function PlanZuordnung({
  projektId,
  vorlageId,
  vorlageFehler,
  onProjekt,
  onVorlage,
}: {
  projektId: number | null;
  vorlageId: number | null;
  vorlageFehler: string | null;
  onProjekt: (projektId: number | null, vorlageId: number | null) => void;
  onVorlage: (vorlageId: number | null) => void;
}) {
  const ebenen = useEbenen();
  const ziele = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele, enabled: ebenen.projekte });
  const vorlagen = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const liste = vorlagen.data ?? [];
  const passende = taetigkeitenFuerProjekt(liste, projektId, vorlageId);
  const projekte = (ziele.data?.projekte ?? []).filter((projekt) => projekt.aktiv || projekt.id === projektId);

  function waehleProjekt(wert: string) {
    const neu = wert === '' ? null : Number(wert);
    const bleibt = vorlageId !== null && taetigkeitenFuerProjekt(liste, neu).some((vorlage) => vorlage.id === vorlageId);
    onProjekt(neu, bleibt ? vorlageId : null);
  }

  return (
    <div className="space-y-3 max-md:!mt-20">
      <Ueberschrift titel={tx('Zuordnung')} />
      <Karte className="space-y-3">
        {vorlagen.isError ? <Fehlermeldung fehler={vorlagen.error} /> : null}
        <div className={ebenen.projekte ? 'grid gap-4 md:grid-cols-2' : ''}>
          {ebenen.projekte ? (
            <Feld label="Projekt">
              <select className={EINGABE_STIL} value={projektId ?? ''} onChange={(ereignis) => waehleProjekt(ereignis.target.value)}>
                <option value="">{tx('Keins')}</option>
                {projekte.map((projekt) => (
                  <option key={projekt.id} value={projekt.id}>
                    {projekt.name}
                  </option>
                ))}
              </select>
            </Feld>
          ) : null}
          <Feld label="Tätigkeit">
            <select
              className={EINGABE_STIL}
              value={vorlageId ?? ''}
              onChange={(ereignis) => onVorlage(ereignis.target.value === '' ? null : Number(ereignis.target.value))}
            >
              {passende.map((vorlage) => (
                <option key={vorlage.id} value={vorlage.id}>
                  {tx(vorlage.name)}
                </option>
              ))}
              <option value="">{tx('Keine')}</option>
            </select>
          </Feld>
        </div>
        {vorlageFehler ? <Fehlermeldung fehler={new Error(vorlageFehler)} /> : null}
      </Karte>
    </div>
  );
}
