import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ZugangStatus } from '../../../../shared/api/zugang.ts';
import { ApiFehler, api, SCHLUESSEL } from '../../api/index.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { Zeile } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { googleProfilHinweis } from '../zugang/GoogleAnmeldung.tsx';

type Merker = { art: 'offen' } | { art: 'code'; wert: string } | { art: 'weg' };

let merker: Merker = { art: 'offen' };

const OHNE_PASSWORT = 'Lösen geht erst, wenn das Konto ein Passwort hat. Sonst kommst du nicht mehr hinein.';

function streicheParameter(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('google')) {
    return;
  }
  params.delete('google');
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
}

export function GoogleKonto({ zugang }: { zugang: ZugangStatus | undefined }) {
  const bestaetigen = useBestaetigung();
  const client = useQueryClient();
  const [hinweis, setHinweis] = useState<string | null>(merker.art === 'code' ? googleProfilHinweis(merker.wert) : null);
  const [gesperrt, setGesperrt] = useState(false);
  useEffect(() => {
    if (merker.art === 'weg') {
      return;
    }
    if (merker.art === 'code') {
      setHinweis(googleProfilHinweis(merker.wert));
      return;
    }
    const wert = new URLSearchParams(window.location.search).get('google');
    if (wert === null) {
      return;
    }
    merker = { art: 'code', wert };
    streicheParameter();
    setHinweis(googleProfilHinweis(wert));
  }, []);

  const loesen = async () => {
    const ja = await bestaetigen({
      titel: 'Google lösen?',
      text: 'Danach meldest du dich nur noch mit Passwort an.',
      knopf: 'Lösen',
      gefahr: true,
    });
    if (!ja) {
      return;
    }
    try {
      await api.loeseGoogle();
      await client.invalidateQueries({ queryKey: SCHLUESSEL.zugang });
    } catch (fehler) {
      if (fehler instanceof ApiFehler && fehler.status === 409) {
        setGesperrt(true);
        return;
      }
      setHinweis('Anmeldung mit Google hat nicht geklappt. Versuche es erneut oder melde dich mit Passwort an.');
    }
  };

  if (zugang?.google !== true) {
    return null;
  }
  const email = zugang.googleEmail;
  const verknuepft = email !== null;
  const name = email ? tx('Google · {email} · Lösen', { email }) : tx('Google');
  return (
    <>
      {verknuepft ? (
        <Zeile
          titel={tx('Google')}
          wert={email || undefined}
          name={name}
          deaktiviert={!zugang.googleLoesen || gesperrt}
          onKlick={() => void loesen()}
        />
      ) : (
        <Zeile
          titel={tx('Mit Google verknüpfen')}
          onKlick={() => {
            window.location.assign('/api/zugang/google/start?zweck=verknuepfen');
          }}
        />
      )}
      {verknuepft && (!zugang.googleLoesen || gesperrt) ? <p className="px-4 pb-3 text-sm text-leise">{tx(OHNE_PASSWORT)}</p> : null}
      {hinweis ? (
        <p role="status" className="px-4 pb-3 text-sm text-leise">
          {tx(hinweis)}
        </p>
      ) : null}
    </>
  );
}
