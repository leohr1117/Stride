import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EintragFilter } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { EintragListe } from './EintragListe.tsx';
import { AuswahlBlatt, type AuswahlOption } from '../../components/AuswahlBlatt.tsx';
import { Icon } from '../../components/Icons.tsx';
import { KopfAktion } from '../../components/Kopf.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { Chip, Knopf, Schalter } from '../../ui/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

function idsMit(werte: string[], art: 'vision' | 'organisation'): number[] {
  const prefix = `${art}:`;
  return werte.filter((wert) => wert.startsWith(prefix)).map((wert) => Number(wert.slice(prefix.length)));
}

interface Entwurf {
  bereiche: string[];
  nurMeilensteine: boolean;
  vorlageId: number | undefined;
}

export function ChronikSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const visionenAn = istAn('visionen', sichtbarkeit);
  const organisationenAn = istAn('organisationen', sichtbarkeit);
  const rueckblickAn = istAn('rueckblick', sichtbarkeit);
  const statistikAn = istAn('statistiken', sichtbarkeit);
  const [bereiche, setBereiche] = useState<string[]>([]);
  const [vorlageId, setVorlageId] = useState<number | undefined>();
  const [nurMeilensteine, setNurMeilensteine] = useState(true);
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);

  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });

  const optionen = useMemo(() => {
    const liste: AuswahlOption[] = [];
    if (visionenAn && ziele) {
      for (const vision of ziele.visionen) {
        liste.push({ wert: `vision:${vision.id}`, name: vision.titel, farbe: vision.farbe });
      }
    }
    if (organisationenAn && ziele) {
      for (const organisation of ziele.organisationen) {
        liste.push({ wert: `organisation:${organisation.id}`, name: organisation.name, farbe: organisation.farbe });
      }
    }
    return liste;
  }, [organisationenAn, visionenAn, ziele]);

  const sichtbar = bereiche.filter((wert) => (wert.startsWith('vision:') ? visionenAn : organisationenAn));
  const visionIds = idsMit(sichtbar, 'vision');
  const organisationIds = idsMit(sichtbar, 'organisation');
  const filter: EintragFilter = {
    visionIds: visionIds.length > 0 ? visionIds : undefined,
    organisationIds: organisationIds.length > 0 ? organisationIds : undefined,
    vorlageId,
    nurMeilensteine: nurMeilensteine || undefined,
  };
  const filterAktiv = sichtbar.length > 0 || vorlageId !== undefined || nurMeilensteine;
  const chipVorlagen = taetigkeitenFuerProjekt(vorlagen, null);
  const bereichAn = visionenAn || organisationenAn;

  const oeffnen = () => {
    setEntwurf({
      bereiche: sichtbar,
      nurMeilensteine,
      vorlageId,
    });
    setOffen(true);
  };

  const anwenden = () => {
    if (!entwurf) {
      setOffen(false);
      return;
    }
    setBereiche(entwurf.bereiche);
    setNurMeilensteine(entwurf.nurMeilensteine);
    setVorlageId(entwurf.vorlageId);
    setOffen(false);
  };

  const zuruecksetzen = () => {
    setBereiche([]);
    setNurMeilensteine(false);
    setVorlageId(undefined);
  };

  return (
    <div>
      <KopfAktion>
        <button
          type="button"
          className="relative inline-flex size-12 items-center justify-center text-haupt"
          aria-label={tx('Filter')}
          aria-pressed={filterAktiv}
          onClick={oeffnen}
        >
          <ListFilter className="size-5" aria-hidden="true" />
          {filterAktiv ? <span data-filter-punkt="" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-aktion" /> : null}
        </button>
      </KopfAktion>

      {(rueckblickAn || statistikAn) && (
        <DichteZeilen>
          <Liste>
            {rueckblickAn ? <Zeile titel={tx('Rückblick')} nach="/rueckblick" /> : null}
            {statistikAn ? <Zeile titel={tx('Statistik')} nach="/statistiken" /> : null}
          </Liste>
        </DichteZeilen>
      )}

      <EintragListe
        filter={filter}
        leerText={filterAktiv ? tx('Keine Einträge für diesen Filter.') : tx('Noch keine Einträge.')}
        onZuruecksetzen={filterAktiv ? zuruecksetzen : undefined}
      />

      <Dialog offen={offen} titel={tx('Filter')} onSchliessen={() => setOffen(false)}>
        {entwurf && (
          <div className="space-y-4">
            {bereichAn && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{tx('Bereich')}</p>
                <AuswahlBlatt
                  label={tx('Bereich')}
                  modus="filter"
                  wert={entwurf.bereiche}
                  optionen={optionen}
                  alleText={tx('Alle Bereiche')}
                  zahlText={(anzahl) => tx('{anzahl} Bereiche', { anzahl })}
                  leerText={tx('Noch keine Bereiche.')}
                  leerAktion={{ label: tx('Bereich anlegen'), href: '/ziele' }}
                  onAendern={(wert) => setEntwurf({ ...entwurf, bereiche: wert })}
                />
              </div>
            )}
            <Schalter
              an={entwurf.nurMeilensteine}
              onAendern={(an) => setEntwurf({ ...entwurf, nurMeilensteine: an })}
              label={tx('Nur Meilensteine')}
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold">{tx('Tätigkeiten')}</p>
              <div className="chip-reihe -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <Chip hoch aktiv={entwurf.vorlageId === undefined} onClick={() => setEntwurf({ ...entwurf, vorlageId: undefined })}>
                  {tx('Alle')}
                </Chip>
                {chipVorlagen.map((vorlage) => (
                  <Chip
                    key={vorlage.id}
                    hoch
                    aktiv={entwurf.vorlageId === vorlage.id}
                    onClick={() => setEntwurf({ ...entwurf, vorlageId: vorlage.id })}
                  >
                    <Icon name={vorlage.icon} className="size-3.5" />
                    {vorlage.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="dialog-aktionen pt-2">
              <Knopf
                onClick={() => setEntwurf({ bereiche: [], nurMeilensteine: false, vorlageId: undefined })}
              >
                {tx('Zurücksetzen')}
              </Knopf>
              <Knopf variante="primaer" onClick={anwenden}>
                {tx('Anwenden')}
              </Knopf>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
