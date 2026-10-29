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
  menueTeile,
  primaerPunkt,
  punkteFuer,
  wendeAlle,
  ZEIGE_PX,
  type CacheModus,
  type SchnellPunkt,
  type SchnellPunktArt,
  type SchnellZiel,
} from '../schnell.ts';
import { useBestaetigung } from './Bestaetigung.tsx';
import { Toast } from './Toast.tsx';
import { Knopf } from '../ui/index.ts';

const STREIFEN_PX = AUSLOESEN_PX + 24;
const SCHIEBE_ZEIT = '200ms cubic-bezier(0, 0, 0.2, 1)';

/** Bei Ruhe ganz weg, sonst nur der noch verdeckte Teil. Sonst scheint der Streifen durch transparente Deckel. */
function streifenClip(x: number): string {
  const links = x >= 0 ? STREIFEN_PX : Math.max(0, STREIFEN_PX + x);
  return `inset(0 0 0 ${links}px)`;
}

interface Meldung {
  id: number;
  art: 'status' | 'fehler';
  text: string;
  undo?: () => void;
}

interface Aufgeschoben {
  senden: () => Promise<unknown>;
  erledigt: boolean;
}

interface SchnellApi {
  ausfuehren: (ziel: SchnellZiel, punkt: SchnellPunktArt) => Promise<boolean>;
  melde: (text: string, undo?: () => void) => void;
  schiebe: (text: string, senden: () => Promise<unknown>, zurueck: () => void) => void;
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
    if (ziel.art === 'knoten') {
      await api.loescheKnoten(ziel.id);
      return;
    }
    if (ziel.art === 'vorhaben') return api.loescheVorhaben(ziel.id);
    if (ziel.art === 'eintrag') return api.loescheEintrag(ziel.id);
    if (ziel.art === 'kalender') return api.loescheKalender(ziel.id);
    if (ziel.art === 'todoist') return api.trenneTodoist();
    if (ziel.art === 'trainingsplan' || ziel.art === 'uebung') return;
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
}

function modusVon(punkt: SchnellPunktArt): CacheModus {
  if (punkt === 'loeschen') return 'entfernen';
  return punkt;
}

