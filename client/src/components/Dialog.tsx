import { tx } from '../text.ts';
import { AnimatePresence, usePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { InfoHinweis } from '../ui/Info.tsx';
import { Knopf } from '../ui/index.ts';

const offeneDialoge: symbol[] = [];
const AUSBLENDEN_MS = 180;
const ZUG_SCHWELLE = 96;
const FOKUS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface VerlaufDialog {
  id: string;
  href: string;
  schliessen: () => void;
  vomVerlauf: boolean;
}

const verlauf: VerlaufDialog[] = [];
let laufnummer = 0;
let eigenesPop = false;

function istOberster(kennung: symbol): boolean {
  return offeneDialoge[offeneDialoge.length - 1] === kennung;
}

function istOberstesFenster(fenster: HTMLElement): boolean {
  const alle = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  return alle.length > 0 && alle[alle.length - 1] === fenster;
}

function dialogId(zustand: unknown): string | null {
  if (typeof zustand !== 'object' || zustand === null) {
    return null;
  }
  const id = (zustand as { dialog?: unknown }).dialog;
  return typeof id === 'string' ? id : null;
}

function schreibeDialog(id: string, ersetzen: boolean): void {
  const basis = (history.state ?? {}) as Record<string, unknown>;
  const zustand = { ...basis, dialog: id };
  if (ersetzen) {
    history.replaceState(zustand, '');
  } else {
    history.pushState(zustand, '');
  }
}

function syncInert(): void {
  const wurzel = document.getElementById('root');
  if (wurzel) {
    wurzel.inert = offeneDialoge.length > 0;
  }
}

function beiPop(ereignis: PopStateEvent): void {
  if (eigenesPop) {
    eigenesPop = false;
    ereignis.stopImmediatePropagation();
    const id = dialogId(history.state);
    if (id !== null && !verlauf.some((eintrag) => eintrag.id === id)) {
      eigenesPop = true;
      history.back();
    }
    return;
  }
  const oben = verlauf[verlauf.length - 1];
  if (oben && dialogId(history.state) !== oben.id && location.href === oben.href) {
    ereignis.stopImmediatePropagation();
    oben.schliessen();
    return;
  }
  if (!oben && dialogId(history.state) !== null) {
    ereignis.stopImmediatePropagation();
    history.back();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', beiPop, true);
}

function fokusListe(fenster: HTMLElement): HTMLElement[] {
  return Array.from(fenster.querySelectorAll<HTMLElement>(FOKUS)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

function feldIstPflicht(feld: HTMLElement): boolean {
  return feld.hasAttribute('required') || feld.getAttribute('aria-required') === 'true';
}

function fokusZiel(fenster: HTMLElement): HTMLElement {
  const handy = window.matchMedia('(max-width: 767px)').matches;
  const istFeld = (el: HTMLElement | null): el is HTMLElement => Boolean(el?.matches('input, textarea, select'));
  // React 19 setzt kein autofocus-Attribut. Der Knopf ist beim Layout-Effekt schon fokussiert.
  const schon = document.activeElement;
  const vonReact = schon instanceof HTMLElement && schon !== fenster && fenster.contains(schon) ? schon : null;
  const auto = fenster.querySelector<HTMLElement>('[autofocus]:not([disabled])') ?? vonReact;
  if (istFeld(auto) && handy && !feldIstPflicht(auto)) {
    return fenster;
  }
  if (auto) {
    return auto;
  }
  const gewaehlt = fenster.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
  if (gewaehlt) {
    return gewaehlt;
  }
  const erstesFeld = fenster.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])');
  if (istFeld(erstesFeld) && handy && !feldIstPflicht(erstesFeld)) {
    return fenster;
  }
  if (erstesFeld) {
    return erstesFeld;
  }
  return fenster;
}

function setzeFokus(ziel: HTMLElement): void {
  ziel.focus({ preventScroll: true });
}

/** Fokus bleibt im obersten Fenster. Auswahl startet auf der gewählten Zeile, sonst auf dem markierten Feld. */
export function useFokusKreis(aktiv: boolean, fensterRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    if (!aktiv) {
      return;
    }
    const fenster = fensterRef.current;
    if (!fenster) {
      return;
    }
    const ziel = fokusZiel(fenster);
    setzeFokus(ziel);
    // Ein Scrim-Klick schiebt den Fokus danach auf den Body. Der nächste Frame holt ihn zurück.
    const rahmen = window.requestAnimationFrame(() => {
      if (ziel.isConnected) {
        setzeFokus(ziel);
      }
    });
    const beiTab = (ereignis: KeyboardEvent) => {
      if (ereignis.key !== 'Tab' || !istOberstesFenster(fenster)) {
        return;
      }
      const felder = fokusListe(fenster);
      if (felder.length === 0) {
        ereignis.preventDefault();
        fenster.focus({ preventScroll: true });
        return;
      }
      const erst = felder[0];
      const letzt = felder[felder.length - 1];
      const aktivElement = document.activeElement;
      const innen = aktivElement instanceof HTMLElement && fenster.contains(aktivElement) && felder.includes(aktivElement);
      if (!innen) {
        ereignis.preventDefault();
        (ereignis.shiftKey ? letzt : erst)?.focus({ preventScroll: true });
        return;
      }
      if (ereignis.shiftKey && aktivElement === erst) {
        ereignis.preventDefault();
        letzt?.focus({ preventScroll: true });
      } else if (!ereignis.shiftKey && aktivElement === letzt) {
        ereignis.preventDefault();
        erst?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', beiTab);
    return () => {
      window.cancelAnimationFrame(rahmen);
      window.removeEventListener('keydown', beiTab);
    };
  }, [aktiv, fensterRef]);
}

function schnappschuss(wurzel: HTMLElement): string {
  const teile: string[] = [];
  wurzel.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        teile.push(`${el.name}:${el.value}:${el.checked}`);
      } else if (el.type !== 'hidden') {
        teile.push(el.value);
      }
    } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      teile.push(el.value);
    }
  });
  wurzel.querySelectorAll('[role="switch"], [role="radio"], [aria-pressed]').forEach((el) => {
    teile.push(`${el.getAttribute('aria-checked')}|${el.getAttribute('aria-pressed')}`);
  });
  return teile.join('\u001f');
}

