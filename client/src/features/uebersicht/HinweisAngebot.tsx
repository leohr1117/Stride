import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { HinweisZeile } from '../../ui/index.ts';
import { bewertungIstFaellig } from './bewertungStand.ts';
import { angebotFehler, angebotGespeichert, angebotIstFaellig, angebotSchlugFehl, beginneAngebot } from './angebotStand.ts';

export function HinweisAngebot() {
  const client = useQueryClient();
  const navigiere = useNavigate();
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

  const frage = tx('Benachrichtigungen einschalten?');
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
    <HinweisZeile
      text={frage}
      aktion={{ label: tx('Ansehen'), onClick: () => navigiere('/mehr/benachrichtigungen') }}
      onSchliessen={weglegen}
      fehler={angebotFehler()}
    />
  );
}