export function SchnellProvider({ children }: { children: ReactNode }) {
  const bestaetigen = useBestaetigung();
  const client = useQueryClient();
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const meldungId = useRef(0);
  const lauf = useRef(0);
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  const tiefe = useRef(0);
  const wartend = useRef<Aufgeschoben | null>(null);

  const zeigeRoh = useCallback((neu: Omit<Meldung, 'id'> | null) => {
    if (!neu) {
      setMeldung(null);
      return;
    }
    meldungId.current += 1;
    setMeldung({ ...neu, id: meldungId.current });
  }, []);

  const reiht = useCallback(<T,>(arbeit: () => Promise<T>): Promise<T> => {
    const lauf = kette.current.then(
      async () => {
        tiefe.current += 1;
        try {
          return await arbeit();
        } finally {
          tiefe.current -= 1;
        }
      },
      async () => {
        tiefe.current += 1;
        try {
          return await arbeit();
        } finally {
          tiefe.current -= 1;
        }
      },
    );
    kette.current = lauf.then(
      () => undefined,
      () => undefined,
    );
    return lauf;
  }, []);

  const festschreiben = useCallback((): Promise<unknown> => {
    const aktuell = wartend.current;
    if (!aktuell || aktuell.erledigt) {
      return Promise.resolve();
    }
    aktuell.erledigt = true;
    wartend.current = null;
    // Innerhalb der Kette direkt senden. Ein weiteres reiht wartet sonst auf sich selbst.
    if (tiefe.current > 0) {
      return aktuell.senden();
    }
    return reiht(() => aktuell.senden());
  }, [reiht]);

  const fehlertext = (fehler: unknown) => (fehler instanceof ApiFehler ? fehler.message : tx('Das hat nicht geklappt.'));

  const schiebe = useCallback(
    (text: string, sendenAktion: () => Promise<unknown>, zurueck: () => void) => {
      const mein = ++lauf.current;
      void festschreiben();
      const eintrag: Aufgeschoben = {
        erledigt: false,
        senden: async () => {
          try {
            await sendenAktion();
            if (lauf.current === mein) {
              await client.invalidateQueries();
            }
          } catch (fehler) {
            if (lauf.current !== mein) {
              return;
            }
            zurueck();
            zeigeRoh({ art: 'fehler', text: fehlertext(fehler) });
          }
        },
      };
      wartend.current = eintrag;
      zeigeRoh({
        art: 'status',
        text,
        undo: () => {
          if (eintrag.erledigt) {
            return;
          }
          eintrag.erledigt = true;
          if (wartend.current === eintrag) {
            wartend.current = null;
          }
          zurueck();
          zeigeRoh(null);
        },
      });
    },
    [client, festschreiben, zeigeRoh],
  );

  const melde = useCallback(
    (text: string, undo?: () => void) => {
      lauf.current += 1;
      void festschreiben();
      zeigeRoh({ art: 'status', text, undo });
    },
    [festschreiben, zeigeRoh],
  );

  const commit = useCallback(
    (ziel: SchnellZiel, punkt: SchnellPunktArt, warten: boolean): Promise<boolean> => {
      const mein = ++lauf.current;
      const modus = modusVon(punkt);
      const arbeit = async (): Promise<boolean> => {
        await festschreiben();
        await client.cancelQueries();
        const snapshot = client.getQueriesData({ predicate: () => true });
        wendeAlle(client, ziel.art, ziel.id, modus);
        if (punkt !== 'loeschen') {
          const text =
            punkt === 'archivieren'
              ? tx('{name} archiviert', { name: ziel.name })
              : tx('{name} wiederhergestellt', { name: ziel.name });
          const zurueck = punkt === 'archivieren' ? 'wiederherstellen' : 'archivieren';
          zeigeRoh({
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
          zeigeRoh({ art: 'fehler', text: fehlertext(fehler) });
          return false;
        }
      };
      const versprechen = reiht(arbeit);
      return warten ? versprechen : Promise.resolve(true);
    },
    [client, festschreiben, reiht, zeigeRoh],
  );

  const loeschenSpaeter = useCallback(
    (ziel: SchnellZiel): Promise<boolean> => {
      const mein = ++lauf.current;
      const text = ziel.art === 'eintrag' ? tx('Eintrag gelöscht') : tx('„{name}" gelöscht', { name: ziel.name });
      const versprechen = reiht(async () => {
        await festschreiben();
        await client.cancelQueries();
        const snapshot = client.getQueriesData({ predicate: () => true });
        wendeAlle(client, ziel.art, ziel.id, 'entfernen');
        const eintrag: Aufgeschoben = {
          erledigt: false,
          senden: async () => {
            try {
              await sende(ziel, 'loeschen');
              if (lauf.current === mein) {
                await client.invalidateQueries();
              }
            } catch (fehler) {
              if (lauf.current !== mein) {
                return;
              }
              for (const [key, wert] of snapshot) {
                client.setQueryData(key as QueryKey, wert);
              }
              zeigeRoh({ art: 'fehler', text: fehlertext(fehler) });
            }
          },
        };
        wartend.current = eintrag;
        zeigeRoh({
          art: 'status',
          text,
          undo: () => {
            if (eintrag.erledigt) {
              return;
            }
            eintrag.erledigt = true;
            if (wartend.current === eintrag) {
              wartend.current = null;
            }
            for (const [key, wert] of snapshot) {
              client.setQueryData(key as QueryKey, wert);
            }
            zeigeRoh(null);
          },
        });
        return true;
      });
      return versprechen;
    },
    [client, festschreiben, reiht, zeigeRoh],
  );

  const ausfuehren = useCallback(
    async (ziel: SchnellZiel, punkt: SchnellPunktArt): Promise<boolean> => {
      if (punkt === 'wiederherstellen' && ziel.onWiederherstellen) {
        ziel.onWiederherstellen();
        return true;
      }
      if (punkt === 'loeschen') {
        const frage = bestaetigungFuer(ziel);
        if (frage) {
          const ja = await bestaetigen({ ...frage, gefahr: true });
          if (!ja) {
            return false;
          }
          return commit(ziel, punkt, true);
        }
        return loeschenSpaeter(ziel);
      }
      return commit(ziel, punkt, false);
    },
    [bestaetigen, commit, loeschenSpaeter],
  );

  return (
    <SchnellKontext.Provider value={{ ausfuehren, melde, schiebe }}>
      {children}
      {meldung ? (
        <Toast
          key={meldung.id}
          text={meldung.text}
          rolle={meldung.art === 'fehler' ? 'alert' : 'status'}
          aktion={meldung.undo}
          aktionLabel={meldung.undo ? 'Rückgängig' : undefined}
          onEnde={() => {
            void festschreiben();
            setMeldung((aktuell) => (aktuell?.id === meldung.id ? null : aktuell));
          }}
        />
      ) : null}
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

  const teile = menueTeile(punkte);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={tx("Aktionen")}
      style={stil}
      onKeyDown={beiTaste}
      className="fixed z-[80] min-w-44 rounded-xl border border-rand bg-flaeche py-1 shadow-lg"
    >
      {teile.oben.map((punkt) => (
        <button
          key={punkt.art}
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-flaeche-2"
          onClick={() => onWahl(punkt)}
        >
          {tx(punkt.label)}
        </button>
      ))}
      {teile.loeschen && (
        <button
          type="button"
          role="menuitem"
          className={`block w-full px-3 py-2.5 text-left text-sm text-gefahr hover:bg-flaeche-2 ${teile.oben.length > 0 ? 'border-t border-[var(--trenner)]' : ''}`}
          onClick={() => {
            if (teile.loeschen) {
              onWahl(teile.loeschen);
            }
          }}
        >
          {tx(teile.loeschen.label)}
        </button>
      )}
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
  const farbe = primaer?.art === 'loeschen' ? 'bg-gefahr text-gefahr-text' : 'bg-akzent text-akzent-text';

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
      <div
        data-schnell-streifen=""
        className={`absolute inset-y-0 right-0 flex justify-end ${farbe}`}
        style={{
          width: STREIFEN_PX,
          clipPath: streifenClip(x),
          transition: zieht ? 'none' : `clip-path ${SCHIEBE_ZEIT}`,
        }}
      >
        <button
          type="button"
          data-schnell-frei=""
          tabIndex={x === 0 ? -1 : 0}
          aria-hidden={x === 0}
          className="shrink-0 text-sm font-medium"
          style={{ width: ZEIGE_PX }}
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
      <div
        className={`relative min-w-full ${hintergrund}`}
        style={{
          transform: `translateX(${x}px)`,
          transition: zieht ? 'none' : `transform ${SCHIEBE_ZEIT}`,
        }}
      >
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
