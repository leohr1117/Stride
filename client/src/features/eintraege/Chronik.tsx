import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EintragFilter } from '../../../../shared/api/index.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { EintragListe } from './EintragListe.tsx';
import { AuswahlBlatt, type AuswahlOption } from '../../components/AuswahlBlatt.tsx';
import { Icon } from '../../components/Icons.tsx';
import { Chip, Schalter } from '../../ui/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

function idsMit(werte: string[], art: 'vision' | 'organisation'): number[] {
  const prefix = `${art}:`;
  return werte.filter((wert) => wert.startsWith(prefix)).map((wert) => Number(wert.slice(prefix.length)));
}

export function ChronikSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const visionenAn = istAn('visionen', sichtbarkeit);
  const organisationenAn = istAn('organisationen', sichtbarkeit);
  const [bereiche, setBereiche] = useState<string[]>([]);
  const [vorlageId, setVorlageId] = useState<number | undefined>();
  const [nurMeilensteine, setNurMeilensteine] = useState(true);

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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {(visionenAn || organisationenAn) && (
          <AuswahlBlatt
            label={tx('Bereich')}
            modus="filter"
            wert={sichtbar}
            optionen={optionen}
            alleText={tx('Alle Bereiche')}
            zahlText={(anzahl) => tx('{anzahl} Bereiche', { anzahl })}
            leerText={tx('Noch keine Bereiche.')}
            leerAktion={{ label: tx('Bereich anlegen'), href: '/ziele' }}
            onAendern={setBereiche}
          />
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
