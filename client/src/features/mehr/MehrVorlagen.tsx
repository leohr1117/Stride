import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Vorlage } from '../../../../shared/api/index.ts';
import { anteileInProzent } from '../../../../shared/spiel/anteile.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Icon } from '../../components/Icons.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste, ZeilenGruppe } from '../../components/Zeile.tsx';
import { prozentPunkte } from '../../format.ts';
import { GekuerzteNebenzeile, staerktFassungen } from '../taetigkeiten/Nebenzeile.tsx';
import { ReihenfolgeKnopf } from '../taetigkeiten/Reihenfolge.tsx';
import { Fehlermeldung, Ladeanzeige, Leer } from '../../ui/index.ts';
import { useFunktionen } from '../../funktionen.ts';
import { attributName, tx } from '../../text.ts';

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

  const zeile = (vorlage: Vorlage, neben: string | null) => {
    const gewichte = wirksameGewichte(vorlage);
    const prozente = vorlage.festeAnteile
      ? gewichte.map((gewicht) => gewicht.gewicht)
      : anteileInProzent(gewichte.map((gewicht) => gewicht.gewicht));
    const plusSumme = prozente.reduce((summe, wert) => summe + wert, 0);
    const rest = vorlage.festeAnteile ? Math.max(0, 100 - plusSumme) : 0;
    const abzugZeilen = vorlage.abzuege.filter((abzug) => attributeNachId.has(abzug.attributId));
    const teile = gewichte.map((gewicht, index) => {
      const attribut = attributeNachId.get(gewicht.attributId);
      const name = attribut ? attributName(attribut) : '?';
      return `${name} ${prozentPunkte(prozente[index] ?? 0)}`;
    });
    const fassungen = teile.length > 0 ? staerktFassungen(teile) : [];
    const anteile: ReactNode =
      gewichte.length > 0 ? (
        <>
          {neben || fassungen.length === 0 ? null : (
            <GekuerzteNebenzeile
              fassungen={fassungen}
              anteile
              className="mt-1 truncate text-[13px] leading-[18px] text-leise"
            />
          )}
          {abzugZeilen.length > 0 ? (
            <span className="mt-1 block truncate text-[13px] leading-[18px] text-leise">
              {abzugZeilen
                .map((abzug) => {
                  const attribut = attributeNachId.get(abzug.attributId);
                  const abzugName = attribut ? attributName(attribut) : '?';
                  return `${abzugName} \u2212${prozentPunkte(abzug.prozent)}`;
                })
                .join(' · ')}
            </span>
          ) : null}
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
            {rest > 0 ? (
              <span
                data-rest={rest}
                style={{
                  width: `${rest}%`,
                  flexGrow: 0,
                  flexShrink: 0,
                  minWidth: 0,
                  backgroundColor: 'color-mix(in srgb, var(--leise) 45%, transparent)',
                }}
              />
            ) : null}
          </div>
        </>
      ) : null;
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
            className={`relative flex min-h-12 items-center gap-3 px-4 py-3 ${vorlage.archiviert ? 'opacity-50' : ''}`}
          >
            <button type="button" aria-label={vorlage.name} onClick={() => onBearbeiten(vorlage)} className="absolute inset-0 z-0" />
            <Icon name={vorlage.icon} className="pointer-events-none size-5 shrink-0 text-leise" />
            <span className="pointer-events-none min-w-0 flex-1">
              <span className="block truncate text-base leading-6">{vorlage.name}</span>
              {neben ? <span className="block truncate text-[13px] leading-[18px] text-leise">{neben}</span> : null}
              {anteile}
            </span>
            <span className="pointer-events-auto relative z-10">{menue}</span>
          </div>
        )}
      </SchnellZeile>
    );
  };

  const allgemein = (vorlagen ?? []).filter((vorlage) => vorlage.projektId === null);
  const projekt = (vorlagen ?? []).filter((vorlage) => vorlage.projektId !== null);

  return (
    <div className="space-y-6">
      <ReihenfolgeKnopf vorlagen={vorlagen ?? []} />
      {isPending ? <Ladeanzeige /> : null}
      {error ? <Fehlermeldung fehler={error} /> : null}
      {vorlagen?.length === 0 ? <Leer text={tx('Noch keine Tätigkeit.')} /> : null}
      {vorlagen ? (
        <>
          <div data-taetigkeit-gruppe="allgemein">
            <Liste>
              {allgemein.map((vorlage) => zeile(vorlage, null))}
              <AnlegeZeile text="Tätigkeit anlegen" onKlick={() => onBearbeiten(null)} />
            </Liste>
          </div>
          {projekt.length > 0 ? (
            <ZeilenGruppe titel="Nur für ein Projekt">
              {projekt.map((vorlage) => zeile(vorlage, vorlage.projektName))}
            </ZeilenGruppe>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
