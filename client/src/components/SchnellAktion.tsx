import { tx } from '../text.ts';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { EllipsisVertical } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ApiFehler, api } from '../api/index.ts';
import {
  ACHSE_PX,
  AUSLOESEN_PX,
  bestaetigungFuer,
  OFFEN_ANTEIL,
  primaerPunkt,
  punkteFuer,
  UNDO_MS,
  wendeAlle,
  ZEIGE_PX,
  type CacheModus,
  type SchnellPunkt,
  type SchnellPunktArt,
  type SchnellZiel,
} from '../schnell.ts';
import { useBestaetigung } from './Bestaetigung.tsx';
import { Knopf } from '../ui/index.ts';

interface Meldung {
  art: 'status' | 'fehler';
  text: string;
  undo?: () => void;
}

interface SchnellApi {
  ausfuehren: (ziel: SchnellZiel, punkt: SchnellPunktArt) => Promise<boolean>;
}

const SchnellKontext = createContext<SchnellApi | null>(null);

function useSchnell(): SchnellApi {
  const wert = useContext(SchnellKontext);
  if (!wert) {
    throw new Error('useSchnellAktion muss innerhalb von <SchnellProvider> verwendet werden.');
  }
  return wert;
}

export function useSchnellAktion(): SchnellApi {
  return useSchnell();
}

async function sende(ziel: SchnellZiel, punkt: SchnellPunktArt): Promise<void> {
  const archiviert = punkt === 'archivieren';
  if (punkt === 'loeschen') {
    if (ziel.art === 'vision') return api.loescheVision(ziel.id);
    if (ziel.art === 'organisation') return api.loescheOrganisation(ziel.id);
    if (ziel.art === 'projekt') return api.loescheProjekt(ziel.id);
    if (ziel.art === 'vorlage') return api.loescheVorlage(ziel.id);
    if (ziel.art === 'attribut') return api.loescheAttribut(ziel.id);
    if (ziel.art === 'faehigkeit') return api.loescheFaehigkeit(ziel.id);
    if (ziel.art === 'investition') return api.loescheInvestition(ziel.id);
    if (ziel.art === 'basis') return api.loescheBasisAufgabe(ziel.id);
    if (ziel.art === 'aufgabe') return api.loescheAufgabe(ziel.id);
    if (ziel.art === 'knoten') {
      await api.loescheKnoten(ziel.id);
      return;
    }
    if (ziel.art === 'vorhaben') return api.loescheVorhaben(ziel.id);
    if (ziel.art === 'eintrag') return api.loescheEintrag(ziel.id);
    if (ziel.art === 'kalender') return api.loescheKalender(ziel.id);
    if (ziel.art === 'todoist') return api.trenneTodoist();
    if (ziel.art === 'trainingsplan') return api.loescheTrainingsplan(ziel.id);
    if (ziel.art === 'uebung') return api.loescheUebung(ziel.id);
    return api.loescheKonto(ziel.id);
  }
  if (ziel.art === 'vision') await api.aendereVision(ziel.id, { archiviert });
  else if (ziel.art === 'organisation') await api.aendereOrganisation(ziel.id, { archiviert });
  else if (ziel.art === 'projekt') await api.aendereProjekt(ziel.id, { archiviert });
  else if (ziel.art === 'vorlage') await api.aendereVorlage(ziel.id, { archiviert });
  else if (ziel.art === 'attribut') await api.aendereAttribut(ziel.id, { archiviert });
  else if (ziel.art === 'faehigkeit') await api.aendereFaehigkeit(ziel.id, { archiviert });
  else if (ziel.art === 'investition') await api.aendereInvestition(ziel.id, { archiviert });
  else if (ziel.art === 'basis') await api.aendereBasisAufgabe(ziel.id, { archiviert });
  else if (ziel.art === 'aufgabe') await api.aendereAufgabe(ziel.id, { archiviert });
  else if (ziel.art === 'trainingsplan') await api.aendereTrainingsplan(ziel.id, { archiviert });
  else if (ziel.art === 'uebung') await api.aendereUebung(ziel.id, { archiviert });
}

function modusVon(punkt: SchnellPunktArt): CacheModus {
  if (punkt === 'loeschen') return 'entfernen';
  return punkt;
}

