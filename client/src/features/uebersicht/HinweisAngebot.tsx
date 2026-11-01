import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { Fehlermeldung, Karte } from '../../ui/index.ts';
import { bewertungIstFaellig } from './bewertungStand.ts';
import { angebotFehler, angebotGespeichert, angebotIstFaellig, angebotSchlugFehl, beginneAngebot } from './angebotStand.ts';

export function HinweisAngebot() {
  const client = useQueryClient();
  const { data: zeigen } = useQuery({
    queryKey: SCHLUESSEL.angebot,
    queryFn: angebotIstFaellig,
    initialData: angebotIstFaellig,
    staleTime: Infinity,
  });
  const { data: bewertung } = useQuery({
    queryKey: SCHLUESSEL.bewertung,
    queryFn: bewertungIstFaellig,
    initialData: false,
    staleTime: Infinity,
  });
  if (!zeigen || bewertung) {
    return null;
  }

  const frage = tx('Benachrichtigungen auf diesem Gerät einschalten?');
  const weglegen = () => {
    if (!beginneAngebot(client)) {
      return;
    }
    void api.hinweisAngebot().then(
      () => angebotGespeichert(),
      () => angebotSchlugFehl(client),
    );
  };

  return (
    <Karte label={frage} className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-base">{frage}</p>
        <Link
          to="/mehr/benachrichtigungen"
          className="knopf knopf-primaer inline-flex min-h-12 items-center rounded-lg bg-aktion px-4 text-sm font-medium text-aktion-text"
        >
          {tx('Ansehen')}
        </Link>
        <button type="button" className="knopf min-h-12 px-0 text-sm text-leise" onClick={weglegen}>
          {tx('Nicht jetzt')}
        </button>
      </div>
      <Fehlermeldung fehler={angebotFehler()} />
    </Karte>
  );
}
