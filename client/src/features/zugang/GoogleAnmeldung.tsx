import { useEffect, useState } from 'react';
import { tx } from '../../text.ts';

const HINWEIS: Record<string, string> = {
  c: 'Dieses Google-Konto ist mit keinem Stride-Konto verknüpft. Melde dich mit Passwort an und verknüpfe es unter Mehr → Konto.',
  d: 'Anmeldung mit Google hat nicht geklappt. Versuche es erneut oder melde dich mit Passwort an.',
  abbruch: 'Anmeldung mit Google abgebrochen.',
  fremd: 'Dieses Google-Konto ist schon mit einem anderen Stride-Konto verknüpft.',
};

type Merker = { art: 'offen' } | { art: 'code'; wert: string } | { art: 'weg' };

let merker: Merker = { art: 'offen' };

export function googleHinweis(code: string | null): string | null {
  if (!code || code === 'a' || code === 'b') {
    return null;
  }
  return HINWEIS[code] ?? HINWEIS.d ?? null;
}

export function googleProfilHinweis(code: string | null): string | null {
  if (code === 'abbruch') {
    return 'Verknüpfen abgebrochen.';
  }
  return googleHinweis(code);
}

function streicheParameter(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('google')) {
    return;
  }
  params.delete('google');
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
}

export function useGoogleRueckkehr(lesen: boolean): { code: string | null; weg: () => void; setze: (wert: string) => void } {
  const [code, setCode] = useState<string | null>(merker.art === 'code' ? merker.wert : null);
  useEffect(() => {
    if (!lesen || merker.art === 'weg') {
      return;
    }
    if (merker.art === 'code') {
      setCode(merker.wert);
      return;
    }
    const wert = new URLSearchParams(window.location.search).get('google');
    if (wert === null) {
      return;
    }
    merker = { art: 'code', wert };
    streicheParameter();
    setCode(wert);
  }, [lesen]);
  return {
    code,
    weg: () => {
      merker = { art: 'weg' };
      setCode(null);
    },
    setze: (wert: string) => {
      merker = { art: 'code', wert };
      setCode(wert);
    },
  };
}

function useHell(): boolean {
  const [hell, setHell] = useState(() => document.documentElement.dataset.schema === 'light');
  useEffect(() => {
    const wurzel = document.documentElement;
    const lese = () => setHell(wurzel.dataset.schema === 'light');
    const beobachter = new MutationObserver(lese);
    beobachter.observe(wurzel, { attributes: true, attributeFilter: ['data-schema'] });
    return () => beobachter.disconnect();
  }, []);
  return hell;
}

function GoogleZeichen() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[18px] shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const KNOPF =
  'flex w-full min-h-12 items-center justify-center gap-3 rounded-lg border px-3 no-underline text-[14px] leading-5 font-medium';

export function GoogleOder() {
  return (
    <p className="flex items-center gap-3 text-sm text-leise before:h-px before:flex-1 before:bg-current before:opacity-30 after:h-px after:flex-1 after:bg-current after:opacity-30">
      {tx('oder')}
    </p>
  );
}

export function GoogleKnopf() {
  const hell = useHell();
  const farbe = hell
    ? 'border-[#747775] bg-[#FFFFFF] text-[#1F1F1F]'
    : 'border-[#8E918F] bg-[#131314] text-[#E3E3E3]';
  return (
    <a
      href="/api/zugang/google/start?zweck=anmelden"
      className={`${KNOPF} ${farbe}`}
      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
    >
      <GoogleZeichen />
      {tx('Über Google anmelden')}
    </a>
  );
}

export function GoogleAnlage({ email }: { email: string }) {
  return <p className="text-leise">{tx('Mit Google: {email}', { email })}</p>;
}