export function SchnellProvider({ children }: { children: ReactNode }) {
  const bestaetigen = useBestaetigung();
  const client = useQueryClient();
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const timer = useRef<number | null>(null);
  const lauf = useRef(0);
  const kette = useRef<Promise<unknown>>(Promise.resolve());

  const zeige = useCallback((neu: Meldung | null) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setMeldung(neu);
    if (neu) {
      timer.current = window.setTimeout(() => setMeldung(null), UNDO_MS);
    }
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const reiht = useCallback(<T,>(arbeit: () => Promise<T>): Promise<T> => {
    const naechste = kette.current.then(arbeit, arbeit);
    kette.current = naechste.then(
      () => undefined,
      () => undefined,
    );
    return naechste;
  }, []);

  const commit = useCallback(
    (ziel: SchnellZiel, punkt: SchnellPunktArt, warten: boolean): Promise<boolean> => {
      const mein = ++lauf.current;
      const modus = modusVon(punkt);
      const arbeit = async (): Promise<boolean> => {
        await client.cancelQueries();
        const snapshot = client.getQueriesData({ predicate: () => true });
        wendeAlle(client, ziel.art, ziel.id, modus);
        if (punkt === 'loeschen') {
          zeige(null);
        } else {
          const text =
            punkt === 'archivieren'
              ? tx('{name} archiviert', { name: ziel.name })
              : tx('{name} wiederhergestellt', { name: ziel.name });
          const zurueck = punkt === 'archivieren' ? 'wiederherstellen' : 'archivieren';
          zeige({
            art: 'status',
            text,
            undo: () => {
              void commit(ziel, zurueck, false);
            },
          });
        }
        try {
          await sende(ziel, punkt);
          if (lauf.current !== mein) {
            return true;
          }
          await client.invalidateQueries();
          return true;
        } catch (fehler) {
          if (lauf.current !== mein) {
            return false;
          }
          for (const [key, wert] of snapshot) {
            client.setQueryData(key as QueryKey, wert);
          }
          zeige({
            art: 'fehler',
            text: fehler instanceof ApiFehler ? fehler.message : tx("Das hat nicht geklappt."),
          });
          return false;
        }
      };
      const versprechen = reiht(arbeit);
      return warten ? versprechen : Promise.resolve(true);
    },
    [client, reiht, zeige],
  );

  const ausfuehren = useCallback(
    async (ziel: SchnellZiel, punkt: SchnellPunktArt): Promise<boolean> => {
      if (punkt === 'wiederherstellen' && ziel.onWiederherstellen) {
        ziel.onWiederherstellen();
        return true;
      }
      if (punkt === 'loeschen') {
        const frage = bestaetigungFuer(ziel);
        const ja = await bestaetigen({ ...frage, gefahr: true });
        if (!ja) {
          return false;
        }
        return commit(ziel, punkt, true);
      }
      return commit(ziel, punkt, false);
    },
    [bestaetigen, commit],
  );

  return (
    <SchnellKontext.Provider value={{ ausfuehren }}>
      {children}
      {meldung
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[80] flex justify-center px-4 md:bottom-6">
              <div
                role={meldung.art === 'fehler' ? 'alert' : 'status'}
                className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-rand bg-flaeche px-4 py-3 shadow-lg"
              >
                <span className="min-w-0 flex-1 text-sm break-words">{tx(meldung.text)}</span>
                {meldung.undo ? (
                  <button type="button" className="shrink-0 text-sm font-medium text-akzent" onClick={meldung.undo}>
                    {tx("Rückgängig")}
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </SchnellKontext.Provider>
  );
}

function Menue({
  punkte,
  anker,
  onWahl,
  onSchliessen,
}: {
  punkte: SchnellPunkt[];
  anker: { x: number; y: number };
  onWahl: (punkt: SchnellPunkt) => void;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stil, setStil] = useState({ top: anker.y, left: anker.x });

  useLayoutEffect(() => {
    const kasten = ref.current?.getBoundingClientRect();
    if (!kasten) {
      return;
    }
    let links = anker.x;
    let oben = anker.y;
    if (links + kasten.width > window.innerWidth - 8) {
      links = window.innerWidth - kasten.width - 8;
    }
    if (oben + kasten.height > window.innerHeight - 8) {
      oben = Math.max(8, anker.y - kasten.height);
    }
    setStil({ top: Math.max(8, oben), left: Math.max(8, links) });
  }, [anker]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key !== 'Escape') {
        return;
      }
      ereignis.preventDefault();
      ereignis.stopPropagation();
      onSchliessen();
    };
    const beiZeiger = (ereignis: PointerEvent) => {
      if (!ref.current?.contains(ereignis.target as Node)) {
        onSchliessen();
      }
    };
    window.addEventListener('keydown', beiTaste, true);
    document.addEventListener('pointerdown', beiZeiger);
    return () => {
      window.removeEventListener('keydown', beiTaste, true);
      document.removeEventListener('pointerdown', beiZeiger);
    };
  }, [onSchliessen]);

  const beiTaste = (ereignis: ReactKeyboardEvent) => {
    const knoepfe = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = knoepfe.indexOf(document.activeElement as HTMLButtonElement);
    if (ereignis.key === 'ArrowDown' || ereignis.key === 'ArrowUp' || ereignis.key === 'Home' || ereignis.key === 'End') {
      ereignis.preventDefault();
      const naechster =
        ereignis.key === 'Home'
          ? 0
          : ereignis.key === 'End'
            ? knoepfe.length - 1
            : ereignis.key === 'ArrowDown'
              ? (index + 1) % knoepfe.length
              : (index - 1 + knoepfe.length) % knoepfe.length;
      knoepfe[naechster]?.focus();
    }
    if (ereignis.key === 'Tab') {
      onSchliessen();
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={tx("Aktionen")}
      style={stil}
      onKeyDown={beiTaste}
      className="fixed z-[80] min-w-44 rounded-xl border border-rand bg-flaeche py-1 shadow-lg"
    >
      {punkte.map((punkt) => (
        <button
          key={punkt.art}
          type="button"
          role="menuitem"
          className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-flaeche-2 ${punkt.art === 'loeschen' ? 'text-gefahr' : ''}`}
          onClick={() => onWahl(punkt)}
        >
          {tx(punkt.label)}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function SchnellZeile({
  ziel,
  className = '',
  hintergrund = 'bg-flaeche',
  children,
}: {
  ziel: SchnellZiel;
  className?: string;
  hintergrund?: string;
  children: ReactNode | ((menue: ReactNode) => ReactNode);
}) {
  const aktion = useSchnell();
  const punkte = punkteFuer(ziel);
  const huelle = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const achse = useRef<'x' | 'y' | null>(null);
  const stand = useRef(0);
  const unterdruecke = useRef(false);
  const [x, setX] = useState(0);
  const [zieht, setZieht] = useState(false);
  const [offen, setOffen] = useState(false);
  const [anker, setAnker] = useState<{ x: number; y: number } | null>(null);

  const schliessen = useCallback(() => {
    setOffen(false);
    knopf.current?.focus();
  }, []);

  useEffect(() => {
    if (x === 0) {
      return;
    }
    const zu = (ereignis: PointerEvent) => {
      if (!huelle.current?.contains(ereignis.target as Node)) {
        setX(0);
        stand.current = 0;
      }
    };
    document.addEventListener('pointerdown', zu);
    return () => document.removeEventListener('pointerdown', zu);
  }, [x]);

  if (punkte.length === 0) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {typeof children === 'function' ? children(null) : children}
      </div>
    );
  }

  const primaer = primaerPunkt(punkte);
  const oeffne = (punkt: { x: number; y: number }) => {
    setAnker(punkt);
    setOffen(true);
  };
  const beiWahl = (punkt: SchnellPunkt) => {
    setOffen(false);
    setX(0);
    stand.current = 0;
    void aktion.ausfuehren(ziel, punkt.art);
  };
  const beiDown = (ereignis: ReactPointerEvent) => {
    if (ereignis.pointerType === 'mouse') {
      return;
    }
    if ((ereignis.target as HTMLElement).closest('[data-schnell-menue], [data-schnell-frei]')) {
      return;
    }
    start.current = { x: ereignis.clientX, y: ereignis.clientY, id: ereignis.pointerId };
    achse.current = null;
  };
  const beiMove = (ereignis: ReactPointerEvent) => {
    if (!start.current || ereignis.pointerId !== start.current.id || ereignis.pointerType === 'mouse') {
      return;
    }
    const dx = ereignis.clientX - start.current.x;
    const dy = ereignis.clientY - start.current.y;
    if (!achse.current) {
      if (Math.hypot(dx, dy) < ACHSE_PX) {
        return;
      }
      if (dx >= 0 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        achse.current = 'y';
        return;
      }
      achse.current = 'x';
      setZieht(true);
      try {
        huelle.current?.setPointerCapture(ereignis.pointerId);
      } catch {
        /* Der aktuelle Zug zählt auch ohne Fang. */
      }
    }
    if (achse.current !== 'x') {
      return;
    }
    const zug = Math.max(-AUSLOESEN_PX - 24, Math.min(0, dx));
    stand.current = zug;
    setX(zug);
  };
  const beiEnde = (ereignis: ReactPointerEvent) => {
    if (!start.current || ereignis.pointerId !== start.current.id) {
      return;
    }
    const warX = achse.current === 'x';
    const zug = stand.current;
    start.current = null;
    achse.current = null;
    setZieht(false);
    if (!warX) {
      return;
    }
    unterdruecke.current = true;
    if (zug <= -AUSLOESEN_PX && primaer) {
      setX(0);
      stand.current = 0;
      void aktion.ausfuehren(ziel, primaer.art);
      return;
    }
    if (zug <= -ZEIGE_PX * OFFEN_ANTEIL) {
      setX(-ZEIGE_PX);
      stand.current = -ZEIGE_PX;
      return;
    }
    setX(0);
    stand.current = 0;
  };
  const beiKlick = (ereignis: ReactMouseEvent) => {
    const ziel = ereignis.target instanceof Element ? ereignis.target : null;
    const aufAktion = Boolean(ziel?.closest('[data-schnell-frei], [data-schnell-menue]'));
    if (unterdruecke.current) {
      unterdruecke.current = false;
      if (!aufAktion) {
        ereignis.preventDefault();
        ereignis.stopPropagation();
      }
      return;
    }
    if (x < 0 && !aufAktion) {
      ereignis.preventDefault();
      ereignis.stopPropagation();
      setX(0);
      stand.current = 0;
    }
  };
  const beiKontext = (ereignis: ReactMouseEvent) => {
    ereignis.preventDefault();
    oeffne({ x: ereignis.clientX, y: ereignis.clientY });
  };

  const menue = (
    <button
      ref={knopf}
      type="button"
      data-schnell-menue=""
      aria-label={tx('Aktionen für {name}', { name: ziel.name })}
      aria-haspopup="menu"
      aria-expanded={offen}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-leise hover:bg-flaeche-2 hover:text-haupt"
      onClick={(ereignis) => {
        ereignis.stopPropagation();
        const kasten = knopf.current?.getBoundingClientRect();
        oeffne(kasten ? { x: kasten.left, y: kasten.bottom } : { x: ereignis.clientX, y: ereignis.clientY });
      }}
    >
      <EllipsisVertical className="size-5" />
    </button>
  );
  const inhalt = typeof children === 'function' ? children(menue) : (
    <div className="flex min-w-0 flex-1 items-center">
      <div className="min-w-0 flex-1">{children}</div>
      {menue}
    </div>
  );
  const farbe = primaer?.art === 'loeschen' ? 'bg-gefahr text-white' : 'bg-akzent text-akzent-text';

  return (
    <div
      ref={huelle}
      data-schnell={ziel.name}
      className={`relative overflow-hidden ${className}`}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={beiDown}
      onPointerMove={beiMove}
      onPointerUp={beiEnde}
      onPointerCancel={beiEnde}
      onClickCapture={beiKlick}
      onContextMenu={beiKontext}
    >
      <div className={`absolute inset-y-0 right-0 flex w-[156px] justify-end ${farbe}`}>
        <button
          type="button"
          data-schnell-frei=""
          tabIndex={x === 0 ? -1 : 0}
          aria-hidden={x === 0}
          className="w-[88px] text-sm font-medium"
          onClick={() => {
            if (primaer) {
              setX(0);
              stand.current = 0;
              void aktion.ausfuehren(ziel, primaer.art);
            }
          }}
        >
          {primaer ? tx(primaer.label) : null}
        </button>
      </div>
      <div className={`relative min-w-full ${hintergrund} ${zieht ? '' : 'transition-transform duration-200 ease-out'}`} style={{ transform: `translateX(${x}px)` }}>
        {inhalt}
      </div>
      {offen && anker ? <Menue punkte={punkte} anker={anker} onWahl={beiWahl} onSchliessen={schliessen} /> : null}
    </div>
  );
}

export function SchnellNebenaktion({ ziel, onErledigt }: { ziel: SchnellZiel; onErledigt?: () => void }) {
  const aktion = useSchnell();
  const punkte = punkteFuer(ziel);
  if (punkte.length === 0) {
    return null;
  }
  return (
    <>
      {punkte.map((punkt) => (
        <Knopf
          key={punkt.art}
          variante={punkt.art === 'wiederherstellen' ? 'sekundaer' : 'gefahr'}
          onClick={() => {
            void aktion.ausfuehren(ziel, punkt.art).then((ok) => {
              if (ok) {
                onErledigt?.();
              }
            });
          }}
        >
          {tx(punkt.label)}
        </Knopf>
      ))}
    </>
  );
}