function DialogSchicht({
  titel,
  info,
  vorTitel,
  art,
  menu,
  onSchliessen,
  onDreckig,
  children,
}: {
  titel: string;
  info?: string;
  vorTitel?: ReactNode;
  art: 'blatt' | 'warnung';
  menu?: ReactNode;
  onSchliessen: () => void;
  onDreckig?: (dreckig: boolean) => void;
  children: ReactNode;
}) {
  const [anwesend, entfernen] = usePresence();
  const entfernenRef = useRef(entfernen);
  entfernenRef.current = entfernen;
  const [bereit, setBereit] = useState(false);
  const fensterRef = useRef<HTMLDivElement>(null);
  const basis = useRef('');
  const benutzer = useRef(false);
  const melde = useRef(onDreckig);
  melde.current = onDreckig;
  const zug = useRef<{ id: number; y: number } | null>(null);

  useEffect(() => {
    if (!anwesend) {
      const timer = window.setTimeout(() => entfernenRef.current?.(), AUSBLENDEN_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setBereit(true), 0);
    return () => window.clearTimeout(timer);
  }, [anwesend]);

  useFokusKreis(Boolean(anwesend), fensterRef);

  useLayoutEffect(() => {
    if (!anwesend || art !== 'blatt' || benutzer.current) {
      return;
    }
    const fenster = fensterRef.current;
    if (!fenster) {
      return;
    }
    const formular = fenster.querySelector<HTMLElement>('.formular');
    basis.current = formular ? schnappschuss(formular) : '';
    melde.current?.(false);
  });

  useEffect(() => {
    if (!anwesend || art !== 'blatt') {
      return;
    }
    const fenster = fensterRef.current;
    if (!fenster) {
      return;
    }
    const markiere = (ereignis: Event) => {
      const ziel = ereignis.target;
      if (!(ziel instanceof Element) || !fenster.contains(ziel)) {
        return;
      }
      const formular = ziel.closest('.formular');
      if (!(formular instanceof HTMLElement) || !fenster.contains(formular)) {
        return;
      }
      const feld = ziel.closest('input, textarea, select, [role="switch"], [role="radio"], [aria-pressed]');
      if (!feld || !formular.contains(feld)) {
        return;
      }
      benutzer.current = true;
      window.requestAnimationFrame(() => {
        const jetzt = schnappschuss(formular);
        melde.current?.(jetzt !== basis.current);
      });
    };
    fenster.addEventListener('input', markiere, true);
    fenster.addEventListener('change', markiere, true);
    fenster.addEventListener('click', markiere, true);
    return () => {
      fenster.removeEventListener('input', markiere, true);
      fenster.removeEventListener('change', markiere, true);
      fenster.removeEventListener('click', markiere, true);
    };
  }, [anwesend, art]);

  const eingabe = anwesend && bereit;

  const beiZugStart = (ereignis: React.PointerEvent<HTMLElement>) => {
    if (art !== 'blatt' || !eingabe || window.matchMedia('(min-width: 768px)').matches) {
      return;
    }
    const ziel = ereignis.target;
    if (ziel instanceof Element && ziel.closest('button, a, input, textarea, select')) {
      return;
    }
    zug.current = { id: ereignis.pointerId, y: ereignis.clientY };
  };

  const beiZugBewegung = (ereignis: React.PointerEvent<HTMLElement>) => {
    if (!zug.current || zug.current.id !== ereignis.pointerId) {
      return;
    }
    const fenster = fensterRef.current;
    if (!fenster) {
      return;
    }
    const dy = Math.max(0, ereignis.clientY - zug.current.y);
    fenster.style.transform = dy === 0 ? '' : `translateY(${dy}px)`;
  };

  const beiZugEnde = (ereignis: React.PointerEvent<HTMLElement>) => {
    if (!zug.current || zug.current.id !== ereignis.pointerId) {
      return;
    }
    const dy = Math.max(0, ereignis.clientY - zug.current.y);
    zug.current = null;
    const fenster = fensterRef.current;
    if (fenster) {
      fenster.style.transform = '';
    }
    if (dy >= ZUG_SCHWELLE) {
      onSchliessen();
    }
  };

  const rolle = art === 'warnung' ? 'alertdialog' : 'dialog';

  return (
    <div className={`fixed inset-0 z-[90] ${eingabe ? '' : 'pointer-events-none'}`}>
      <div
        className={`dialog-scrim absolute inset-0 transition-opacity duration-150 ${anwesend ? 'opacity-100' : 'opacity-0'}`}
        onPointerDown={(ereignis) => {
          if (eingabe && ereignis.target === ereignis.currentTarget) {
            ereignis.preventDefault();
            onSchliessen();
          }
        }}
      />
      <div
        className={`dialog-schicht pointer-events-none absolute inset-x-0 flex justify-center ${
          art === 'warnung' ? 'items-center p-4' : 'items-end md:items-center md:p-6'
        }`}
      >
        <div
          ref={fensterRef}
          tabIndex={-1}
          role={anwesend ? rolle : undefined}
          aria-modal={anwesend ? true : undefined}
          aria-hidden={anwesend ? undefined : true}
          inert={anwesend ? undefined : true}
          aria-label={anwesend ? titel : undefined}
          data-art={art}
          onClick={(ereignis) => {
            if (art !== 'blatt') {
              return;
            }
            const ziel = ereignis.target;
            if (!(ziel instanceof Element)) {
              return;
            }
            const link = ziel.closest('a');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) {
              return;
            }
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) {
              return;
            }
            onSchliessen();
          }}
          className={`dialog-fenster pointer-events-auto relative flex min-h-0 flex-col border border-rand bg-flaeche transition-opacity duration-150 ${
            art === 'warnung' ? 'dialog-warnung' : 'dialog-blatt'
          } ${anwesend ? 'opacity-100' : 'opacity-0'}`}
        >
          {art === 'blatt' ? (
            <div
              className="dialog-zug"
              onPointerDown={beiZugStart}
              onPointerMove={beiZugBewegung}
              onPointerUp={beiZugEnde}
              onPointerCancel={beiZugEnde}
            >
              <div className="dialog-griff md:hidden" aria-hidden="true" />
              <header className="dialog-kopf flex h-14 shrink-0 items-center gap-2 ps-5 pe-1">
                <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">
                  {vorTitel}
                  <span>{titel}</span>
                </h2>
                {info ? <InfoHinweis text={info} name={titel} /> : null}
                <div className="flex shrink-0 items-center">
                  {menu}
                  <button
                    type="button"
                    onClick={onSchliessen}
                    aria-label={tx('Schließen')}
                    className="flex size-12 items-center justify-center rounded-full text-leise transition hover:bg-flaeche-2 hover:text-haupt"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </header>
            </div>
          ) : (
            <header className="flex shrink-0 items-start px-5 pt-5 pb-1">
              <h2 className="min-w-0 text-[17px] font-semibold text-balance">
                {vorTitel}
                <span>{titel}</span>
              </h2>
              {info ? <InfoHinweis text={info} name={titel} /> : null}
            </header>
          )}
          <div className="dialog-koerper min-h-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function verlaufOeffnen(schliessen: () => void): { kennung: symbol; raeumen: () => void } {
  const kennung = Symbol('dialog');
  const id = `d${(laufnummer += 1)}`;
  const eintrag: VerlaufDialog = {
    id,
    href: location.href,
    schliessen,
    vomVerlauf: false,
  };
  const vorher = dialogId(history.state);
  schreibeDialog(id, vorher !== null && !verlauf.some((bekannt) => bekannt.id === vorher));
  verlauf.push(eintrag);
  offeneDialoge.push(kennung);
  syncInert();
  return {
    kennung,
    raeumen: () => {
      const index = verlauf.indexOf(eintrag);
      if (index >= 0) {
        verlauf.splice(index, 1);
      }
      const offenIndex = offeneDialoge.indexOf(kennung);
      if (offenIndex >= 0) {
        offeneDialoge.splice(offenIndex, 1);
      }
      syncInert();
      if (eintrag.vomVerlauf) {
        return;
      }
      queueMicrotask(() => {
        if (dialogId(history.state) !== id) {
          return;
        }
        eigenesPop = true;
        history.back();
      });
    },
  };
}

