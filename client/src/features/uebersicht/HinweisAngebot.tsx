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
    <Karte label={frage} className="space-y-3">
      <p className="text-base">{frage}</p>
      <Link
        to="/mehr/benachrichtigungen"
        className="knopf knopf-primaer inline-flex w-fit rounded-xl bg-akzent px-4 py-2.5 text-sm font-medium text-akzent-text"
      >
        {tx('Ansehen')}
      </Link>
      <button type="button" className="knopf block px-0 py-1 text-left text-sm text-leise" onClick={weglegen}>
        {tx('Nicht jetzt')}
      </button>
      <Fehlermeldung fehler={angebotFehler()} />
    </Karte>
  );
}
