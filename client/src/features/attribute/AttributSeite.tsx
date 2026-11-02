import { attributName, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Attribut } from '../../../../shared/api/index.ts';
import type { AttributKennung, AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { ArchivListe } from '../../components/ArchivListe.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { useFunktionen } from '../../funktionen.ts';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { AttributBereich, AttributFormular, AttributKatalog } from './AttributVerwaltung.tsx';

type Bearbeitung =
  | { art: 'bearbeiten'; attribut: Attribut }
  | { art: 'katalog'; typ: AttributTyp; vorauswahl?: AttributKennung }
  | null;

function dialogTitel(bearbeitung: Bearbeitung): string {
  if (bearbeitung?.art === 'bearbeiten') {
    return attributName(bearbeitung.attribut);
  }
  return tx('Attribut hinzufügen');
}

export function KoennenSeite() {
  return <AttributSeite typ="attribut" />;
}

export function HabenSeite() {
  return <AttributSeite typ="status" />;
}

function AttributSeite({ typ }: { typ: AttributTyp }) {
  const { data: charakter, error, isPending } = useQuery({ queryKey: SCHLUESSEL.charakter, queryFn: api.charakter });
  const { data: alleAttribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const funktionen = useFunktionen();
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error || !charakter) {
    return <Fehlermeldung fehler={error} />;
  }

  const werte = typ === 'status' ? charakter.status : charakter.attribute;
  const aktiveAttribute = [...charakter.attribute, ...charakter.status];
  const archiv = alleAttribute.filter((attribut) => attribut.archiviert && attribut.typ === typ);
  const oeffneKatalog = (vorauswahl?: AttributKennung) => setBearbeitung({ art: 'katalog', typ, vorauswahl });

  return (
    <div className="space-y-6">
      {werte.length === 0 ? (
        <Leer text={tx('Noch keine Attribute.')} aktion={<Knopf onClick={() => oeffneKatalog()}>{tx('Attribut hinzufügen')}</Knopf>} />
      ) : (
        <AttributBereich
          typ={typ}
          werte={werte}
          erschoepfungen={charakter.erschoepfungen}
          onNeu={() => oeffneKatalog()}
          onBearbeiten={(attribut) => setBearbeitung({ art: 'bearbeiten', attribut })}
        />
      )}
      <ArchivListe
        eintraege={archiv.map((attribut) => {
          const kennung = attribut.kennung;
          return {
            schluessel: `a-${attribut.id}`,
            name: attributName(attribut),
            icon: attribut.icon,
            farbe: attribut.farbe,
            ziel: {
              art: 'attribut' as const,
              id: attribut.id,
              name: attributName(attribut),
              archiviert: true,
              loeschbar: attribut.loeschbar,
              onWiederherstellen: kennung !== null ? () => oeffneKatalog(kennung) : undefined,
            },
          };
        })}
      />
      <Dialog offen={bearbeitung !== null} titel={dialogTitel(bearbeitung)} onSchliessen={() => setBearbeitung(null)}>
        {bearbeitung?.art === 'bearbeiten' && (
          <AttributFormular
            key={bearbeitung.attribut.id}
            attribut={bearbeitung.attribut}
            andere={aktiveAttribute.filter(
              (attribut) => attribut.id !== bearbeitung.attribut.id && istTypAktiv(funktionen, attribut.typ),
            )}
            onFertig={() => setBearbeitung(null)}
          />
        )}
        {bearbeitung?.art === 'katalog' && (
          <AttributKatalog
            key={`${bearbeitung.typ}-${bearbeitung.vorauswahl ?? ''}`}
            typ={bearbeitung.typ}
            attribute={alleAttribute}
            vorauswahl={bearbeitung.vorauswahl}
            onFertig={() => setBearbeitung(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