/** Teilt sich den Zurück-Stapel mit Dialog. Für Schichten, die kein Blatt sind. */
export function useDialogVerlauf(aktiv: boolean, onSchliessen: () => void): void {
  const schliessen = useRef(onSchliessen);
  schliessen.current = onSchliessen;

  useLayoutEffect(() => {
    if (!aktiv) {
      return;
    }
    const { kennung, raeumen } = verlaufOeffnen(() => {
      const oben = verlauf[verlauf.length - 1];
      if (oben) {
        oben.vomVerlauf = true;
      }
      schliessen.current();
    });
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape' && istOberster(kennung)) {
        ereignis.preventDefault();
        schliessen.current();
      }
    };
    const vorherigerUeberlauf = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', beiTaste);
    return () => {
      document.body.style.overflow = vorherigerUeberlauf;
      window.removeEventListener('keydown', beiTaste);
      raeumen();
    };
  }, [aktiv]);
}

export function Dialog({
  offen,
  titel,
  info,
  vorTitel,
  art = 'blatt',
  menu,
  onSchliessen,
  children,
}: {
  offen: boolean;
  titel: string;
  info?: string;
  vorTitel?: ReactNode;
  art?: 'blatt' | 'warnung';
  menu?: ReactNode;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const schliessen = useRef(onSchliessen);
  schliessen.current = onSchliessen;
  const eintragRef = useRef<VerlaufDialog | null>(null);
  const dreckig = useRef(false);
  const artRef = useRef(art);
  artRef.current = art;
  const [frage, setFrage] = useState(false);
  const frageSetzen = useRef(setFrage);
  frageSetzen.current = setFrage;
  const ausloeser = useRef<HTMLElement | null>(null);
  const zuletztOffen = useRef(false);
  if (offen && !zuletztOffen.current) {
    const aktiv = document.activeElement;
    ausloeser.current = aktiv instanceof HTMLElement && aktiv !== document.body ? aktiv : null;
    dreckig.current = false;
  }
  zuletztOffen.current = offen;

  const versuchenRef = useRef<(vomVerlauf: boolean) => void>(() => {});
  versuchenRef.current = (vomVerlauf: boolean) => {
    if (artRef.current === 'blatt' && dreckig.current) {
      if (vomVerlauf && eintragRef.current) {
        schreibeDialog(eintragRef.current.id, false);
      }
      frageSetzen.current(true);
      return;
    }
    if (vomVerlauf && eintragRef.current) {
      eintragRef.current.vomVerlauf = true;
    }
    schliessen.current();
  };

  useLayoutEffect(() => {
    if (!offen) {
      return;
    }
    const kennung = Symbol('dialog');
    const id = `d${(laufnummer += 1)}`;
    const eintrag: VerlaufDialog = {
      id,
      href: location.href,
      schliessen: () => versuchenRef.current(true),
      vomVerlauf: false,
    };
    eintragRef.current = eintrag;
    const vorher = dialogId(history.state);
    schreibeDialog(id, vorher !== null && !verlauf.some((bekannt) => bekannt.id === vorher));
    verlauf.push(eintrag);
    offeneDialoge.push(kennung);
    syncInert();
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape' && istOberster(kennung)) {
        ereignis.preventDefault();
        versuchenRef.current(false);
      }
    };
    const vorherigerUeberlauf = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', beiTaste);
    return () => {
      const index = verlauf.indexOf(eintrag);
      if (index >= 0) {
        verlauf.splice(index, 1);
      }
      const offenIndex = offeneDialoge.indexOf(kennung);
      if (offenIndex >= 0) {
        offeneDialoge.splice(offenIndex, 1);
      }
      syncInert();
      document.body.style.overflow = vorherigerUeberlauf;
      window.removeEventListener('keydown', beiTaste);
      if (eintragRef.current === eintrag) {
        eintragRef.current = null;
      }
      const ziel = ausloeser.current;
      if (ziel?.isConnected) {
        ziel.focus({ preventScroll: true });
      } else if (offeneDialoge.length === 0) {
        const seite = document.querySelector('h1');
        if (seite instanceof HTMLElement) {
          if (!seite.hasAttribute('tabindex')) {
            seite.tabIndex = -1;
          }
          seite.focus({ preventScroll: true });
        }
      }
      if (eintrag.vomVerlauf) {
        return;
      }
      queueMicrotask(() => {
        if (dialogId(history.state) !== id) {
          return;
        }
        eigenesPop = true;
        history.back();
      });
    };
  }, [offen]);

  const verwerfen = () => {
    dreckig.current = false;
    setFrage(false);
    onSchliessen();
  };

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {offen && (
            <DialogSchicht
              key="dialog"
              titel={titel}
              info={info}
              vorTitel={vorTitel}
              art={art}
              menu={menu}
              onSchliessen={() => versuchenRef.current(false)}
              onDreckig={(wert) => {
                dreckig.current = wert;
              }}
            >
              {children}
            </DialogSchicht>
          )}
        </AnimatePresence>,
        document.body,
      )}
      {art === 'blatt' ? (
        <Dialog offen={offen && frage} titel={tx('Änderungen verwerfen?')} art="warnung" onSchliessen={() => setFrage(false)}>
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-leise">{tx('Die Eingaben in diesem Blatt gehen verloren.')}</p>
            <div className="dialog-aktionen">
              <Knopf autoFocus onClick={() => setFrage(false)}>
                {tx('Weiter bearbeiten')}
              </Knopf>
              <Knopf variante="warnung" onClick={verwerfen}>
                {tx('Verwerfen')}
              </Knopf>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
