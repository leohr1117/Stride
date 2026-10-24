import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import type { EintragFilter } from '../../../../shared/api/index.ts';
import { zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { EintragListe } from './EintragListe.tsx';
import { Icon } from '../../components/Icons.tsx';
import { Chip, EINGABE_STIL, Schalter } from '../../ui/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

type Bereich = { art: 'alle' } | { art: 'vision'; id: number } | { art: 'organisation'; id: number };

function bereichAusWert(wert: string): Bereich {
  const [art, id] = wert.split(':');
  if ((art === 'vision' || art === 'organisation') && id) {
    return { art, id: Number(id) };
  }
  return { art: 'alle' };
}

export function ChronikSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const visionenAn = istAn('visionen', sichtbarkeit);
  const organisationenAn = istAn('organisationen', sichtbarkeit);
  const [bereich, setBereich] = useState<Bereich>({ art: 'alle' });
  const [vorlageId, setVorlageId] = useState<number | undefined>();
  const [nurMeilensteine, setNurMeilensteine] = useState(true);

  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });

  const wirksam =
    (bereich.art === 'vision' && !visionenAn) || (bereich.art === 'organisation' && !organisationenAn)
      ? { art: 'alle' as const }
      : bereich;
  const filter: EintragFilter = {
    visionId: wirksam.art === 'vision' ? wirksam.id : undefined,
    organisationId: wirksam.art === 'organisation' ? wirksam.id : undefined,
    vorlageId,
    nurMeilensteine: nurMeilensteine || undefined,
  };
  const filterAktiv = wirksam.art !== 'alle' || vorlageId !== undefined || nurMeilensteine;
  const chipVorlagen = taetigkeitenFuerProjekt(vorlagen, null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{tx("Chronik")}</h1>

      <div className="space-y-3">
        {(visionenAn || organisationenAn) && (
          <select
            className={EINGABE_STIL}
            value={wirksam.art === 'alle' ? '' : `${wirksam.art}:${wirksam.id}`}
            onChange={(ereignis) => setBereich(bereichAusWert(ereignis.target.value))}
          >
            <option value="">{tx("Alle Bereiche")}</option>
            {visionenAn && ziele && ziele.visionen.length > 0 && (
              <optgroup label={tx(zielTitel('visionen'))}>
                {ziele.visionen.map((vision) => (
                  <option key={vision.id} value={`vision:${vision.id}`}>
                    {vision.titel}
                  </option>
                ))}
              </optgroup>
            )}
            {organisationenAn && ziele && ziele.organisationen.length > 0 && (
              <optgroup label={tx(zielTitel('organisationen'))}>
                {ziele.organisationen.map((organisation) => (
                  <option key={organisation.id} value={`organisation:${organisation.id}`}>
                    {organisation.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
        <Schalter
          an={nurMeilensteine}
          onAendern={setNurMeilensteine}
          label={tx("Nur Meilensteine")}
          icon={<Trophy className={`size-4 ${nurMeilensteine ? 'text-xp' : 'text-leise'}`} />}
        />
        <div className="chip-reihe -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip aktiv={vorlageId === undefined} onClick={() => setVorlageId(undefined)}>
            {tx("Alle")}
          </Chip>
          {chipVorlagen.map((vorlage) => (
            <Chip key={vorlage.id} aktiv={vorlageId === vorlage.id} onClick={() => setVorlageId(vorlage.id)}>
              <Icon name={vorlage.icon} className="size-3.5" />
              {vorlage.name}
            </Chip>
          ))}
        </div>
      </div>

      <EintragListe filter={filter} leerText={filterAktiv ? tx("Keine Einträge für diesen Filter.") : tx("Noch keine Einträge.")} />
    </div>
  );
}
