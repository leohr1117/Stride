import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Aufgabe } from '../../../../shared/api/aufgaben.ts';
import { datumInZone } from '../../../../shared/spiel/datum.ts';
import { erscheintAufHeute } from '../../../../shared/spiel/aufgabe.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useFunktionen } from '../../funktionen.ts';
import { Fehlermeldung, Karte, Ueberschrift } from '../../ui/index.ts';
import { AufgabenListe, useAufgaben } from '../aufgaben/Aufgaben.tsx';
import { AufgabenFormular } from '../aufgaben/AufgabenDialog.tsx';

const HEUTE_SICHTBAR = 5;

export function Heute() {
  const an = useFunktionen().aufgaben;
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const query = useAufgaben(false, an);
  const [bearbeitung, setBearbeitung] = useState<Aufgabe | null>(null);

  if (!an) {
    return null;
  }
  if (query.isPending) {
    return null;
  }
  if (query.error) {
    return <Fehlermeldung fehler={query.error} />;
  }

  const heute = datumInZone(new Date(), einstellungen?.zeitzone ?? null);
  const zeilen = query.data.filter((aufgabe) => erscheintAufHeute(aufgabe, heute));
  if (zeilen.length === 0) {
    return null;
  }
  const sichtbar = zeilen.slice(0, HEUTE_SICHTBAR);

  return (
    <Karte>
      <Ueberschrift
        titel={tx('Heute')}
        aktion={
          zeilen.length > HEUTE_SICHTBAR ? (
            <Link to="/aufgaben" data-herkunft="/" state={{ herkunft: '/' }} className="text-sm font-medium text-akzent">
              {tx('Alle')}
            </Link>
          ) : null
        }
      />
      <AufgabenListe aufgaben={sichtbar} onBearbeiten={setBearbeitung} />
      <Dialog offen={bearbeitung !== null} titel={tx('Aufgabe bearbeiten')} onSchliessen={() => setBearbeitung(null)}>
        {bearbeitung && (
          <AufgabenFormular key={bearbeitung.id} aufgabe={bearbeitung} onFertig={() => setBearbeitung(null)} />
        )}
      </Dialog>
    </Karte>
  );
}
