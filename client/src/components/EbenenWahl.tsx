import { tx } from '../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Landmark, Mountain, Target } from 'lucide-react';
import { Link } from 'react-router';
import { ebenenSperre } from '../../../shared/spiel/abhaengigkeiten.ts';
import {
  EBENEN,
  hinweisAusblenden,
  setzeEbene,
  zieleAktiv,
  ZIEL_MARKE,
  type Ebene,
  type Ebenen,
} from '../../../shared/spiel/ebenen.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useBestaetigung } from './Bestaetigung.tsx';
import { ZeileSchalter, ZeilenGruppe } from './Zeile.tsx';

const EBENEN_ICON = {
  visionen: Mountain,
  projekte: Flag,
  vorhaben: Target,
  organisationen: Landmark,
} as const;

export function EbenenWahl() {
  const queryClient = useQueryClient();
  const bestaetigen = useBestaetigung();
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const speichern = useMutation({
    mutationFn: (ebenen: Ebenen) => api.aendereEinstellungen({ ebenen }),
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
      void queryClient.invalidateQueries();
    },
  });
  if (!einstellungen) {
    return <div id="ziel-stufen" className="scroll-mt-24" />;
  }
  const umschalten = async (ebene: Ebene, an: boolean) => {
    const nachher = setzeEbene(einstellungen.ebenen, ebene, an);
    const hinweis = hinweisAusblenden(einstellungen.ebenen, nachher, einstellungen.ebenenZahlen);
    if (
      hinweis &&
      !(await bestaetigen({
        titel: tx("Ebenen ausblenden?"),
        text: hinweis,
        knopf: tx("Ausblenden"),
      }))
    ) {
      return;
    }
    speichern.mutate(nachher);
  };
  const oeffnen = zieleAktiv(einstellungen.ebenen);
  return (
    <div id="ziel-stufen" className="scroll-mt-24">
      <ZeilenGruppe titel="Ziel-Stufen">
        {EBENEN.map((ebene) => {
          const sperre = ebenenSperre(ebene, einstellungen.ebenen);
          const Icon = EBENEN_ICON[ebene];
          const an = einstellungen.ebenen[ebene];
          return (
            <ZeileSchalter
              key={ebene}
              symbol={<Icon className="size-5" aria-hidden />}
              titel={ZIEL_MARKE[ebene].mehrzahl}
              untertitel={ZIEL_MARKE[ebene].kuerzel}
              info={sperre ?? undefined}
              an={an}
              deaktiviert={sperre !== null}
              onAendern={(wert) => void umschalten(ebene, wert)}
              neben={
                an && oeffnen ? (
                  <Link to="/ziele" className="text-sm font-medium text-akzent">
                    {tx("Öffnen")}
                  </Link>
                ) : undefined
              }
            />
          );
        })}
      </ZeilenGruppe>
    </div>
  );
}
