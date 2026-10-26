import { tx } from '../text.ts';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react';
import type { Einstellungen } from '../../../shared/api/index.ts';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../../../shared/sprache/kern.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useSprache } from '../sprache.tsx';
import { Fehlermeldung, InfoHinweis, Knopf } from '../ui/index.ts';

/** Überlebt den Neuaufbau beim Sprachwechsel, damit ältere Speichern nicht gewinnen. */
let speicherKette: Promise<void> = Promise.resolve();

function spracheMerken(code: Sprache, queryClient: QueryClient): Promise<Einstellungen> {
  const naechste = speicherKette
    .catch(() => undefined)
    .then(() => api.aendereEinstellungen({ sprache: code }))
    .then((neu) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
      return neu;
    });
  speicherKette = naechste.then(
    () => undefined,
    () => undefined,
  );
  return naechste;
}

const SEITEN: { text: string; bild: ReactNode }[] = [
  {
    text: 'Fortschritt und Ziele werden als Level sichtbar.',
    bild: <BildFortschritt />,
  },
  {
    text: 'Auch große Ziele starten mit einem Schritt.',
    bild: <BildSchritt />,
  },
  {
    text: 'Dranbleiben zählt als Serie.',
    bild: <BildSerie />,
  },
  {
    text: 'Einträge festhalten reicht.',
    bild: <BildEintrag />,
  },
];

const WISCH_MIN = 48;

export function SprachStart({ onFertig }: { onFertig: () => void }) {
  const { sprache, waehle } = useSprache();
  const queryClient = useQueryClient();
  const [wartet, setWartet] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);

  const waehleSprache = (code: Sprache) => {
    waehle(code);
    void spracheMerken(code, queryClient).catch(() => undefined);
  };

  const weiter = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (wartet) {
      return;
    }
    waehle(sprache);
    setWartet(true);
    setFehler(null);
    void spracheMerken(sprache, queryClient)
      .then(() => onFertig())
      .catch((grund: unknown) => {
        setFehler(grund);
        setWartet(false);
      });
  };

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6">
      <form onSubmit={weiter} className="mx-auto my-auto w-full max-w-lg shrink-0 space-y-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-7" />
          Stride
        </div>
        <div className="flex min-w-0 items-center">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{tx('Sprache')}</h1>
          <InfoHinweis text="Gilt für die ganze App und für die Start-Tätigkeiten." />
        </div>
        <div role="radiogroup" aria-label={tx('Sprache')} className="space-y-2">
          {SPRACHEN.map((code) => {
            const aktiv = sprache === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                lang={code}
                aria-checked={aktiv}
                onClick={() => waehleSprache(code)}
                className={`sprach-wahl min-h-11 w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium break-words transition ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
              >
                {SPRACH_NAME[code]}
              </button>
            );
          })}
        </div>
        <Fehlermeldung fehler={fehler} />
        <div className="flex justify-end">
          <Knopf type="submit" variante="primaer" disabled={wartet}>
            {tx('Weiter')}
          </Knopf>
        </div>
      </form>
    </main>
  );
}

export function Einfuehrung({ onFertig }: { onFertig: () => void }) {
  const [seite, setSeite] = useState(0);
  const startX = useRef<number | null>(null);
  const aktuell = SEITEN[seite] ?? SEITEN[0];
  const letzte = seite === SEITEN.length - 1;

  const weiter = () => {
    if (letzte) {
      onFertig();
      return;
    }
    setSeite(seite + 1);
  };

  const zurueck = () => {
    if (seite > 0) {
      setSeite(seite - 1);
    }
  };

  const zeigerStart = (ereignis: PointerEvent<HTMLDivElement>) => {
    if (ereignis.pointerType === 'mouse' && ereignis.button !== 0) {
      return;
    }
    if (ereignis.target instanceof Element && ereignis.target.closest('button')) {
      return;
    }
    startX.current = ereignis.clientX;
    ereignis.currentTarget.setPointerCapture(ereignis.pointerId);
  };

  const zeigerEnde = (ereignis: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) {
      return;
    }
    const delta = ereignis.clientX - startX.current;
    startX.current = null;
    if (delta <= -WISCH_MIN) {
      weiter();
    } else if (delta >= WISCH_MIN) {
      zurueck();
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-8">
        <p className="text-lg font-bold tracking-tight">Stride</p>
        <div
          className="touch-none space-y-6"
          onPointerDown={zeigerStart}
          onPointerUp={zeigerEnde}
          onPointerCancel={() => {
            startX.current = null;
          }}
        >
          <div className="flex justify-center text-akzent" aria-hidden="true">
            {aktuell.bild}
          </div>
          <p className="sr-only">
            {tx('Folie {seite} von {anzahl}', { seite: seite + 1, anzahl: SEITEN.length })}
          </p>
          <p className="text-center text-lg font-medium text-balance break-words">{tx(aktuell.text)}</p>
          <div className="flex justify-center gap-2" role="tablist" aria-label={tx("Folien")}>
            {SEITEN.map((eintrag, index) => (
              <button
                key={eintrag.text}
                type="button"
                role="tab"
                aria-selected={index === seite}
                aria-label={tx('Folie {index}', { index: index + 1 })}
                className="flex size-8 items-center justify-center"
                onClick={() => setSeite(index)}
              >
                <span className={`size-2.5 rounded-full ${index === seite ? 'bg-akzent' : 'bg-leise/40'}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Knopf type="button" variante="leise" onClick={onFertig}>
            {tx("Überspringen")}
          </Knopf>
          <Knopf type="button" variante="primaer" onClick={weiter}>
            {letzte ? tx('Zu den Fragen') : tx('Weiter')}
          </Knopf>
        </div>
      </div>
    </main>
  );
}

function BildRahmen({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 160 112" className="h-32 w-44" fill="none">
      {children}
    </svg>
  );
}

function BildFortschritt() {
  return (
    <BildRahmen>
      <path d="M16 100h128" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.35" />
      <rect x="24" y="68" width="28" height="32" rx="8" fill="currentColor" opacity="0.4" />
      <rect x="66" y="44" width="28" height="56" rx="8" fill="currentColor" opacity="0.7" />
      <rect x="108" y="20" width="28" height="80" rx="8" fill="currentColor" />
    </BildRahmen>
  );
}

function BildSchritt() {
  return (
    <BildRahmen>
      <circle cx="108" cy="56" r="34" stroke="currentColor" strokeWidth="12" opacity="0.35" />
      <rect x="16" y="40" width="32" height="32" rx="8" fill="currentColor" />
      <path d="M48 56h22" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
    </BildRahmen>
  );
}

function BildSerie() {
  return (
    <BildRahmen>
      <circle cx="28" cy="56" r="16" fill="currentColor" />
      <path d="M44 56h24" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <circle cx="80" cy="56" r="16" fill="currentColor" />
      <path d="M96 56h24" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <circle cx="132" cy="56" r="16" fill="currentColor" />
    </BildRahmen>
  );
}

function BildEintrag() {
  return (
    <BildRahmen>
      <rect x="40" y="16" width="80" height="80" rx="16" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="8" />
      <path d="M56 42h48" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.45" />
      <path d="M56 60h36" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.45" />
      <path d="M56 78l10 10 18-20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </BildRahmen>
  );
}
